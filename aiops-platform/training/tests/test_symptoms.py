from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pyarrow.parquet as pq
import pytest

from aiops_training.cli import main
from aiops_training.ground_truth.symptoms import (
    CASE_SIGNALS,
    SymptomConfig,
    measure_from_ground_truth,
    measure_symptoms,
)
from aiops_training.telemetry.schema import METRIC_SCHEMA, to_table

T0 = datetime(2026, 11, 18, 5, 0, tzinfo=UTC)
FAULT = (1000, 1600)
STEPS = range(0, 2400, 5)


def at(seconds: float) -> datetime:
    return T0 + timedelta(seconds=seconds)


def metric(name: str, seconds: float, value: float, **labels) -> dict:
    return {
        "run_id": "run-1",
        "timestamp": at(seconds),
        "metric_name": name,
        "metric_kind": "counter",
        "value": value,
        "schema_version": "telemetry.v2",
        "quality_flags": [],
        **labels,
    }


def artifact(tmp_path: Path, rows: list[dict]) -> Path:
    pq.write_table(to_table(rows, METRIC_SCHEMA), tmp_path / "metrics.parquet")
    return tmp_path


def latency(service, dependency, mean_at, calls_at=lambda s: 2, operation="op") -> list[dict]:
    """Histogram tích lũy mỗi 5 s; `mean_at(step)` là trễ trung bình của lời gọi trong bước đó."""
    rows, total, count = [], 0.0, 0
    labels = {
        "service_name": service,
        "dependency_identity": dependency,
        "operation_name": operation,
    }
    for step in STEPS:
        calls = calls_at(step)
        total += mean_at(step) * calls
        count += calls
        rows.append(metric("lms_dependency_duration_seconds_sum", step, total, **labels))
        rows.append(metric("lms_dependency_duration_seconds_count", step, count, **labels))
    return rows


def slow_from(onset: float, fast=0.005, slow=0.25):
    return lambda step: slow if FAULT[0] + onset <= step < FAULT[1] else fast


def by_id(result: dict) -> dict[str, dict]:
    return {signal["signal_id"]: signal for signal in result["signals"]}


def run(case: str, path: Path, **config) -> dict:
    return measure_symptoms(case, at(FAULT[0]), at(FAULT[1]), path, SymptomConfig(**config))


def test_latency_onset_lag_and_roles(tmp_path):
    rows = (
        latency("course", "course-postgres", slow_from(0))
        + latency("gateway", "gateway-course", slow_from(40))
        + latency("ai-worker", "ai-worker-course", lambda s: 0.005)
    )
    result = run("C2", artifact(tmp_path, rows))
    signals = by_id(result)
    # Mẫu tại fault_start không tính (chỉ xét ts > fault_start); mẫu 1005 là cửa sổ đầu tiên sau đó.
    assert signals["course:course-postgres:latency"]["lag_s"] == 5
    assert signals["gateway:gateway-course:latency"]["lag_s"] == 40
    assert signals["ai-worker:ai-worker-course:latency"]["status"] == "not_observed"
    assert result["root_cause_lag_s"] == 5
    assert result["first_symptom_lag_s"] == 40
    assert result["outside_request_path_observed"] is False


def test_single_slow_sample_is_not_a_symptom_with_default_window(tmp_path):
    # Cửa sổ 15 s trượt bước 5 s: mẫu 1200 nằm trong 3 cửa sổ trượt liền nhau, nhưng persistence
    # đếm cửa sổ không chồng nhau nên một mẫu đơn lẻ không đủ.
    spike = lambda s: 0.25 if s == 1200 else 0.005  # noqa: E731
    rows = latency("course", "course-postgres", spike)
    signal = by_id(run("C2", artifact(tmp_path, rows)))["course:course-postgres:latency"]
    assert signal["observed"] is False
    assert signal["peak_during_fault"] > 0.05


def test_single_error_is_not_a_symptom_but_two_spaced_errors_are(tmp_path):
    def errors(steps_with_error):
        rows, total = [], 0
        for step in STEPS:
            total += step in steps_with_error
            rows.append(
                metric(
                    "lms_dependency_error_count_total",
                    step,
                    total,
                    service_name="ai-worker",
                    dependency_identity="ai-worker-identity-token",
                )
            )
        return rows

    key = "ai-worker:ai-worker-identity-token:errors"
    one = by_id(run("C6", artifact(tmp_path, errors({1100}))))[key]
    assert one["observed"] is False and one["status"] == "not_observed"
    (tmp_path / "b").mkdir()
    two = by_id(run("C6", artifact(tmp_path / "b", errors({1100, 1115}))))[key]
    assert two["observed"] is True and two["lag_s"] == 100


def test_no_traffic_and_missing_service_are_not_healthy(tmp_path):
    # Không lời gọi nào trong khoảng tìm → no_traffic, không phải "không vượt ngưỡng".
    calls = lambda s: 2 if s < FAULT[0] - 30 else 0  # noqa: E731
    rows = latency("scheduler-worker", "scheduler-worker-media", lambda s: 0.01, calls_at=calls)
    signals = by_id(run("C4", artifact(tmp_path, rows)))
    assert signals["scheduler-worker:scheduler-worker-media:latency"]["status"] == "no_traffic"
    # Counter lỗi vắng series mà service không export metric nào → no_data (mất dữ liệu).
    signals = by_id(run("C6", artifact(tmp_path, rows)))
    assert (
        signals["notification-worker:notification-worker-identity-token:errors"]["status"]
        == "no_data"
    )


