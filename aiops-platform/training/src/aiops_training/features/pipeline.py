"""Feature pipeline v1: cửa sổ trượt trên artifact export (schema `telemetry.v2`).

Thay đổi so với v0 (task-05 tuần 15, sau khi chạy trên run 48 phút có fault của pilot):

- **Lọc nhiễu `noise.v1`** áp như nhau cho mọi run (evaluation-protocol-v1 mục 8.5): bỏ route probe
  (`/ready`, `/health`) khỏi metric HTTP của service và thao tác probe (`ping` tới MinIO) khỏi
  metric dependency. Trace/log probe đã bị lọc ở bước export; bộ lọc của export được ghi lại trong
  `features-manifest.json`.
- **Ánh xạ identity lệch** (`IDENTITY_ALIASES`) áp cho cạnh (metric dependency).
- **Không dùng dữ liệu tương lai** (mục 7.2): metric và log chỉ lấy mẫu có thời điểm < `window_end`;
  span được tính vào cửa sổ chứa thời điểm **kết thúc** (trạng thái lỗi chỉ biết khi span xong), v0
  tính theo lúc bắt đầu. Độ trễ thu thập theo modality ghi ở `available_after_s`: một cửa sổ chỉ
  được dùng sau `window_end` + độ trễ lớn nhất.
- **Trace không đầy đủ:** cột `traces_truncated` khi export chạm giới hạn tìm kiếm hoặc ngân sách
  (số span của cửa sổ đông bị thấp đi, không phải tín hiệu).
- **Cạnh async:** bảng `queue_windows` từ gauge RabbitMQ theo hàng đợi (message sẵn sàng, chưa ack,
  consumer).
- **Modality thiếu:** `span_count`, `log_count`, `log_error_rate` rỗng thay vì 0; runtime không có
  metric nào thì mọi feature metric rỗng (v0 ghi `request_rate` = 0).
- **Warm-up:** cột `warmup` cho cửa sổ bắt đầu trước `time_start + warmup_s`; bước fit bỏ qua.

Phần còn lại giữ như v0:

Sinh `ServiceWindowFeature` và `EdgeWindowFeature` theo telemetry-and-ground-truth-schema-v1 mục
11.1–11.2, cửa sổ 60 s, bước 15 s (analysis blueprint v1). Quy tắc:

- Counter và histogram trong artifact là giá trị tích lũy thô; mức tăng trong cửa sổ = cộng các hiệu
  dương liên tiếp của từng series, giá trị trước điểm đầu cửa sổ lấy mẫu gần nhất trước đó, series
  xuất hiện giữa cửa sổ coi giá trị trước là 0 (faults README, mục Giới hạn), counter reset thì
  đếm lại từ 0.
- Percentile tính lại từ hiệu bucket của histogram trong cửa sổ, nội suy tuyến tính trong bucket như
  `histogram_quantile` của Prometheus (schema v1 mục 5.2, quy tắc histogram).
- Series "đứng yên" khi runtime ngừng: Collector giữ giá trị cuối ~5 phút
  (telemetry-data-dictionary-v2 mục 8.2), nên sự có mặt của mẫu không chứng minh runtime còn
  sống. Cửa sổ mà counter nhịp tim
  `process_cpu_time_seconds_total` của runtime **không tăng** dù trước đó đã có mẫu được gắn
  `telemetry_silent = true` và đặc trưng tốc độ của runtime đó để null thay vì 0.
- Không đọc ground truth, fault manifest hay nhật ký workload: đặc trưng chỉ từ telemetry (chống
  leakage cơ bản; kiểm đầy đủ ở tuần 15).
"""

from __future__ import annotations

import bisect
import json
import math
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from ..telemetry.identity import IDENTITY_ALIASES, PROBE_OPERATIONS, PROBE_ROUTES, RUNTIMES
from ..telemetry.window import parse_utc

FEATURE_VERSION = "feature.v1"
NOISE_FILTER_VERSION = "noise.v1"
HEARTBEAT = "process_cpu_time_seconds_total"
QUEUE_METRICS = {
    "rabbitmq_detailed_queue_messages_ready": "messages_ready",
    "rabbitmq_detailed_queue_messages_unacked": "messages_unacked",
    "rabbitmq_detailed_queue_consumers": "consumers",
}
#: Độ trễ thu thập theo modality (evaluation-protocol-v1 mục 1.3, 7.2): log ≈ 2 s, trace ≈ 2,5 s,
#: counter 4–10 s. Cửa sổ chỉ đủ dữ liệu sau `window_end` + giá trị lớn nhất.
AVAILABLE_AFTER_S = {"metrics": 10.0, "traces": 3.0, "logs": 2.0}
#: Số span tối thiểu để tính `trace_error_rate` (evaluation-protocol-v1 mục 6.1.1 bảng F): trace có
#: thể là mẫu (ngân sách export), tỉ lệ trên vài span quá nhiễu nên để rỗng.
MIN_SPANS_FOR_RATE = 5

