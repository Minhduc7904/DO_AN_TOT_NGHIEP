"""Đoạn cao điểm của run khỏe, lấy từ kế hoạch phát lại (lịch workload), không từ telemetry.

Luật trùng `peakAlignedStart` của `aiops-platform/faults/fault-schedule.mjs` (`--align-peak`):
quét điểm bắt đầu theo bước cố định, chọn đoạn có nhiều lần bắt đầu phiên nhất, hòa thì lấy đoạn
sớm nhất.
Run khỏe không có fault nên bỏ ràng buộc recovery.
"""

from __future__ import annotations

import bisect
import hashlib
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .matching import PeakSegment


class PeakPlanError(ValueError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason


@dataclass(frozen=True)
class PlanPeak:
    """Đoạn `[start_s, end_s)` tính theo giây từ đầu kế hoạch."""

    start_s: float
    end_s: float
    session_starts: int

    def anchor(self, workload_start: datetime) -> PeakSegment:
        return PeakSegment(
            workload_start + timedelta(seconds=self.start_s),
            workload_start + timedelta(seconds=self.end_s),
        )


def peak_window(
    session_starts: Sequence[float],
    *,
    run_seconds: float,
    warmup_s: float,
    duration_s: float,
    step_s: float,
) -> PlanPeak:
    if step_s <= 0 or duration_s <= 0:
        raise ValueError("duration_s và step_s phải > 0")
    latest = run_seconds - duration_s
    if latest < warmup_s:
        raise ValueError("Kế hoạch quá ngắn cho đoạn cao điểm sau warm-up")
    starts = sorted(session_starts)
    best: PlanPeak | None = None
    start = warmup_s
    while start <= latest:
        count = bisect.bisect_left(starts, start + duration_s) - bisect.bisect_left(starts, start)
        if best is None or count > best.session_starts:
            best = PlanPeak(start, start + duration_s, count)
        start += step_s
    assert best is not None
    return best


def load_plan_peak(
    plan_path: Path,
    expected_sha256: str | None,
    *,
    warmup_s: float,
    duration_s: float,
    step_s: float,
) -> tuple[PlanPeak, dict[str, Any]]:
    """Đọc kế hoạch, kiểm sha256 với run manifest và trả đoạn cao điểm cùng tham chiếu lineage."""
    if not plan_path.is_file():
        raise PeakPlanError("peak_plan_missing", f"Không thấy kế hoạch {plan_path}")
    raw = plan_path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if expected_sha256 and digest != expected_sha256:
        raise PeakPlanError(
            "peak_plan_sha256_mismatch",
            f"sha256 của {plan_path} là {digest}, run manifest ghi {expected_sha256}",
        )
    plan = json.loads(raw)
    peak = peak_window(
        [float(session["start_s"]) for session in plan["sessions"]],
        run_seconds=float(plan["run_seconds"]),
        warmup_s=warmup_s,
        duration_s=duration_s,
        step_s=step_s,
    )
    reference = {
        "plan_id": plan.get("plan_id"),
        "path": str(plan_path),
        "sha256": digest,
        "start_offset_seconds": peak.start_s,
        "end_offset_seconds": peak.end_s,
        "session_starts": peak.session_starts,
    }
    return peak, reference
