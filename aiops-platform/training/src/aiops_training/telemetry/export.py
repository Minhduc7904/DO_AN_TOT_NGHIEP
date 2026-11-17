"""Export telemetry của một run ra artifact Parquet kèm manifest.

Thư mục kết quả `<out>/<run_id>/`:

- `metrics.parquet`, `spans.parquet`, `logs.parquet` theo `schema.py`;
- `manifest.json` theo `TelemetryArtifactManifest` (schema v1 mục 6), kèm truy vấn đã dùng và thống
  kê cắt bớt để không có dữ liệu bị bỏ âm thầm.

Một nguồn lỗi không chặn hai nguồn còn lại: modality đó ghi `error` trong `modality_availability`.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from .adapters.loki import LokiAdapter
from .adapters.prometheus import PrometheusAdapter
from .adapters.tempo import TempoAdapter, TempoExportOptions
from .identity import NOISE_TRACE_ROOT_NAMES, PROBE_ROUTES
from .schema import LOG_SCHEMA, METRIC_SCHEMA, SCHEMA_VERSION, SPAN_SCHEMA, to_table
from .window import ExportWindow

MANIFEST_VERSION = "telemetry-artifact.v1"
#: Prometheus, Tempo, Loki của testbed giữ dữ liệu 24 giờ.
RETENTION = timedelta(hours=24)


@dataclass(frozen=True)
class ExportOptions:
    step_seconds: int = 5
    exclude_probe_logs: bool = True
    tempo: TempoExportOptions = field(default_factory=TempoExportOptions)


@dataclass(frozen=True)
class Sources:
    prometheus: PrometheusAdapter
    tempo: TempoAdapter
    loki: LokiAdapter
    urls: dict[str, str]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write(table: pa.Table, path: Path) -> dict[str, Any]:
    pq.write_table(table, path, compression="zstd")
    return {"path": path.name, "sha256": _sha256(path), "record_count": table.num_rows}


def check_retention(window: ExportWindow, now: datetime | None = None) -> None:
    current = now or datetime.now(UTC)
    if window.start < current - RETENTION:
        raise ValueError(
            f"Cửa sổ bắt đầu {window.start.isoformat()} đã quá retention 24 giờ của backend; "
            "dữ liệu có thể đã bị xóa một phần."
        )


def export_run(
    window: ExportWindow,
    out_dir: Path,
    sources: Sources,
    options: ExportOptions | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    options = options or ExportOptions()
    check_retention(window, now)
    target = out_dir / window.run_id
    target.mkdir(parents=True, exist_ok=True)

    availability: dict[str, str] = {}
    files: dict[str, Any] = {}
    stats: dict[str, Any] = {}
    queries: dict[str, Any] = {}
    errors: dict[str, str] = {}

    try:
        metrics = sources.prometheus.export(window, step_seconds=options.step_seconds)
        files["metrics"] = _write(to_table(metrics.rows, METRIC_SCHEMA), target / "metrics.parquet")
        queries["metrics"] = metrics.queries
        stats["metrics"] = {
            "series_by_family": metrics.series_by_family,
            "samples": len(metrics.rows),
            "invalid_value_count": metrics.invalid_value_count,
        }
        availability["metrics"] = "available" if metrics.rows else "empty"
    except Exception as error:  # noqa: BLE001 - ghi lỗi của từng nguồn vào manifest
        availability["metrics"] = "error"
        errors["metrics"] = f"{type(error).__name__}: {error}"

    try:
        traces = sources.tempo.export(window, options.tempo)
        files["traces"] = _write(to_table(traces.rows, SPAN_SCHEMA), target / "spans.parquet")
        queries["traces"] = {"search": "{ }", "fetch": "GET /api/v2/traces/<trace_id>"}
        trace_stats = asdict(traces)
        trace_stats.pop("rows")
        trace_stats["spans"] = len(traces.rows)
        stats["traces"] = trace_stats
        truncated = traces.dropped_by_budget > 0 or traces.search_limit_hit > 0
        if traces.aborted:
            availability["traces"] = "partial"
        elif not traces.rows:
            availability["traces"] = "empty"
        else:
            availability["traces"] = "truncated" if truncated else "available"
    except Exception as error:  # noqa: BLE001
        availability["traces"] = "error"
        errors["traces"] = f"{type(error).__name__}: {error}"

    try:
        logs = sources.loki.export(window, exclude_probes=options.exclude_probe_logs)
        files["logs"] = _write(to_table(logs.rows, LOG_SCHEMA), target / "logs.parquet")
        queries["logs"] = logs.query
        stats["logs"] = {
            "entries": len(logs.rows),
            "pages": logs.pages,
            "probe_logs_excluded": logs.probe_logs_excluded,
            "same_timestamp_overflow": logs.same_timestamp_overflow,
        }
        availability["logs"] = "available" if logs.rows else "empty"
    except Exception as error:  # noqa: BLE001
        availability["logs"] = "error"
        errors["logs"] = f"{type(error).__name__}: {error}"

    generated_at = (now or datetime.now(UTC)).isoformat().replace("+00:00", "Z")
    manifest = {
        "artifact_manifest_version": MANIFEST_VERSION,
        "artifact_id": f"{window.run_id}--raw--{generated_at}",
        "run_id": window.run_id,
        "artifact_kind": "raw",
        "modality": "multimodal",
        "modality_availability": availability,
        "telemetry_schema_version": SCHEMA_VERSION,
        "variant_kind": "full",
        "source_artifact_id": None,
        "format": "parquet",
        "files": files,
        "generated_at": generated_at,
        "time_start": window.start.isoformat().replace("+00:00", "Z"),
        "time_end": window.end.isoformat().replace("+00:00", "Z"),
        "record_count": sum(entry["record_count"] for entry in files.values()),
        "source_systems": sources.urls,
        "export_config": {
            "step_seconds": options.step_seconds,
            "exclude_probe_logs": options.exclude_probe_logs,
            "probe_routes": list(PROBE_ROUTES),
            "noise_trace_root_names": sorted(NOISE_TRACE_ROOT_NAMES),
            "tempo": asdict(options.tempo),
        },
        "queries": queries,
        "stats": stats,
        "errors": errors,
        "quality_report_id": None,
    }
    (target / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return manifest
