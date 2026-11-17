import json
from datetime import UTC, datetime, timedelta

import pyarrow.parquet as pq

from aiops_training.telemetry.identity import RUNTIMES
from aiops_training.telemetry.schema import LOG_SCHEMA, METRIC_SCHEMA, SPAN_SCHEMA, to_table
from aiops_training.telemetry.validation.quality import evaluate, summary_table

START = datetime(2026, 11, 17, 10, 0, 0, tzinfo=UTC)
WINDOW_S = 300


def _metric_rows(silent=None, skip=()):
    """Bộ đếm CPU mỗi 5 giây cho từng runtime; `silent` = (runtime, từ giây, tới giây) đứng yên."""
    rows = []
    for runtime in RUNTIMES:
        if runtime in skip:
            continue
        value = 1.0
        for second in range(0, WINDOW_S + 1, 5):
            frozen = silent and runtime == silent[0] and silent[1] <= second <= silent[2]
            if not frozen:
                value += 0.004
            rows.append(
                {
                    "run_id": "r",
                    "timestamp": START + timedelta(seconds=second),
                    "metric_name": "process_cpu_time_seconds_total",
                    "metric_kind": "counter",
                    "service_name": runtime,
                    "service_version": "0.1.0",
                    "service_instance_id": f"{runtime}-compose-1",
                    "value": value,
                    "quality_flags": [],
                }
            )
    return rows


def _span(runtime, span_id, parent=None, trace="a" * 32):
    return {
        "run_id": "r",
        "trace_id": trace,
        "span_id": span_id,
        "parent_span_id": parent,
        "service_name": runtime,
        "service_version": "0.1.0",
        "service_instance_id": f"{runtime}-compose-1",
        "start_time": START,
        "end_time": START,
        "quality_flags": [],
    }


def _log(runtime, trace_id="a" * 32, event="http.server.request", message="HTTP GET /x 200"):
    return {
        "run_id": "r",
        "timestamp": START + timedelta(seconds=10),
        "service_name": runtime,
        "service_version": "0.1.0",
        "service_instance_id": f"{runtime}-compose-1",
        "trace_id": trace_id,
        "event": event,
        "message": message,
        "quality_flags": [],
    }


def _artifact(tmp_path, metrics, spans, logs, availability=None):
    target = tmp_path / "r"
    target.mkdir()
    files = {}
    for key, name, rows, schema in (
        ("metrics", "metrics.parquet", metrics, METRIC_SCHEMA),
        ("traces", "spans.parquet", spans, SPAN_SCHEMA),
        ("logs", "logs.parquet", logs, LOG_SCHEMA),
    ):
        if rows is None:
            continue
        pq.write_table(to_table(rows, schema), target / name)
        files[key] = {"path": name}
    manifest = {
        "artifact_manifest_version": "telemetry-artifact.v1",
        "artifact_id": "r--raw--x",
        "run_id": "r",
        "artifact_kind": "raw",
        "variant_kind": "full",
        "modality_availability": availability
        or {"metrics": "available", "traces": "available", "logs": "available"},
        "time_start": "2026-11-17T10:00:00Z",
        "time_end": "2026-11-17T10:05:00Z",
        "export_config": {"exclude_probe_logs": True},
        "stats": {"traces": {"noise_excluded": 7}, "logs": {"probe_logs_excluded": 3}},
        "files": files,
    }
    (target / "manifest.json").write_text(json.dumps(manifest))
    return target


def _healthy_spans_and_logs():
    spans = [_span(runtime, f"{index:016x}") for index, runtime in enumerate(RUNTIMES)]
    logs = [_log(runtime) for runtime in RUNTIMES if not runtime.endswith("-worker")]
    return spans, logs


def test_healthy_artifact_passes_and_worker_logs_are_not_instrumented(tmp_path):
    spans, logs = _healthy_spans_and_logs()
    report = evaluate(_artifact(tmp_path, _metric_rows(), spans, logs))
    assert report["overall_status"] == "pass", report["reasons"]
    assert report["runtimes"]["media-worker"]["logs_state"] == "not_instrumented"
    assert report["runtimes"]["course"]["heartbeat_coverage_ratio"] == 1.0
    assert report["logs_quality"]["log_correlation_ratio"] == 1.0
    assert report["traces_quality"]["noise_trace_excluded_count"] == 7
    assert "| course |" in summary_table(report)


def test_frozen_counter_is_telemetry_silent(tmp_path):
    spans, logs = _healthy_spans_and_logs()
    # Bộ đếm của identity đứng yên 100 giây giữa cửa sổ (giống docker pause của C6).
    metrics = _metric_rows(silent=("identity", 100, 200))
    report = evaluate(_artifact(tmp_path, metrics, spans, logs))
    assert report["overall_status"] == "partial"
    assert report["reasons"] == ["telemetry_silent:identity"]
    interval = report["runtimes"]["identity"]["silent_intervals"][0]
    assert interval["start"] == "2026-11-17T10:01:35Z" and interval["seconds"] > 100
    assert report["runtimes"]["course"]["flags"] == []


def test_missing_modality_and_runtime_fail(tmp_path):
    spans, _ = _healthy_spans_and_logs()
    report = evaluate(
        _artifact(
            tmp_path,
            _metric_rows(skip=("ai-worker",)),
            spans,
            None,
            availability={"metrics": "available", "traces": "available", "logs": "error"},
        )
    )
    assert report["overall_status"] == "fail"
    assert "missing_modality:logs" in report["reasons"]
    assert "missing_metrics:ai-worker" in report["reasons"]


def test_unknown_service_orphan_span_duplicates_and_uncorrelated_log(tmp_path):
    spans, logs = _healthy_spans_and_logs()
    spans.append(_span("course", "ffffffffffffffff", parent="eeeeeeeeeeeeeeee"))
    spans.append(_span("course", "ffffffffffffffff", parent="eeeeeeeeeeeeeeee"))
    logs.append(_log("legacy-auth", trace_id=None, message="khác"))
    report = evaluate(_artifact(tmp_path, _metric_rows(), spans, logs))
    assert report["overall_status"] == "fail"
    assert report["identity_quality"]["unknown_service_names"] == ["legacy-auth"]
    assert report["traces_quality"]["missing_parent_relation_count"] == 2
    assert report["duplicate_quality"]["duplicate_span_id_count"] == 1
    assert report["logs_quality"]["trace_correlated_context_log_count"] == len(logs) - 1
    assert "low_log_trace_correlation" in report["reasons"]
