"""Export trace từ Tempo theo cửa sổ của run.

Tempo của testbed bị giới hạn 512 MiB và từng bị OOM khi nhận nhiều truy vấn dồn dập (17/11/2026),
nên adapter:

1. tìm trace theo từng lát thời gian, chia đôi lát khi chạm giới hạn kết quả;
2. loại trace nhiễu theo tên span gốc ngay ở bước tìm (không tải về);
3. tải từng trace **tuần tự**, nghỉ giữa hai lần gọi, giới hạn tổng số trace;
4. khi vượt giới hạn, chọn trace cách đều theo thời gian (tất định) và ghi số trace bị bỏ
   vào thống kê.
"""

from __future__ import annotations

import base64
import binascii
import json
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx

from ..identity import NOISE_TRACE_ROOT_NAMES
from ..schema import SCHEMA_VERSION
from ..window import ExportWindow

SEARCH_QUERY = "{ }"
MAX_ERROR_SAMPLES = 10
_HEX = set("0123456789abcdef")

_SPAN_KINDS = {
    "SPAN_KIND_SERVER": "server",
    "SPAN_KIND_CLIENT": "client",
    "SPAN_KIND_PRODUCER": "producer",
    "SPAN_KIND_CONSUMER": "consumer",
    "SPAN_KIND_INTERNAL": "internal",
}
_STATUS = {"STATUS_CODE_OK": "ok", "STATUS_CODE_ERROR": "error"}

#: Thuộc tính span có cột riêng; còn lại vào `attributes`.
_SPAN_ATTRIBUTE_COLUMNS = {
    "operation_name": "operation_name",
    "error.type": "error_type",
    "http.request.method": "http_method",
    "http.route": "http_route",
    "http.response.status_code": "http_status",
    "peer.service": "peer_service",
    "dependency_identity": "dependency_identity",
    "messaging.message.id": "message_id",
    "messaging.operation.type": "messaging_operation",
    "messaging.destination.name": "queue",
}
_PRODUCER_PREFIX = "lms.commands publish "


class TempoError(RuntimeError):
    pass


@dataclass(frozen=True)
class TraceRef:
    trace_id: str
    root_service: str | None
    root_name: str | None
    start_ns: int


@dataclass
class TraceExport:
    rows: list[dict[str, Any]] = field(default_factory=list)
    search_queries: int = 0
    candidates: int = 0
    noise_excluded: int = 0
    selected: int = 0
    dropped_by_budget: int = 0
    search_limit_hit: int = 0
    fetched: int = 0
    not_found: int = 0
    fetch_errors: int = 0
    parse_errors: int = 0
    deferred: int = 0
    deferred_recovered: int = 0
    not_attempted: int = 0
    aborted: bool = False
    #: Tối đa `MAX_ERROR_SAMPLES` lỗi gốc (trace_id + thông điệp) để chẩn đoán, không chỉ đếm.
    error_samples: list[dict[str, str]] = field(default_factory=list)

    def record_error(self, trace_id: str, error: Exception) -> None:
        if len(self.error_samples) < MAX_ERROR_SAMPLES:
            self.error_samples.append(
                {"trace_id": trace_id, "error": f"{type(error).__name__}: {error}"}
            )


@dataclass(frozen=True)
class TempoExportOptions:
    # Run healthy-spike của dataset v0 có ~38.000 trace không nhiễu; 20.000 (trước 23/11) bỏ 47%.
    max_traces: int = 60_000
    fetch_delay_ms: int = 20
    slice_seconds: int = 30
    min_slice_seconds: int = 2
    search_limit: int = 1_000
    include_noise: bool = False
    max_consecutive_errors: int = 5
    retries: int = 2
    deferred_pause_seconds: float = 10.0


