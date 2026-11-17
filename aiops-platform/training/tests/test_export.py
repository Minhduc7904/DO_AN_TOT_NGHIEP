import json
from datetime import timedelta

import httpx
import pyarrow.parquet as pq
import pytest
from conftest import make_client
from test_loki import BASE_NS, _labels, _streams
from test_prometheus import DEPENDENCY_SERIES, _matrix
from test_tempo import _search_item, _trace_payload

from aiops_training.telemetry.adapters.loki import LokiAdapter
from aiops_training.telemetry.adapters.prometheus import PrometheusAdapter
from aiops_training.telemetry.adapters.tempo import TempoAdapter, TempoExportOptions
from aiops_training.telemetry.export import ExportOptions, Sources, check_retention, export_run
from aiops_training.telemetry.schema import LOG_SCHEMA, METRIC_SCHEMA, SPAN_SCHEMA


def _loki_vector(request):
    return httpx.Response(
        200,
        json={
            "status": "success",
            "data": {"resultType": "vector", "result": [{"metric": {}, "value": [0, "5"]}]},
        },
    )


def _sources(prometheus_handler=None):
    routes = {
        "/api/v1/query_range": prometheus_handler or (lambda r: _matrix([DEPENDENCY_SERIES])),
        "/api/search": lambda r: httpx.Response(200, json={"traces": [_search_item(1)]}),
        "/api/v2/traces/": lambda r: httpx.Response(200, json=_trace_payload()),
        "/loki/api/v1/query_range": lambda r: _streams([(BASE_NS, "line", _labels())]),
        "/loki/api/v1/query": _loki_vector,
    }
    client = make_client(routes)
    return Sources(
        prometheus=PrometheusAdapter(client, "http://prom"),
        tempo=TempoAdapter(client, "http://tempo", sleep=lambda _: None),
        loki=LokiAdapter(client, "http://loki"),
        urls={"prometheus": "http://prom", "tempo": "http://tempo", "loki": "http://loki"},
    )


OPTIONS = ExportOptions(tempo=TempoExportOptions(slice_seconds=600, fetch_delay_ms=0))


def test_export_writes_parquet_and_manifest(tmp_path, window, now):
    manifest = export_run(window, tmp_path, _sources(), OPTIONS, now=now)

    target = tmp_path / window.run_id
    assert manifest["modality_availability"] == {
        "metrics": "available",
        "traces": "available",
        "logs": "available",
    }
    assert manifest["errors"] == {}
    for key, name, schema in (
        ("metrics", "metrics.parquet", METRIC_SCHEMA),
        ("traces", "spans.parquet", SPAN_SCHEMA),
        ("logs", "logs.parquet", LOG_SCHEMA),
    ):
        table = pq.read_table(target / name)
        assert table.schema.equals(schema, check_metadata=False)
        assert manifest["files"][key]["record_count"] == table.num_rows > 0
    on_disk = json.loads((target / "manifest.json").read_text())
    assert on_disk["run_id"] == window.run_id
    assert on_disk["telemetry_schema_version"] == "telemetry.v2"
    assert on_disk["stats"]["logs"]["probe_logs_excluded"] == 5
    assert on_disk["time_start"] == "2026-11-17T09:43:00Z"


def test_one_source_failing_does_not_block_others(tmp_path, window, now):
    failing = _sources(lambda r: httpx.Response(500, json={"status": "error", "error": "boom"}))
    manifest = export_run(window, tmp_path, failing, OPTIONS, now=now)
    assert manifest["modality_availability"]["metrics"] == "error"
    assert "boom" in manifest["errors"]["metrics"]
    assert manifest["modality_availability"]["traces"] == "available"
    assert "metrics" not in manifest["files"]


def test_retention_guard(window, now):
    check_retention(window, now)
    with pytest.raises(ValueError, match="retention"):
        check_retention(window, now + timedelta(hours=25))
