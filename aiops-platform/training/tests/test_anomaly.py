"""Detector bất thường (task-01 tuần 16): ngưỡng tĩnh, robust z, Isolation Forest, điểm hợp nhất.

Bảng feature dựng bằng schema thật của pipeline v1; baseline fit/apply, sklearn, pyarrow chạy thật.
"""

from __future__ import annotations

import ast
import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from aiops_training.anomaly.detectors import Fused, RobustZ, StaticThreshold, build_detector
from aiops_training.anomaly.iforest import fit_models, load_models, save_models, vector
from aiops_training.anomaly.run import detect
from aiops_training.anomaly.signals import SIGNALS, Observation, ServiceWindow, service_windows
from aiops_training.cli import main
from aiops_training.features.baseline import apply_baseline, fit_baseline
from aiops_training.features.pipeline import EDGE_SCHEMA, QUEUE_SCHEMA, SERVICE_SCHEMA

T0 = datetime(2026, 11, 23, 9, 0, tzinfo=UTC)
SIGNAL = {signal.name: signal for signal in SIGNALS}


def _service_row(run_id: str, index: int, service: str, **values) -> dict:
    start = T0 + timedelta(seconds=15 * index)
    row = {name: None for name in SERVICE_SCHEMA.names}
    row.update(
        run_id=run_id,
        window_start=start,
        window_end=start + timedelta(seconds=60),
        warmup=index < 2,
        service_name=service,
        missing_metrics=False,
        missing_traces=False,
        missing_logs=False,
        traces_truncated=False,
        telemetry_silent=False,
    )
    row.update(values)
    return row


def _feature_dir(
    root: Path,
    run_id: str,
    windows: int = 40,
    course_latency=lambda i: 0.05 + 0.002 * (i % 5),
    silent_identity: set[int] | None = None,
    window_s: int = 60,
) -> Path:
    """Run giả: course (HTTP + trace + log), media-worker (worker: không HTTP, có cạnh và hàng đợi),
    identity (im lặng ở các cửa sổ trong `silent_identity`)."""
    directory = root / run_id / "telemetry" / "features"
    directory.mkdir(parents=True)
    service, edge, queue = [], [], []
    for i in range(windows):
        service.append(
            _service_row(
                run_id,
                i,
                "course",
                request_rate=2.0 + (i % 3),
                error_rate=0.001 * (i % 4),
                latency_p95=course_latency(i),
                downstream_latency_p95=0.02 + 0.001 * (i % 3),
                trace_error_rate=0.0,
                log_error_rate=0.01 * (i % 2),
                span_count=100,
                log_count=50,
            )
        )
        # Worker: không có tín hiệu HTTP; trace thưa (dưới số span tối thiểu): rỗng.
        service.append(
            _service_row(run_id, i, "media-worker", request_rate=0.0, log_error_rate=0.0)
        )
        silent = i in (silent_identity or set())
        service.append(
            _service_row(
                run_id,
                i,
                "identity",
                telemetry_silent=silent,
                error_rate=None if silent else 0.0,
                latency_p95=None if silent else 0.01 + 0.001 * (i % 2),
            )
        )
        start = T0 + timedelta(seconds=15 * i)
        edge.append(
            {
                "run_id": run_id,
                "window_start": start,
                "window_end": start + timedelta(seconds=60),
                "warmup": i < 2,
                "caller_service": "media-worker",
                "dependency_identity": "media-minio",
                "call_count": 10.0,
                "error_ratio": 0.0,
                "timeout_ratio": 0.0,
                "duration_mean": 0.02,
                "duration_p95": 0.03 + 0.001 * (i % 4),
                "duration_p99": 0.04,
                "caller_silent": False,
            }
        )
        queue.append(
            {
                "run_id": run_id,
                "window_start": start,
                "window_end": start + timedelta(seconds=60),
                "warmup": i < 2,
                "consumer_service": "media-worker",
                "queue": "media-worker--generate-media-thumbnail-v1",
                "dead_letter": False,
                "messages_ready": float(i % 3),
                "messages_unacked": 0.0,
                "consumers": 1.0,
                "consumer_silent": False,
            }
        )
        # Hàng đợi dead-letter: không có consumer theo thiết kế.
        queue.append(
            {
                **queue[-1],
                "queue": "media-worker--generate-media-thumbnail-v1.error",
                "dead_letter": True,
                "messages_ready": 0.0,
                "consumers": 0.0,
            }
        )
    pq.write_table(
        pa.Table.from_pylist(service, SERVICE_SCHEMA), directory / "service_windows.parquet"
    )
    pq.write_table(pa.Table.from_pylist(edge, EDGE_SCHEMA), directory / "edge_windows.parquet")
    pq.write_table(pa.Table.from_pylist(queue, QUEUE_SCHEMA), directory / "queue_windows.parquet")
    meta = {
        "run_id": run_id,
        "feature_version": "feature.v1",
        "feature_config_version": "feature.v1",
        "noise_filter_version": "noise.v1",
        "config": {"window_s": window_s, "step_s": 15, "align_s": 15, "warmup_s": 30},
    }
    (directory / "features-manifest.json").write_text(json.dumps(meta), encoding="utf-8")
    return directory