class TempoAdapter:
    def __init__(
        self,
        client: httpx.Client,
        base_url: str,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._base = base_url.rstrip("/")
        self._sleep = sleep

    # ---- tìm trace ---------------------------------------------------------------------------

    def search(self, start_s: int, end_s: int, limit: int) -> list[TraceRef]:
        response = self._client.get(
            f"{self._base}/api/search",
            params={"q": SEARCH_QUERY, "start": start_s, "end": end_s, "limit": limit, "spss": 1},
        )
        if response.status_code != 200:
            raise TempoError(f"search {start_s}-{end_s}: HTTP {response.status_code}")
        return [
            TraceRef(
                trace_id=_search_trace_id(item["traceID"]),
                root_service=item.get("rootServiceName"),
                root_name=item.get("rootTraceName"),
                start_ns=int(item.get("startTimeUnixNano", 0)),
            )
            for item in response.json().get("traces", [])
        ]

    def list_traces(
        self, window: ExportWindow, options: TempoExportOptions, stats: TraceExport
    ) -> list[TraceRef]:
        """Liệt kê trace trong cửa sổ, chia đôi lát thời gian khi kết quả chạm `search_limit`."""
        found: dict[str, TraceRef] = {}
        start_s = int(window.start.timestamp())
        end_s = int(window.end.timestamp()) + 1
        pending = [
            (s, min(s + options.slice_seconds, end_s))
            for s in range(start_s, end_s, options.slice_seconds)
        ]
        while pending:
            lo, hi = pending.pop(0)
            refs = self.search(lo, hi, options.search_limit)
            stats.search_queries += 1
            if len(refs) >= options.search_limit:
                if hi - lo > options.min_slice_seconds:
                    mid = (lo + hi) // 2
                    pending[0:0] = [(lo, mid), (mid, hi)]
                    continue
                stats.search_limit_hit += 1
            for ref in refs:
                found.setdefault(ref.trace_id, ref)
        return sorted(found.values(), key=lambda ref: (ref.start_ns, ref.trace_id))

    # ---- tải trace ---------------------------------------------------------------------------

    def get_trace(self, trace_id: str) -> dict[str, Any] | None:
        response = self._client.get(f"{self._base}/api/v2/traces/{trace_id}")
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise TempoError(f"trace {trace_id}: HTTP {response.status_code}")
        return response.json()

    def export(self, window: ExportWindow, options: TempoExportOptions) -> TraceExport:
        stats = TraceExport()
        refs = self.list_traces(window, options, stats)
        stats.candidates = len(refs)
        if not options.include_noise:
            kept = [ref for ref in refs if ref.root_name not in NOISE_TRACE_ROOT_NAMES]
            stats.noise_excluded = len(refs) - len(kept)
            refs = kept
        selected = _evenly_spaced(refs, options.max_traces)
        stats.selected = len(selected)
        stats.dropped_by_budget = len(refs) - len(selected)

        failed = self._fetch_pass(selected, window, options, stats, retries=0)
        if failed and not stats.aborted:
            # Lỗi lẻ tẻ thường do Tempo khựng vài giây (đo 17/11/2026: ReadTimeout rồi gọi lại chỉ
            # mất 0,1 s). Tải lại các trace lỗi ở cuối, sau một khoảng nghỉ, thay vì thử dồn dập.
            stats.deferred = len(failed)
            self._sleep(options.deferred_pause_seconds)
            retry_refs = [ref for ref, _ in failed]
            failed = self._fetch_pass(retry_refs, window, options, stats, retries=options.retries)
            stats.deferred_recovered = stats.deferred - len(failed)
        for ref, error in failed:
            stats.fetch_errors += 1
            stats.record_error(ref.trace_id, error)
        return stats

    def _fetch_pass(
        self,
        refs: list[TraceRef],
        window: ExportWindow,
        options: TempoExportOptions,
        stats: TraceExport,
        retries: int,
    ) -> list[tuple[TraceRef, Exception]]:
        """Tải lần lượt các trace; trả danh sách trace lỗi kèm lỗi gốc."""
        failed: list[tuple[TraceRef, Exception]] = []
        consecutive_errors = 0
        for index, ref in enumerate(refs):
            if index > 0 and options.fetch_delay_ms > 0:
                self._sleep(options.fetch_delay_ms / 1000)
            try:
                payload = self._fetch_with_retry(ref.trace_id, retries)
            except (TempoError, httpx.TransportError) as error:
                failed.append((ref, error))
                consecutive_errors += 1
                if consecutive_errors >= options.max_consecutive_errors:
                    # Nhiều lỗi liên tiếp: Tempo có thể đã chết (OOM); dừng để không dội thêm tải.
                    stats.aborted = True
                    stats.not_attempted = len(refs) - index - 1
                    break
                continue
            consecutive_errors = 0
            if payload is None:
                stats.not_found += 1
                continue
            try:
                rows = parse_trace(payload, window.run_id, ref.root_name)
            except TempoError as error:
                stats.parse_errors += 1
                stats.record_error(ref.trace_id, error)
                continue
            stats.fetched += 1
            stats.rows.extend(rows)
        return failed

    def _fetch_with_retry(self, trace_id: str, retries: int) -> dict[str, Any] | None:
        for attempt in range(retries + 1):
            try:
                return self.get_trace(trace_id)
            except (TempoError, httpx.TransportError):
                if attempt == retries:
                    raise
                self._sleep(2**attempt)
        return None


def _evenly_spaced(refs: list[TraceRef], limit: int) -> list[TraceRef]:
    if len(refs) <= limit:
        return refs
    if limit <= 0:
        return []
    step = len(refs) / limit
    return [refs[int(i * step)] for i in range(limit)]


def _search_trace_id(value: str) -> str:
    """ID trong kết quả tìm kiếm là hex và có thể bị bỏ số 0 ở đầu; trả đủ 32 ký tự hex."""
    lowered = value.lower()
    if not lowered or not set(lowered) <= _HEX or len(lowered) > 32:
        raise TempoError(f"traceID không phải hex: {value!r}")
    return lowered.zfill(32)


def _otlp_id(value: str | None) -> str | None:
    """ID trong JSON OTLP của Tempo là base64 (8 byte → 12 ký tự, 16 byte → 24 ký tự).

    Nếu chuỗi đã là hex đủ 16/32 ký tự (một số phiên bản trả hex) thì giữ nguyên.
    """
    if not value:
        return None
    lowered = value.lower()
    if len(lowered) in (16, 32) and set(lowered) <= _HEX:
        return lowered
    try:
        return base64.b64decode(value, validate=True).hex()
    except (binascii.Error, ValueError) as error:
        raise TempoError(f"ID span không đọc được: {value!r}") from error


def _attr_value(value: dict[str, Any]) -> Any:
    if "stringValue" in value:
        return value["stringValue"]
    if "intValue" in value:
        return int(value["intValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "boolValue" in value:
        return bool(value["boolValue"])
    if "arrayValue" in value:
        return [_attr_value(item) for item in value["arrayValue"].get("values", [])]
    return None


def _attributes(items: list[dict[str, Any]] | None) -> dict[str, Any]:
    return {item["key"]: _attr_value(item.get("value", {})) for item in items or []}


def _ns_to_datetime(ns: int) -> datetime:
    return datetime.fromtimestamp(ns // 1_000_000_000, tz=UTC).replace(
        microsecond=(ns % 1_000_000_000) // 1_000
    )


def parse_trace(
    payload: dict[str, Any], run_id: str, root_name: str | None
) -> list[dict[str, Any]]:
    """Chuyển trace JSON (OTLP) thành các dòng theo `SPAN_SCHEMA`."""
    trace = payload.get("trace", payload)
    rows: list[dict[str, Any]] = []
    for resource_spans in trace.get("resourceSpans", []):
        resource = _attributes(resource_spans.get("resource", {}).get("attributes"))
        for scope_spans in resource_spans.get("scopeSpans", []):
            for span in scope_spans.get("spans", []):
                rows.append(_span_row(span, resource, run_id, root_name))
    return rows


def _span_row(
    span: dict[str, Any], resource: dict[str, Any], run_id: str, root_name: str | None
) -> dict[str, Any]:
    attrs = _attributes(span.get("attributes"))
    columns: dict[str, Any] = {column: None for column in _SPAN_ATTRIBUTE_COLUMNS.values()}
    for key, column in _SPAN_ATTRIBUTE_COLUMNS.items():
        if key in attrs:
            columns[column] = attrs.pop(key)
    if columns["http_status"] is not None:
        columns["http_status"] = int(columns["http_status"])

    start_ns = int(span.get("startTimeUnixNano", 0))
    end_ns = int(span.get("endTimeUnixNano", 0))
    name = span.get("name")
    kind = _SPAN_KINDS.get(span.get("kind", ""), "internal")
    flags: list[str] = []
    service_name = resource.get("service.name")
    if not service_name:
        flags.append("missing_service_name")
    if end_ns < start_ns:
        flags.append("negative_duration")

    return {
        "run_id": run_id,
        "trace_id": _otlp_id(span.get("traceId")),
        "span_id": _otlp_id(span.get("spanId")),
        "parent_span_id": _otlp_id(span.get("parentSpanId")),
        "service_name": service_name,
        "service_version": resource.get("service.version"),
        "service_instance_id": resource.get("service.instance.id"),
        "span_kind": kind,
        "span_name": name,
        **columns,
        "start_time": _ns_to_datetime(start_ns),
        "end_time": _ns_to_datetime(end_ns),
        "duration_ms": (end_ns - start_ns) / 1_000_000,
        "status": _STATUS.get(span.get("status", {}).get("code", ""), "unset"),
        "command_name": (
            name[len(_PRODUCER_PREFIX) :]
            if kind == "producer" and name and name.startswith(_PRODUCER_PREFIX)
            else None
        ),
        "trace_root_name": root_name,
        "attributes": json.dumps(attrs, sort_keys=True, ensure_ascii=False) if attrs else None,
        "source": "tempo",
        "schema_version": SCHEMA_VERSION,
        "quality_flags": flags,
    }
