"""Kiểm chứng execution: đối chiếu khoảng fault của `RunGroundTruth` với telemetry đã export.

Đây là `verification_checks` của schema v1 mục 8.2 (execution validity), không phải detector:
chỉ trả lời "fault đã thật sự tạo ra triệu chứng tối thiểu của case trong cửa sổ fault chưa". Run
có fault bật thành công mà không thấy triệu chứng thì `run_status = invalid` (schema v1 mục 9.1),
để không bị tính
nhầm là FN của RCA engine.

Counter và histogram trong artifact là giá trị tích lũy thô (Prometheus adapter); ở đây lấy hiệu
cuối − đầu của từng series trong cửa sổ. Series xuất hiện giữa cửa sổ coi giá trị trước đó là 0
(faults README, mục Giới hạn).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from ..telemetry.window import parse_utc

LATENCY_COMPONENT = {"C2": "course-postgres", "C3": "ai-llm-provider", "C4": "media-minio"}
SERIES_KEY = (
    "metric_name",
    "service_name",
    "service_instance_id",
    "dependency_identity",
    "operation_name",
    "status",
    "http_method",
    "http_route_template",
    "http_status_class",
    "queue",
    "le",
)


@dataclass(frozen=True)
class ValidationConfig:
    #: Đoạn trước fault dùng làm mốc so sánh.
    baseline_s: float = 300.0
    #: Bỏ qua đoạn đầu cửa sổ fault (độ trễ thu thập counter 4–10 s, schema v1 mục 7.2).
    settle_s: float = 15.0
    #: Latency trung bình trong fault phải ≥ hệ số này × trước fault.
    min_latency_ratio: float = 2.0
    #: Số lời gọi tối thiểu trong cửa sổ fault để kết luận.
    min_calls: int = 3


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def load_metrics(artifact_dir: Path, names: set[str]) -> dict[tuple, list[tuple[datetime, float]]]:
    # Lọc theo tên metric ngay khi đọc: artifact 15 phút có hơn một triệu dòng.
    table = pq.read_table(
        artifact_dir / "metrics.parquet",
        columns=[*SERIES_KEY, "timestamp", "value"],
        filters=[("metric_name", "in", sorted(names))],
    )
    series: dict[tuple, list[tuple[datetime, float]]] = defaultdict(list)
    for row in table.to_pylist():
        if row["value"] is None:
            continue
        series[tuple(row[key] for key in SERIES_KEY)].append((row["timestamp"], row["value"]))
    for points in series.values():
        points.sort()
    return series


def counter_increase(points: list[tuple[datetime, float]], start: datetime, end: datetime) -> float:
    """Mức tăng của counter trong [start, end); reset (giá trị giảm) tính lại từ 0."""
    before = [value for ts, value in points if ts < start]
    inside = [value for ts, value in points if start <= ts < end]
    if not inside:
        return 0.0
    previous = before[-1] if before else 0.0
    total = 0.0
    for value in inside:
        total += value - previous if value >= previous else value
        previous = value
    return total


def _sum_increase(series, metric: str, start, end, **match) -> float:
    total = 0.0
    for key, points in series.items():
        fields = dict(zip(SERIES_KEY, key, strict=True))
        if fields["metric_name"] != metric:
            continue
        if any(fields.get(name) != value for name, value in match.items()):
            continue
        total += counter_increase(points, start, end)
    return total


def _mean_latency(series, component: str, start, end) -> tuple[float | None, float]:
    total = _sum_increase(
        series, "lms_dependency_duration_seconds_sum", start, end, dependency_identity=component
    )
    calls = _sum_increase(
        series, "lms_dependency_duration_seconds_count", start, end, dependency_identity=component
    )
    return (total / calls if calls > 0 else None), calls


def _check(name, entity, result, observed, expected, checked_at) -> dict[str, Any]:
    return {
        "check_name": name,
        "entity_id": entity,
        "result": result,
        "observed_value": observed,
        "expected_condition": expected,
        "checked_at": checked_at,
    }


def verify(
    ground_truth: dict[str, Any], artifact_dir: Path, config: ValidationConfig | None = None
) -> list[dict[str, Any]]:
    config = config or ValidationConfig()
    params = ground_truth.get("fault_parameters") or {}
    case_id = params.get("case_id")
    now = _iso(datetime.now(UTC))
    if ground_truth.get("fault_type") == "none" or not ground_truth.get("fault_start"):
        return []
    fault_start = parse_utc(ground_truth["fault_start"])
    fault_end = parse_utc(ground_truth["fault_end"]) if ground_truth.get("fault_end") else None
    if fault_end is None:
        return [_check("fault_interval_closed", case_id, "fail", None, "có fault_end", now)]
    baseline = (fault_start - timedelta(seconds=config.baseline_s), fault_start)
    active = (fault_start + timedelta(seconds=config.settle_s), fault_end)
    checks: list[dict[str, Any]] = []

    if case_id in LATENCY_COMPONENT:
        component = LATENCY_COMPONENT[case_id]
        series = load_metrics(
            artifact_dir,
            {"lms_dependency_duration_seconds_sum", "lms_dependency_duration_seconds_count"},
        )
        before, before_calls = _mean_latency(series, component, *baseline)
        during, during_calls = _mean_latency(series, component, *active)
        observed = {
            "baseline_mean_s": before,
            "baseline_calls": before_calls,
            "fault_mean_s": during,
            "fault_calls": during_calls,
        }
        if during is None or during_calls < config.min_calls:
            result = "fail"  # không có traffic chạm dependency trong cửa sổ fault
        elif before is None:
            result = "pass" if during >= 0.1 else "fail"
        else:
            result = "pass" if during >= config.min_latency_ratio * before else "fail"
        checks.append(
            _check(
                "dependency_latency_increased",
                component,
                result,
                observed,
                f"mean latency trong fault ≥ {config.min_latency_ratio} × trước fault, "
                f"≥ {config.min_calls} lời gọi",
                now,
            )
        )
    elif case_id == "C6":
        series = load_metrics(
            artifact_dir, {"process_cpu_time_seconds_total", "lms_dependency_error_count_total"}
        )
        cpu_before = _sum_increase(
            series, "process_cpu_time_seconds_total", *baseline, service_name="identity"
        )
        cpu_during = _sum_increase(
            series, "process_cpu_time_seconds_total", *active, service_name="identity"
        )
        checks.append(
            _check(
                "root_cause_heartbeat_stopped",
                "identity",
                "pass" if cpu_before > 0 and cpu_during == 0 else "fail",
                {"cpu_increase_baseline_s": cpu_before, "cpu_increase_fault_s": cpu_during},
                "process_cpu_time_seconds_total của identity tăng trước fault, đứng yên khi fault",
                now,
            )
        )
        lag = ground_truth.get("expected_symptom_lag") or {}
        lag_end = min(
            fault_end, fault_start + timedelta(seconds=float(lag.get("max_seconds", 120)) + 30)
        )
        errors = _sum_increase(
            series,
            "lms_dependency_error_count_total",
            fault_start,
            lag_end,
            dependency_identity="gateway-identity-token",
        )
        checks.append(
            _check(
                "symptom_observed_within_lag_window",
                "gateway-identity-token",
                "pass" if errors > 0 else "fail",
                {"error_increase": errors, "window_end": _iso(lag_end)},
                "lms_dependency_error_count_total{gateway-identity-token} tăng trong cửa sổ trễ",
                now,
            )
        )
    else:
        checks.append(_check("case_supported", case_id, "fail", None, "C2|C3|C4|C6", now))
    return checks


def apply_verification(
    ground_truth: dict[str, Any], checks: list[dict[str, Any]]
) -> dict[str, Any]:
    """Ghi kết quả kiểm chứng vào bản ghi (trả bản mới, không sửa bản gốc)."""
    record = dict(ground_truth)
    record["verification_checks"] = checks
    if not checks:
        record["verification_result"] = "not_applicable"
        return record
    passed = all(check["result"] == "pass" for check in checks)
    record["verification_result"] = "succeeded" if passed else "failed"
    reasons = list(record.get("invalid_reasons", []))
    if not passed:
        reasons.append("verification_failed")
    record["invalid_reasons"] = reasons
    record["run_status"] = "invalid" if reasons else record["run_status"]
    return record