def _train_and_apply(tmp_path: Path, others: dict[str, Path] | None = None) -> dict[str, Path]:
    train = {name: _feature_dir(tmp_path, name) for name in ("train-a", "train-b")}
    baseline = fit_baseline(train)
    baseline_path = tmp_path / "baseline.json"
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")
    from aiops_training.features.baseline import sha256_file

    for directory in [*train.values(), *(others or {}).values()]:
        apply_baseline(directory, baseline, baseline_sha256=sha256_file(baseline_path))
    return train


def _window(*observations: tuple[str, float | None, float | None], silent=False) -> ServiceWindow:
    window = ServiceWindow("r", T0, T0 + timedelta(seconds=60), False, "course", silent)
    for name, value, z in observations:
        window.observations.append(Observation(SIGNAL[name], "course", value, z))
    return window


# --- Quy tắc dùng chung cho mọi detector ---------------------------------------------------------


def test_signals_use_only_symptoms_and_trace_ratios():
    names = {signal.name for signal in SIGNALS}
    # Không dùng tín hiệu tải hay số đếm tuyệt đối của trace (bảng F, hệ quả (c)).
    for excluded in (
        "service.request_rate",
        "service.span_count",
        "service.log_count",
        "service.cpu_usage",
        "service.memory_usage",
        "edge.call_count",
    ):
        assert excluded not in names
    traces = [signal.name for signal in SIGNALS if signal.modality == "traces"]
    assert traces == ["service.trace_error_rate"]
    assert SIGNAL["queue.consumers"].direction == "down"


@pytest.mark.parametrize(
    "detector",
    [
        StaticThreshold({"service.error_rate": 0.05}),
        RobustZ(threshold=3),
        Fused(threshold=3),
    ],
)
def test_silent_window_is_flagged_and_empty_window_is_null_for_every_detector(detector):
    silent = detector.score(_window(("service.error_rate", None, None), silent=True))
    assert silent.flagged is True and silent.reason == "telemetry_silent" and silent.score is None
    empty = detector.score(_window(("service.error_rate", None, None)))
    assert empty.flagged is None and empty.reason == "no_data"


def test_iforest_follows_the_same_silent_and_empty_rules(tmp_path):
    train = _train_and_apply(tmp_path)
    detector = build_detector("iforest", {"threshold": 0.6}, fit_models(train))
    assert detector.score(_window(silent=True)).reason == "telemetry_silent"
    assert detector.score(_window(("service.error_rate", None, None))).flagged is None


# --- Từng detector --------------------------------------------------------------------------------


def test_static_threshold_uses_raw_values_and_direction():
    detector = StaticThreshold({"service.latency_p95": 1.0, "queue.consumers": 1.0})
    calm = detector.score(
        _window(("service.latency_p95", 0.5, 99.0), ("queue.consumers", 1.0, 0.0))
    )
    # Ngưỡng tĩnh không nhìn z: z = 99 không làm nó vượt; consumers = 1 đúng bằng ngưỡng không vượt.
    assert calm.flagged is False and calm.score == pytest.approx(1.0)
    slow = detector.score(_window(("service.latency_p95", 2.5, 0.0)))
    assert slow.flagged is True and slow.score == pytest.approx(2.5)
    assert slow.top.signal.name == "service.latency_p95"
    lost = detector.score(_window(("queue.consumers", 0.0, -5.0)))
    assert lost.flagged is True and math.isinf(lost.score)
    # Tín hiệu không có ngưỡng trong config bị bỏ qua: có dữ liệu nên là "không vượt", không phải
    # cửa sổ null (cùng nghĩa với ba detector kia).
    unthresholded = detector.score(_window(("edge.error_ratio", 0.9, 50.0)))
    assert unthresholded.flagged is False and unthresholded.score is None
    with pytest.raises(ValueError, match="dương"):
        StaticThreshold({"service.error_rate": 0.0})


