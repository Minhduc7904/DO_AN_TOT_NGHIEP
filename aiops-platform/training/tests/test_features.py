from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pyarrow.parquet as pq
import pytest

from aiops_training.features.pipeline import (
    FeatureConfig,
    build_features,
    histogram_quantile,
    increase,
    windows,
    write_features,
)
from aiops_training.telemetry.schema import METRIC_SCHEMA, to_table

T0 = datetime(2026, 11, 18, 5, 0, tzinfo=UTC)


def test_increase_handles_new_series_reset_and_empty_window():
    times = [0.0, 10.0, 20.0, 30.0]
    values = [5.0, 7.0, 2.0, 4.0]
    assert increase(times, values, 5, 40) == 6  # 7−5, reset → +2, 4−2
    assert increase(times, values, -5, 1) == 5  # series mới giữa cửa sổ: trước đó coi là 0
    assert increase(times, values, 31, 50) == 0
    # Series có từ trước artifact: mẫu đầu chỉ là mốc, không đếm giá trị tích lũy từ lúc khởi động.
    assert increase([0.0, 10.0], [1000.0, 1004.0], 0, 15, carried=True) == 4
    assert increase([0.0], [1000.0], 0, 15, carried=True) == 0


def test_histogram_quantile_matches_prometheus_interpolation():
    buckets = {0.1: 50.0, 0.5: 90.0, 1.0: 100.0, float("inf"): 100.0}
    assert histogram_quantile(0.5, buckets) == pytest.approx(0.1)
    assert histogram_quantile(0.7, buckets) == pytest.approx(0.1 + 0.4 * (20 / 40))
    assert histogram_quantile(0.99, buckets) == pytest.approx(0.5 + 0.5 * 0.9)
    assert histogram_quantile(0.5, {0.1: 0.0, float("inf"): 0.0}) is None
    assert histogram_quantile(0.9, {}) is None


def test_windows_are_aligned_60s_step_15s():
    start = T0.timestamp() + 7
    result = windows(start, start + 120, FeatureConfig())
    assert result[0][0] == T0.timestamp() + 15
    assert all(end - begin == 60 for begin, end in result)
    assert [b - a for (a, _), (b, _) in zip(result, result[1:], strict=False)] == [15] * 3


def _metric(name: str, seconds: float, value: float, **labels) -> dict:
    return {
        "run_id": "run-1",
        "timestamp": T0 + timedelta(seconds=seconds),
        "metric_name": name,
        "metric_kind": "counter",
        "value": value,
        "schema_version": "telemetry.v2",
        "quality_flags": [],
        **labels,
    }