METRICS_USED = (
    "http_server_request_count_total",
    "http_server_request_error_count_total",
    "http_server_request_duration_seconds_bucket",
    "lms_dependency_request_count_total",
    "lms_dependency_error_count_total",
    "lms_dependency_duration_seconds_bucket",
    "lms_dependency_duration_seconds_sum",
    "lms_dependency_duration_seconds_count",
    HEARTBEAT,
    "process_memory_usage_bytes",
    *QUEUE_METRICS,
)
HTTP_METRICS = frozenset(name for name in METRICS_USED if name.startswith("http_server_"))
DEPENDENCY_METRICS = frozenset(name for name in METRICS_USED if name.startswith("lms_dependency_"))


@dataclass(frozen=True)
class FeatureConfig:
    window_s: int = 60
    step_s: int = 15
    #: Bỏ cửa sổ đầu run cho tới khi có ít nhất một cửa sổ đầy đủ dữ liệu.
    align_s: int = 15
    #: Warm-up của fault manifest (phút 0–6 của run 48 phút); chỉ dùng để đánh dấu cửa sổ.
    warmup_s: int = 360


@dataclass(frozen=True)
class NoiseFilter:
    version: str = NOISE_FILTER_VERSION
    probe_routes: tuple[str, ...] = PROBE_ROUTES
    probe_operations: tuple[str, ...] = PROBE_OPERATIONS
    identity_aliases: tuple[tuple[str, str], ...] = tuple(sorted(IDENTITY_ALIASES.items()))

    def alias(self, identity: str | None) -> str | None:
        return dict(self.identity_aliases).get(identity, identity) if identity else identity

    def drops(self, metric: str, route: str | None, operation: str | None) -> bool:
        if metric in HTTP_METRICS and route in self.probe_routes:
            return True
        return metric in DEPENDENCY_METRICS and operation in self.probe_operations


@dataclass
class SeriesData:
    """Một series: nhãn và điểm đã sắp theo thời gian (tách `times` để tra bằng bisect)."""

    status: str | None
    le: str | None
    times: list[float]
    values: list[float]
    #: Series đã tồn tại trước khi artifact bắt đầu: mẫu đầu là giá trị tích lũy từ lúc process khởi
    #: động, chỉ dùng làm mốc chứ không tính là mức tăng.
    carried: bool = False


#: metric → (service_name, dependency_identity) → danh sách series.
Index = dict[str, dict[tuple[str | None, str | None], list[SeriesData]]]


def _ts(value: datetime) -> float:
    return value.timestamp()


def _iso(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, tz=UTC).isoformat().replace("+00:00", "Z")


def increase(
    times: list[float], values: list[float], start: float, end: float, carried: bool = False
) -> float:
    """Mức tăng của một counter trong [start, end) theo quy tắc ở docstring module.

    `carried`: series có từ trước khi artifact bắt đầu, nên mẫu đầu tiên chỉ là mốc (không coi
    giá trị
    trước nó là 0, tránh đếm toàn bộ giá trị tích lũy từ lúc process khởi động vào cửa sổ đầu).
    """
    first = bisect.bisect_left(times, start)
    last = bisect.bisect_left(times, end)
    if first == 0 and carried:
        first = 1
        if last < first:
            return 0.0
        previous = values[0]
    elif first == last:
        return 0.0
    else:
        previous = values[first - 1] if first > 0 else 0.0
    total = 0.0
    for value in values[first:last]:
        total += value - previous if value >= previous else value
        previous = value
    return total


def last_value(times: list[float], values: list[float], start: float, end: float) -> float | None:
    index = bisect.bisect_left(times, end) - 1
    if index < 0 or times[index] < start:
        return None
    return values[index]


