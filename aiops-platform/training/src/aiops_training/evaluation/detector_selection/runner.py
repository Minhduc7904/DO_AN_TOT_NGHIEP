"""Chạy các bước chọn trên validation (evaluation-protocol-v1 mục 6.1.2, 6.1.3; task-06 tuần 16).

Thứ tự: `setup` → `step1` (12 tổ hợp robust z) → `step2a` (4 bộ tham số incident) → `step2b`
(ngưỡng tĩnh, Isolation Forest, fused) → `freeze`. Mỗi bước đọc lựa chọn của bước trước từ file
`selection-*.json` (kiểm sha256 với ledger), ghi mọi lần chấm vào ledger và không chấm lại tổ hợp
đã có trong ledger. Chạy lại một bước bị dừng giữa chừng thì đọc lại đúng những gì đã ghi (kiểm
sha256) và chỉ chấm nốt phần còn thiếu; chấm lại để tái lập thì dùng thư mục kết quả khác.

Đầu ra nhỏ (config sinh từ ứng viên, evaluation artifact, lựa chọn, ledger) nằm trong `out_dir`
(mặc định `evaluations/validation-v1/`, được commit). Đầu ra trung gian lớn (bảng anomalies,
incident record của mọi tổ hợp, điểm train) nằm trong `work_dir` (mặc định
`artifacts/validation-v1/`, không commit). Model Isolation Forest ghi vào `models/` (joblib không
commit, metadata `.json` chép vào `out_dir/models/`).
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow.parquet as pq

from ...anomaly.detectors import build_detector
from ...anomaly.iforest import fit_models, load_models, save_models
from ...anomaly.run import detect
from ...features.leakage import check_leakage, is_healthy
from ...features.pipeline import features_dir_name
from ...incident.run import build_incidents, load_config, write_incidents
from ..detection.config import (
    DEFAULT_EVALUATION_CONFIG,
    TRAINING_ROOT,
    load_evaluation_config,
)
from ..detection.harness import evaluate_detection, sha256_file, slots_from_dataset
from ..detection.selection import combination_from_artifact, select_combination
from .candidates import (
    PREFIX,
    Combination,
    iforest_section,
    incident_identity_sha256,
    quantile_key,
    quantile_scores,
    step1_combinations,
    step1_id,
    step2a_combinations,
    step2b_combinations,
    write_config,
)
from .ledger import CANDIDATES_V2_MERGE_COMMIT, Ledger, LedgerError, scoring_code

E1_DETECTORS = ("static", "robust_z", "iforest", "fused")
STEP2B_DETECTORS = ("static", "iforest", "fused")


class SelectionError(RuntimeError):
    pass


@dataclass
class Context:
    runs_dir: Path
    load_dir: Path
    training_root: Path = TRAINING_ROOT
    dataset_path: Path | None = None
    out_dir: Path | None = None
    work_dir: Path | None = None
    evaluation_config_path: Path = DEFAULT_EVALUATION_CONFIG
    required_commit: str = CANDIDATES_V2_MERGE_COMMIT
    _models: dict[int, tuple[Path, Any]] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        root = self.training_root
        self.dataset_path = self.dataset_path or (
            root.parent / "experiments" / "datasets" / "dataset-v0.json"
        )
        # Lượt chính ghi config đã freeze vào `configs/`; lượt tái lập (`--out-dir` khác) ghi vào
        # thư mục kết quả của chính nó để không đụng config đã commit.
        self.freeze_dir = root / "configs" if self.out_dir is None else self.out_dir / "frozen"
        self.models_dir = root / "models" if self.out_dir is None else self.out_dir / "models-bin"
        self.out_dir = self.out_dir or root / "evaluations" / "validation-v1"
        self.work_dir = self.work_dir or root / "artifacts" / "validation-v1"
        self.v1_path = root / "configs" / "detection-candidates-v1.json"
        self.v2_path = root / "configs" / "detection-candidates-v2.json"
        self.v1 = json.loads(self.v1_path.read_text("utf-8"))
        self.v2 = json.loads(self.v2_path.read_text("utf-8"))
        self.dataset = json.loads(self.dataset_path.read_text("utf-8"))
        self.evaluation_config = load_evaluation_config(self.evaluation_config_path)
        self.ledger = Ledger(self.out_dir / "ledger.jsonl")

    @property
    def candidate_set_version(self) -> str:
        return self.v2["candidate_set_version"]

    def code(self) -> dict[str, Any]:
        return scoring_code(self.training_root, self.required_commit)

    def validation_slots(self):
        return slots_from_dataset(self.dataset, "validation")

    def validation_runs(self) -> list[str]:
        return [slot.run_id for slot in self.validation_slots() if slot.run_id]

    def train_runs(self) -> list[str]:
        return sorted(
            slot["run_id"]
            for slot in self.dataset["slots"]
            if slot.get("run_id") and slot["split"] == "train" and is_healthy(slot)
        )

    def windows(self) -> list[int]:
        return sorted({int(p["window_seconds"]) for p in self.v1["window_persistence"]})

    def features_dir(self, run_id: str, window_seconds: int) -> Path:
        return self.runs_dir / run_id / "telemetry" / features_dir_name(window_seconds)

    def baseline_path(self, window_seconds: int) -> Path:
        return self.training_root / "baselines" / f"dataset-v0-w{window_seconds}.json"

    def rel(self, path: Path) -> str:
        try:
            return str(path.resolve().relative_to(self.training_root.resolve()))
        except ValueError:
            return str(path)

    def path(self, rel: str) -> Path:
        return self.training_root / rel


def _write_json(path: Path, data: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return sha256_file(path)


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text("utf-8"))


def _verified(ctx: Context, rel: str, sha: str, what: str) -> Path:
    path = ctx.path(rel)
    if not path.exists() or sha256_file(path) != sha:
        raise LedgerError(f"{what}: {rel} thiếu hoặc khác sha256 đã ghi trong ledger")
    return path


# --- setup ---------------------------------------------------------------------------------------


def input_hashes(ctx: Context) -> dict[str, Any]:
    """sha256 của mọi đầu vào cố định; mọi bước so lại với dòng `setup` của ledger."""

    def ref(path: Path) -> dict[str, str]:
        return {"path": ctx.rel(path), "sha256": sha256_file(path)}

    return {
        "candidates_v1": ref(ctx.v1_path),
        "candidates_v2": ref(ctx.v2_path),
        "evaluation_config": {
            **ref(ctx.evaluation_config_path),
            "version": ctx.evaluation_config.version,
        },
        "dataset_manifest": {**ref(ctx.dataset_path), "dataset_id": ctx.dataset.get("dataset_id")},
        "baselines": {str(w): ref(ctx.baseline_path(w)) for w in ctx.windows()},
    }


def setup(ctx: Context) -> dict[str, Any]:
    """Kiểm điều kiện chấm, baseline đã apply, leakage; ghi sha của mọi đầu vào vào ledger."""
    code = ctx.code()
    if ctx.ledger.find("setup"):
        return _require_setup(ctx)
    inputs = input_hashes(ctx)
    leakage = {}
    for window in ctx.windows():
        sha = inputs["baselines"][str(window)]["sha256"]
        for run_id in ctx.train_runs() + ctx.validation_runs():
            applied = _read_json(ctx.features_dir(run_id, window) / "baseline-apply.json")
            if applied.get("baseline_sha256") != sha or int(applied.get("window_s") or 0) != window:
                raise SelectionError(
                    f"{run_id}: bảng z cửa sổ {window} s không apply baseline "
                    f"dataset-v0-w{window}.json (sha {applied.get('baseline_sha256')}, cửa sổ "
                    f"{applied.get('window_s')})"
                )
        dirs = {
            run_id: ctx.features_dir(run_id, window)
            for run_id in ctx.train_runs() + ctx.validation_runs()
        }
        errors = check_leakage(
            ctx.dataset,
            _read_json(ctx.baseline_path(window)),
            dirs,
            manifest_sha256=sha256_file(ctx.dataset_path),
        )
        if errors:
            raise SelectionError(f"check-leakage cửa sổ {window} s báo lỗi: {errors}")
        leakage[str(window)] = {"runs_checked": sorted(dirs), "errors": errors}
    return ctx.ledger.append(
        "setup",
        code=code,
        **inputs,
        check_leakage=leakage,
        validation_runs=ctx.validation_runs(),
        train_runs=ctx.train_runs(),
    )


def _require_same_code(ctx: Context, code: dict[str, Any]) -> None:
    """Mọi lần chấm của lượt chọn chạy trên cùng nội dung code đã ghi ở `setup`."""
    expected = _require_setup(ctx)["code"]["code_tree"]
    if code["code_tree"] != expected:
        raise LedgerError(
            f"Code đã đổi so với lúc setup ({code['code_tree']} ≠ {expected}): không trộn vào lượt "
            "chọn này; bắt đầu ledger mới và chấm lại toàn bộ"
        )


def _require_setup(ctx: Context) -> dict[str, Any]:
    entries = ctx.ledger.find("setup")
    if not entries:
        raise SelectionError("Chưa chạy setup: ledger chưa có dòng setup")
    entry = entries[0]
    current = input_hashes(ctx)
    changed = sorted(name for name, value in current.items() if entry.get(name) != value)
    if changed:
        raise SelectionError(
            f"Đầu vào đã đổi so với lúc setup: {changed}. Không trộn vào lượt chọn này; bắt đầu "
            "ledger mới (thư mục kết quả mới)"
        )
    return entry


# --- Isolation Forest và ngưỡng phân vị trên train --------------------------------------------


def model_for(ctx: Context, window_seconds: int) -> tuple[Path, Any]:
    """Model một mỗi service cho độ dài cửa sổ, fit trên 4 run train khỏe.

    Fit lần đầu và ghi `fit_model` vào ledger; các lần sau model phải khớp sha256 đã ghi (file
    joblib không commit: mất thì fit lại và phải ra đúng sha256 cũ).
    """
    if window_seconds in ctx._models:
        return ctx._models[window_seconds]
    path = ctx.models_dir / f"iforest-{PREFIX}-w{window_seconds}.joblib"
    section = iforest_section(ctx.v2, threshold=0.0)
    recorded = ctx.ledger.find("fit_model", window_seconds=window_seconds)
    if not path.exists() or not recorded:
        code = ctx.code()
        _require_same_code(ctx, code)
        doc = {
            "detector_config_version": f"{PREFIX}.iforest-fit-w{window_seconds}",
            "candidate_set_version": ctx.candidate_set_version,
            "detectors": {
                "iforest": {"seed": section["seed"], "hyperparameters": section["hyperparameters"]}
            },
        }
        config_path = ctx.out_dir / "configs" / "train" / f"iforest-fit-w{window_seconds}.json"
        config_sha = write_config(doc, config_path)
        runs = {run_id: ctx.features_dir(run_id, window_seconds) for run_id in ctx.train_runs()}
        models, metadata = fit_models(
            runs,
            section["hyperparameters"],
            seed=section["seed"],
            provenance={
                "detector_config_version": doc["detector_config_version"],
                "detector_config_sha256": config_sha,
                "dataset_id": ctx.dataset.get("dataset_id"),
                "dataset_manifest_sha256": sha256_file(ctx.dataset_path),
                "code_commit": code["commit"],
                "code_dirty": code["dirty"],
            },
        )
        full = save_models(models, metadata, path)
        if recorded and full["model_sha256"] != recorded[0]["model_sha256"]:
            raise SelectionError(
                f"{path}: fit lại cho sha256 {full['model_sha256']}, khác sha256 đã ghi "
                f"{recorded[0]['model_sha256']}"
            )
        if not recorded:
            ctx.ledger.append(
                "fit_model",
                window_seconds=window_seconds,
                model_file=ctx.rel(path),
                model_sha256=full["model_sha256"],
                fit_runs=full["fit_runs"],
                baseline_sha256=full["baseline_sha256"],
                config=ctx.rel(config_path),
                config_sha256=config_sha,
                code_commit=code["commit"],
            )
            recorded = ctx.ledger.find("fit_model", window_seconds=window_seconds)
    model = load_models(path)
    metadata = model[1]
    expected = {
        "model_sha256": recorded[0]["model_sha256"],
        "baseline_sha256": sha256_file(ctx.baseline_path(window_seconds)),
        "hyperparameters": section["hyperparameters"],
        "seed": section["seed"],
        "fit_runs": ctx.train_runs(),
        "window_s": window_seconds,
    }
    wrong = {k: (metadata.get(k), v) for k, v in expected.items() if metadata.get(k) != v}
    if wrong:
        raise SelectionError(f"{path}: model không khớp luật cố định/ledger: {wrong}")
    copy = ctx.out_dir / "models" / (path.name + ".json")
    copy.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path.with_suffix(path.suffix + ".json"), copy)
    ctx._models[window_seconds] = (path, model)
    return ctx._models[window_seconds]


def quantile_values(rows: list[dict[str, Any]]) -> np.ndarray:
    """Điểm vào phân vị: bỏ warm-up, im lặng, `flagged` rỗng, điểm rỗng (luật phân vị của v2)."""
    values = [
        r["score"]
        for r in rows
        if not r["warmup"]
        and r["reason"] != "telemetry_silent"
        and r["flagged"] is not None
        and r["score"] is not None
    ]
    array = np.asarray(values, dtype=float)
    if array.size == 0:
        raise SelectionError("Không có điểm nào để tính phân vị")
    if not np.all(np.isfinite(array)):
        raise SelectionError("Có điểm vô hạn trong điểm train: phân vị tuyến tính không xác định")
    return array


def train_thresholds(ctx: Context, window_seconds: int) -> dict[str, Any]:
    """Ngưỡng phân vị của Isolation Forest và fused trên 4 run train khỏe (không đọc validation)."""
    path = ctx.out_dir / f"train-thresholds-w{window_seconds}.json"
    recorded = ctx.ledger.find("train_thresholds", window_seconds=window_seconds)
    if recorded and path.exists():
        return _read_json(_verified(ctx, recorded[0]["file"], recorded[0]["sha256"], "ngưỡng"))
    if path.exists():
        raise LedgerError(f"{path} có sẵn nhưng ledger không có dòng train_thresholds")
    rule = ctx.v2["quantile_threshold_rule"]
    if rule.get("interpolation") != "numpy.quantile, method = linear":
        raise SelectionError(f"Luật nội suy của v2 không như đã cài: {rule.get('interpolation')}")
    model_path, model = model_for(ctx, window_seconds)
    result: dict[str, Any] = {
        "window_seconds": window_seconds,
        "train_runs": ctx.train_runs(),
        "baseline_sha256": sha256_file(ctx.baseline_path(window_seconds)),
        "model_sha256": model[1]["model_sha256"],
        "quantiles": rule["quantiles"],
        "scores": {},
        "thresholds": {},
    }
    for name, detector_name, partial in quantile_scores(ctx.v2):
        # Ngưỡng giữ chỗ không đổi điểm; chỉ đọc cột score.
        section = (
            iforest_section(ctx.v2, threshold=1.0)
            if detector_name == "iforest"
            else {"threshold": 1.0, **partial}
        )
        doc = {
            "detector_config_version": f"{PREFIX}.train-scores-{name}-w{window_seconds}",
            "candidate_set_version": ctx.candidate_set_version,
            "detectors": {detector_name: section},
        }
        config_path = ctx.out_dir / "configs" / "train" / f"scores-{name}-w{window_seconds}.json"
        write_config(doc, config_path)
        used = model if detector_name == "iforest" else None
        rows: list[dict[str, Any]] = []
        for run_id in ctx.train_runs():
            out = ctx.work_dir / "train-scores" / f"w{window_seconds}" / name / run_id
            detect(
                ctx.features_dir(run_id, window_seconds),
                build_detector(detector_name, section, used),
                out,
                config={"detector_config_version": doc["detector_config_version"], **section},
                config_path=config_path,
                model_metadata=used[1] if used else None,
            )
            rows += pq.read_table(out / f"anomalies-{detector_name}.parquet").to_pylist()
        values = quantile_values(rows)
        result["scores"][name] = {"n_values": int(values.size), "max": float(values.max())}
        for q in rule["quantiles"]:
            result["thresholds"][quantile_key(name, q)] = float(
                np.quantile(values, q, method="linear")
            )
    sha = _write_json(path, result)
    if recorded and sha != recorded[0]["sha256"]:
        raise SelectionError(f"{path}: tính lại cho sha256 khác ledger")
    if not recorded:
        ctx.ledger.append(
            "train_thresholds",
            window_seconds=window_seconds,
            file=ctx.rel(path),
            sha256=sha,
            baseline_sha256=result["baseline_sha256"],
            model_sha256=result["model_sha256"],
            model_file=ctx.rel(model_path),
            thresholds=result["thresholds"],
        )
    return result


# --- chấm một tổ hợp ---------------------------------------------------------------------------


def _anomalies(ctx: Context, combo: Combination, config_path: Path, config_sha: str, run_id: str):
    model = model_for(ctx, combo.window_seconds)[1] if combo.detector == "iforest" else None
    out = (
        ctx.work_dir / "anomalies" / f"w{combo.window_seconds}" / combo.detector_config_version
    ) / run_id
    table = out / f"anomalies-{combo.detector}.parquet"
    manifest_path = table.with_suffix(".json")
    if table.exists() and manifest_path.exists():
        manifest = _read_json(manifest_path)
        cached = (
            manifest.get("detector_config_sha256") == config_sha
            and manifest.get("output_sha256") == sha256_file(table)
            and (manifest.get("lineage") or {}).get("model_sha256")
            == (model[1]["model_sha256"] if model else None)
        )
        if cached:
            return table
    detect(
        ctx.features_dir(run_id, combo.window_seconds),
        build_detector(combo.detector, combo.detector_section, model),
        out,
        config={"detector_config_version": combo.detector_config_version, **combo.detector_section},
        config_path=config_path,
        model_metadata=model[1] if model else None,
    )
    return table


def check_binding(
    artifact: dict[str, Any],
    combo: Combination,
    detector_sha: str,
    incident_sha: str,
    model_sha: str | None,
) -> None:
    """`candidate_binding` của v2: artifact phải đúng là tổ hợp sinh từ ứng viên."""
    expected = {
        "detector": combo.detector,
        "detector_config_version": combo.detector_config_version,
        "incident_config_version": combo.incident_config_version,
        "detector_config_sha256": detector_sha,
        "incident_config_sha256": incident_sha,
        "model_sha256": model_sha,
        "window_seconds": combo.window_seconds,
        "persistence_windows": combo.persistence_windows,
    }
    if "threshold" in combo.detector_section:
        expected["threshold"] = float(combo.detector_section["threshold"])
    wrong = {k: (artifact.get(k), v) for k, v in expected.items() if artifact.get(k) != v}
    if wrong:
        raise SelectionError(f"{combo.combination_id}: artifact không khớp ứng viên: {wrong}")


def _combo_configs(ctx: Context, combo: Combination) -> tuple[Path, str, Path, str]:
    version = ctx.candidate_set_version
    detector_path = ctx.out_dir / "configs" / "detector" / f"{combo.detector_config_version}.json"
    detector_sha = write_config(combo.detector_config(version), detector_path)
    incident_path = ctx.out_dir / "configs" / "incident" / f"{combo.incident_config_version}.json"
    write_config(combo.incident_config(version), incident_path)
    return detector_path, detector_sha, incident_path, incident_identity_sha256(incident_path)


def score(ctx: Context, combo: Combination) -> dict[str, Any]:
    """Chấm một tổ hợp trên validation, ghi artifact và một dòng `score` vào ledger.

    Tổ hợp đã có dòng `score` không chấm lại: đọc lại artifact, kiểm sha256 với ledger. Mọi lần
    chấm của một bước phải chạy trên cùng một commit. Dòng `score_started`/`score_failed` ghi lại cả
    lần chấm không ra artifact.
    """
    code = ctx.code()
    done = ctx.ledger.find("score", step=combo.step, combination_id=combo.combination_id)
    if done:
        return _read_json(
            _verified(ctx, done[-1]["artifact"], done[-1]["artifact_sha256"], combo.combination_id)
        )
    path = ctx.out_dir / f"step{combo.step}" / f"{combo.combination_id}.json"
    if path.exists():
        raise LedgerError(f"{path} có sẵn nhưng ledger không có dòng score: không ghi đè")
    _require_same_code(ctx, code)
    detector_path, detector_sha, incident_path, incident_sha = _combo_configs(ctx, combo)
    model_sha = (
        model_for(ctx, combo.window_seconds)[1][1]["model_sha256"]
        if combo.detector == "iforest"
        else None
    )
    ctx.ledger.append(
        "score_started",
        step=combo.step,
        combination_id=combo.combination_id,
        code_commit=code["commit"],
    )
    try:
        incident_config = load_config(incident_path)
        incidents_dir = ctx.work_dir / "incidents" / f"step{combo.step}" / combo.combination_id
        for run_id in ctx.validation_runs():
            table = _anomalies(ctx, combo, detector_path, detector_sha, run_id)
            record = build_incidents(table, incident_config, incident_path)
            write_incidents(record, incidents_dir / f"{run_id}.json")
        artifact = evaluate_detection(
            ctx.validation_slots(),
            runs_dir=ctx.runs_dir,
            incidents_template=str(incidents_dir / "{run_id}.json"),
            config=ctx.evaluation_config,
            config_path=ctx.evaluation_config_path,
            load_dir=ctx.load_dir,
            dataset=ctx.dataset,
            dataset_path=ctx.dataset_path,
            split="validation",
            bootstrap=False,
            code={"commit": code["commit"], "dirty": code["dirty"]},
        )
        check_binding(artifact, combo, detector_sha, incident_sha, model_sha)
        summary = artifact["summary"]
        if summary["peak_unavailable_by_reason"]:
            raise SelectionError(
                f"{combo.combination_id}: không tính được đoạn cao điểm "
                f"{summary['peak_unavailable_by_reason']} (kiểm --load-dir)"
            )
        sha = _write_json(path, artifact)
    except Exception as error:
        ctx.ledger.append(
            "score_failed",
            step=combo.step,
            combination_id=combo.combination_id,
            code_commit=code["commit"],
            error=f"{type(error).__name__}: {error}",
        )
        raise
    rate = summary["false_alarm_rate"]
    ctx.ledger.append(
        "score",
        step=combo.step,
        combination_id=combo.combination_id,
        tie_rank=combo.tie_rank,
        candidate=combo.meta,
        detector=combo.detector,
        window_seconds=combo.window_seconds,
        persistence_windows=combo.persistence_windows,
        threshold=artifact["threshold"],
        detector_config_version=combo.detector_config_version,
        detector_config_sha256=detector_sha,
        incident_config_version=combo.incident_config_version,
        incident_config_sha256=incident_sha,
        model_sha256=model_sha,
        artifact=ctx.rel(path),
        artifact_sha256=sha,
        evaluation_artifact_id=artifact["evaluation_artifact_id"],
        code_commit=code["commit"],
        eligible_run_ids=summary["eligible_run_ids"],
        excluded_by_reason=summary["excluded_by_reason"],
        matched_fault_runs=summary["matched_fault_runs"],
        false_alarms=rate["false_alarms"],
        exposure_us=rate["exposure_us"],
        false_alarms_per_hour=rate["per_hour"],
        meets_cap=rate["meets_cap"],
    )
    return artifact


# --- lựa chọn -----------------------------------------------------------------------------------


def _existing_selection(ctx: Context, step: str) -> dict[str, Any] | None:
    """Lựa chọn đã ghi của bước (kiểm sha256 với ledger), hoặc None nếu bước chưa chọn."""
    path = ctx.out_dir / f"selection-step{step}.json"
    entries = ctx.ledger.find("select", step=step)
    if entries:
        return _read_json(_verified(ctx, entries[-1]["file"], entries[-1]["sha256"], step))
    if path.exists():
        raise LedgerError(f"{path} có sẵn nhưng ledger không có dòng select")
    return None


def _selection(ctx: Context, step: str) -> dict[str, Any]:
    selection = _existing_selection(ctx, step)
    if selection is None:
        raise SelectionError(f"Bước {step} chưa chọn: chạy bước đó trước")
    return selection


def _select(
    ctx: Context,
    step: str,
    combos: list[Combination],
    artifacts: dict[str, dict[str, Any]],
    use_tie_rank: bool,
) -> dict[str, Any]:
    results = [
        combination_from_artifact(artifacts[c.combination_id], c.combination_id) for c in combos
    ]
    tie_rank = {c.combination_id: c.tie_rank for c in combos} if use_tie_rank else None
    selection = select_combination(results, tie_rank=tie_rank)
    chosen = next(c for c in combos if c.combination_id == selection["selected"])
    paths = {c.combination_id: _artifact_path(ctx, c, artifacts) for c in combos}
    selection.update(
        {
            "step": step,
            "candidate_set_version": ctx.candidate_set_version,
            "chosen": {
                "combination_id": chosen.combination_id,
                "detector": chosen.detector,
                "window_seconds": chosen.window_seconds,
                "persistence_windows": chosen.persistence_windows,
                "detector_section": chosen.detector_section,
                "incident": chosen.incident,
                "detector_config_version": chosen.detector_config_version,
                "incident_config_version": chosen.incident_config_version,
                "candidate": chosen.meta,
            },
            "artifacts": {cid: ctx.rel(p) for cid, p in paths.items()},
            "artifact_sha256": {cid: sha256_file(p) for cid, p in paths.items()},
        }
    )
    path = ctx.out_dir / f"selection-step{step}.json"
    sha = _write_json(path, selection)
    ctx.ledger.append(
        "select",
        step=step,
        selected=selection["selected"],
        meets_cap=selection["meets_cap"],
        rule_applied=selection["rule_applied"],
        tie_break=selection["tie_break"],
        file=ctx.rel(path),
        sha256=sha,
    )
    return selection


def _artifact_path(ctx: Context, combo: Combination, artifacts: dict[str, Any]) -> Path:
    reused = artifacts[combo.combination_id].get("_reused_from")
    if reused:
        return ctx.path(reused)
    return ctx.out_dir / f"step{combo.step}" / f"{combo.combination_id}.json"


# --- các bước ----------------------------------------------------------------------------------


def step1(ctx: Context) -> dict[str, Any]:
    _require_setup(ctx)
    existing = _existing_selection(ctx, "1")
    if existing is not None:
        return existing
    combos = step1_combinations(ctx.v1, ctx.v2)
    artifacts = {c.combination_id: score(ctx, c) for c in combos}
    # Luật v1: late_tolerance nhỏ hơn rồi ngưỡng lớn hơn (không dùng tie_rank).
    return _select(ctx, "1", combos, artifacts, use_tie_rank=False)


def step2a(ctx: Context) -> dict[str, Any]:
    _require_setup(ctx)
    existing = _existing_selection(ctx, "2a")
    if existing is not None:
        return existing
    chosen = _selection(ctx, "1")["chosen"]
    window, persistence = chosen["window_seconds"], chosen["persistence_windows"]
    threshold = chosen["detector_section"]["threshold"]
    combos = step2a_combinations(ctx.v2, window, persistence, threshold)
    reuse_id = step1_id(window, persistence, threshold)
    step1_combo = next(
        c for c in step1_combinations(ctx.v1, ctx.v2) if c.combination_id == reuse_id
    )
    artifacts: dict[str, dict[str, Any]] = {}
    for combo in combos:
        same = (
            combo.incident == step1_combo.incident
            and combo.detector_section == step1_combo.detector_section
        )
        if not same:
            artifacts[combo.combination_id] = score(ctx, combo)
            continue
        # Tổ hợp trùng bước 1 (v2 `reuse`): dùng lại artifact đã ghi ở bước 1, kiểm sha256 với
        # ledger và kiểm nó đúng là tổ hợp này.
        scored = ctx.ledger.find("score", step="1", combination_id=reuse_id)
        if not scored:
            raise LedgerError(f"Bước 1 chưa có dòng score của {reuse_id} để dùng lại")
        path = _verified(ctx, scored[-1]["artifact"], scored[-1]["artifact_sha256"], reuse_id)
        _require_same_code(ctx, ctx.code())
        artifact = _read_json(path)
        _, detector_sha, _, incident_sha = _combo_configs(ctx, combo)
        check_binding(artifact, combo, detector_sha, incident_sha, None)
        if not ctx.ledger.find("reuse", step="2a", combination_id=combo.combination_id):
            ctx.ledger.append(
                "reuse",
                step="2a",
                combination_id=combo.combination_id,
                tie_rank=combo.tie_rank,
                reused_step="1",
                reused_combination_id=reuse_id,
                artifact=ctx.rel(path),
                artifact_sha256=sha256_file(path),
            )
        artifacts[combo.combination_id] = {**artifact, "_reused_from": ctx.rel(path)}
    return _select(ctx, "2a", combos, artifacts, use_tie_rank=True)


def step2b(ctx: Context, detectors: tuple[str, ...] = STEP2B_DETECTORS) -> dict[str, Any]:
    _require_setup(ctx)
    chosen1 = _selection(ctx, "1")["chosen"]
    chosen2a = _selection(ctx, "2a")["chosen"]
    window, persistence = chosen1["window_seconds"], chosen1["persistence_windows"]
    thresholds = train_thresholds(ctx, window)["thresholds"]
    groups = step2b_combinations(ctx.v2, window, persistence, chosen2a["incident"], thresholds)
    out = {}
    for detector in detectors:
        step = f"2b-{detector}"
        existing = _existing_selection(ctx, step)
        if existing is not None:
            out[detector] = existing
            continue
        combos = groups[detector]
        artifacts = {c.combination_id: score(ctx, c) for c in combos}
        out[detector] = _select(ctx, step, combos, artifacts, use_tie_rank=True)
    return out


def e1_choices(ctx: Context) -> dict[str, dict[str, Any]]:
    """Tổ hợp E1 của từng detector: robust z lấy từ bước 2a, ba detector còn lại từ bước 2b."""
    choices = {"robust_z": _selection(ctx, "2a")}
    for detector in STEP2B_DETECTORS:
        choices[detector] = _selection(ctx, f"2b-{detector}")
    out = {}
    for detector, selection in choices.items():
        selected = selection["selected"]
        artifact = _verified(
            ctx, selection["artifacts"][selected], selection["artifact_sha256"][selected], selected
        )
        out[detector] = {"selection": selection, "artifact": artifact}
    return out


def freeze(ctx: Context) -> dict[str, Any]:
    """Freeze config detector/incident của E1 có version và lineage; chép incident record của E1.

    Nếu tiến trình dừng sau khi ghi `configs/*-e1-v1.json` mà trước dòng `freeze` của ledger, lần
    chạy lại bị từ chối vì `configs/` có thay đổi chưa commit: xóa hai file đó rồi chạy lại.
    """
    setup_entry = _require_setup(ctx)
    done = ctx.ledger.find("freeze")
    if done:
        for name in ("detector_config", "incident_config"):
            _verified(ctx, done[-1][name]["file"], done[-1][name]["sha256"], "freeze")
        return done[-1]
    code = ctx.code()
    _require_same_code(ctx, code)
    step1_sel = _selection(ctx, "1")
    window = step1_sel["chosen"]["window_seconds"]
    persistence = step1_sel["chosen"]["persistence_windows"]
    choices = e1_choices(ctx)
    incident = choices["robust_z"]["selection"]["chosen"]["incident"]
    for detector, choice in choices.items():
        chosen = choice["selection"]["chosen"]
        if (chosen["window_seconds"], chosen["persistence_windows"]) != (window, persistence):
            raise SelectionError(f"{detector}: window/persistence khác bước 1")
        if chosen["incident"] != incident:
            raise SelectionError(f"{detector}: tham số incident khác bước 2a")
    model_path, model = model_for(ctx, window)
    # Chép incident record của E1 trước khi ghi config đã freeze (ghi config làm `configs/` có
    # thay đổi chưa commit, các lần chạy sau sẽ bị từ chối cho tới khi commit).
    copied = {}
    for detector, choice in choices.items():
        selection = choice["selection"]
        # Thư mục incident theo artifact thật (tổ hợp dùng lại ở bước 2a trỏ về tổ hợp bước 1).
        artifact = Path(selection["artifacts"][selection["selected"]])
        source = ctx.work_dir / "incidents" / artifact.parent.name / artifact.stem
        target = ctx.out_dir / "e1" / "incidents" / detector
        target.mkdir(parents=True, exist_ok=True)
        # Incident record ở work_dir không commit: chỉ chép khi sha256 khớp artifact đã kiểm.
        refs = {
            row["run_id"]: (row.get("lineage") or {}).get("incident_artifact_ref", {}).get("sha256")
            for row in _read_json(choice["artifact"])["runs"]
        }
        for run_id in ctx.validation_runs():
            file = source / f"{run_id}.json"
            if not file.exists() or sha256_file(file) != refs.get(run_id):
                raise SelectionError(f"{file}: incident record khác bản đã chấm trong artifact")
            shutil.copyfile(file, target / f"{run_id}.json")
        copied[detector] = ctx.rel(target)
    selections = {}
    for step in ("1", "2a", *(f"2b-{d}" for d in STEP2B_DETECTORS)):
        entry = ctx.ledger.find("select", step=step)[-1]
        selections[step] = {"file": entry["file"], "sha256": entry["sha256"]}
    thresholds = ctx.ledger.find("train_thresholds", window_seconds=window)[-1]
    lineage = {
        "candidates_v1": setup_entry["candidates_v1"],
        "candidates_v2": setup_entry["candidates_v2"],
        "evaluation_config": setup_entry["evaluation_config"],
        "dataset_manifest": setup_entry["dataset_manifest"],
        "baseline": setup_entry["baselines"][str(window)],
        "model": {
            "file": ctx.rel(model_path),
            "metadata": ctx.rel(ctx.out_dir / "models" / (model_path.name + ".json")),
            "sha256": model[1]["model_sha256"],
            "fit_runs": model[1]["fit_runs"],
        },
        "train_thresholds": {"file": thresholds["file"], "sha256": thresholds["sha256"]},
        "selections": selections,
        "ledger": {"file": ctx.rel(ctx.ledger.path), "sha256": sha256_file(ctx.ledger.path)},
        "code_commit": code["commit"],
    }
    selected = {}
    for detector in E1_DETECTORS:
        choice = choices[detector]
        artifact = _read_json(choice["artifact"])
        selected[detector] = {
            "combination_id": choice["selection"]["selected"],
            "meets_cap": choice["selection"]["meets_cap"],
            "threshold": artifact["threshold"],
            "artifact": ctx.rel(choice["artifact"]),
            "artifact_sha256": sha256_file(choice["artifact"]),
            "detector_config_version": artifact["detector_config_version"],
            "detector_config_sha256": artifact["detector_config_sha256"],
            "incident_config_version": artifact["incident_config_version"],
            "incident_config_sha256": artifact["incident_config_sha256"],
            "model_sha256": artifact["model_sha256"],
        }
    detector_doc = {
        "detector_config_version": "detector-e1.v1",
        "candidate_set_version": ctx.candidate_set_version,
        "status": "Đã freeze sau khi chọn trên validation (task-06 tuần 16); dùng cho E1 ở test.",
        "window_seconds": window,
        "persistence_windows": persistence,
        "detectors": {
            d: choices[d]["selection"]["chosen"]["detector_section"] for d in E1_DETECTORS
        },
        "selected": selected,
        "lineage": lineage,
    }
    incident_doc = {
        "incident_config_version": "incident-e1.v1",
        "candidate_set_version": ctx.candidate_set_version,
        "status": "Đã freeze sau khi chọn trên validation (task-06 tuần 16); dùng chung cho 4 "
        "detector của E1.",
        "window_seconds": window,
        "incident": incident,
        "selected": selected["robust_z"],
        "lineage": lineage,
    }
    detector_path = ctx.freeze_dir / "detector-e1-v1.json"
    incident_path = ctx.freeze_dir / "incident-e1-v1.json"
    detector_sha = write_config(detector_doc, detector_path)
    incident_sha = write_config(incident_doc, incident_path)
    return ctx.ledger.append(
        "freeze",
        detector_config={"file": ctx.rel(detector_path), "sha256": detector_sha},
        incident_config={"file": ctx.rel(incident_path), "sha256": incident_sha},
        selected=selected,
        e1_incidents=copied,
        code_commit=code["commit"],
    )
