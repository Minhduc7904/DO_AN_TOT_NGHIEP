"""Isolation Forest theo service, fit chỉ trên run train khỏe (analysis blueprint mục 9.4).

- **Vector của một (cửa sổ, service):** mỗi tín hiệu triệu chứng của `SIGNALS` một chiều, theo đúng
  thứ tự đó; giá trị là max z có hướng trên các thực thể của service (bản thân service, các cạnh nó
  gọi, các hàng đợi nó tiêu thụ). Chiều không có giá trị (không có lời gọi, không áp dụng, thiếu
  baseline) điền 0, tức bằng median của train: "không có bằng chứng bất thường". Cách điền này không
  dùng thông tin nào của fault.
- **Scaler** là chính baseline healthy v1 (median và thang đo robust fit trên train); artifact ghi
  sha256 baseline qua `baseline-apply.json` của từng run fit.
- **Một model mỗi service.** Service worker không có tín hiệu HTTP nên các chiều đó luôn 0 trên
  train; cây không tách được chiều hằng nên model của worker thực chất chạy trên vector con của tín
  hiệu áp dụng được.
- **Dữ liệu fit:** cửa sổ sau warm-up, không im lặng, có dữ liệu, của các run train khỏe; sắp theo
  (run, cửa sổ) để fit xác định với cùng seed.
- **Điểm** = −`score_samples` ∈ (0, 1]: càng cao càng bất thường (anomaly score của Liu, Ting, Zhou
  2008).
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from .detectors import Score, _decide, _max_z, _modality_scores, _silent_or_empty
from .signals import SIGNAL_SET_VERSION, SIGNALS, ServiceWindow, service_windows

MODEL_SCHEMA = "iforest-model.v1"
FILL_RULE = "missing_dimension=0 (median của train)"
DEFAULT_HYPERPARAMETERS: dict[str, Any] = {
    "n_estimators": 200,
    "max_samples": 256,
    "max_features": 1.0,
    "bootstrap": False,
}
DEFAULT_SEED = 20260819


def vector(window: ServiceWindow) -> list[float]:
    best: dict[str, float] = {}
    for obs in window.observations:
        if obs.z is None:
            continue
        name = obs.signal.name
        best[name] = max(best.get(name, obs.z), obs.z)
    return [best.get(signal.name, 0.0) for signal in SIGNALS]


def _trainable(window: ServiceWindow) -> bool:
    return not window.warmup and not window.silent and window.has_data


def fit_models(
    feature_dirs: dict[str, Path],
    hyperparameters: dict[str, Any] | None = None,
    seed: int = DEFAULT_SEED,
    provenance: dict[str, Any] | None = None,
) -> tuple[dict[str, IsolationForest], dict[str, Any]]:
    """`feature_dirs`: `run_id → thư mục feature đã apply-baseline` của run train khỏe.

    Scaler (baseline) phải được fit trên **đúng** các run này: `baseline_fit_runs` trong
    `baseline-apply.json` của mọi run phải bằng tập `feature_dirs`. `provenance` (detector config
    version, code commit, dataset…) được chép vào metadata.
    """
    if not feature_dirs:
        raise ValueError("Cần ít nhất một run train để fit")
    params = {**DEFAULT_HYPERPARAMETERS, **(hyperparameters or {})}
    rows: dict[str, list[list[float]]] = {}
    windows_s: set[int] = set()
    applied: dict[str, Any] = {}
    for run_id, directory in sorted(feature_dirs.items()):
        meta = json.loads((directory / "features-manifest.json").read_text(encoding="utf-8"))
        if meta["run_id"] != run_id:
            raise ValueError(f"{directory} là feature của {meta['run_id']}, không phải {run_id}")
        windows_s.add(int(meta["config"]["window_s"]))
        apply_path = directory / "baseline-apply.json"
        applied[run_id] = json.loads(apply_path.read_text(encoding="utf-8"))
        for window in service_windows(directory):
            if _trainable(window):
                rows.setdefault(window.service, []).append(vector(window))
    if len(windows_s) != 1:
        raise ValueError(f"Run train có độ dài cửa sổ khác nhau: {sorted(windows_s)}")
    baselines = {entry.get("baseline_sha256") for entry in applied.values()}
    if len(baselines) != 1 or None in baselines:
        raise ValueError(
            f"Run train phải cùng một baseline đã ghi sha256: {sorted(map(str, baselines))}"
        )
    scaler_runs = {
        tuple(sorted(entry.get("baseline_fit_runs") or [])) for entry in applied.values()
    }
    if scaler_runs != {tuple(sorted(feature_dirs))}:
        raise ValueError(
            f"Baseline (scaler) fit trên {sorted(scaler_runs)}, "
            f"model fit trên {sorted(feature_dirs)}"
        )
    models: dict[str, IsolationForest] = {}
    counts: dict[str, int] = {}
    for service, matrix in sorted(rows.items()):
        model = IsolationForest(
            n_estimators=params["n_estimators"],
            max_samples=min(params["max_samples"], len(matrix)),
            max_features=params["max_features"],
            bootstrap=params["bootstrap"],
            random_state=seed,
            n_jobs=1,
        )
        model.fit(np.asarray(matrix, dtype=float))
        models[service] = model
        counts[service] = len(matrix)
    metadata = {
        **(provenance or {}),
        "schema": MODEL_SCHEMA,
        "signal_set_version": SIGNAL_SET_VERSION,
        "feature_order": [signal.name for signal in SIGNALS],
        "aggregation": "max z có hướng trên các thực thể của service",
        "fill_rule": FILL_RULE,
        "scaler": "baseline healthy (median, thang đo robust) qua apply-baseline",
        "baseline_sha256": baselines.pop(),
        "hyperparameters": params,
        "seed": seed,
        "window_s": windows_s.pop(),
        "fit_runs": sorted(feature_dirs),
        "fit_inputs": {
            run_id: {
                "features_manifest_sha256": entry.get("features_manifest_sha256"),
                "baseline_fit_runs": entry.get("baseline_fit_runs"),
            }
            for run_id, entry in sorted(applied.items())
        },
        "fit_windows": counts,
        "score": "-score_samples, (0, 1], cao hơn là bất thường hơn",
    }
    return models, metadata


def code_provenance(training_dir: Path) -> dict[str, Any]:
    """Commit của code và cờ có thay đổi chưa commit trong `aiops-platform/training`."""

    def git(*args: str) -> str:
        result = subprocess.run(
            ["git", "-C", str(training_dir), *args], capture_output=True, text=True, check=False
        )
        return result.stdout.strip() if result.returncode == 0 else ""

    return {
        "code_commit": git("rev-parse", "HEAD") or None,
        "code_dirty": bool(git("status", "--porcelain", "--", ".")),
    }


def save_models(models: dict[str, IsolationForest], metadata: dict[str, Any], out: Path) -> dict:
    """Ghi `<out>` (joblib) và `<out>.json` (metadata + sha256 của file model)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, out)
    full = {**metadata, "model_file": out.name, "model_sha256": _sha256(out)}
    out.with_suffix(out.suffix + ".json").write_text(
        json.dumps(full, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return full


def load_models(path: Path) -> tuple[dict[str, IsolationForest], dict[str, Any]]:
    metadata = json.loads(path.with_suffix(path.suffix + ".json").read_text(encoding="utf-8"))
    if metadata.get("schema") != MODEL_SCHEMA:
        raise ValueError(f"Model schema {metadata.get('schema')}, cần {MODEL_SCHEMA}")
    if _sha256(path) != metadata["model_sha256"]:
        raise ValueError(f"sha256 của {path} không khớp metadata")
    return joblib.load(path), metadata


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass
class IForestDetector:
    model: tuple[dict[str, IsolationForest], dict[str, Any]]
    threshold: float
    name: str = "iforest"

    def score(self, window: ServiceWindow) -> Score:
        early = _silent_or_empty(window)
        if early:
            return early
        models, _ = self.model
        components = _modality_scores(window)
        estimator = models.get(window.service)
        if estimator is None:
            # Service không có cửa sổ train nào: không có căn cứ để vượt (không phải cửa sổ null).
            return Score(None, False, "below_threshold", components)
        value = float(-estimator.score_samples(np.asarray([vector(window)], dtype=float))[0])
        _, obs = _max_z(window.observations)
        flagged, reason = _decide(value, self.threshold)
        return Score(value, flagged, reason, components, obs, obs.z if obs else None)