def histogram_quantile(q: float, buckets: dict[float, float]) -> float | None:
    """Quantile từ số đếm tích lũy theo `le` (giống Prometheus: nội suy tuyến tính trong bucket)."""
    if not buckets:
        return None
    bounds = sorted(buckets)
    total = buckets[bounds[-1]]
    if total <= 0:
        return None
    rank = q * total
    previous_bound = 0.0
    previous_count = 0.0
    for bound in bounds:
        count = buckets[bound]
        if count >= rank:
            if math.isinf(bound):
                return previous_bound
            if count == previous_count:
                return bound
            return previous_bound + (bound - previous_bound) * (rank - previous_count) / (
                count - previous_count
            )
        previous_bound, previous_count = bound, count
    return previous_bound


def load_metric_index(
    artifact_dir: Path,
    time_start: float,
    step_s: float = 5.0,
    noise: NoiseFilter | None = None,
) -> Index:
    """Đọc metric cần dùng, gom theo (service_name, dependency_identity) — với gauge hàng đợi là
    (service_name, queue).

    Đọc từng metric một và theo cột để giới hạn RAM (artifact 48 phút có vài triệu dòng). Series có
    mẫu đầu trong vòng một bước scrape từ `time_start` coi là đã tồn tại trước artifact (`carried`).
    Bỏ series của probe và đổi identity lệch theo `noise`.
    """
    noise = noise or NoiseFilter()
    columns = [
        "service_name",
        "dependency_identity",
        "status",
        "le",
        "service_instance_id",
        "http_route_template",
        "http_method",
        "operation_name",
        "http_status_class",
        "queue",
    ]
    position = {name: index for index, name in enumerate(columns)}
    index: Index = defaultdict(lambda: defaultdict(list))
    for metric in METRICS_USED:
        table = pq.read_table(
            artifact_dir / "metrics.parquet",
            columns=[*columns, "timestamp", "value"],
            filters=[("metric_name", "=", metric)],
        )
        data = table.to_pydict()
        raw: dict[tuple, list[tuple[float, float]]] = defaultdict(list)
        for row in range(table.num_rows):
            value = data["value"][row]
            if value is None:
                continue
            key = tuple(data[column][row] for column in columns)
            if noise.drops(
                metric, key[position["http_route_template"]], key[position["operation_name"]]
            ):
                continue
            raw[key].append((_ts(data["timestamp"][row]), value))
        del data, table
        for key, points in raw.items():
            points.sort()
            second = (
                key[position["queue"]]
                if metric in QUEUE_METRICS
                else noise.alias(key[position["dependency_identity"]])
            )
            index[metric][(key[0], second)].append(
                SeriesData(
                    status=key[2],
                    le=key[3],
                    times=[point[0] for point in points],
                    values=[point[1] for point in points],
                    carried=points[0][0] <= time_start + step_s,
                )
            )
    return index


def _select(index: Index, metric: str, service: str | None, dependency: Any = ...) -> list:
    groups = index.get(metric, {})
    if dependency is ...:
        return [item for (svc, _), items in groups.items() if svc == service for item in items]
    return list(groups.get((service, dependency), []))


def _sum_increase(
    items: list[SeriesData], start: float, end: float, status: str | None = None
) -> float:
    return sum(
        increase(item.times, item.values, start, end, item.carried)
        for item in items
        if status is None or item.status == status
    )


def _bucket_increase(items: list[SeriesData], start: float, end: float) -> dict[float, float]:
    buckets: dict[float, float] = defaultdict(float)
    for item in items:
        if item.le is not None:
            buckets[float(item.le)] += increase(item.times, item.values, start, end, item.carried)
    return dict(buckets)


def _ratio(numerator: float, denominator: float) -> float | None:
    return numerator / denominator if denominator > 0 else None


def windows(start: float, end: float, config: FeatureConfig) -> list[tuple[float, float]]:
    first = math.ceil(start / config.align_s) * config.align_s
    result = []
    current = first
    while current + config.window_s <= end:
        result.append((current, current + config.window_s))
        current += config.step_s
    return result


def _span_index(artifact_dir: Path) -> dict[str, EventIndex]:
    path = artifact_dir / "spans.parquet"
    if not path.exists():
        return {}
    # Span chỉ quan sát được (và biết có lỗi hay không) khi đã kết thúc: tính theo `end_time` để
    # cửa sổ không dùng trạng thái của span còn chạy sau `window_end` (v0 tính theo `start_time`).
    table = pq.read_table(path, columns=["service_name", "end_time", "status"])
    spans: dict[str, list[tuple[float, bool]]] = defaultdict(list)
    for row in table.to_pylist():
        if row["end_time"] is None:
            continue
        spans[row["service_name"]].append((_ts(row["end_time"]), row["status"] == "error"))
    return {service: _event_index(items) for service, items in spans.items()}