def test_robust_z_is_max_directional_z_and_ignores_missing_baseline():
    detector = RobustZ(threshold=3)
    result = detector.score(
        _window(("service.error_rate", 0.2, 5.0), ("service.latency_p95", 0.1, 1.0))
    )
    assert result.flagged is True and result.score == 5.0
    assert result.top.signal.name == "service.error_rate"
    # Giá trị có nhưng mọi nhóm thiếu baseline (z rỗng): không có căn cứ để vượt, và không phải
    # cửa sổ null vì service có dữ liệu.
    missing = detector.score(_window(("edge.error_ratio", 0.5, None)))
    assert missing.flagged is False and missing.reason == "below_threshold"
    assert detector.score(_window(("service.error_rate", 0.0, 2.9))).flagged is False


def test_fused_falls_back_only_on_modalities_without_data():
    detector = Fused(threshold=3)
    # Đủ ba modality: trung bình đều; điểm âm của modality bị cắt về 0, không trừ modality khác.
    full = detector.score(
        _window(
            ("service.error_rate", 0.2, 9.0),
            ("service.trace_error_rate", 0.0, -2.0),
            ("service.log_error_rate", 0.1, 3.0),
        )
    )
    assert full.components == {"metrics": 9.0, "traces": 0.0, "logs": 3.0}
    assert full.score == pytest.approx(4.0) and full.flagged is True
    # Worker: không có trace (dưới số span tối thiểu) và log → chỉ còn metric, chuẩn hóa trọng số.
    worker = detector.score(_window(("edge.duration_p95", 0.5, 6.0)))
    assert worker.components == {"metrics": 6.0, "traces": None, "logs": None}
    assert worker.score == pytest.approx(6.0)
    weighted = Fused(threshold=3, weights={"metrics": 0.5, "traces": 0.0, "logs": 0.5}).score(
        _window(("service.error_rate", 0.2, 8.0), ("service.trace_error_rate", 0.5, 100.0))
    )
    # Trace có trọng số 0 không đóng góp; log không có dữ liệu → chỉ metric.
    assert weighted.score == pytest.approx(8.0)
    with pytest.raises(ValueError):
        Fused(threshold=3, weights={"metric": 1.0})


def test_each_detector_names_its_own_evidence_signals():
    window = _window(
        ("service.error_rate", 0.2, 6.0),
        ("service.latency_p95", 0.5, 4.5),
        ("service.log_error_rate", 0.0, -1.0),
    )
    # robust_z: mọi tín hiệu có z vượt ngưỡng.
    assert RobustZ(threshold=4).score(window).evidence == (
        "service.error_rate@course",
        "service.latency_p95@course",
    )
    # static: tín hiệu vượt ngưỡng riêng của nó (không nhìn z).
    static = StaticThreshold({"service.error_rate": 0.1, "service.latency_p95": 1.0})
    assert static.score(window).evidence == ("service.error_rate@course",)
    # fused: tín hiệu z > 0 của modality có đóng góp.
    assert Fused(threshold=3).score(window).evidence == (
        "service.error_rate@course",
        "service.latency_p95@course",
    )


# --- Gom feature theo service và Isolation Forest -------------------------------------------------


def test_service_windows_attribute_edges_to_caller_and_queues_to_consumer(tmp_path):
    train = _train_and_apply(tmp_path)
    windows = service_windows(train["train-a"])
    worker = next(w for w in windows if w.service == "media-worker" and not w.warmup)
    entities = {obs.entity for obs in worker.observations}
    assert "media-worker|media-minio" in entities
    assert "media-worker|media-worker--generate-media-thumbnail-v1" in entities
    assert not worker.available("traces")  # worker không có trace_error_rate
    consumers = [obs for obs in worker.observations if obs.signal.name == "queue.consumers"]
    # Dead-letter không có consumer theo thiết kế: không sinh tín hiệu mất consumer, chỉ hàng đợi
    # thường; messages_ready của dead-letter vẫn được theo dõi.
    assert [obs.entity for obs in consumers] == [
        "media-worker|media-worker--generate-media-thumbnail-v1"
    ]
    assert consumers[0].value == 1.0 and consumers[0].z == pytest.approx(0.0)
    dead = [obs for obs in worker.observations if obs.entity.endswith(".error")]
    assert [obs.signal.name for obs in dead] == ["queue.messages_ready", "queue.messages_unacked"]
    static = StaticThreshold({"queue.consumers": 1.0})
    assert static.score(worker).flagged is False


