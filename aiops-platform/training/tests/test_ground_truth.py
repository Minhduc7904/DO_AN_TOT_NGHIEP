from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from aiops_training.ground_truth.build import GroundTruthError, build_ground_truth
from aiops_training.ground_truth.validate import apply_verification, counter_increase, verify
from aiops_training.telemetry.schema import METRIC_SCHEMA, to_table

MANIFEST_PATH = (
    Path(__file__).resolve().parents[2] / "faults" / "manifests" / "fault-manifest-v2.json"
)
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
T0 = datetime(2026, 11, 18, 5, 0, tzinfo=UTC)
WORKLOAD = {
    "run_id": "run-1",
    "plan_id": "moodle-normal-mixed-k4-v1",
    "workload_seed": 7,
    "started_at": "2026-11-18T05:00:00Z",
    "finished_at": "2026-11-18T05:48:00Z",
    "scenario": "student-replay",
    "run_seconds": 2880,
}


def iso(seconds: float) -> str:
    return (T0 + timedelta(seconds=seconds)).isoformat().replace("+00:00", "Z")


def fault_log(case_id: str, start: float, end: float, ok: bool = True, ttl: str | None = None):
    precheck = {"event": "fault.precheck", "case_id": case_id, "ok": True, "results": []}
    if ttl:
        precheck["results"] = [{"name": "IDENTITY_SERVICE_TOKEN_TTL_SECONDS", "actual": ttl}]
    return [
        precheck,
        {"event": "fault.scheduled", "case_id": case_id, "fault_duration_s": end - start},
        {"event": "fault.activate", "case_id": case_id, "ts": iso(start), "steps": [{"ok": ok}]},
        {"event": "fault.deactivate", "case_id": case_id, "ts": iso(end), "steps": [{"ok": True}]},
    ]


def build(case_id: str | None, records=None, workload=WORKLOAD):
    return build_ground_truth(
        run_id="run-1",
        scenario_id=case_id or "healthy",
        repeat_index=0,
        workload=workload,
        fault_manifest=MANIFEST,
        case_id=case_id,
        fault_records=records,
    )


def test_fault_run_uses_control_plane_interval_and_manifest_labels():
    record = build("C2", fault_log("C2", 1080, 1680))
    # Chưa kiểm chứng với telemetry thì chưa được valid.
    assert record["run_status"] == "invalid"
    assert record["invalid_reasons"] == ["verification_not_run"]
    assert record["fault_start"] == iso(1080) and record["fault_end"] == iso(1680)
    assert record["fault_id"] == "FC" and record["fault_target"] == "course-postgres"
    assert record["root_cause_service"] == "course"
    assert record["fault_intensity"] == "latency course-to-postgres 200 --jitter 20"
    assert record["fault_parameters"]["manifest_version"] == MANIFEST["manifest_version"]
    assert record["expected_symptom_lag"] is None


def test_c6_records_symptom_lag_from_configured_ttl():
    record = build("C6", fault_log("C6", 1000, 1300, ttl="60"))
    assert record["expected_symptom_services"] == ["gateway"]
    assert record["expected_symptom_lag"] == {
        "min_seconds": 0,
        "max_seconds": 90,
        "basis": "IDENTITY_SERVICE_TOKEN_TTL_SECONDS",
    }
    assert record["fault_parameters"]["IDENTITY_SERVICE_TOKEN_TTL_SECONDS"] == 60


def test_failed_activation_is_invalid_without_fake_fault_start():
    record = build("C3", fault_log("C3", 100, 200, ok=False))
    assert record["run_status"] == "invalid"
    assert record["fault_start"] is None
    assert "activation_failed" in record["invalid_reasons"]
    assert record["run_status"] == "invalid"


def test_healthy_run_and_required_fields():
    record = build(None)
    assert record["fault_type"] == "none" and record["fault_parameters"] == {}
    assert record["run_status"] == "valid"
    with pytest.raises(GroundTruthError):
        build("C2", None)
    with pytest.raises(GroundTruthError):
        build("C9", [])
    broken = build(None, workload={**WORKLOAD, "finished_at": None})
    assert broken["run_status"] == "failed"


def test_counter_increase_handles_new_series_and_reset():
    points = [(T0 + timedelta(seconds=s), v) for s, v in [(0, 5), (10, 7), (20, 2), (30, 4)]]
    assert counter_increase(points, T0 + timedelta(seconds=5), T0 + timedelta(seconds=40)) == 6
    # Series mới giữa cửa sổ: giá trị trước coi là 0.
    assert counter_increase(points, T0 - timedelta(seconds=5), T0 + timedelta(seconds=1)) == 5


