"""Lọc incident theo evaluation interval và ghép incident với fault của một run (mục 7.1, 17)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from .records import Incident

#: Nhãn của từng incident trong artifact.
MATCHED = "tp"
FP_BEFORE_FAULT = "fp_before_fault"
FP_AFTER_LATE_TOLERANCE = "fp_after_late_tolerance"
FP_DUPLICATE = "fp_duplicate"
FP_HEALTHY = "fp_healthy_run"
OUTSIDE_INTERVAL = "outside_evaluation_interval"


@dataclass(frozen=True)
class Interval:
    """Khoảng đóng `[start, end]`."""

    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.end < self.start:
            raise ValueError(f"Khoảng rỗng: {self.start} > {self.end}")

    def contains(self, moment: datetime) -> bool:
        return self.start <= moment <= self.end

    @property
    def seconds(self) -> float:
        return (self.end - self.start).total_seconds()

    def overlap_seconds(self, other: Interval) -> float:
        start, end = max(self.start, other.start), min(self.end, other.end)
        return max(0.0, (end - start).total_seconds())


@dataclass(frozen=True)
class PeakSegment:
    """Đoạn cao điểm nửa mở `[start, end)` lấy từ lịch workload."""

    start: datetime
    end: datetime

    def contains(self, moment: datetime) -> bool:
        return self.start <= moment < self.end


@dataclass
class RunDetection:
    """Kết quả chấm một run eligible; `fault_window` None là run khỏe."""

    run_id: str
    evaluation_interval: Interval
    fault_window: Interval | None
    matching_interval: Interval | None
    late_tolerance_s: float
    matched_incident_id: str | None
    detection_delay_s: float | None
    labels: dict[str, str]
    tp: int
    fp: int
    fn: int
    #: Báo động giả theo luật chọn (mục 6.1.2 bước 2) và thời gian phơi nhiễm tương ứng.
    false_alarms: int
    exposure_s: float
    peak: dict[str, Any] | None = None
    incidents: list[Incident] = field(default_factory=list)

    @property
    def is_fault_run(self) -> bool:
        return self.fault_window is not None

    @property
    def incidents_in_interval(self) -> int:
        return sum(1 for label in self.labels.values() if label != OUTSIDE_INTERVAL)

    def detection_fields(self) -> dict[str, Any]:
        """Phần detection của evaluation artifact (mục 22)."""
        return {
            "matched_incident_id": self.matched_incident_id,
            "detected": self.matched_incident_id is not None if self.is_fault_run else None,
            "tp": self.tp,
            "fp_incident_count": self.fp,
            "fn": self.fn,
            "detection_delay_seconds": self.detection_delay_s,
            "healthy_run_false_positive": None if self.is_fault_run else int(self.fp > 0),
        }


def _order(incident: Incident) -> tuple[datetime, str]:
    return incident.detected_at, incident.incident_id


def evaluate_run(
    run_id: str,
    incidents: list[Incident] | tuple[Incident, ...],
    evaluation_interval: Interval,
    *,
    fault_window: Interval | None = None,
    late_tolerance_s: float = 0.0,
    exclude_late_tolerance_tail: bool = True,
    peak: PeakSegment | None = None,
) -> RunDetection:
    """Chấm một run theo mục 17.2–17.5.

    Fault run: incident sớm nhất (theo `detected_at`, hòa theo `incident_id`) có `detected_at`
    trong `[fault_start, fault_end + late_tolerance]` là TP; incident khác trong evaluation interval
    là FP; không có thì FN. Run khỏe: mọi incident trong evaluation interval là FP. Incident ngoài
    evaluation interval chỉ được gắn nhãn diagnostic.
    """
    ordered = sorted(incidents, key=_order)
    labels: dict[str, str] = {}
    inside = []
    for incident in ordered:
        if evaluation_interval.contains(incident.detected_at):
            inside.append(incident)
        else:
            labels[incident.incident_id] = OUTSIDE_INTERVAL

    matching = None
    matched: Incident | None = None
    if fault_window is None:
        for incident in inside:
            labels[incident.incident_id] = FP_HEALTHY
        false_alarms = len(inside)
        exposure = evaluation_interval.seconds
    else:
        matching = Interval(
            fault_window.start, fault_window.end + timedelta(seconds=late_tolerance_s)
        )
        for incident in inside:
            if incident.detected_at < matching.start:
                labels[incident.incident_id] = FP_BEFORE_FAULT
            elif incident.detected_at > matching.end:
                labels[incident.incident_id] = FP_AFTER_LATE_TOLERANCE
            elif matched is None:
                matched = incident
                labels[incident.incident_id] = MATCHED
            else:
                labels[incident.incident_id] = FP_DUPLICATE
        # Luật chọn chỉ đếm incident ngoài khoảng ghép là báo động giả; mẫu số trừ đúng khoảng đó.
        false_alarms = sum(
            1
            for incident in inside
            if labels[incident.incident_id] in (FP_BEFORE_FAULT, FP_AFTER_LATE_TOLERANCE)
        )
        removed = matching if exclude_late_tolerance_tail else fault_window
        exposure = evaluation_interval.seconds - evaluation_interval.overlap_seconds(removed)

    tp = int(matched is not None)
    fp = len(inside) - tp
    fn = int(fault_window is not None and matched is None)
    delay = (
        (matched.detected_at - fault_window.start).total_seconds()
        if matched is not None and fault_window is not None
        else None
    )
    peak_result = None
    if peak is not None:
        peak_interval = Interval(peak.start, peak.end)
        peak_result = {
            "start": peak.start,
            "end": peak.end,
            "false_alarms": sum(
                1
                for incident in inside
                if labels[incident.incident_id] != MATCHED and peak.contains(incident.detected_at)
            ),
            "exposure_s": evaluation_interval.overlap_seconds(peak_interval),
        }
    return RunDetection(
        run_id=run_id,
        evaluation_interval=evaluation_interval,
        fault_window=fault_window,
        matching_interval=matching,
        late_tolerance_s=late_tolerance_s,
        matched_incident_id=matched.incident_id if matched else None,
        detection_delay_s=delay,
        labels=labels,
        tp=tp,
        fp=fp,
        fn=fn,
        false_alarms=false_alarms,
        exposure_s=exposure,
        peak=peak_result,
        incidents=ordered,
    )