def _artifact(tmp_path: Path) -> Path:
    rows = []
    for step in range(0, 600, 5):
        # identity: CPU tăng tới giây 300 rồi đứng yên (bị pause), mẫu vẫn còn.
        cpu = min(step, 300) * 0.01
        rows.append(_metric("process_cpu_time_seconds_total", step, cpu, service_name="identity"))
        rows.append(
            _metric("process_cpu_time_seconds_total", step, step * 0.02, service_name="course")
        )
        rows.append(
            _metric("http_server_request_count_total", step, step * 2.0, service_name="course")
        )
        calls = step / 5 * 4  # 4 lời gọi mỗi 5 s
        labels = {"service_name": "course", "dependency_identity": "course-postgres"}
        total = (min(step, 300) / 5 * 4) * 0.002 + (max(step - 300, 0) / 5 * 4) * 0.2
        rows.append(_metric("lms_dependency_request_count_total", step, calls, **labels))
        rows.append(_metric("lms_dependency_duration_seconds_count", step, calls, **labels))
        rows.append(_metric("lms_dependency_duration_seconds_sum", step, total, **labels))
        fast_bucket = min(step, 300) / 5 * 4
        for le, value in (("0.01", fast_bucket), ("0.5", calls), ("+Inf", calls)):
            rows.append(
                _metric("lms_dependency_duration_seconds_bucket", step, value, le=le, **labels)
            )
    pq.write_table(to_table(rows, METRIC_SCHEMA), tmp_path / "metrics.parquet")
    manifest = {
        "run_id": "run-1",
        "manifest_version": "telemetry-artifact.v1",
        "time_start": T0.isoformat().replace("+00:00", "Z"),
        "time_end": (T0 + timedelta(seconds=600)).isoformat().replace("+00:00", "Z"),
        # Export chạy sau time_end + độ trễ thu thập, như runner (kiểm ở leakage).
        "generated_at": (T0 + timedelta(seconds=660)).isoformat().replace("+00:00", "Z"),
        "modality_availability": {"metrics": "available", "traces": "missing", "logs": "missing"},
        "files": {},
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return tmp_path


def test_service_and_edge_features_on_synthetic_artifact(tmp_path):
    tables = build_features(_artifact(tmp_path))
    service_rows, edge_rows, meta = tables.service_rows, tables.edge_rows, tables.meta
    assert meta["windows"] == len(windows(T0.timestamp(), T0.timestamp() + 600, FeatureConfig()))
    by_window = {(row["window_start"], row["service_name"]): row for row in service_rows}
    early = by_window[(T0 + timedelta(seconds=60), "course")]
    assert early["request_rate"] == pytest.approx(2.0)
    assert early["cpu_usage"] == pytest.approx(0.02)
    assert early["missing_traces"] is True

    identity_early = by_window[(T0 + timedelta(seconds=60), "identity")]
    identity_late = by_window[(T0 + timedelta(seconds=420), "identity")]
    assert identity_early["telemetry_silent"] is False
    assert identity_late["telemetry_silent"] is True
    assert identity_late["cpu_usage"] is None and identity_late["request_rate"] is None
    gateway = by_window[(T0 + timedelta(seconds=60), "gateway")]
    assert gateway["missing_metrics"] is True and gateway["telemetry_silent"] is False

    edges = {
        row["window_start"]: row
        for row in edge_rows
        if row["caller_service"] == "course" and row["dependency_identity"] == "course-postgres"
    }
    before = edges[T0 + timedelta(seconds=120)]
    during = edges[T0 + timedelta(seconds=420)]
    assert before["duration_mean"] == pytest.approx(0.002)
    assert during["duration_mean"] == pytest.approx(0.2)
    assert before["duration_p95"] < 0.01 < during["duration_p95"]
    assert during["call_count"] == pytest.approx(48)
    assert during["error_ratio"] == 0


def test_write_features_outputs_parquet_and_manifest(tmp_path):
    meta = write_features(_artifact(tmp_path))
    target = tmp_path / "features"
    assert pq.read_table(target / "service_windows.parquet").num_rows == meta["service_rows"]
    assert pq.read_table(target / "edge_windows.parquet").num_rows == meta["edge_rows"]
    saved = json.loads((target / "features-manifest.json").read_text(encoding="utf-8"))
    assert saved["feature_config_version"] == "feature.v1"
    assert saved["noise_filter_version"] == "noise.v1"
    assert saved["edges"] == ["course->course-postgres"]


def test_first_window_does_not_count_cumulative_value_from_process_start(tmp_path):
    artifact = _artifact(tmp_path)
    table = pq.read_table(artifact / "metrics.parquet").to_pylist()
    for row in table:
        if row["metric_name"] == "http_server_request_count_total":
            row["value"] += 1_000_000  # process đã chạy lâu trước khi artifact bắt đầu
    pq.write_table(to_table(table, METRIC_SCHEMA), artifact / "metrics.parquet")
    service_rows = build_features(artifact).service_rows
    first = next(
        row for row in service_rows if row["service_name"] == "course" and row["window_start"] == T0
    )
    assert first["request_rate"] == pytest.approx(2.0 * 55 / 60)


# --- feature v1 (task-05 tuần 15) -------------------------------------------------------------


def _rewrite(artifact: Path, extra: list[dict], **manifest_changes) -> None:
    rows = pq.read_table(artifact / "metrics.parquet").to_pylist() + extra
    pq.write_table(to_table(rows, METRIC_SCHEMA), artifact / "metrics.parquet")
    manifest = json.loads((artifact / "manifest.json").read_text(encoding="utf-8"))
    manifest.update(manifest_changes)
    (artifact / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


def _row(rows: list[dict], seconds: float, **match) -> dict:
    return next(
        row
        for row in rows
        if row["window_start"] == T0 + timedelta(seconds=seconds)
        and all(row[key] == value for key, value in match.items())
    )


def test_probe_routes_and_operations_are_filtered(tmp_path):
    artifact = _artifact(tmp_path)
    extra = []
    for step in range(0, 600, 5):
        # Probe /ready mỗi 5 s ở course; ping MinIO của media mỗi 5 s, chậm 1 s.
        extra.append(
            _metric(
                "http_server_request_count_total",
                step,
                step / 5,
                service_name="course",
                http_route_template="/ready",
            )
        )
        labels = {
            "service_name": "media",
            "dependency_identity": "media-minio",
            "operation_name": "ping",
        }
        extra.append(_metric("lms_dependency_request_count_total", step, step / 5, **labels))
        extra.append(_metric("lms_dependency_duration_seconds_count", step, step / 5, **labels))
        extra.append(_metric("lms_dependency_duration_seconds_sum", step, step / 5, **labels))
    _rewrite(artifact, extra)
    tables = build_features(artifact)
    course = _row(tables.service_rows, 60, service_name="course")
    assert course["request_rate"] == pytest.approx(2.0)  # chỉ traffic thật, không có probe
    assert not any(row["dependency_identity"] == "media-minio" for row in tables.edge_rows)
    assert tables.meta["noise_filter"]["probe_operations"] == ["ping"]


def test_identity_alias_maps_outbox_replay_edge(tmp_path):
    artifact = _artifact(tmp_path)
    extra = []
    for step in range(0, 600, 5):
        for identity in ("notification-worker-rabbitmq", "notification-rabbitmq"):
            extra.append(
                _metric(
                    "lms_dependency_request_count_total",
                    step,
                    step / 5,
                    service_name="notification-worker",
                    dependency_identity=identity,
                )
            )
    _rewrite(artifact, extra)
    tables = build_features(artifact)
    edges = {(row["caller_service"], row["dependency_identity"]) for row in tables.edge_rows}
    assert ("notification-worker", "notification-worker-rabbitmq") in edges
    assert ("notification-worker", "notification-rabbitmq") not in edges
    merged = _row(
        tables.edge_rows,
        60,
        caller_service="notification-worker",
        dependency_identity="notification-worker-rabbitmq",
    )
    assert merged["call_count"] == pytest.approx(24)  # 2 series × 12 lời gọi trong 60 s


def test_spans_count_in_window_of_their_end_time(tmp_path):
    from aiops_training.telemetry.schema import SPAN_SCHEMA

    artifact = _artifact(tmp_path)
    span = {
        "run_id": "run-1",
        "trace_id": "t1",
        "span_id": "s1",
        "service_name": "course",
        "span_kind": "SERVER",
        "span_name": "POST /x",
        # Bắt đầu ở giây 100, kết thúc lỗi ở giây 170: trạng thái chỉ biết từ giây 170.
        "start_time": T0 + timedelta(seconds=100),
        "end_time": T0 + timedelta(seconds=170),
        "duration_ms": 70_000.0,
        "status": "error",
        "schema_version": "telemetry.v2",
        "quality_flags": [],
    }
    # Bốn span lỗi kết thúc ở giây 170, một span thành công kết thúc ở giây 200.
    spans = [{**span, "span_id": f"s{i}"} for i in range(4)]
    spans.append({**span, "span_id": "s4", "end_time": T0 + timedelta(seconds=200), "status": "ok"})
    pq.write_table(to_table(spans, SPAN_SCHEMA), artifact / "spans.parquet")
    _rewrite(
        artifact,
        [],
        modality_availability={"metrics": "available", "traces": "truncated", "logs": "missing"},
    )
    rows = build_features(artifact).service_rows
    # Cửa sổ [90, 150) chứa lúc bắt đầu nhưng span chưa xong: không được thấy lỗi.
    early = _row(rows, 90, service_name="course")
    assert early["span_count"] == 0 and early["trace_error_rate"] is None
    # [120, 180) chứa end_time của 4 span: dưới MIN_SPANS_FOR_RATE (5) nên tỉ lệ để rỗng.
    late = _row(rows, 120, service_name="course")
    assert late["span_count"] == 4 and late["trace_error_rate"] is None
    assert late["traces_truncated"] is True and late["missing_traces"] is False
    # Log `missing`: đặc trưng log rỗng, không phải 0.
    assert late["missing_logs"] is True
    assert late["log_count"] is None and late["log_error_rate"] is None
    # [150, 210) có đủ 5 span: 4 lỗi / 5.
    full = _row(rows, 150, service_name="course")
    assert full["span_count"] == 5 and full["trace_error_rate"] == pytest.approx(0.8)


def test_metric_sample_exactly_at_window_end_is_excluded(tmp_path):
    artifact = _artifact(tmp_path)
    table = pq.read_table(artifact / "metrics.parquet").to_pylist()
    for row in table:
        # Đúng giây 120 (window_end của cửa sổ [60, 120)), course nhận thêm 600 request.
        if row["metric_name"] == "http_server_request_count_total" and row[
            "timestamp"
        ] >= T0 + timedelta(seconds=120):
            row["value"] += 600
    pq.write_table(to_table(table, METRIC_SCHEMA), artifact / "metrics.parquet")
    rows = build_features(artifact).service_rows
    # Cửa sổ [60, 120) không thấy mẫu ở giây 120: vẫn 2 req/s như artifact gốc.
    assert _row(rows, 60, service_name="course")["request_rate"] == pytest.approx(2.0)
    # Cửa sổ kế tiếp [75, 135) chứa giây 120 nên thấy 600 request thêm.
    assert _row(rows, 75, service_name="course")["request_rate"] == pytest.approx(2.0 + 10.0)


def test_queue_windows_and_warmup_flag(tmp_path):
    artifact = _artifact(tmp_path)
    extra = []
    for step in range(0, 600, 5):
        for queue, ready, unacked in (
            ("ai-worker--run-ai-job-v1", 0, 1 if step < 300 else 3),
            ("ai-worker--run-ai-job-v1.error", 2, 0),
        ):
            labels = {"service_name": "ai-worker", "queue": queue}
            extra.append(_metric("rabbitmq_detailed_queue_messages_ready", step, ready, **labels))
            extra.append(
                _metric("rabbitmq_detailed_queue_messages_unacked", step, unacked, **labels)
            )
            extra.append(_metric("rabbitmq_detailed_queue_consumers", step, 1, **labels))
    _rewrite(artifact, extra)
    tables = build_features(artifact, FeatureConfig(warmup_s=120))
    job = _row(tables.queue_rows, 420, queue="ai-worker--run-ai-job-v1")
    assert job["messages_unacked"] == 3 and job["consumers"] == 1 and job["dead_letter"] is False
    assert _row(tables.queue_rows, 60, queue="ai-worker--run-ai-job-v1")["messages_unacked"] == 1
    assert _row(tables.queue_rows, 60, queue="ai-worker--run-ai-job-v1.error")["dead_letter"]
    assert _row(tables.service_rows, 90, service_name="course")["warmup"] is True
    assert _row(tables.service_rows, 120, service_name="course")["warmup"] is False
    assert tables.meta["queues"] == [
        "ai-worker:ai-worker--run-ai-job-v1",
        "ai-worker:ai-worker--run-ai-job-v1.error",
    ]