def _log_index(artifact_dir: Path) -> dict[str, EventIndex]:
    path = artifact_dir / "logs.parquet"
    if not path.exists():
        return {}
    table = pq.read_table(path, columns=["service_name", "timestamp", "level"])
    logs: dict[str, list[tuple[float, bool]]] = defaultdict(list)
    for row in table.to_pylist():
        logs[row["service_name"]].append(
            (_ts(row["timestamp"]), row["level"] in ("error", "fatal"))
        )
    return {service: _event_index(items) for service, items in logs.items()}


@dataclass
class EventIndex:
    """Thời điểm sự kiện đã sắp và tổng tích lũy số lỗi, để đếm theo cửa sổ bằng bisect."""

    times: list[float]
    error_prefix: list[int]


def _event_index(items: list[tuple[float, bool]]) -> EventIndex:
    items.sort()
    prefix = [0]
    for _, is_error in items:
        prefix.append(prefix[-1] + (1 if is_error else 0))
    return EventIndex([item[0] for item in items], prefix)


def _count_in(index: EventIndex | None, start: float, end: float) -> tuple[int, int]:
    if index is None:
        return 0, 0
    lo = bisect.bisect_left(index.times, start)
    hi = bisect.bisect_left(index.times, end)
    return hi - lo, index.error_prefix[hi] - index.error_prefix[lo]


@dataclass
class FeatureTables:
    service_rows: list[dict[str, Any]]
    edge_rows: list[dict[str, Any]]
    queue_rows: list[dict[str, Any]]
    meta: dict[str, Any]


