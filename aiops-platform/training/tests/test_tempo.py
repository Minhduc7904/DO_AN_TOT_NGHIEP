import httpx
from conftest import b64_id, make_client

from aiops_training.telemetry.adapters.tempo import (
    TempoAdapter,
    TempoExportOptions,
    parse_trace,
)

TRACE_HEX = "0d0e3fae17d085c486794e99555e8989"
ROOT_SPAN = "22973b1128f818da"
CHILD_SPAN = "1111111111111111"


def _trace_payload(trace_hex=TRACE_HEX):
    return {
        "trace": {
            "resourceSpans": [
                {
                    "resource": {
                        "attributes": [
                            {"key": "service.name", "value": {"stringValue": "gateway"}},
                            {"key": "service.version", "value": {"stringValue": "0.1.0"}},
                            {
                                "key": "service.instance.id",
                                "value": {"stringValue": "gateway-compose-1"},
                            },
                        ]
                    },
                    "scopeSpans": [
                        {
                            "scope": {"name": "@aiops-lms/observability"},
                            "spans": [
                                {
                                    "traceId": b64_id(trace_hex),
                                    "spanId": b64_id(ROOT_SPAN),
                                    "name": "POST /api/v1/*path",
                                    "kind": "SPAN_KIND_SERVER",
                                    "startTimeUnixNano": "1794908585018000000",
                                    "endTimeUnixNano": "1794908585037934971",
                                    "attributes": [
                                        {
                                            "key": "http.request.method",
                                            "value": {"stringValue": "POST"},
                                        },
                                        {
                                            "key": "http.response.status_code",
                                            "value": {"intValue": "202"},
                                        },
                                        {
                                            "key": "http.route",
                                            "value": {"stringValue": "/api/v1/*path"},
                                        },
                                    ],
                                    "status": {},
                                },
                                {
                                    "traceId": b64_id(trace_hex),
                                    "spanId": b64_id(CHILD_SPAN),
                                    "parentSpanId": b64_id(ROOT_SPAN),
                                    "name": "lms.commands publish ai.job.run",
                                    "kind": "SPAN_KIND_PRODUCER",
                                    "startTimeUnixNano": "1794908585020000000",
                                    "endTimeUnixNano": "1794908585021500000",
                                    "attributes": [
                                        {
                                            "key": "dependency_identity",
                                            "value": {"stringValue": "ai-rabbitmq"},
                                        },
                                        {"key": "retry", "value": {"boolValue": False}},
                                    ],
                                    "status": {"code": "STATUS_CODE_ERROR"},
                                },
                            ],
                        }
                    ],
                }
            ]
        }
    }


def test_parse_trace_decodes_ids_and_maps_columns():
    rows = parse_trace(_trace_payload(), "run-1", "POST /api/v1/*path")
    root, child = rows
    assert root["trace_id"] == TRACE_HEX
    assert root["span_id"] == ROOT_SPAN and root["parent_span_id"] is None
    assert root["span_kind"] == "server" and root["status"] == "unset"
    assert root["http_status"] == 202 and root["http_method"] == "POST"
    assert root["service_name"] == "gateway"
    assert abs(root["duration_ms"] - 19.934971) < 1e-6
    assert child["parent_span_id"] == ROOT_SPAN
    assert child["span_kind"] == "producer" and child["status"] == "error"
    assert child["command_name"] == "ai.job.run"
    assert child["dependency_identity"] == "ai-rabbitmq"
    assert child["attributes"] == '{"retry": false}'


def _search_item(index, root_name="POST /api/v1/*path"):
    return {
        # Tempo bỏ số 0 ở đầu traceID trong kết quả tìm kiếm.
        "traceID": f"{index:x}",
        "rootServiceName": "gateway",
        "rootTraceName": root_name,
        "startTimeUnixNano": str(1794908580000000000 + index),
    }


