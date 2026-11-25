"""Luật chọn tổ hợp detector của evaluation-protocol-v1 mục 6.1.2 (`detection-candidates.v1`).

Điều kiện: báo động giả ≤ cap incident/giờ. Trong các tổ hợp đạt: nhiều fault run khớp nhất → ít
báo động giả/giờ hơn → `late_tolerance` nhỏ hơn → ngưỡng lớn hơn. Không tổ hợp nào đạt: chọn tổ hợp
ít báo động giả/giờ nhất, hòa theo cùng thứ tự, và ghi là không đạt điều kiện.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class CombinationResult:
    combination_id: str
    threshold: float
    late_tolerance_seconds: float
    matched_fault_runs: int
    false_alarms: int
    false_alarm_hours: float
    window_seconds: int | None = None
    persistence_windows: int | None = None

    @property
    def false_alarms_per_hour(self) -> float | None:
        return None if self.false_alarm_hours == 0 else self.false_alarms / self.false_alarm_hours


def combination_from_artifact(
    artifact: dict[str, Any], combination_id: str, threshold: float
) -> CombinationResult:
    """Lấy đầu vào của luật chọn từ evaluation artifact của harness."""
    summary = artifact["summary"]
    rate = summary["false_alarm_rate"]
    return CombinationResult(
        combination_id=combination_id,
        threshold=threshold,
        late_tolerance_seconds=artifact["late_tolerance_seconds"],
        matched_fault_runs=summary["matched_fault_runs"],
        false_alarms=rate["false_alarms"],
        false_alarm_hours=rate["hours"],
        window_seconds=artifact.get("window_seconds"),
        persistence_windows=artifact.get("persistence_windows"),
    )


def _rate_key(result: CombinationResult) -> float:
    rate = result.false_alarms_per_hour
    return math.inf if rate is None else rate


def _meets(result: CombinationResult, cap: float) -> bool:
    rate = result.false_alarms_per_hour
    return rate is not None and rate <= cap


def _key_when_cap_met(result: CombinationResult) -> tuple:
    return (
        -result.matched_fault_runs,
        _rate_key(result),
        result.late_tolerance_seconds,
        -result.threshold,
        result.combination_id,
    )


def _key_fallback(result: CombinationResult) -> tuple:
    return (
        _rate_key(result),
        -result.matched_fault_runs,
        result.late_tolerance_seconds,
        -result.threshold,
        result.combination_id,
    )


def select_combination(
    results: Sequence[CombinationResult], cap_per_hour: float = 1.0
) -> dict[str, Any]:
    """Trả tổ hợp được chọn, việc có đạt điều kiện không và bảng xếp hạng đầy đủ."""
    if not results:
        raise ValueError("Không có tổ hợp nào để chọn")
    ids = [r.combination_id for r in results]
    if len(set(ids)) != len(ids):
        raise ValueError("combination_id bị trùng")
    passing = sorted((r for r in results if _meets(r, cap_per_hour)), key=_key_when_cap_met)
    failing = [r for r in results if not _meets(r, cap_per_hour)]
    if passing:
        ranking = passing + sorted(failing, key=_key_fallback)
        rule = "cap_met"
    else:
        ranking = sorted(failing, key=_key_fallback)
        rule = "fallback_min_false_alarms"
    table = [
        {
            "rank": index + 1,
            **asdict(result),
            "false_alarms_per_hour": result.false_alarms_per_hour,
            "meets_cap": _meets(result, cap_per_hour),
        }
        for index, result in enumerate(ranking)
    ]
    return {
        "selected": table[0]["combination_id"],
        "meets_cap": table[0]["meets_cap"],
        "rule_applied": rule,
        "cap_per_hour": cap_per_hour,
        "ranking": table,
    }
