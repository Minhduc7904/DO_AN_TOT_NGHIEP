"""Data-quality check cho artifact export của một run (`TelemetryQualityReport`, schema v1 mục 7).

Kiểm:

- độ phủ 11/11 runtime theo từng modality và trạng thái thiếu có ngữ nghĩa (schema v1 mục 7.1);
- modality bị thiếu hoặc lỗi;
- cờ `telemetry_silent`: bộ đếm CPU của process không tăng quá ngưỡng trong cửa sổ.
  Process Node đang sống luôn tiêu một ít CPU mỗi 5 giây, nên bộ đếm đứng yên nghĩa là
  runtime chết, bị pause hoặc mất kết nối tới Collector (ví dụ `docker pause identity`
  của C6). Không dùng "có mẫu hay không": Collector giữ giá trị cuối của series thêm
  khoảng 5 phút (mặc định `metric_expiration`); đo ngày 17/11/2026 khi pause `scheduler`
  70 giây, Prometheus vẫn có mẫu mỗi 5 giây với giá trị đứng yên;
- định danh, khoảng trống scrape, quan hệ cha-con của span, tương quan log-trace, bản ghi trùng.

Ngưỡng nằm ở `QualityConfig`, không gắn cứng trong schema (schema v1 mục 7.2).
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from ..identity import RUNTIMES
from ..window import parse_utc

QUALITY_VERSION = "telemetry-quality.v1"

#: Worker chưa ghi log khi xử lý command (case catalogue mục 1.5): ngoài access log probe thì không
#: có log nào. Khi probe bị loại, thiếu log của worker là `not_instrumented`, không phải lỗi
#: dữ liệu.
WORKERS_WITHOUT_COMMAND_LOGS = frozenset(
    {"media-worker", "notification-worker", "scheduler-worker", "ai-worker"}
)
#: Bộ đếm tăng đều ở mọi runtime đang sống, dùng làm nhịp tim để phát hiện im lặng.
HEARTBEAT_METRIC = "process_cpu_time_seconds_total"
#: Log thuộc ngữ cảnh request/dependency, nơi kỳ vọng có `trace_id`
#: (schema v1 mục 7.2 `logs_quality`).
CONTEXT_LOG_EVENTS = frozenset({"http.server.request", "http.server.error", "dependency.failure"})


@dataclass(frozen=True)
class QualityConfig:
    expected_scrape_interval_s: float = 5.0
    #: Im lặng dài hơn ngưỡng này (6 chu kỳ) thì gắn `telemetry_silent`.
    silent_threshold_s: float = 30.0
    #: Khoảng trống đầu/cuối cửa sổ không tính là im lặng (telemetry tới trễ, export cộng 30 s
    #: cuối cửa sổ).
    edge_tolerance_s: float = 35.0
    min_log_correlation_ratio: float = 0.95


def _ts(value: datetime) -> float:
    return value.timestamp()


def _gaps(times: list[float], start: float, end: float) -> list[tuple[float, float]]:
    """Các khoảng không có mẫu giữa `start` và `end` (gồm cả đầu và cuối)."""
    points = [start, *sorted(times), end]
    return [(a, b) for a, b in zip(points, points[1:], strict=False) if b > a]


def _iso(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, tz=UTC).isoformat().replace("+00:00", "Z")


def _alive_times(
    series: dict[tuple[str, str], list[tuple[float, float]]],
) -> dict[str, list[float]]:
    """Thời điểm mỗi runtime "còn sống": mẫu đầu tiên và mọi mẫu mà bộ đếm tăng so với mẫu trước."""
    alive: dict[str, list[float]] = defaultdict(list)
    for (runtime, _instance), points in series.items():
        previous: float | None = None
        for timestamp, value in sorted(points):
            if previous is None or value > previous:
                alive[runtime].append(timestamp)
            previous = value
    return alive


def _read(path: Path, columns: list[str]) -> list[dict[str, Any]] | None:
    if not path.exists():
        return None
    return pq.read_table(path, columns=columns).to_pylist()


def evaluate(artifact_dir: Path, config: QualityConfig | None = None) -> dict[str, Any]:
    config = config or QualityConfig()
    manifest = json.loads((artifact_dir / "manifest.json").read_text(encoding="utf-8"))
    start = _ts(parse_utc(manifest["time_start"]))
    end = _ts(parse_utc(manifest["time_end"]))
    availability = manifest["modality_availability"]
    exclude_probe_logs = manifest.get("export_config", {}).get("exclude_probe_logs", True)
    reasons: list[str] = []
    fatal = False

    metrics = _read(
        artifact_dir / "metrics.parquet",
        [
            "timestamp",
            "metric_name",
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
            "value",
            "quality_flags",
        ],
    )
    spans = _read(
        artifact_dir / "spans.parquet",
        [
            "trace_id",
            "span_id",
            "parent_span_id",
            "service_name",
            "service_version",
            "service_instance_id",
            "start_time",
        ],
    )
    logs = _read(
        artifact_dir / "logs.parquet",
        [
            "timestamp",
            "service_name",
            "service_version",
            "service_instance_id",
            "trace_id",
            "event",
            "message",
            "quality_flags",
        ],
    )

    for modality, rows in (("metrics", metrics), ("traces", spans), ("logs", logs)):
        state = availability.get(modality, "missing")
        if state == "error" or rows is None:
            fatal = True
            reasons.append(f"missing_modality:{modality}")
        elif state in ("truncated", "partial"):
            reasons.append(f"{state}_modality:{modality}")

    # ---- định danh ------------------------------------------------------------------------------
    identity = {
        "total_records": 0,
        "missing_service_name_count": 0,
        "missing_service_version_count": 0,
        "missing_service_instance_id_count": 0,
        "unknown_service_name_count": 0,
        "unknown_service_names": [],
    }
    unknown: set[str] = set()
    for rows in (metrics or [], spans or [], logs or []):
        for row in rows:
            identity["total_records"] += 1
            name = row["service_name"]
            if not name:
                identity["missing_service_name_count"] += 1
            elif name not in RUNTIMES:
                identity["unknown_service_name_count"] += 1
                unknown.add(name)
            if not row["service_version"]:
                identity["missing_service_version_count"] += 1
            if not row["service_instance_id"]:
                identity["missing_service_instance_id_count"] += 1
    identity["unknown_service_names"] = sorted(unknown)
    if identity["missing_service_name_count"] or unknown:
        fatal = True
        reasons.append("unknown_or_missing_service_name")

    # ---- metrics: phủ, khoảng trống, im lặng -----------------------------------------------------
    heartbeat_series: dict[tuple[str, str], list[tuple[float, float]]] = defaultdict(list)
    metric_counts: Counter[str] = Counter()
    duplicate_metrics = 0
    seen_metric: set[tuple[Any, ...]] = set()
    invalid_values = 0
    for row in metrics or []:
        name = row["service_name"]
        metric_counts[name] += 1
        if "invalid_value" in (row["quality_flags"] or []):
            invalid_values += 1
        if row["metric_name"] == HEARTBEAT_METRIC and name and row["value"] is not None:
            series = (name, row["service_instance_id"] or "")
            heartbeat_series[series].append((_ts(row["timestamp"]), row["value"]))
        key = tuple(
            value for column, value in row.items() if column not in ("quality_flags", "value")
        )
        if key in seen_metric:
            duplicate_metrics += 1
        seen_metric.add(key)

    heartbeat = _alive_times(heartbeat_series)
    span_counts: Counter[str] = Counter(row["service_name"] for row in spans or [])
    log_counts: Counter[str] = Counter(row["service_name"] for row in logs or [])

    runtimes: dict[str, Any] = {}
    max_gap_overall = 0.0
    gap_count = 0
    silent_runtimes: list[str] = []
    for runtime in RUNTIMES:
        beats = heartbeat.get(runtime, [])
        silent: list[dict[str, Any]] = []
        max_gap = 0.0
        for lo, hi in _gaps(beats, start, end):
            length = hi - lo
            if length > config.expected_scrape_interval_s * 1.5:
                gap_count += 1
            # Bỏ qua khoảng trống chạm mép cửa sổ nếu ngắn hơn dung sai mép.
            at_edge = lo == start or hi == end
            if at_edge and length <= config.edge_tolerance_s:
                continue
            max_gap = max(max_gap, length)
            if length > config.silent_threshold_s:
                silent.append({"start": _iso(lo), "end": _iso(hi), "seconds": round(length, 1)})
        max_gap_overall = max(max_gap_overall, max_gap)
        expected_points = max(1, int((end - start) // config.expected_scrape_interval_s))
        coverage = min(1.0, len(set(int(t) for t in beats)) / expected_points)

        traces_state = "observed" if span_counts[runtime] else "no_traffic"
        if log_counts[runtime]:
            logs_state = "observed"
        elif exclude_probe_logs and runtime in WORKERS_WITHOUT_COMMAND_LOGS:
            logs_state = "not_instrumented"
        else:
            logs_state = "no_traffic"
        flags = []
        if not metric_counts[runtime]:
            flags.append("missing_metrics")
            fatal = True
        if silent:
            flags.append("telemetry_silent")
            silent_runtimes.append(runtime)
        if traces_state != "observed":
            flags.append("missing_traces")
        if logs_state != "observed":
            flags.append("missing_logs")
        runtimes[runtime] = {
            "metrics_records": metric_counts[runtime],
            "heartbeat_coverage_ratio": round(coverage, 3),
            "max_heartbeat_gap_s": round(max_gap, 1),
            "silent_intervals": silent,
            "spans": span_counts[runtime],
            "traces_state": traces_state,
            "logs": log_counts[runtime],
            "logs_state": logs_state,
            "flags": flags,
        }
    if silent_runtimes:
        reasons.append("telemetry_silent:" + ",".join(silent_runtimes))
    missing_metrics = [name for name, info in runtimes.items() if not info["metrics_records"]]
    if missing_metrics:
        reasons.append("missing_metrics:" + ",".join(missing_metrics))

    # ---- traces --------------------------------------------------------------------------------
    span_ids_by_trace: dict[str, set[str]] = defaultdict(set)
    duplicate_spans = 0
    for row in spans or []:
        bucket = span_ids_by_trace[row["trace_id"]]
        if row["span_id"] in bucket:
            duplicate_spans += 1
        bucket.add(row["span_id"])
    missing_parent = sum(
        1
        for row in spans or []
        if row["parent_span_id"] and row["parent_span_id"] not in span_ids_by_trace[row["trace_id"]]
    )
    trace_stats = manifest.get("stats", {}).get("traces", {})
    traces_quality = {
        "trace_count": len(span_ids_by_trace),
        "span_count": len(spans or []),
        "missing_trace_id_count": sum(1 for row in spans or [] if not row["trace_id"]),
        "missing_span_id_count": sum(1 for row in spans or [] if not row["span_id"]),
        "missing_parent_relation_count": missing_parent,
        "noise_trace_excluded_count": trace_stats.get("noise_excluded"),
        "dropped_by_budget": trace_stats.get("dropped_by_budget"),
        "fetch_errors": trace_stats.get("fetch_errors"),
    }
    if missing_parent:
        reasons.append("missing_parent_relation")

    # ---- logs ----------------------------------------------------------------------------------
    context_logs = [row for row in logs or [] if row["event"] in CONTEXT_LOG_EVENTS]
    correlated = sum(1 for row in context_logs if row["trace_id"])
    ratio = correlated / len(context_logs) if context_logs else None
    seen_log: set[tuple[Any, ...]] = set()
    duplicate_logs = 0
    for row in logs or []:
        key = (row["timestamp"], row["service_name"], row["message"], row["trace_id"])
        if key in seen_log:
            duplicate_logs += 1
        seen_log.add(key)
    logs_quality = {
        "log_count": len(logs or []),
        "request_or_message_context_log_count": len(context_logs),
        "trace_correlated_context_log_count": correlated,
        "log_correlation_ratio": round(ratio, 4) if ratio is not None else None,
        "invalid_timestamp_count": sum(1 for row in logs or [] if row["timestamp"] is None),
        "probe_logs_excluded": manifest.get("stats", {}).get("logs", {}).get("probe_logs_excluded"),
    }
    if ratio is not None and ratio < config.min_log_correlation_ratio:
        reasons.append("low_log_trace_correlation")

    duplicate_quality = {
        "duplicate_metric_record_count": duplicate_metrics,
        "duplicate_span_id_count": duplicate_spans,
        "duplicate_log_record_count": duplicate_logs,
    }
    if duplicate_metrics or duplicate_spans or duplicate_logs:
        reasons.append("duplicates")

    metrics_quality = {
        "expected_scrape_interval_ms": int(config.expected_scrape_interval_s * 1000),
        "gap_count": gap_count,
        "max_gap_ms": int(max_gap_overall * 1000),
        "invalid_value_count": invalid_values,
        "covered_runtimes": sum(1 for info in runtimes.values() if info["metrics_records"]),
    }

    status = "fail" if fatal else ("partial" if reasons else "pass")
    generated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    return {
        "telemetry_quality_version": QUALITY_VERSION,
        "quality_report_id": f"{manifest['artifact_id']}--quality",
        "run_id": manifest["run_id"],
        "artifact_id": manifest["artifact_id"],
        "artifact_manifest_version": manifest["artifact_manifest_version"],
        "artifact_kind": manifest["artifact_kind"],
        "variant_kind": manifest["variant_kind"],
        "generated_at": generated_at,
        "overall_status": status,
        "reasons": reasons,
        "expected_time_start": manifest["time_start"],
        "expected_time_end": manifest["time_end"],
        "modality_availability": availability,
        "config": asdict(config),
        "runtimes": runtimes,
        "identity_quality": identity,
        "metrics_quality": metrics_quality,
        "traces_quality": traces_quality,
        "logs_quality": logs_quality,
        "duplicate_quality": duplicate_quality,
    }


def summary_table(report: dict[str, Any]) -> str:
    """Bảng Markdown dễ đọc: một dòng mỗi runtime."""
    lines = [
        f"run_id={report['run_id']} overall_status={report['overall_status']} "
        f"reasons={report['reasons']}",
        "",
        "| Runtime | Metric | Nhịp tim | Gap lớn nhất (s) | Span | Log | Cờ |",
        "| --- | ---: | ---: | ---: | ---: | --- | --- |",
    ]
    for name, info in report["runtimes"].items():
        logs = info["logs"] if info["logs_state"] == "observed" else info["logs_state"]
        lines.append(
            f"| {name} | {info['metrics_records']} | {info['heartbeat_coverage_ratio']:.0%} | "
            f"{info['max_heartbeat_gap_s']} | {info['spans']} | {logs} | "
            f"{', '.join(info['flags']) or '—'} |"
        )
    return "\n".join(lines)
