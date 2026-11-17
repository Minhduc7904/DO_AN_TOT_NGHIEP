"""Export metric từ Prometheus bằng `query_range` theo cửa sổ của run.

Giữ giá trị thô (counter tích lũy, bucket histogram) thay vì `rate()`: feature stage tự tính rate
và tái aggregate percentile, đúng quy tắc histogram của schema v1 mục 5.2.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from ..schema import SCHEMA_VERSION
from ..window import ExportWindow

#: Prometheus từ chối query trả quá 11 000 điểm mỗi series; chia cửa sổ dưới ngưỡng này.
MAX_POINTS_PER_QUERY = 10_000


@dataclass(frozen=True)
class MetricFamily:
    name: str
    kind: str  # counter | gauge | histogram_bucket | histogram_sum | histogram_count


#: Họ metric thật của testbed v2 (schema v1 mục 5.2, case catalogue mục 1.1).
METRIC_FAMILIES: tuple[MetricFamily, ...] = (
    MetricFamily("http_server_request_count_total", "counter"),
    MetricFamily("http_server_request_error_count_total", "counter"),
    MetricFamily("http_server_request_duration_seconds_bucket", "histogram_bucket"),
    MetricFamily("http_server_request_duration_seconds_sum", "histogram_sum"),
    MetricFamily("http_server_request_duration_seconds_count", "histogram_count"),
    MetricFamily("lms_dependency_request_count_total", "counter"),
    MetricFamily("lms_dependency_error_count_total", "counter"),
    MetricFamily("lms_dependency_duration_seconds_bucket", "histogram_bucket"),
    MetricFamily("lms_dependency_duration_seconds_sum", "histogram_sum"),
    MetricFamily("lms_dependency_duration_seconds_count", "histogram_count"),
    MetricFamily("process_cpu_time_seconds_total", "counter"),
    MetricFamily("process_memory_usage_bytes", "gauge"),
    MetricFamily("rabbitmq_detailed_queue_messages", "gauge"),
    MetricFamily("rabbitmq_detailed_queue_messages_ready", "gauge"),
    MetricFamily("rabbitmq_detailed_queue_messages_unacked", "gauge"),
    MetricFamily("rabbitmq_detailed_queue_consumers", "gauge"),
)

#: Nhãn do Prometheus/Collector gắn, không mang nghĩa phân tích.
DROPPED_LABELS = frozenset(
    {
        "__name__",
        "instance",
        "job",
        "exported_instance",
        "exported_job",
        "otel_scope_name",
        "otel_scope_version",
    }
)

#: Nhãn có cột riêng trong bảng metric; nhãn khác (nếu có) vào cột `attributes` dạng JSON.
COLUMN_LABELS = (
    "service_name",
    "service_version",
    "service_instance_id",
    "dependency_identity",
    "operation_name",
    "status",
    "http_method",
    "http_route_template",
    "http_status_class",
    "queue",
    "le",
)


class PrometheusError(RuntimeError):
    pass


@dataclass
class MetricExport:
    rows: list[dict[str, Any]] = field(default_factory=list)
    queries: list[str] = field(default_factory=list)
    series_by_family: dict[str, int] = field(default_factory=dict)
    invalid_value_count: int = 0


class PrometheusAdapter:
    def __init__(self, client: httpx.Client, base_url: str) -> None:
        self._client = client
        self._base = base_url.rstrip("/")

    def query_range(
        self, query: str, start: datetime, end: datetime, step_seconds: int
    ) -> list[dict[str, Any]]:
        response = self._client.get(
            f"{self._base}/api/v1/query_range",
            params={
                "query": query,
                "start": f"{start.timestamp():.3f}",
                "end": f"{end.timestamp():.3f}",
                "step": f"{step_seconds}s",
            },
        )
        body = _json(response)
        if response.status_code != 200 or body.get("status") != "success":
            raise PrometheusError(
                f"query_range {query!r}: HTTP {response.status_code} {body.get('error', '')}"
            )
        return body["data"]["result"]

    def export(
        self,
        window: ExportWindow,
        step_seconds: int = 5,
        families: tuple[MetricFamily, ...] = METRIC_FAMILIES,
    ) -> MetricExport:
        result = MetricExport()
        chunk = timedelta(seconds=step_seconds * MAX_POINTS_PER_QUERY)
        for family in families:
            query = f'{{__name__="{family.name}"}}'
            result.queries.append(query)
            series_keys: set[str] = set()
            chunk_start = window.start
            while chunk_start < window.end:
                chunk_end = min(chunk_start + chunk, window.end)
                for series in self.query_range(query, chunk_start, chunk_end, step_seconds):
                    labels = series["metric"]
                    series_keys.add(json.dumps(labels, sort_keys=True))
                    for timestamp, raw in series["values"]:
                        row = _row(window.run_id, family, labels, timestamp, raw)
                        if row["quality_flags"]:
                            result.invalid_value_count += 1
                        result.rows.append(row)
                # Điểm cuối của chunk trước trùng điểm đầu chunk sau; lùi một bước để không trùng.
                chunk_start = chunk_end + timedelta(seconds=step_seconds)
            result.series_by_family[family.name] = len(series_keys)
        return result


def _json(response: httpx.Response) -> dict[str, Any]:
    try:
        return response.json()
    except ValueError:
        return {"error": response.text[:200]}


def _row(
    run_id: str, family: MetricFamily, labels: dict[str, str], timestamp: float, raw: str
) -> dict[str, Any]:
    value = float(raw)
    flags: list[str] = []
    if math.isnan(value) or math.isinf(value):
        flags.append("invalid_value")
        stored: float | None = None
    else:
        stored = value
    extra = {
        key: val
        for key, val in labels.items()
        if key not in DROPPED_LABELS and key not in COLUMN_LABELS
    }
    return {
        "run_id": run_id,
        "timestamp": datetime.fromtimestamp(float(timestamp), tz=UTC),
        "metric_name": family.name,
        "metric_kind": family.kind,
        **{label: labels.get(label) for label in COLUMN_LABELS},
        "value": stored,
        "attributes": json.dumps(extra, sort_keys=True, ensure_ascii=False) if extra else None,
        "source": "prometheus",
        "schema_version": SCHEMA_VERSION,
        "quality_flags": flags,
    }
