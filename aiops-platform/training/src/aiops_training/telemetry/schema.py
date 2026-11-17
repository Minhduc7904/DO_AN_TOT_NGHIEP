"""Schema cột của artifact export (Parquet). Data dictionary chi tiết: task-05 tuần 13.

Cột bám theo logical schema `MetricRecord`, `TraceSpan`, `LogRecord` của
telemetry-and-ground-truth-schema-v1 mục 5, cụ thể hóa cho topology v2.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

import pyarrow as pa

SCHEMA_VERSION = "telemetry.v2"

_TS = pa.timestamp("ns", tz="UTC")
_FLAGS = pa.list_(pa.string())

METRIC_SCHEMA = pa.schema(
    [
        ("run_id", pa.string()),
        ("timestamp", _TS),
        ("metric_name", pa.string()),
        ("metric_kind", pa.string()),
        ("service_name", pa.string()),
        ("service_version", pa.string()),
        ("service_instance_id", pa.string()),
        ("dependency_identity", pa.string()),
        ("operation_name", pa.string()),
        ("status", pa.string()),
        ("http_method", pa.string()),
        ("http_route_template", pa.string()),
        ("http_status_class", pa.string()),
        ("queue", pa.string()),
        ("le", pa.string()),
        ("value", pa.float64()),
        ("attributes", pa.string()),
        ("source", pa.string()),
        ("schema_version", pa.string()),
        ("quality_flags", _FLAGS),
    ]
)

SPAN_SCHEMA = pa.schema(
    [
        ("run_id", pa.string()),
        ("trace_id", pa.string()),
        ("span_id", pa.string()),
        ("parent_span_id", pa.string()),
        ("service_name", pa.string()),
        ("service_version", pa.string()),
        ("service_instance_id", pa.string()),
        ("span_kind", pa.string()),
        ("span_name", pa.string()),
        ("operation_name", pa.string()),
        ("start_time", _TS),
        ("end_time", _TS),
        ("duration_ms", pa.float64()),
        ("status", pa.string()),
        ("error_type", pa.string()),
        ("http_method", pa.string()),
        ("http_route", pa.string()),
        ("http_status", pa.int32()),
        ("peer_service", pa.string()),
        ("dependency_identity", pa.string()),
        ("message_id", pa.string()),
        ("command_name", pa.string()),
        ("messaging_operation", pa.string()),
        ("queue", pa.string()),
        ("trace_root_name", pa.string()),
        ("attributes", pa.string()),
        ("source", pa.string()),
        ("schema_version", pa.string()),
        ("quality_flags", _FLAGS),
    ]
)

LOG_SCHEMA = pa.schema(
    [
        ("run_id", pa.string()),
        ("timestamp", _TS),
        ("level", pa.string()),
        ("service_name", pa.string()),
        ("service_version", pa.string()),
        ("service_instance_id", pa.string()),
        ("trace_id", pa.string()),
        ("span_id", pa.string()),
        ("message_id", pa.string()),
        ("event", pa.string()),
        ("error_type", pa.string()),
        ("dependency_identity", pa.string()),
        ("operation_name", pa.string()),
        ("http_method", pa.string()),
        ("http_route", pa.string()),
        ("http_status", pa.int32()),
        ("duration_ms", pa.float64()),
        ("message", pa.string()),
        ("attributes", pa.string()),
        ("source", pa.string()),
        ("schema_version", pa.string()),
        ("quality_flags", _FLAGS),
    ]
)


def to_table(rows: Iterable[Mapping[str, Any]], schema: pa.Schema) -> pa.Table:
    """Dựng bảng theo đúng schema; thiếu cột thì null, thừa cột thì báo lỗi.

    Báo lỗi khi thừa cột để không âm thầm mất dữ liệu.
    """
    names = set(schema.names)
    columns: dict[str, list[Any]] = {name: [] for name in schema.names}
    for row in rows:
        extra = set(row) - names
        if extra:
            raise ValueError(f"Cột không có trong schema: {sorted(extra)}")
        for name in schema.names:
            columns[name].append(row.get(name))
    return pa.table(columns, schema=schema)
