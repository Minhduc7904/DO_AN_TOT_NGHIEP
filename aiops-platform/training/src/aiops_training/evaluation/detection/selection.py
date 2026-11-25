"""Luật chọn tổ hợp detector của evaluation-protocol-v1 mục 6.1.2 (`detection-candidates.v1`).

Điều kiện: báo động giả ≤ cap incident/giờ. Trong các tổ hợp đạt: nhiều fault run khớp nhất → ít
báo động giả/giờ hơn → `late_tolerance` nhỏ hơn → ngưỡng lớn hơn. Không tổ hợp nào đạt: chọn tổ hợp
ít báo động giả/giờ nhất, hòa theo cùng thứ tự, và ghi là không đạt điều kiện.

Khi tập ứng viên khai báo thứ tự toàn phần (`tie_rank` nguyên theo `combination_id`, 1 là ưu tiên
nhất), khóa hòa cuối "ngưỡng lớn hơn" được thay bằng `tie_rank` tăng dần: trường `threshold` số
không phân biệt được các ứng viên chỉ khác config (ngưỡng tĩnh luôn 1.0, tham số incident cùng
ngưỡng, fused khác trọng số).

Tỉ lệ so bằng số hữu tỉ (`Fraction`) trên thời gian phơi nhiễm micro giây nguyên, không qua phép
chia số thực. Chỉ so được các tổ hợp chấm trên cùng tập run, cùng evaluation config, cùng tập ứng
viên và cùng detector.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
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
    #: Định danh tổ hợp: các ứng viên khác nhau chính ở các sha này (bộ ngưỡng tĩnh, hyperparameter
    #: Isolation Forest, tham số incident), không chỉ ở threshold.
    detector_config_sha256: str | None = None
    incident_config_sha256: str | None = None
    model_sha256: str | None = None

    def identity(self) -> tuple:
        return (
            self.detector,
            self.window_seconds,
            self.persistence_windows,
            self.threshold,
            self.detector_config_sha256,
            self.incident_config_sha256,
            self.model_sha256,
        )

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
        detector_config_sha256=artifact.get("detector_config_sha256"),
        incident_config_sha256=artifact.get("incident_config_sha256"),
        model_sha256=artifact.get("model_sha256"),
    )


def _threshold_key(result: CombinationResult) -> float:
    # Ngưỡng lớn hơn đứng trước; tổ hợp không có ngưỡng xếp sau.
    return float("inf") if result.threshold is None else -result.threshold


TieKey = Callable[[CombinationResult], tuple]


def _default_tie(result: CombinationResult) -> tuple:
    return (_threshold_key(result), result.combination_id)


def _key_when_cap_met(result: CombinationResult, tie: TieKey = _default_tie) -> tuple:
    return (
        -result.matched_fault_runs,
        result.rate_key(),
        result.late_tolerance_seconds,
        *tie(result),
    )


def _key_fallback(result: CombinationResult, tie: TieKey = _default_tie) -> tuple:
    return (
        result.rate_key(),
        -result.matched_fault_runs,
        result.late_tolerance_seconds,
        *tie(result),
    )


def _tie_rank_key(results: Sequence[CombinationResult], tie_rank: Mapping[str, int]) -> TieKey:
    missing = sorted(r.combination_id for r in results if r.combination_id not in tie_rank)
    if missing:
        raise ValueError(f"Thiếu tie_rank cho tổ hợp: {missing}")
    ranks = [tie_rank[r.combination_id] for r in results]
    if any(isinstance(rank, bool) or not isinstance(rank, int) for rank in ranks):
        raise ValueError("tie_rank phải là số nguyên")
    if len(set(ranks)) != len(ranks):
        raise ValueError("Hai tổ hợp có cùng tie_rank: thứ tự hòa không toàn phần")
    return lambda result: (tie_rank[result.combination_id],)


_SHARED = (
    "eligible_run_ids",
    "evaluation_config_version",
    "candidates_sha256",
    "detector",
    "cap_per_hour",
)


def select_combination(
    results: Sequence[CombinationResult], tie_rank: Mapping[str, int] | None = None
) -> dict[str, Any]:
    """Trả tổ hợp được chọn, việc có đạt điều kiện không và bảng xếp hạng đầy đủ.

    `tie_rank` (tùy chọn, khóa là `combination_id`): khóa hòa cuối thay cho "ngưỡng lớn hơn" rồi
    `combination_id`; phải có cho mọi tổ hợp và không trùng nhau.
    """
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
    seen: dict[tuple, str] = {}
    for result in results:
        other = seen.setdefault(result.identity(), result.combination_id)
        if other != result.combination_id:
            raise ValueError(
                f"{other} và {result.combination_id} trùng toàn bộ khóa định danh (detector, "
                "window, persistence, threshold, sha256 của config detector, config incident, "
                "model): "
                "cùng một tổ hợp bị chấm hai lần"
            )
    tie = _default_tie if tie_rank is None else _tie_rank_key(results, tie_rank)
    passing = sorted((r for r in results if r.meets_cap), key=lambda r: _key_when_cap_met(r, tie))
    failing = sorted((r for r in results if not r.meets_cap), key=lambda r: _key_fallback(r, tie))
    table = [
        {
            "rank": index + 1,
            "combination_id": result.combination_id,
            "threshold": result.threshold,
            "window_seconds": result.window_seconds,
            "persistence_windows": result.persistence_windows,
            "detector_config_sha256": result.detector_config_sha256,
            "incident_config_sha256": result.incident_config_sha256,
            "model_sha256": result.model_sha256,
            "late_tolerance_seconds": result.late_tolerance_seconds,
            "matched_fault_runs": result.matched_fault_runs,
            "false_alarms": result.false_alarms,
            "false_alarm_hours": result.false_alarm_hours,
            "false_alarms_per_hour": result.false_alarms_per_hour,
            "meets_cap": result.meets_cap,
            "tie_rank": None if tie_rank is None else tie_rank[result.combination_id],
        }
        for index, result in enumerate(passing + failing)
    ]
    return {
        "selected": table[0]["combination_id"],
        "meets_cap": table[0]["meets_cap"],
        "rule_applied": "cap_met" if passing else "fallback_min_false_alarms",
        "tie_break": "threshold_desc" if tie_rank is None else "tie_rank_asc",
        "cap_per_hour": first.cap_per_hour,
        "detector": first.detector,
        "evaluation_config_version": first.evaluation_config_version,
        "candidates_sha256": first.candidates_sha256,
        "eligible_run_ids": list(first.eligible_run_ids),
        "ranking": table,
    }