def test_small_absolute_increase_is_ignored(tmp_path):
    # Trước fault 2 ms, khi "fault" 6 ms: gấp 3 lần nhưng chỉ tăng 4 ms (< 50 ms).
    rows = latency("media-worker", "media-minio", slow_from(0, fast=0.002, slow=0.006))
    signal = by_id(run("C4", artifact(tmp_path, rows)))["media-worker:media-minio:latency"]
    assert signal["observed"] is False


def test_probe_calls_are_excluded(tmp_path):
    # Chỉ ping của probe chậm; lời gọi của workload vẫn nhanh → không có triệu chứng ở media.
    rows = latency("media", "media-minio", slow_from(0), operation="ping") + latency(
        "media", "media-minio", lambda s: 0.003, operation="get-object"
    )
    signal = by_id(run("C4", artifact(tmp_path, rows)))["media:media-minio:latency"]
    assert signal["observed"] is False
    assert signal["baseline"]["mean_s"] == pytest.approx(0.003)


def test_sparse_calls_skip_empty_windows(tmp_path):
    # Một lời gọi mỗi 60 s: cửa sổ không có lời gọi bị bỏ qua, persistence đếm cửa sổ có dữ liệu.
    calls = lambda s: 1 if s % 60 == 0 else 0  # noqa: E731
    rows = latency("ai-worker", "ai-llm-provider", slow_from(0, slow=30.0), calls_at=calls)
    signal = by_id(run("C3", artifact(tmp_path, rows)))["ai-worker:ai-llm-provider:latency"]
    assert signal["observed"] is True
    assert signal["lag_s"] == 20  # mẫu 1020 là mẫu đầu tiên có lời gọi trong fault


def test_c6_stall_errors_and_after_fault_end(tmp_path):
    rows = []
    for step in STEPS:
        cpu = min(step, FAULT[0]) * 0.01 + max(0, step - FAULT[1]) * 0.01
        rows.append(metric("process_cpu_time_seconds_total", step, cpu, service_name="identity"))
        token_errors = 0 if step < FAULT[0] + 75 else (step - FAULT[0] - 70) // 5
        rows.append(
            metric(
                "lms_dependency_error_count_total",
                step,
                token_errors,
                service_name="gateway",
                dependency_identity="gateway-identity-token",
            )
        )
        # 5xx có sẵn trước fault (1 mỗi 60 s), khi fault tăng mạnh.
        fives = step // 60 + (0 if step < FAULT[0] + 80 else (step - FAULT[0] - 75))
        rows.append(
            metric(
                "http_server_request_count_total",
                step,
                fives,
                service_name="gateway",
                http_status_class="5xx",
            )
        )
    result = run("C6", artifact(tmp_path, rows))
    signals = by_id(result)
    assert signals["identity:cpu:stall"]["lag_s"] == 15
    assert signals["gateway:gateway-identity-token:errors"]["lag_s"] == 75
    assert signals["gateway:http:5xx"]["lag_s"] == 80
    # Counter lỗi không có series = 0 lỗi cả run (series chỉ sinh sau lần tăng đầu tiên).
    absent = signals["gateway:gateway-identity:errors"]
    assert absent["status"] == "not_observed" and absent["series_absent"] is True
    assert result["outside_request_path_lag_s"] == 75


def test_gauge_and_symptom_after_fault_end(tmp_path):
    rows = []
    for step in STEPS:
        value = 1 if step < FAULT[1] + 30 else 4  # job dồn lại, lộ sau khi gỡ fault
        rows.append(
            metric(
                "rabbitmq_detailed_queue_messages_unacked",
                step,
                value,
                service_name="ai-worker",
                queue="ai-worker--run-ai-job-v1",
            )
        )
    signal = by_id(run("C3", artifact(tmp_path, rows)))["ai-worker:run-ai-job:unacked"]
    assert signal["observed"] is True
    assert signal["after_fault_end"] is True
    assert signal["lag_s"] == FAULT[1] - FAULT[0] + 30


def test_from_ground_truth_and_cli(tmp_path, capsys):
    rows = latency("course", "course-postgres", slow_from(0))
    path = artifact(tmp_path, rows)
    record = {
        "fault_parameters": {"case_id": "C2"},
        "fault_start": at(FAULT[0]).isoformat(),
        "fault_end": at(FAULT[1]).isoformat(),
    }
    assert measure_from_ground_truth(record, path)["root_cause_lag_s"] == 5
    with pytest.raises(ValueError):
        measure_from_ground_truth({**record, "fault_end": None}, path)
    out = tmp_path / "symptoms.json"
    code = main(
        [
            "symptoms",
            str(path),
            "--case",
            "C2",
            "--fault-start",
            record["fault_start"],
            "--fault-end",
            record["fault_end"],
            "--out",
            str(out),
        ]
    )
    assert code == 0 and out.exists()
    assert '"root_cause_lag_s": 5' in capsys.readouterr().out


def test_every_case_has_root_cause_and_symptom_signal():
    for case, signals in CASE_SIGNALS.items():
        roles = {signal.role for signal in signals}
        assert "root_cause" in roles, case
        assert roles & {"request_path", "outside_request_path"}, case
        assert len({s.signal_id for s in signals}) == len(signals), case
