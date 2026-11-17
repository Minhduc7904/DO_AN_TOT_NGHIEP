import httpx
from conftest import make_client

from aiops_training.telemetry.adapters.loki import LokiAdapter, build_query

BASE_NS = 1794908581000000000


def _labels(service="course", route="/api/v1/courses/:course_id/lessons", **extra):
    return {
        "detected_level": "info",
        "duration_ms": "4.338",
        "event": "http.server.request",
        "http_method": "POST",
        "http_route": route,
        "http_status_code": "201",
        "service_instance_id": f"{service}-compose-1",
        "service_name": service,
        "service_version": "0.1.0",
        "severity_text": "INFO",
        "span_id": "e4800e8698ea4996",
        "trace_id": "72eac237312abe8139ed58f476c13cfc",
        "flags": "1",
        **extra,
    }


def _streams(entries):
    """entries: list[(ts, line, labels)] → phản hồi Loki gom theo stream."""
    grouped = {}
    for ts, line, labels in entries:
        key = tuple(sorted(labels.items()))
        grouped.setdefault(key, {"stream": labels, "values": []})["values"].append([str(ts), line])
    return httpx.Response(
        200,
        json={
            "status": "success",
            "data": {"resultType": "streams", "result": list(grouped.values())},
        },
    )


def test_paginates_and_deduplicates_boundary_entries(window):
    # 7 dòng; dòng 3 và 4 cùng timestamp nằm ở ranh giới trang (limit = 4).
    all_entries = [
        (BASE_NS + offset, f"line {i}", _labels())
        for i, offset in enumerate([0, 10, 20, 30, 30, 40, 50])
    ]
    probe_queries = []

    def query_range(request: httpx.Request):
        start = int(request.url.params["start"])
        limit = int(request.url.params["limit"])
        page = [entry for entry in all_entries if entry[0] >= start][:limit]
        return _streams(page)

    def query(request: httpx.Request):
        probe_queries.append(request.url.params["query"])
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": {"resultType": "vector", "result": [{"metric": {}, "value": [0, "307"]}]},
            },
        )

    client = make_client({"/loki/api/v1/query_range": query_range, "/loki/api/v1/query": query})
    export = LokiAdapter(client, "http://loki").export(window, page_limit=4)

    assert [row["message"] for row in export.rows] == [f"line {i}" for i in range(7)]
    assert export.pages >= 2
    assert export.probe_logs_excluded == 307
    assert 'http_route =~ "/ready|/health"' in probe_queries[0]


def test_row_mapping_and_level():
    client = make_client(
        {
            "/loki/api/v1/query_range": lambda request: _streams(
                [
                    (
                        BASE_NS,
                        "HTTP POST /api/v1/courses/:course_id/lessons 201",
                        _labels(event_id="evt-1"),
                    )
                ]
            )
        }
    )
    from datetime import UTC, datetime

    from aiops_training.telemetry.window import ExportWindow

    window = ExportWindow(
        "r", datetime(2026, 11, 17, 9, 43, tzinfo=UTC), datetime(2026, 11, 17, 9, 44, tzinfo=UTC)
    )
    row = LokiAdapter(client, "http://loki").export(window, exclude_probes=False).rows[0]
    assert row["level"] == "info"
    assert row["http_status"] == 201 and row["duration_ms"] == 4.338
    assert row["message_id"] == "evt-1"
    assert row["trace_id"] == "72eac237312abe8139ed58f476c13cfc"
    assert row["attributes"] == '{"flags": "1"}'
    assert row["quality_flags"] == []


def test_build_query_excludes_probe_routes():
    assert build_query(False) == '{service_name=~".+"}'
    assert build_query(True) == '{service_name=~".+"} | http_route !~ "/ready|/health"'
