from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from test_features import _artifact

from aiops_training.cli import main
from aiops_training.features.baseline import BaselineError, apply_baseline, fit_baseline
from aiops_training.features.leakage import check_leakage
from aiops_training.features.pipeline import write_features


def _run(root: Path, run_id: str, rate_factor: float = 1.0) -> Path:
    """Run giả trong `root/<run_id>/telemetry` (bố cục của runner) đã có feature v1."""
    artifact = root / run_id / "telemetry"
    artifact.mkdir(parents=True)
    _artifact(artifact)
    manifest = json.loads((artifact / "manifest.json").read_text(encoding="utf-8"))
    manifest["run_id"] = run_id
    (artifact / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    if rate_factor != 1.0:
        table = pq.read_table(artifact / "metrics.parquet").to_pylist()
        for row in table:
            if row["metric_name"] == "http_server_request_count_total":
                row["value"] *= rate_factor
        from aiops_training.telemetry.schema import METRIC_SCHEMA, to_table

        pq.write_table(to_table(table, METRIC_SCHEMA), artifact / "metrics.parquet")
    write_features(artifact)
    return artifact / "features"


def _manifest(cases: dict[str, str] | None = None, **splits: list[str]) -> dict:
    """Dataset manifest giả; `cases`: `run_id → case` cho slot có fault, còn lại healthy."""
    slots = [
        {
            "slot_id": f"{split}-{index}",
            "split": split,
            "case": (cases or {}).get(run_id),
            "run_id": run_id,
            "replaced_run_ids": [],
        }
        for split, runs in splits.items()
        for index, run_id in enumerate(runs)
    ]
    return {"schema": "dataset-manifest.v0", "dataset_id": "ds-test", "slots": slots}


def _edit_json(path: Path, **changes) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data.update(changes)
    path.write_text(json.dumps(data), encoding="utf-8")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_fit_excludes_warmup_and_silent_windows_and_apply_uses_fitted_params(tmp_path):
    dirs = {name: _run(tmp_path, name) for name in ("train-a", "train-b")}
    baseline = fit_baseline(dirs, provenance={"dataset_id": "ds-test"})
    assert baseline["fit_runs"] == ["train-a", "train-b"]
    course = baseline["stats"]["service"]["course"]["request_rate"]
    assert course["median"] == pytest.approx(2.0) and course["mad"] == 0
    # Đặc trưng hằng trên train: thang đo là sàn theo đơn vị (request/s → 0,05).
    assert course["scale_basis"] == "unit_floor" and course["scale"] == pytest.approx(0.05)
    # Cửa sổ warm-up (360 s đầu) và cửa sổ runtime im lặng không vào fit: identity bị "pause" từ
    # giây 300 nên mọi cửa sổ ngoài warm-up của nó đều im lặng → không có thống kê.
    assert "identity" not in baseline["stats"]["service"]
    rows = pq.read_table(dirs["train-a"] / "service_windows.parquet").to_pylist()
    kept = [r for r in rows if r["service_name"] == "course" and not r["warmup"]]
    assert course["n"] == 2 * len(kept) and len(kept) < sum(
        r["service_name"] == "course" for r in rows
    )

    other = _run(tmp_path, "validation-a", rate_factor=2.0)
    result = apply_baseline(other, baseline)
    assert result["baseline_fit_runs"] == ["train-a", "train-b"]
    rows = pq.read_table(other / "service_windows_z.parquet").to_pylist()
    late = [r for r in rows if r["service_name"] == "course" and not r["warmup"]]
    assert late[0]["request_rate_z"] == pytest.approx((4.0 - 2.0) / 0.05)
    gateway = next(r for r in rows if r["service_name"] == "gateway")
    assert gateway["baseline_missing"] is True and gateway["request_rate_z"] is None


def test_fit_and_apply_refuse_mixed_versions(tmp_path):
    a, b = _run(tmp_path, "a"), _run(tmp_path, "b")
    meta = json.loads((b / "features-manifest.json").read_text(encoding="utf-8"))
    meta["noise_filter_version"] = "noise.v0"
    (b / "features-manifest.json").write_text(json.dumps(meta), encoding="utf-8")
    with pytest.raises(BaselineError, match="khác nhau"):
        fit_baseline({"a": a, "b": b})
    baseline = fit_baseline({"a": a})
    with pytest.raises(BaselineError, match="noise_filter_version"):
        apply_baseline(b, baseline)


def test_check_leakage_passes_on_clean_dataset(tmp_path):
    dirs = {name: _run(tmp_path, name) for name in ("t1", "v1")}
    manifest = _manifest(train=["t1"], validation=["v1"])
    baseline = fit_baseline({"t1": dirs["t1"]}, provenance={"dataset_id": "ds-test"})
    assert check_leakage(manifest, baseline, dirs) == []


def test_check_leakage_catches_intentional_violations(tmp_path):
    dirs = {name: _run(tmp_path, name) for name in ("t1", "v1")}
    # (1) Cùng run_id ở hai split.
    manifest = _manifest(train=["t1"], validation=["v1", "t1"])
    errors = check_leakage(manifest, None, dirs)
    assert any("t1 thuộc nhiều split" in e for e in errors)

    # (2) Bước fit đọc run validation.
    manifest = _manifest(train=["t1"], validation=["v1"])
    leaky = fit_baseline(dirs, provenance={"dataset_id": "ds-test"})
    errors = check_leakage(manifest, leaky, dirs)
    assert any("fit trên run v1 thuộc split ['validation']" in e for e in errors)

    # (3) Cột ground truth trong bảng feature, trường truth trong manifest feature.
    path = dirs["v1"] / "edge_windows.parquet"
    table = pq.read_table(path)
    table = table.append_column("root_cause_service", pa.array(["course"] * table.num_rows))
    pq.write_table(table, path)
    meta = json.loads((dirs["v1"] / "features-manifest.json").read_text(encoding="utf-8"))
    meta["config"]["fault_start"] = "2026-11-18T05:18:00Z"
    (dirs["v1"] / "features-manifest.json").write_text(json.dumps(meta), encoding="utf-8")
    errors = check_leakage(manifest, None, dirs)
    assert any("edge_windows.parquet có cột truth ['root_cause_service']" in e for e in errors)
    assert any("features-manifest có trường truth ['fault_start']" in e for e in errors)

    # (4) Baseline của dataset khác; run không có trong manifest; feature không khai báo causality.
    other = fit_baseline({"t1": dirs["t1"]}, provenance={"dataset_id": "khac"})
    extra = _run(tmp_path, "x1")
    meta = json.loads((extra / "features-manifest.json").read_text(encoding="utf-8"))
    meta["causality"]["traces"] = "span có start_time trong cửa sổ"
    (extra / "features-manifest.json").write_text(json.dumps(meta), encoding="utf-8")
    errors = check_leakage(_manifest(train=["t1"]), other, {"t1": dirs["t1"], "x1": extra})
    assert any("không phải ds-test" in e for e in errors)
    assert any("x1: không có trong dataset manifest" in e for e in errors)
    assert any("x1: feature không khai báo quy tắc thời điểm" in e for e in errors)


def test_cli_fit_reads_only_train_runs_and_check_leakage(tmp_path, capsys):
    runs = tmp_path / "runs"
    for name in ("t1", "t2", "v1"):
        _run(runs, name)
    dataset = tmp_path / "dataset.json"
    dataset.write_text(json.dumps(_manifest(train=["t1", "t2"], validation=["v1"])), "utf-8")
    out = tmp_path / "baseline.json"
    assert (
        main(
            ["fit-baseline", "--dataset", str(dataset), "--runs-dir", str(runs), "--out", str(out)]
        )
        == 0
    )
    baseline = json.loads(out.read_text(encoding="utf-8"))
    assert baseline["fit_runs"] == ["t1", "t2"]
    assert baseline["dataset_id"] == "ds-test"
    assert baseline["dataset_manifest_sha256"] == _sha256(dataset)
    args = ["check-leakage", "--dataset", str(dataset), "--runs-dir", str(runs)]
    assert main([*args, "--baseline", str(out)]) == 0
    assert '"errors": []' in capsys.readouterr().out

    # apply-baseline ghi lineage cạnh bảng z: sha256 của đúng file baseline và manifest feature.
    features = runs / "v1" / "telemetry" / "features"
    assert main(["apply-baseline", str(features), "--baseline", str(out)]) == 0
    capsys.readouterr()
    lineage = json.loads((features / "baseline-apply.json").read_text(encoding="utf-8"))
    assert lineage["baseline_sha256"] == _sha256(out)
    assert lineage["features_manifest_sha256"] == _sha256(features / "features-manifest.json")
    assert lineage["baseline_fit_runs"] == ["t1", "t2"] and lineage["run_id"] == "v1"

    # Dataset manifest đổi sau khi fit (thêm một dòng trống): sha256 không còn khớp baseline.
    dataset.write_text(dataset.read_text(encoding="utf-8") + "\n", "utf-8")
    assert main([*args, "--baseline", str(out)]) == 1
    assert "dataset manifest đang kiểm có sha256" in capsys.readouterr().out
    # Thiếu feature của một run train: fit từ chối thay vì âm thầm fit trên tập nhỏ hơn.
    shutil.rmtree(runs / "t2" / "telemetry" / "features")
    with pytest.raises(SystemExit, match="t2"):
        main(
            ["fit-baseline", "--dataset", str(dataset), "--runs-dir", str(runs), "--out", str(out)]
        )


def test_robust_scale_falls_back_from_mad_to_meanad_to_unit_floor():
    from aiops_training.features.baseline import robust_scale

    spread = robust_scale([1.0, 2.0, 3.0, 4.0, 5.0], "latency_p95")
    assert spread["scale_basis"] == "mad" and spread["scale"] == pytest.approx(1.4826 * 1.0)
    # Phần lớn là 0, vài cửa sổ có lỗi: MAD = 0 nhưng MeanAD = 2/10 → modified z-score.
    sparse = robust_scale([0.0] * 8 + [1.0, 1.0], "error_ratio")
    assert sparse["mad"] == 0 and sparse["scale_basis"] == "meanad"
    assert sparse["scale"] == pytest.approx(1.2533 * 0.2)
    constant = robust_scale([1.0] * 6, "consumers")
    assert constant["scale_basis"] == "unit_floor" and constant["scale"] == pytest.approx(0.2)


def test_apply_refuses_baseline_of_other_schema(tmp_path):
    features = _run(tmp_path, "a")
    baseline = fit_baseline({"a": features})
    with pytest.raises(BaselineError, match="schema"):
        apply_baseline(features, {**baseline, "schema": "feature-baseline.v1"})


def test_cli_fit_skips_train_runs_with_fault_and_check_rejects_them(tmp_path, capsys):
    runs = tmp_path / "runs"
    for name in ("t1", "t2"):
        _run(runs, name)
    dataset = tmp_path / "dataset.json"
    manifest = _manifest(cases={"t2": "C2"}, train=["t1", "t2"])
    dataset.write_text(json.dumps(manifest), "utf-8")
    out = tmp_path / "baseline.json"
    args = ["fit-baseline", "--dataset", str(dataset), "--runs-dir", str(runs), "--out", str(out)]
    assert main(args) == 0
    assert json.loads(out.read_text(encoding="utf-8"))["fit_runs"] == ["t1"]
    # Baseline dựng tay có fit cả run train có fault: kiểm leakage bắt được.
    dirs = {name: runs / name / "telemetry" / "features" for name in ("t1", "t2")}
    leaky = fit_baseline(dirs, provenance={"dataset_id": "ds-test"})
    errors = check_leakage(manifest, leaky, dirs)
    assert "baseline fit trên run t2 không healthy (case ['C2'])" in errors
    assert not any("run t1" in e for e in errors)


def test_check_leakage_does_not_trust_baseline_metadata(tmp_path):
    dirs = {name: _run(tmp_path, name) for name in ("t1", "v1")}
    manifest = _manifest(train=["t1"], validation=["v1"])
    baseline = fit_baseline({"t1": dirs["t1"]}, provenance={"dataset_id": "ds-test"})

    # Khóa của fit_inputs_sha256 khác fit_runs.
    errors = check_leakage(manifest, {**baseline, "fit_inputs_sha256": {}}, dirs)
    assert "fit_inputs_sha256 có run [] khác fit_runs ['t1']" in errors

    # Run fit không có thư mục feature để đối chiếu.
    errors = check_leakage(manifest, baseline, {"v1": dirs["v1"]})
    assert "baseline: không có feature của run fit t1 để đối chiếu sha256" in errors

    # Manifest feature của run train bị sinh lại/sửa sau khi fit.
    _edit_json(dirs["t1"] / "features-manifest.json", note="sinh lại")
    errors = check_leakage(manifest, baseline, dirs)
    assert any(e.startswith("baseline: sha256 features-manifest của t1 khác") for e in errors)

    # dataset_manifest_sha256 khác sha256 của manifest đang kiểm.
    errors = check_leakage(
        manifest, {**baseline, "dataset_manifest_sha256": "a" * 64}, dirs, manifest_sha256="b" * 64
    )
    assert any("dataset manifest đang kiểm có sha256 " + "b" * 64 in e for e in errors)


def test_check_leakage_checks_run_identity_and_collection_time(tmp_path):
    dirs = {name: _run(tmp_path, name) for name in ("t1", "v1")}
    manifest = _manifest(train=["t1"], validation=["v1"])

    # Thư mục feature của t1 khai báo dưới tên v1.
    errors = check_leakage(manifest, None, {"v1": dirs["t1"]})
    assert "v1: features-manifest thuộc run t1" in errors
    assert "v1: manifest export thuộc run t1" in errors

    # Export ghi xong chỉ 5 s sau time_end (< độ trễ lớn nhất 10 s).
    export = dirs["v1"].parent / "manifest.json"
    time_end = json.loads(export.read_text(encoding="utf-8"))["time_end"]
    early = time_end.replace(":10:00Z", ":10:05Z")
    assert early != time_end
    _edit_json(export, generated_at=early)
    errors = check_leakage(manifest, None, dirs)
    assert any(e.startswith(f"v1: export ghi lúc {early}, sớm hơn time_end + 10 s") for e in errors)

    # Feature dựng trên export khác (time_end của export sớm hơn cửa sổ cuối của feature).
    _edit_json(export, time_end=time_end.replace(":10:00Z", ":08:00Z"), generated_at=time_end)
    errors = check_leakage(manifest, None, dirs)
    assert any(e.startswith("v1: time_end của feature") for e in errors)
    assert any(e.startswith("v1: service_windows.parquet có window_end") for e in errors)

    # Thư mục feature tách khỏi artifact export: không kiểm được thời điểm.
    moved = tmp_path / "elsewhere" / "features"
    shutil.copytree(dirs["t1"], moved)
    errors = check_leakage(manifest, None, {"t1": moved})
    assert any(e.startswith("t1: không có manifest export") for e in errors)


def test_check_leakage_catches_version_mismatch(tmp_path):
    dirs = {name: _run(tmp_path, name) for name in ("t1", "v1")}
    manifest = _manifest(train=["t1"], validation=["v1"])
    _edit_json(dirs["v1"] / "features-manifest.json", noise_filter_version="noise.v0")
    errors = check_leakage(manifest, None, dirs)
    assert any(e.startswith("phiên bản feature/lọc nhiễu không đồng nhất") for e in errors)

    # Đồng nhất nhưng không phải phiên bản hiện hành của pipeline.
    _edit_json(dirs["t1"] / "features-manifest.json", noise_filter_version="noise.v0")
    errors = check_leakage(manifest, None, dirs)
    assert not any("không đồng nhất" in e for e in errors)
    assert "cần ('feature.v1', 'noise.v1'), có [\"('feature.v1', 'noise.v0')\"]" in errors
