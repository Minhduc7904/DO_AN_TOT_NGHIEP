"""Feature và baseline theo độ dài cửa sổ (task-02 tuần 16): cửa sổ 30 s tách khỏi 60 s về thư mục,
manifest, baseline và kiểm leakage; baseline cũ không có `window_s` vẫn đọc được (legacy).

Pipeline, baseline và kiểm leakage chạy thật trên artifact giả của `test_features`.
"""

from __future__ import annotations

import json

import pyarrow.parquet as pq
import pytest
from test_baseline_leakage import _manifest, _run

from aiops_training.cli import main
from aiops_training.features.baseline import (
    BaselineError,
    apply_baseline,
    baseline_window_s,
    fit_baseline,
)
from aiops_training.features.leakage import check_leakage
from aiops_training.features.pipeline import (
    FeatureConfig,
    FeatureError,
    features_dir_name,
    write_features,
)


def _with_w30(root, name):
    """Run giả có cả feature 60 s (`features/`) và 30 s (`features-w30/`)."""
    w60 = _run(root, name)
    write_features(w60.parent, config=FeatureConfig(window_s=30))
    return w60, w60.parent / "features-w30"


def test_each_window_length_has_its_own_directory_and_manifest(tmp_path):
    w60, w30 = _with_w30(tmp_path, "train-a")
    assert features_dir_name(60) == "features" and features_dir_name(30) == "features-w30"
    meta60 = json.loads((w60 / "features-manifest.json").read_text(encoding="utf-8"))
    meta30 = json.loads((w30 / "features-manifest.json").read_text(encoding="utf-8"))
    assert meta60["window_s"] == 60 and meta30["window_s"] == 30
    rows = pq.read_table(w30 / "service_windows.parquet").to_pylist()
    assert {(r["window_end"] - r["window_start"]).total_seconds() for r in rows} == {30.0}
    # Cùng bước 15 s: cửa sổ ngắn hơn nên có nhiều cửa sổ hơn trên cùng khoảng thời gian.
    assert meta30["windows"] > meta60["windows"]
    # Ghi 30 s không đụng vào thư mục 60 s.
    assert (w60 / "service_windows.parquet").exists()
    with pytest.raises(FeatureError, match="bội dương"):
        write_features(w60.parent, config=FeatureConfig(window_s=40))


def test_default_window_output_is_unchanged(tmp_path):
    w60 = _run(tmp_path, "train-a")
    again = tmp_path / "again"
    write_features(w60.parent, out_dir=again, config=FeatureConfig(window_s=60))
    for name in ("service_windows.parquet", "edge_windows.parquet", "queue_windows.parquet"):
        assert pq.read_table(w60 / name).equals(pq.read_table(again / name))


def test_baseline_records_window_and_apply_refuses_mismatch(tmp_path):
    a60, a30 = _with_w30(tmp_path, "train-a")
    b60, b30 = _with_w30(tmp_path, "train-b")
    base60 = fit_baseline({"train-a": a60, "train-b": b60})
    base30 = fit_baseline({"train-a": a30, "train-b": b30})
    assert base60["window_s"] == 60 and base30["window_s"] == 30
    with pytest.raises(BaselineError, match="cửa sổ 30 s, baseline fit trên cửa sổ 60 s"):
        apply_baseline(a30, base60)
    with pytest.raises(BaselineError, match="cửa sổ 60 s, baseline fit trên cửa sổ 30 s"):
        apply_baseline(a60, base30)
    result = apply_baseline(a30, base30)
    assert result["window_s"] == 30 and result["baseline_window_s_legacy"] is False
    with pytest.raises(BaselineError, match="độ dài cửa sổ khác nhau"):
        fit_baseline({"train-a": a60, "train-b": b30})


def test_legacy_baseline_without_window_is_read_without_rewriting(tmp_path):
    a60, a30 = _with_w30(tmp_path, "train-a")
    legacy = fit_baseline({"train-a": a60})
    del legacy["window_s"]  # như baselines/dataset-v0.json fit trước task-02
    assert baseline_window_s(legacy) == (60, True)
    assert baseline_window_s(legacy, {"train-a": a60}) == (60, True)
    assert apply_baseline(a60, legacy)["baseline_window_s_legacy"] is True
    with pytest.raises(BaselineError, match="legacy"):
        apply_baseline(a30, legacy)
    # Legacy suy từ chính run fit: baseline 30 s cũ (không ghi window_s) được nhận đúng là 30 s.
    legacy30 = fit_baseline({"train-a": a30})
    del legacy30["window_s"]
    assert baseline_window_s(legacy30, {"train-a": a30}) == (30, True)


def test_check_leakage_rejects_mixed_window_lengths(tmp_path):
    t60, t30 = _with_w30(tmp_path, "t1")
    v60, v30 = _with_w30(tmp_path, "v1")
    manifest = _manifest(train=["t1"], validation=["v1"])
    base30 = fit_baseline({"t1": t30})
    base30["dataset_id"] = "ds-test"
    assert check_leakage(manifest, base30, {"t1": t30, "v1": v30}) == []
    errors = check_leakage(manifest, base30, {"t1": t30, "v1": v60})
    assert any("độ dài cửa sổ không đồng nhất" in error for error in errors)
    # Baseline legacy (không có window_s) suy từ run fit: 60 s, nên run 30 s bị bắt.
    legacy = fit_baseline({"t1": t60})
    legacy["dataset_id"] = "ds-test"
    del legacy["window_s"]
    assert check_leakage(manifest, legacy, {"t1": t60, "v1": v60}) == []
    errors = check_leakage(manifest, legacy, {"t1": t60, "v1": v30})
    assert any("legacy" in error and "độ dài cửa sổ" in error for error in errors)


def test_cli_window_option_and_features_subdir(tmp_path, capsys):
    runs = tmp_path / "runs"
    for name in ("t1", "t2", "v1"):
        artifact = _run(runs, name).parent
        assert main(["features", str(artifact), "--window-s", "30"]) == 0
        assert (artifact / "features-w30" / "features-manifest.json").exists()
    dataset = tmp_path / "dataset.json"
    dataset.write_text(json.dumps(_manifest(train=["t1", "t2"], validation=["v1"])), "utf-8")
    out = tmp_path / "baseline-w30.json"
    sub = ["--features-subdir", "telemetry/features-w30"]
    fit = ["fit-baseline", "--dataset", str(dataset), "--runs-dir", str(runs), "--out", str(out)]
    assert main([*fit, *sub]) == 0
    assert json.loads(out.read_text(encoding="utf-8"))["window_s"] == 30
    check = ["check-leakage", "--dataset", str(dataset), "--runs-dir", str(runs)]
    assert main([*check, "--baseline", str(out), *sub]) == 0
    # Baseline 30 s kiểm trên thư mục 60 s mặc định: lệch cửa sổ bị bắt.
    assert main([*check, "--baseline", str(out)]) == 1
    assert "độ dài cửa sổ không đồng nhất" in capsys.readouterr().out
