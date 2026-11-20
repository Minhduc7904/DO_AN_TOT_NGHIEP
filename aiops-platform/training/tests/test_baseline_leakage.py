from __future__ import annotations

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


def _manifest(**splits: list[str]) -> dict:
    slots = [
        {"slot_id": f"{split}-{index}", "split": split, "run_id": run_id, "replaced_run_ids": []}
        for split, runs in splits.items()
        for index, run_id in enumerate(runs)
    ]
    return {"schema": "dataset-manifest.v0", "dataset_id": "ds-test", "slots": slots}


def test_fit_excludes_warmup_and_silent_windows_and_apply_uses_fitted_params(tmp_path):
    dirs = {name: _run(tmp_path, name) for name in ("train-a", "train-b")}
    baseline = fit_baseline(dirs, provenance={"dataset_id": "ds-test"})
    assert baseline["fit_runs"] == ["train-a", "train-b"]
    course = baseline["stats"]["service"]["course"]["request_rate"]
    assert course["median"] == pytest.approx(2.0) and course["mad"] == 0
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
    assert late[0]["request_rate_z"] == pytest.approx((4.0 - 2.0) / 1e-3)
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
    assert baseline["dataset_id"] == "ds-test" and len(baseline["dataset_manifest_sha256"]) == 64
    args = ["check-leakage", "--dataset", str(dataset), "--runs-dir", str(runs)]
    assert main([*args, "--baseline", str(out)]) == 0
    assert '"errors": []' in capsys.readouterr().out
    # Thiếu feature của một run train: fit từ chối thay vì âm thầm fit trên tập nhỏ hơn.
    shutil.rmtree(runs / "t2" / "telemetry" / "features")
    with pytest.raises(SystemExit, match="t2"):
        main(
            ["fit-baseline", "--dataset", str(dataset), "--runs-dir", str(runs), "--out", str(out)]
        )