def build_features(
    artifact_dir: Path, config: FeatureConfig | None = None, noise: NoiseFilter | None = None
) -> FeatureTables:
    config = config or FeatureConfig()
    noise = noise or NoiseFilter()
    manifest = json.loads((artifact_dir / "manifest.json").read_text(encoding="utf-8"))
    run_id = manifest["run_id"]
    start = _ts(parse_utc(manifest["time_start"]))
    end = _ts(parse_utc(manifest["time_end"]))
    index = load_metric_index(artifact_dir, start, noise=noise)
    spans = _span_index(artifact_dir)
    logs = _log_index(artifact_dir)
    availability = manifest.get("modality_availability", {})
    span_available = availability.get("traces") != "missing"
    log_available = availability.get("logs") != "missing"
    traces_truncated = availability.get("traces") == "truncated"
    warmup_end = start + config.warmup_s

    edges = sorted(
        key for key in index.get("lms_dependency_request_count_total", {}) if key[0] and key[1]
    )
    queues = sorted(
        {key for metric in QUEUE_METRICS for key in index.get(metric, {}) if key[0] and key[1]}
    )
    per_service = {
        runtime: {
            "heartbeat": _select(index, HEARTBEAT, runtime),
            "requests": _select(index, "http_server_request_count_total", runtime),
            "errors": _select(index, "http_server_request_error_count_total", runtime),
            "latency": _select(index, "http_server_request_duration_seconds_bucket", runtime),
            "downstream": _select(index, "lms_dependency_duration_seconds_bucket", runtime),
            "memory": _select(index, "process_memory_usage_bytes", runtime),
        }
        for runtime in RUNTIMES
    }
    per_edge = {
        edge: {
            "count": _select(index, "lms_dependency_duration_seconds_count", *edge),
            "sum": _select(index, "lms_dependency_duration_seconds_sum", *edge),
            "calls": _select(index, "lms_dependency_request_count_total", *edge),
            "errors": _select(index, "lms_dependency_error_count_total", *edge),
            "buckets": _select(index, "lms_dependency_duration_seconds_bucket", *edge),
        }
        for edge in edges
    }
    per_queue = {
        queue: {column: _select(index, metric, *queue) for metric, column in QUEUE_METRICS.items()}
        for queue in queues
    }

    service_rows: list[dict[str, Any]] = []
    edge_rows: list[dict[str, Any]] = []
    queue_rows: list[dict[str, Any]] = []
    all_windows = windows(start, end, config)
    for window_start, window_end in all_windows:
        seconds = window_end - window_start
        bounds = (window_start, window_end)
        common = {
            "run_id": run_id,
            "window_start": datetime.fromtimestamp(window_start, tz=UTC),
            "window_end": datetime.fromtimestamp(window_end, tz=UTC),
            "warmup": window_start < warmup_end,
        }
        silent: dict[str, bool] = {}
        for runtime in RUNTIMES:
            data = per_service[runtime]
            seen_before = any(
                item.times and item.times[0] < window_end for item in data["heartbeat"]
            )
            cpu = _sum_increase(data["heartbeat"], *bounds)
            dead = seen_before and cpu == 0
            silent[runtime] = dead
            missing_metrics = not seen_before
            requests = _sum_increase(data["requests"], *bounds)
            errors = _sum_increase(data["errors"], *bounds)
            latency = _bucket_increase(data["latency"], *bounds)
            downstream = _bucket_increase(data["downstream"], *bounds)
            memory = [last_value(item.times, item.values, *bounds) for item in data["memory"]]
            span_total, span_errors = _count_in(spans.get(runtime), *bounds)
            log_total, log_errors = _count_in(logs.get(runtime), *bounds)
            # Runtime im lặng hoặc chưa từng có mẫu nhịp tim: metric để rỗng, không phải 0.
            live = not dead and not missing_metrics
            service_rows.append(
                {
                    **common,
                    "service_name": runtime,
                    "request_rate": requests / seconds if live else None,
                    "error_rate": _ratio(errors, requests) if live else None,
                    "latency_p50": histogram_quantile(0.5, latency) if live else None,
                    "latency_p95": histogram_quantile(0.95, latency) if live else None,
                    "latency_p99": histogram_quantile(0.99, latency) if live else None,
                    "cpu_usage": cpu / seconds if live else None,
                    "memory_usage": max((v for v in memory if v is not None), default=None)
                    if live
                    else None,
                    "trace_error_rate": _ratio(span_errors, span_total)
                    if span_total >= MIN_SPANS_FOR_RATE
                    else None,
                    # Modality thiếu: để rỗng, không phải 0 (0 nghĩa là "không có sự kiện").
                    "span_count": span_total if span_available else None,
                    "downstream_latency_p95": histogram_quantile(0.95, downstream)
                    if live
                    else None,
                    "log_error_rate": log_errors / seconds if log_available else None,
                    "log_count": log_total if log_available else None,
                    "missing_metrics": missing_metrics,
                    "missing_traces": not span_available,
                    "missing_logs": not log_available,
                    "traces_truncated": traces_truncated,
                    "telemetry_silent": dead,
                }
            )
        for (caller, dependency), data in per_edge.items():
            calls = _sum_increase(data["calls"], *bounds)
            count = _sum_increase(data["count"], *bounds)
            buckets = _bucket_increase(data["buckets"], *bounds)
            edge_rows.append(
                {
                    **common,
                    "caller_service": caller,
                    "dependency_identity": dependency,
                    "call_count": calls,
                    "error_ratio": _ratio(_sum_increase(data["errors"], *bounds), calls),
                    "timeout_ratio": _ratio(
                        _sum_increase(data["calls"], *bounds, status="timeout"), calls
                    ),
                    "duration_mean": _ratio(_sum_increase(data["sum"], *bounds), count),
                    "duration_p95": histogram_quantile(0.95, buckets),
                    "duration_p99": histogram_quantile(0.99, buckets),
                    "caller_silent": silent.get(caller, False),
                }
            )
        for (consumer, queue), data in per_queue.items():
            # Gauge: giá trị cuối trong cửa sổ, cộng theo series (có thể nhiều instance).
            values = {
                column: [last_value(item.times, item.values, *bounds) for item in items]
                for column, items in data.items()
            }
            queue_rows.append(
                {
                    **common,
                    "consumer_service": consumer,
                    "queue": queue,
                    "dead_letter": queue.endswith(".error"),
                    **{
                        column: sum(v for v in found if v is not None)
                        if any(v is not None for v in found)
                        else None
                        for column, found in values.items()
                    },
                    "consumer_silent": silent.get(consumer, False),
                }
            )

    trace_stats = (manifest.get("stats") or {}).get("traces") or {}
    meta = {
        "feature_version": FEATURE_VERSION,
        "feature_config_version": FEATURE_VERSION,
        "noise_filter_version": noise.version,
        "noise_filter": {
            "probe_routes": list(noise.probe_routes),
            "probe_operations": list(noise.probe_operations),
            "identity_aliases": dict(noise.identity_aliases),
            "export": (manifest.get("export_config") or {}).get("noise_trace_root_names"),
        },
        "causality": {
            "metrics": "mẫu có timestamp trong [window_start, window_end)",
            "traces": "span có end_time trong [window_start, window_end)",
            "logs": "dòng log có timestamp trong [window_start, window_end)",
            "available_after_s": AVAILABLE_AFTER_S,
        },
        "run_id": run_id,
        "config": asdict(config),
        "input_manifest_version": manifest.get("manifest_version"),
        "input_files": manifest.get("files"),
        "modality_availability": availability,
        "trace_stats": {
            key: trace_stats.get(key)
            for key in ("candidates", "selected", "dropped_by_budget", "search_limit_hit")
        },
        "time_start": manifest["time_start"],
        "time_end": manifest["time_end"],
        "windows": len(all_windows),
        "service_rows": len(service_rows),
        "edge_rows": len(edge_rows),
        "queue_rows": len(queue_rows),
        "edges": [f"{caller}->{dependency}" for caller, dependency in edges],
        "queues": [f"{consumer}:{queue}" for consumer, queue in queues],
        "silent_windows": sum(1 for row in service_rows if row["telemetry_silent"]),
        "generated_at": _iso(datetime.now(UTC).timestamp()),
    }
    return FeatureTables(service_rows, edge_rows, queue_rows, meta)