def _metric(name: str, seconds: float, value: float, **labels) -> dict:
    return {
        "run_id": "run-1",
        "timestamp": T0 + timedelta(seconds=seconds),
        "metric_name": name,
        "metric_kind": "counter",
        "value": value,
        "schema_version": "telemetry.v2",
        "quality_flags": [],
        **labels,
    }


def _artifact(tmp_path: Path, rows: list[dict]) -> Path:
    import pyarrow.parquet as pq

    pq.write_table(to_table(rows, METRIC_SCHEMA), tmp_path / "metrics.parquet")
    return tmp_path


def latency_rows(
    component: str, fault_mean: float, calls_per_step: int = 2, **extra_labels
) -> list[dict]:
    """Histogram sum/count tích lũy mỗi 5 s; trước fault 5 ms/lời gọi, khi fault `fault_mean` s."""
    rows, total, count = [], 0.0, 0
    for step in range(0, 1800, 5):
        mean = fault_mean if 1000 <= step < 1300 else 0.005
        total += mean * calls_per_step
        count += calls_per_step
        labels = {"service_name": "course", "dependency_identity": component, **extra_labels}
        rows.append(_metric("lms_dependency_duration_seconds_sum", step, total, **labels))
        rows.append(_metric("lms_dependency_duration_seconds_count", step, count, **labels))
    return rows


def test_verify_ignores_probe_calls(tmp_path):
    record = build("C4", fault_log("C4", 1000, 1300))
    probe = latency_rows("media-minio", 0.3, service_name="media", operation_name="ping")
    idle = latency_rows("media-minio", 0.005, service_name="media", operation_name="get-object")
    checks = verify(record, _artifact(tmp_path, probe + idle))
    # Chỉ ping chậm: workload không chạm fault, kiểm chứng phải trượt.
    assert checks[0]["result"] == "fail"
    assert checks[0]["observed_value"]["fault_mean_s"] == pytest.approx(0.005)

    hit = latency_rows("media-minio", 0.3, service_name="media", operation_name="get-object")
    assert verify(record, _artifact(tmp_path, probe + hit))[0]["result"] == "pass"


def test_verify_latency_case_pass_and_fail(tmp_path):
    record = build("C2", fault_log("C2", 1000, 1300))
    good = _artifact(tmp_path, latency_rows("course-postgres", 0.2))
    checks = verify(record, good)
    assert checks[0]["check_name"] == "dependency_latency_increased"
    assert checks[0]["result"] == "pass"
    assert checks[0]["observed_value"]["fault_mean_s"] == pytest.approx(0.2)
    assert apply_verification(record, checks)["run_status"] == "valid"

    flat = _artifact(tmp_path, latency_rows("course-postgres", 0.006))
    failed = apply_verification(record, verify(record, flat))
    assert failed["run_status"] == "invalid"
    assert "verification_failed" in failed["invalid_reasons"]


def test_verify_c6_heartbeat_and_symptom(tmp_path):
    record = build("C6", fault_log("C6", 1000, 1300, ttl="60"))
    rows = []
    for step in range(0, 1800, 5):
        cpu = min(step, 1000) * 0.01  # identity đứng yên khi bị pause
        rows.append(_metric("process_cpu_time_seconds_total", step, cpu, service_name="identity"))
        errors = 0 if step < 1075 else (step - 1070) // 5
        rows.append(
            _metric(
                "lms_dependency_error_count_total",
                step,
                errors,
                service_name="gateway",
                dependency_identity="gateway-identity-token",
            )
        )
    checks = {c["check_name"]: c["result"] for c in verify(record, _artifact(tmp_path, rows))}
    assert checks == {
        "root_cause_heartbeat_stopped": "pass",
        "symptom_observed_within_lag_window": "pass",
    }


def test_healthy_run_has_no_verification(tmp_path):
    record = build(None)
    assert verify(record, tmp_path) == []
    assert apply_verification(record, [])["verification_result"] == "not_applicable"


def test_aborted_outside_window_and_appended_log():
    aborted = fault_log("C2", 1080, 1680)
    aborted[-1]["reason"] = "aborted"
    assert "fault_aborted" in build("C2", aborted)["invalid_reasons"]
    late = build("C2", fault_log("C2", 2700, 2900))  # tải kết thúc ở 2880 s
    assert "fault_outside_workload" in late["invalid_reasons"]
    missing = build("C2", fault_log("C2", 100, 200), workload={**WORKLOAD, "finished_at": None})
    assert missing["run_status"] == "failed"
    # Nhật ký append hai lần chạy: chỉ lấy lần lập lịch cuối.
    twice = fault_log("C2", 100, 200, ok=False) + fault_log("C2", 1080, 1680)
    record = build("C2", twice)
    assert record["fault_start"] == iso(1080)
    assert "activation_failed" not in record["invalid_reasons"]
