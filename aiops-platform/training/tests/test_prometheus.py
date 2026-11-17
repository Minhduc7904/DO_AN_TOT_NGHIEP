import json
from datetime import timedelta

import httpx
import pytest
from conftest import make_client

from aiops_training.telemetry.adapters.prometheus import (
    MetricFamily,
    PrometheusAdapter,
    PrometheusError,
)


def _matrix(series):
    return httpx.Response(
        200, json={"status": "success", "data": {"resultType": "matrix", "result": series}}
    )


DEPENDENCY_SERIES = {
    "metric": {
        "__name__": "lms_dependency_duration_seconds_bucket",
        "dependency_identity": "course-postgres",
        "exported_instance": "course-compose-1",
        "exported_job": "course",
        "instance": "otel-collector:8889",
        "job": "otel-collector",
        "le": "0.005",
        "operation_name": "course.create",
        "otel_scope_name": "@aiops-lms/common",
        "service_instance_id": "course-compose-1",
        "service_name": "course",
        "service_version": "0.1.0",
        "status": "ok",
        "unexpected_label": "x",
    },
    "values": [[1794908580, "3"], [1794908585, "NaN"]],
}


def test_export_maps_labels_and_flags_invalid_values(window):
    calls = []
    client = make_client(
        {"/api/v1/query_range": lambda request: _matrix([DEPENDENCY_SERIES])}, calls
    )
    family = MetricFamily("lms_dependency_duration_seconds_bucket", "histogram_bucket")
    result = PrometheusAdapter(client, "http://prom").export(window, 5, (family,))

    assert result.series_by_family == {family.name: 1}
    assert result.invalid_value_count == 1
    first, second = result.rows
    assert first["service_name"] == "course"
    assert first["dependency_identity"] == "course-postgres"
    assert first["le"] == "0.005"
    assert first["value"] == 3.0
    assert first["metric_kind"] == "histogram_bucket"
    assert json.loads(first["attributes"]) == {"unexpected_label": "x"}
    assert second["value"] is None and second["quality_flags"] == ["invalid_value"]
    assert calls[0].url.params["query"] == '{__name__="lms_dependency_duration_seconds_bucket"}'
    assert calls[0].url.params["step"] == "5s"


def test_long_window_is_split_under_point_limit(window):
    calls = []
    client = make_client({"/api/v1/query_range": lambda request: _matrix([])}, calls)
    long_window = type(window)(window.run_id, window.start, window.start + timedelta(hours=30))
    PrometheusAdapter(client, "http://prom").export(
        long_window, 5, (MetricFamily("process_memory_usage_bytes", "gauge"),)
    )
    # 30 giờ / (5 s × 10 000 điểm) → 3 lần gọi, mỗi lần ≤ 10 000 điểm.
    assert len(calls) == 3
    for request in calls:
        span = float(request.url.params["end"]) - float(request.url.params["start"])
        assert span / 5 <= 10_000


def test_error_response_raises(window):
    client = make_client(
        {
            "/api/v1/query_range": lambda request: httpx.Response(
                400, json={"status": "error", "error": "bad query"}
            )
        }
    )
    with pytest.raises(PrometheusError, match="bad query"):
        PrometheusAdapter(client, "http://prom").export(
            window, 5, (MetricFamily("process_memory_usage_bytes", "gauge"),)
        )