SERVICE_SCHEMA = pa.schema(
    [
        ("run_id", pa.string()),
        ("window_start", pa.timestamp("ns", tz="UTC")),
        ("window_end", pa.timestamp("ns", tz="UTC")),
        ("warmup", pa.bool_()),
        ("service_name", pa.string()),
        ("request_rate", pa.float64()),
        ("error_rate", pa.float64()),
        ("latency_p50", pa.float64()),
        ("latency_p95", pa.float64()),
        ("latency_p99", pa.float64()),
        ("cpu_usage", pa.float64()),
        ("memory_usage", pa.float64()),
        ("trace_error_rate", pa.float64()),
        ("span_count", pa.int64()),
        ("downstream_latency_p95", pa.float64()),
        ("log_error_rate", pa.float64()),
        ("log_count", pa.int64()),
        ("missing_metrics", pa.bool_()),
        ("missing_traces", pa.bool_()),
        ("missing_logs", pa.bool_()),
        ("traces_truncated", pa.bool_()),
        ("telemetry_silent", pa.bool_()),
    ]
)

EDGE_SCHEMA = pa.schema(
    [
        ("run_id", pa.string()),
        ("window_start", pa.timestamp("ns", tz="UTC")),
        ("window_end", pa.timestamp("ns", tz="UTC")),
        ("warmup", pa.bool_()),
        ("caller_service", pa.string()),
        ("dependency_identity", pa.string()),
        ("call_count", pa.float64()),
        ("error_ratio", pa.float64()),
        ("timeout_ratio", pa.float64()),
        ("duration_mean", pa.float64()),
        ("duration_p95", pa.float64()),
        ("duration_p99", pa.float64()),
        ("caller_silent", pa.bool_()),
    ]
)

QUEUE_SCHEMA = pa.schema(
    [
        ("run_id", pa.string()),
        ("window_start", pa.timestamp("ns", tz="UTC")),
        ("window_end", pa.timestamp("ns", tz="UTC")),
        ("warmup", pa.bool_()),
        ("consumer_service", pa.string()),
        ("queue", pa.string()),
        ("dead_letter", pa.bool_()),
        ("messages_ready", pa.float64()),
        ("messages_unacked", pa.float64()),
        ("consumers", pa.float64()),
        ("consumer_silent", pa.bool_()),
    ]
)

#: Tên file của từng bảng trong thư mục feature.
TABLES = {
    "service": ("service_windows.parquet", SERVICE_SCHEMA),
    "edge": ("edge_windows.parquet", EDGE_SCHEMA),
    "queue": ("queue_windows.parquet", QUEUE_SCHEMA),
}


def write_features(artifact_dir: Path, out_dir: Path | None = None) -> dict[str, Any]:
    tables = build_features(artifact_dir)
    meta = tables.meta
    target = out_dir or artifact_dir / "features"
    target.mkdir(parents=True, exist_ok=True)
    rows = {"service": tables.service_rows, "edge": tables.edge_rows, "queue": tables.queue_rows}
    for name, (file_name, schema) in TABLES.items():
        pq.write_table(pa.Table.from_pylist(rows[name], schema), target / file_name)
    (target / "features-manifest.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return meta


__all__ = [
    "FEATURE_VERSION",
    "NOISE_FILTER_VERSION",
    "TABLES",
    "FeatureConfig",
    "FeatureTables",
    "NoiseFilter",
    "build_features",
    "histogram_quantile",
    "increase",
    "windows",
    "write_features",
]
