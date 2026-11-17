"""Export log từ Loki theo cửa sổ của run.

Loki giới hạn số dòng mỗi truy vấn (mặc định 5000), nên adapter phân trang theo thời gian: trang sau
bắt đầu từ timestamp cuối của trang trước (bao gồm), rồi bỏ các dòng ở ranh giới đã lấy.

Loki của testbed chỉ đánh index `service_name`; các trường khác (`trace_id`, `event`, `http_route`…)
là structured metadata và được Loki trả gộp vào nhãn của stream.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx

from ..identity import PROBE_ROUTES
from ..schema import SCHEMA_VERSION
from ..window import ExportWindow

ALL_SERVICES = '{service_name=~".+"}'
_PROBE_REGEX = "|".join(PROBE_ROUTES)

#: Trường structured metadata có cột riêng.
_LOG_COLUMNS = {
    "service_name": "service_name",
    "service_version": "service_version",
    "service_instance_id": "service_instance_id",
    "trace_id": "trace_id",
    "span_id": "span_id",
    "event_id": "message_id",
    "event": "event",
    "error_type": "error_type",
    "dependency_identity": "dependency_identity",
    "operation_name": "operation_name",
    "http_method": "http_method",
    "http_route": "http_route",
    "http_status_code": "http_status",
    "duration_ms": "duration_ms",
}
#: Trường dùng để suy `level`, không đưa vào `attributes` nữa.
_LEVEL_KEYS = ("severity_text", "detected_level")


class LokiError(RuntimeError):
    pass


@dataclass
class LogExport:
    rows: list[dict[str, Any]] = field(default_factory=list)
    query: str = ""
    pages: int = 0
    probe_logs_excluded: int | None = None
    same_timestamp_overflow: int = 0


def build_query(exclude_probes: bool) -> str:
    if not exclude_probes:
        return ALL_SERVICES
    return f'{ALL_SERVICES} | http_route !~ "{_PROBE_REGEX}"'


class LokiAdapter:
    def __init__(self, client: httpx.Client, base_url: str) -> None:
        self._client = client
        self._base = base_url.rstrip("/")

    def query_range(
        self, query: str, start_ns: int, end_ns: int, limit: int
    ) -> list[tuple[int, str, dict[str, str]]]:
        response = self._client.get(
            f"{self._base}/loki/api/v1/query_range",
            params={
                "query": query,
                "start": str(start_ns),
                "end": str(end_ns),
                "limit": limit,
                "direction": "forward",
            },
        )
        if response.status_code != 200:
            raise LokiError(f"query_range: HTTP {response.status_code} {response.text[:200]}")
        body = response.json()
        if body.get("status") != "success":
            raise LokiError(f"query_range: {body}")
        entries: list[tuple[int, str, dict[str, str]]] = []
        for stream in body["data"]["result"]:
            labels = stream.get("stream", {})
            for ts, line in stream.get("values", []):
                entries.append((int(ts), line, labels))
        entries.sort(key=lambda entry: entry[0])
        return entries

    def count_probe_logs(self, window: ExportWindow) -> int:
        """Đếm access log probe bị loại, để manifest ghi rõ đã bỏ bao nhiêu."""
        seconds = max(1, int(round(window.seconds)))
        query = (
            f'sum(count_over_time({ALL_SERVICES} | http_route =~ "{_PROBE_REGEX}" [{seconds}s]))'
        )
        response = self._client.get(
            f"{self._base}/loki/api/v1/query",
            params={"query": query, "time": str(window.end_ns)},
        )
        if response.status_code != 200:
            raise LokiError(f"query: HTTP {response.status_code} {response.text[:200]}")
        result = response.json()["data"]["result"]
        return int(float(result[0]["value"][1])) if result else 0

    def export(
        self, window: ExportWindow, *, exclude_probes: bool = True, page_limit: int = 5_000
    ) -> LogExport:
        query = build_query(exclude_probes)
        export = LogExport(query=query)
        seen_at_boundary: set[tuple[int, str, str]] = set()
        cursor = window.start_ns
        while cursor <= window.end_ns:
            page = self.query_range(query, cursor, window.end_ns, page_limit)
            export.pages += 1
            fresh = []
            for ts, line, labels in page:
                key = (ts, line, json.dumps(labels, sort_keys=True))
                if ts == cursor and key in seen_at_boundary:
                    continue
                fresh.append((ts, line, labels, key))
            for ts, line, labels, _ in fresh:
                export.rows.append(_log_row(window.run_id, ts, line, labels))
            if len(page) < page_limit:
                break
            last_ts = page[-1][0]
            if last_ts == cursor and not fresh:
                # Hơn `page_limit` dòng cùng một nano giây: không phân trang tiếp được,
                # bỏ qua mốc này.
                export.same_timestamp_overflow += 1
                cursor += 1
                seen_at_boundary = set()
                continue
            seen_at_boundary = {key for ts, _, _, key in fresh if ts == last_ts}
            if last_ts == cursor:
                seen_at_boundary |= {
                    (ts, line, json.dumps(labels, sort_keys=True))
                    for ts, line, labels in page
                    if ts == last_ts
                }
            cursor = last_ts
        if exclude_probes:
            export.probe_logs_excluded = self.count_probe_logs(window)
        return export


def _ns_to_datetime(ns: int) -> datetime:
    return datetime.fromtimestamp(ns // 1_000_000_000, tz=UTC).replace(
        microsecond=(ns % 1_000_000_000) // 1_000
    )


def _level(labels: dict[str, str]) -> str | None:
    for key in _LEVEL_KEYS:
        if labels.get(key):
            return labels[key].lower()
    return None


def _log_row(run_id: str, ts: int, line: str, labels: dict[str, str]) -> dict[str, Any]:
    columns: dict[str, Any] = {column: None for column in _LOG_COLUMNS.values()}
    rest = dict(labels)
    for key, column in _LOG_COLUMNS.items():
        if key in rest:
            columns[column] = rest.pop(key)
    flags: list[str] = []
    for column, convert in (("http_status", int), ("duration_ms", float)):
        if columns[column] is not None:
            try:
                columns[column] = convert(columns[column])
            except ValueError:
                columns[column] = None
                flags.append(f"invalid_{column}")
    for key in _LEVEL_KEYS:
        rest.pop(key, None)
    if not columns["service_name"]:
        flags.append("missing_service_name")
    return {
        "run_id": run_id,
        "timestamp": _ns_to_datetime(ts),
        "level": _level(labels),
        **columns,
        "message": line,
        "attributes": json.dumps(rest, sort_keys=True, ensure_ascii=False) if rest else None,
        "source": "loki",
        "schema_version": SCHEMA_VERSION,
        "quality_flags": flags,
    }