def test_search_bisects_when_limit_hit_and_filters_noise(window):
    def search(request: httpx.Request):
        start, end = int(request.url.params["start"]), int(request.url.params["end"])
        limit = int(request.url.params["limit"])
        # Lát dài hơn 10 giây trả đúng `limit` kết quả (bị cắt); lát ngắn trả ít hơn.
        if end - start > 10:
            items = [_search_item(i) for i in range(limit)]
        else:
            items = [_search_item(start * 10 + i) for i in range(3)]
            items.append(_search_item(start * 10 + 9, "GET /ready"))
        return httpx.Response(200, json={"traces": items})

    calls = []
    client = make_client(
        {
            "/api/search": search,
            "/api/v2/traces/": lambda request: httpx.Response(200, json=_trace_payload()),
        },
        calls,
    )
    options = TempoExportOptions(slice_seconds=30, search_limit=5, fetch_delay_ms=0)
    stats = TempoAdapter(client, "http://tempo", sleep=lambda _: None).export(window, options)

    assert stats.search_limit_hit == 0
    assert stats.search_queries > 4, "phải chia đôi lát thời gian"
    assert stats.noise_excluded > 0
    assert stats.selected == stats.candidates - stats.noise_excluded
    fetched_ids = [r.url.path.rsplit("/", 1)[1] for r in calls if "/api/v2/traces/" in r.url.path]
    assert all(len(trace_id) == 32 for trace_id in fetched_ids), "traceID phải đủ 32 hex"


def test_budget_selects_evenly_and_reports_dropped(window):
    items = [_search_item(i) for i in range(10)]
    client = make_client(
        {
            "/api/search": lambda request: httpx.Response(200, json={"traces": items}),
            "/api/v2/traces/": lambda request: httpx.Response(200, json=_trace_payload()),
        }
    )
    options = TempoExportOptions(max_traces=4, slice_seconds=600, fetch_delay_ms=0)
    stats = TempoAdapter(client, "http://tempo", sleep=lambda _: None).export(window, options)
    assert stats.selected == 4 and stats.dropped_by_budget == 6
    assert stats.fetched == 4


def test_consecutive_errors_abort_and_keep_error_samples(window):
    items = [_search_item(i) for i in range(20)]
    sleeps = []
    client = make_client(
        {
            "/api/search": lambda request: httpx.Response(200, json={"traces": items}),
            "/api/v2/traces/": lambda request: httpx.Response(503, text="unavailable"),
        }
    )
    options = TempoExportOptions(slice_seconds=600, fetch_delay_ms=0, max_consecutive_errors=3)
    stats = TempoAdapter(client, "http://tempo", sleep=sleeps.append).export(window, options)
    assert stats.aborted
    assert stats.fetch_errors == 3 and stats.fetched == 0
    assert stats.not_attempted == 17
    assert "HTTP 503" in stats.error_samples[0]["error"]
    assert sleeps == [], "Tempo có vẻ đã chết: dừng ngay, không tải lại"


def test_transient_failure_is_retried_at_the_end(window):
    items = [_search_item(i) for i in range(1, 6)]
    failing_once = {"00000000000000000000000000000003"}
    sleeps = []

    def trace(request: httpx.Request):
        trace_id = request.url.path.rsplit("/", 1)[1]
        if trace_id in failing_once:
            failing_once.discard(trace_id)
            raise httpx.ReadTimeout("timed out", request=request)
        return httpx.Response(200, json=_trace_payload())

    client = make_client(
        {
            "/api/search": lambda request: httpx.Response(200, json={"traces": items}),
            "/api/v2/traces/": trace,
        }
    )
    options = TempoExportOptions(slice_seconds=600, fetch_delay_ms=0, deferred_pause_seconds=7)
    stats = TempoAdapter(client, "http://tempo", sleep=sleeps.append).export(window, options)
    assert stats.fetched == 5 and stats.fetch_errors == 0
    assert stats.deferred == 1 and stats.deferred_recovered == 1
    assert sleeps == [7], "nghỉ một lần trước lượt tải lại"


def test_not_found_trace_is_counted_not_fatal(window):
    client = make_client(
        {
            "/api/search": lambda request: httpx.Response(200, json={"traces": [_search_item(1)]}),
            "/api/v2/traces/": lambda request: httpx.Response(404),
        }
    )
    stats = TempoAdapter(client, "http://tempo", sleep=lambda _: None).export(
        window, TempoExportOptions(slice_seconds=600, fetch_delay_ms=0)
    )
    assert stats.not_found == 1 and stats.fetch_errors == 0 and not stats.aborted
