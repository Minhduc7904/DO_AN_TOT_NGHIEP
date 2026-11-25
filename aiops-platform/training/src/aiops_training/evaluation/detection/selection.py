"""Luật chọn tổ hợp detector của evaluation-protocol-v1 mục 6.1.2 (`detection-candidates.v1`).

Điều kiện: báo động giả ≤ cap incident/giờ. Trong các tổ hợp đạt: nhiều fault run khớp nhất → ít
báo động giả/giờ hơn → `late_tolerance` nhỏ hơn → ngưỡng lớn hơn. Không tổ hợp nào đạt: chọn tổ hợp
ít báo động giả/giờ nhất, hòa theo cùng thứ tự, và ghi là không đạt điều kiện.

Tỉ lệ so bằng số hữu tỉ (`Fraction`) trên thời gian phơi nhiễm micro giây nguyên, không qua phép
chia số thực. Chỉ so được các tổ hợp chấm trên cùng tập run, cùng evaluation config, cùng tập ứng
viên và cùng detector.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

from .metrics import US_PER_HOUR, meets_cap


@dataclass(frozen=True)
class CombinationResult:
    combination_id: str
    threshold: float | None
    late_tolerance_seconds: float
    matched_fault_runs: int
    false_alarms: int
    #: Mẫu số của báo động giả/giờ, micro giây (số nguyên).
    exposure_us: int
    cap_per_hour: float
    eligible_run_ids: tuple[str, ...]
    evaluation_config_version: str
    candidates_sha256: str
    detector: str
    window_seconds: int | None = None
    persistence_windows: int | None = None

    @property
    def false_alarm_hours(self) -> float:
        return self.exposure_us / US_PER_HOUR

    @property
    def false_alarms_per_hour(self) -> float | None:
        if self.exposure_us == 0:
            return None
        return self.false_alarms * US_PER_HOUR / self.exposure_us

    @property
    def meets_cap(self) -> bool:
        return meets_cap(self.false_alarms, self.exposure_us, self.cap_per_hour)

    def rate_key(self) -> tuple[int, Fraction]:
        """Khóa sắp tỉ lệ tăng dần; tỉ lệ không xác định (mẫu số 0) xếp sau mọi tỉ lệ."""
        if self.exposure_us == 0:
            return (1, Fraction(0))
        return (0, Fraction(self.false_alarms * US_PER_HOUR, self.exposure_us))


def combination_from_artifact(
    artifact: dict[str, Any], combination_id: str, threshold: float | None = None
) -> CombinationResult:
    """Lấy đầu vào của luật chọn từ evaluation artifact của harness.

    Ngưỡng lấy từ artifact (incident record); nếu truyền `threshold` thì phải khớp.
    """
    recorded = artifact.get("threshold")
    if threshold is not None and (recorded is None or float(threshold) != float(recorded)):
        raise ValueError(
            f"{combination_id}: ngưỡng truyền vào {threshold} khác ngưỡng của artifact {recorded}"
        )
    summary = artifact["summary"]
    rate = summary["false_alarm_rate"]
    return CombinationResult(
        combination_id=combination_id,
        threshold=None if recorded is None else float(recorded),
        late_tolerance_seconds=artifact["late_tolerance_seconds"],
        matched_fault_runs=summary["matched_fault_runs"],
        false_alarms=rate["false_alarms"],
        exposure_us=rate["exposure_us"],
        cap_per_hour=rate["cap_per_hour"],
        eligible_run_ids=tuple(sorted(summary["eligible_run_ids"])),
        evaluation_config_version=artifact["evaluation_config_version"],
        candidates_sha256=artifact["lineage"]["candidates_config"]["sha256"],
        detector=artifact["detector"],
        window_seconds=artifact.get("window_seconds"),
        persistence_windows=artifact.get("persistence_windows"),
    )


def _threshold_key(result: CombinationResult) -> float:
    # Ngưỡng lớn hơn đứng trước; tổ hợp không có ngưỡng xếp sau.
    return float("inf") if result.threshold is None else -result.threshold


def _key_when_cap_met(result: CombinationResult) -> tuple:
    return (
        -result.matched_fault_runs,
        result.rate_key(),
        result.late_tolerance_seconds,
        _threshold_key(result),
        result.combination_id,
    )


def _key_fallback(result: CombinationResult) -> tuple:
    return (
        result.rate_key(),
        -result.matched_fault_runs,
        result.late_tolerance_seconds,
        _threshold_key(result),
        result.combination_id,
    )


_SHARED = (
    "eligible_run_ids",
    "evaluation_config_version",
    "candidates_sha256",
    "detector",
    "cap_per_hour",
)


def select_combination(results: Sequence[CombinationResult]) -> dict[str, Any]:
    """Trả tổ hợp được chọn, việc có đạt điều kiện không và bảng xếp hạng đầy đủ."""
    if not results:
        raise ValueError("Không có tổ hợp nào để chọn")
    ids = [r.combination_id for r in results]
    if len(set(ids)) != len(ids):
        raise ValueError("combination_id bị trùng")
    first = results[0]
    for result in results[1:]:
        for name in _SHARED:
            if getattr(result, name) != getattr(first, name):
                raise ValueError(
                    f"{result.combination_id} khác {first.combination_id} ở {name}: "
                    "chỉ so các tổ hợp chấm trên cùng run, config và detector"
                )
    passing = sorted((r for r in results if r.meets_cap), key=_key_when_cap_met)
    failing = sorted((r for r in results if not r.meets_cap), key=_key_fallback)
    table = [
        {
            "rank": index + 1,
            "combination_id": result.combination_id,
            "threshold": result.threshold,
            "window_seconds": result.window_seconds,
            "persistence_windows": result.persistence_windows,
            "late_tolerance_seconds": result.late_tolerance_seconds,
            "matched_fault_runs": result.matched_fault_runs,
            "false_alarms": result.false_alarms,
            "false_alarm_hours": result.false_alarm_hours,
            "false_alarms_per_hour": result.false_alarms_per_hour,
            "meets_cap": result.meets_cap,
        }
        for index, result in enumerate(passing + failing)
    ]
    return {
        "selected": table[0]["combination_id"],
        "meets_cap": table[0]["meets_cap"],
        "rule_applied": "cap_met" if passing else "fallback_min_false_alarms",
        "cap_per_hour": first.cap_per_hour,
        "detector": first.detector,
        "evaluation_config_version": first.evaluation_config_version,
        "candidates_sha256": first.candidates_sha256,
        "eligible_run_ids": list(first.eligible_run_ids),
        "ranking": table,
    }