def test_iforest_fits_on_train_only_and_is_deterministic(tmp_path):
    train = _train_and_apply(tmp_path)
    models, metadata = fit_models(train, seed=7)
    again, _ = fit_models(train, seed=7)
    assert metadata["fit_runs"] == ["train-a", "train-b"]
    assert metadata["window_s"] == 60 and metadata["seed"] == 7
    assert metadata["feature_order"] == [signal.name for signal in SIGNALS]
    assert metadata["baseline_sha256"]
    # Warm-up (2 cửa sổ đầu) không vào fit: 38 cửa sổ mỗi run × 2 run.
    assert metadata["fit_windows"]["course"] == 76
    windows = [w for w in service_windows(train["train-a"]) if w.service == "course"]
    vectors = [vector(w) for w in windows]
    assert (models["course"].score_samples(vectors) == again["course"].score_samples(vectors)).all()
    path = tmp_path / "model.joblib"
    saved = save_models(models, metadata, path)
    loaded, loaded_meta = load_models(path)
    assert loaded_meta["model_sha256"] == saved["model_sha256"]
    assert (
        loaded["course"].score_samples(vectors) == models["course"].score_samples(vectors)
    ).all()
    path.write_bytes(path.read_bytes() + b"x")
    with pytest.raises(ValueError, match="sha256"):
        load_models(path)


def test_iforest_scores_a_fault_like_window_higher(tmp_path):
    fault = _feature_dir(tmp_path, "pilot-fault", course_latency=lambda i: 2.0 if i >= 30 else 0.05)
    train = _train_and_apply(tmp_path, {"pilot-fault": fault})
    model = fit_models(train)
    detector = build_detector("iforest", {"threshold": 0.6}, model)
    course = {w.window_start: w for w in service_windows(fault) if w.service == "course"}
    normal = detector.score(course[T0 + timedelta(seconds=15 * 10)])
    slow = detector.score(course[T0 + timedelta(seconds=15 * 35)])
    assert slow.score > normal.score and slow.flagged is True


def test_fit_rejects_mixed_window_lengths(tmp_path):
    a = _feature_dir(tmp_path, "train-a")
    b = _feature_dir(tmp_path, "train-b", window_s=30)
    baseline = fit_baseline({"train-a": a})
    for directory in (a, b):
        apply_baseline(directory, baseline, baseline_sha256="x")
    with pytest.raises(ValueError, match="độ dài cửa sổ"):
        fit_models({"train-a": a, "train-b": b})


# --- Chạy trên một run và CLI ---------------------------------------------------------------------


def test_detect_writes_records_with_lineage_and_evidence_keys(tmp_path):
    fault = _feature_dir(tmp_path, "pilot-fault", silent_identity={20, 21})
    _train_and_apply(tmp_path, {"pilot-fault": fault})
    out = tmp_path / "out"
    manifest = detect(fault, RobustZ(threshold=4), out, config={"threshold": 4})
    rows = pq.read_table(out / "anomalies-robust_z.parquet").to_pylist()
    assert len(rows) == manifest["rows"] == 40 * 3
    silent = [r for r in rows if r["service_name"] == "identity" and r["telemetry_silent"]]
    assert len(silent) == 2
    assert all(r["flagged"] and r["reason"] == "telemetry_silent" for r in silent)
    assert {r["top_key"] for r in silent} == {"telemetry_silent@identity"}
    assert manifest["counts"]["telemetry_silent"] == 2
    assert manifest["lineage"]["baseline_sha256"] and manifest["window_s"] == 60
    assert manifest["available_after_s"] == 10.0
    worker = next(r for r in rows if r["service_name"] == "media-worker" and not r["warmup"])
    # Mọi cửa sổ ghi khóa im lặng và khóa của tín hiệu có giá trị; worker không có trace/HTTP.
    assert "telemetry_silent@media-worker" in worker["observed_keys"]
    assert "edge.duration_p95@media-worker|media-minio" in worker["observed_keys"]
    assert (
        "queue.consumers@media-worker|media-worker--generate-media-thumbnail-v1.error"
        not in (worker["observed_keys"])
    )
    assert worker["missing_modalities"] == ["traces"]
    assert worker["top_key"] is None and worker["evidence_keys"] == []  # không vượt
    assert {tuple(r["evidence_keys"]) for r in silent} == {("telemetry_silent@identity",)}


def test_constant_train_signal_uses_unit_floor_scale(tmp_path):
    # messages_unacked hằng 0 trên train → MAD = MeanAD = 0 → thang đo = sàn 1 message, nên một
    # message chờ ack ở run khác cho z = 1 (không phải vô cùng hay 1e15).
    train = {name: _feature_dir(tmp_path, name) for name in ("train-a", "train-b")}
    baseline = fit_baseline(train)
    stat = baseline["stats"]["queue"]["media-worker|media-worker--generate-media-thumbnail-v1"][
        "messages_unacked"
    ]
    assert stat["scale_basis"] == "unit_floor" and stat["scale"] == 1.0
    window = _window(("queue.messages_unacked", 1.0, (1.0 - stat["median"]) / stat["scale"]))
    assert RobustZ(threshold=0.5).score(window).score == pytest.approx(1.0)


