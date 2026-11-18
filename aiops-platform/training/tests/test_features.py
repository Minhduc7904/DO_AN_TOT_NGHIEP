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
        "modality_availability": {"metrics": "available", "traces": "missing", "logs": "missing"},
        "files": {},
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return tmp_path


def test_service_and_edge_features_on_synthetic_artifact(tmp_path):
    service_rows, edge_rows, meta = build_features(_artifact(tmp_path))
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
    assert saved["feature_version"] == "feature.v0"
    assert saved["edges"] == ["course->course-postgres"]
