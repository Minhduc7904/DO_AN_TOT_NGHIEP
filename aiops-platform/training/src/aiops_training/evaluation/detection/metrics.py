"""Gộp kết quả theo run thành chỉ số detection (mục 17.5–17.7, 20.2).

Mọi tỉ lệ trả `None` khi mẫu số bằng 0 (mục 17.6) và luôn đi kèm tử số, mẫu số.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

from .matching import MICROSECONDS, RunDetection

SECONDS_PER_HOUR = 3600.0
US_PER_HOUR = 3600 * MICROSECONDS


@dataclass(frozen=True)
class RunUnit:
    """Một run eligible cùng nhãn phân tầng: `case` với fault run, `profile` với run khỏe."""

    detection: RunDetection
    case: str | None
    profile: str
    align_peak: bool | None = None

    @property
    def is_fault_run(self) -> bool:
        return self.detection.is_fault_run

    @property
    def stratum(self) -> str:
        return f"case:{self.case}" if self.is_fault_run else f"profile:{self.profile}"


def ratio(numerator: float, denominator: float) -> float | None:
    return None if denominator == 0 else numerator / denominator


def precision_recall_f1(tp: int, fp: int, fn: int) -> dict[str, float | None]:
    precision = ratio(tp, tp + fp)
    recall = ratio(tp, tp + fn)
    if precision is None or recall is None:
        f1 = None
    else:
        f1 = ratio(2 * precision * recall, precision + recall)
    return {"precision": precision, "recall": recall, "f1": f1}


def counts(units: Iterable[RunUnit]) -> dict[str, Any]:
    units = list(units)
    tp = sum(u.detection.tp for u in units)
    fp = sum(u.detection.fp for u in units)
    fn = sum(u.detection.fn for u in units)
    return {
        "n_runs": len(units),
        "n_fault_runs": sum(1 for u in units if u.is_fault_run),
        "n_healthy_runs": sum(1 for u in units if not u.is_fault_run),
        "n_incidents": sum(u.detection.incidents_in_interval for u in units),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        **precision_recall_f1(tp, fp, fn),
    }


def false_alarm_rate(units: Iterable[RunUnit]) -> dict[str, Any]:
    """Báo động giả/giờ theo luật chọn mục 6.1.2 (tử, mẫu số theo evaluation config)."""
    units = list(units)
    alarms = sum(u.detection.false_alarms for u in units)
    exposure_us = sum(u.detection.exposure_us for u in units)
    return {
        "false_alarms": alarms,
        "exposure_us": exposure_us,
        "hours": exposure_us / US_PER_HOUR,
        "per_hour": None if exposure_us == 0 else alarms * US_PER_HOUR / exposure_us,
    }


def meets_cap(false_alarms: int, exposure_us: int, cap_per_hour: float) -> bool:
    """`false_alarms / giờ <= cap` so bằng số hữu tỉ: `alarms × 3600 s <= cap × exposure`.

    Mẫu số 0 (không có thời gian phơi nhiễm) thì tỉ lệ không xác định nên không đạt.
    """
    if exposure_us <= 0:
        return False
    return false_alarms * US_PER_HOUR <= Fraction(cap_per_hour) * exposure_us


def healthy_rates(units: Iterable[RunUnit]) -> dict[str, Any]:
    """Healthy-run FPR và FP incidents per healthy hour (mục 17.7)."""
    healthy = [u for u in units if not u.is_fault_run]
    with_fp = sum(1 for u in healthy if u.detection.fp > 0)
    incidents = sum(u.detection.fp for u in healthy)
    hours = sum(u.detection.evaluation_interval.seconds for u in healthy) / SECONDS_PER_HOUR
    return {
        "n_runs": len(healthy),
        "n_runs_with_fp": with_fp,
        "healthy_run_fpr": ratio(with_fp, len(healthy)),
        "fp_incidents": incidents,
        "hours": hours,
        "fp_per_healthy_hour": ratio(incidents, hours),
    }


def peak_rates(units: Iterable[RunUnit]) -> dict[str, Any]:
    with_peak = [u for u in units if not u.is_fault_run and u.detection.peak is not None]
    alarms = sum(u.detection.peak["false_alarms"] for u in with_peak)
    hours = sum(u.detection.peak["exposure_s"] for u in with_peak) / SECONDS_PER_HOUR
    return {
        "n_runs": len(with_peak),
        "false_alarms": alarms,
        "hours": hours,
        "per_hour": ratio(alarms, hours),
    }


def delay_summary(values: Sequence[float], fn: int) -> dict[str, Any]:
    return {
        "count": len(values),
        "fn": fn,
        "mean_seconds": statistics.fmean(values) if values else None,
        "median_seconds": statistics.median(values) if values else None,
        "values_seconds": sorted(values),
    }


def _delays(units: Iterable[RunUnit]) -> dict[str, Any]:
    units = [u for u in units if u.is_fault_run]
    values = [u.detection.detection_delay_s for u in units if u.detection.tp]
    return delay_summary(values, sum(u.detection.fn for u in units))


def _align_peak_name(unit: RunUnit) -> str:
    return "unknown" if unit.align_peak is None else str(unit.align_peak).lower()


def _group(units: Iterable[RunUnit], key) -> dict[str, list[RunUnit]]:
    groups: dict[str, list[RunUnit]] = defaultdict(list)
    for unit in units:
        groups[key(unit)].append(unit)
    return dict(sorted(groups.items()))


def summarize(units: Sequence[RunUnit], cap_per_hour: float) -> dict[str, Any]:
    """Bảng tổng hợp detection của một tổ hợp detector/config trên các run eligible."""
    fault = [u for u in units if u.is_fault_run]
    healthy = [u for u in units if not u.is_fault_run]
    alarm = false_alarm_rate(units)
    per_case = {
        case: {**counts(group), "detection_delay": _delays(group)}
        for case, group in _group(fault, lambda u: str(u.case)).items()
    }
    repetitions = {case: summary["n_runs"] for case, summary in per_case.items()}
    return {
        # Chỉ số chính (mục 17.6, 20.2): mọi run eligible, FP của run khỏe tính vào.
        "pooled": counts(units),
        # Chỉ số phụ: chỉ fault run, để thấy Precision không bị run khỏe kéo xuống.
        "pooled_fault_runs": counts(fault),
        "matched_fault_runs": sum(u.detection.tp for u in fault),
        "false_alarm_rate": {
            **alarm,
            "cap_per_hour": cap_per_hour,
            "meets_cap": meets_cap(alarm["false_alarms"], alarm["exposure_us"], cap_per_hour),
        },
        "healthy": {
            **healthy_rates(healthy),
            "by_profile": {
                profile: healthy_rates(group)
                for profile, group in _group(healthy, lambda u: u.profile).items()
            },
        },
        "peak": {
            profile: peak_rates(group)
            for profile, group in _group(healthy, lambda u: u.profile).items()
            if any(u.detection.peak is not None for u in group)
        },
        "detection_delay": {
            **_delays(fault),
            "by_case": {case: summary["detection_delay"] for case, summary in per_case.items()},
            "by_align_peak": {
                name: _delays(group) for name, group in _group(fault, _align_peak_name).items()
            },
        },
        "per_case": per_case,
        "K": len(per_case),
        "R": repetitions,
    }