def test_detect_checks_lineage(tmp_path):
    train = _train_and_apply(tmp_path)
    directory = train["train-a"]
    models, metadata = fit_models(train)
    detector = build_detector("iforest", {"threshold": 0.6}, (models, metadata))
    out = tmp_path / "out"
    for changed, message in (
        ({"window_s": 30}, "cửa sổ"),
        ({"baseline_sha256": "khác"}, "hai baseline"),
        ({"feature_order": list(reversed(metadata["feature_order"]))}, "bộ tín hiệu"),
    ):
        with pytest.raises(ValueError, match=message):
            detect(directory, detector, out, config={}, model_metadata={**metadata, **changed})
    # Feature sinh lại sau apply-baseline: bảng z cũ không được dùng.
    manifest = directory / "features-manifest.json"
    manifest.write_text(manifest.read_text(encoding="utf-8") + " ", encoding="utf-8")
    with pytest.raises(ValueError, match="manifest feature khác"):
        detect(directory, RobustZ(threshold=4), out, config={})
    (directory / "baseline-apply.json").unlink()
    with pytest.raises(ValueError, match="apply-baseline"):
        detect(directory, RobustZ(threshold=4), out, config={})


def test_iforest_requires_scaler_fitted_on_the_same_runs(tmp_path):
    train = _train_and_apply(tmp_path)
    with pytest.raises(ValueError, match="scaler"):
        fit_models({"train-a": train["train-a"]})


def test_detector_and_lifecycle_never_import_ground_truth():
    root = Path(__file__).parents[1] / "src" / "aiops_training"
    paths = [*(root / "anomaly").glob("*.py"), *(root / "incident").glob("*.py")]
    for path in sorted(paths):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        imported = [
            node.module or "" for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)
        ] + [
            alias.name
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        ]
        assert not any("ground_truth" in name or "evaluation" in name for name in imported), path
        assert "ground-truth.json" not in path.read_text(encoding="utf-8"), path


def test_cli_fit_iforest_and_detect_end_to_end(tmp_path, capsys):
    runs = tmp_path / "runs"
    runs.mkdir()
    train = _train_and_apply(runs)
    dataset = tmp_path / "dataset.json"
    slots = [
        {"slot_id": f"t{i}", "split": "train", "case": None, "run_id": run_id}
        for i, run_id in enumerate(sorted(train))
    ] + [{"slot_id": "v0", "split": "validation", "case": "C2", "run_id": "validation-x"}]
    dataset.write_text(json.dumps({"dataset_id": "ds", "slots": slots}), encoding="utf-8")
    model = tmp_path / "models" / "iforest-w60.joblib"
    config = Path(__file__).parents[1] / "configs" / "detector-dev-v1.json"
    fit = [
        "fit-iforest",
        "--dataset",
        str(dataset),
        "--runs-dir",
        str(runs),
        "--features-subdir",
        "telemetry/features",
        "--out",
        str(model),
        "--config",
        str(config),
    ]
    assert main(fit) == 0
    fitted = json.loads(model.with_suffix(".joblib.json").read_text(encoding="utf-8"))
    assert fitted["fit_runs"] == ["train-a", "train-b"]  # run validation không vào fit
    # Artifact đủ trường của blueprint mục 9.4.
    assert fitted["detector_config_version"] == "detector-dev.v1"
    assert fitted["seed"] == 20260819 and fitted["hyperparameters"]["n_estimators"] == 200
    assert "code_commit" in fitted and "code_dirty" in fitted
    for name in ("static", "robust_z", "fused", "iforest"):
        args = ["detect", str(train["train-a"]), "--detector", name, "--config", str(config)]
        assert main(args + (["--model", str(model)] if name == "iforest" else [])) == 0
        produced = json.loads(
            (train["train-a"] / "anomalies" / f"anomalies-{name}.json").read_text()
        )
        assert produced["detector_config_version"] == "detector-dev.v1"
        assert produced["detector_config_sha256"]
        rows = pq.read_table(train["train-a"] / "anomalies" / f"anomalies-{name}.parquet")
        assert set(rows.column("detector_config_version").to_pylist()) == {"detector-dev.v1"}
    capsys.readouterr()
