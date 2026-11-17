"""Cửa sổ thời gian của một run: phạm vi export telemetry."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

_RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def parse_utc(value: str) -> datetime:
    """Đọc thời điểm ISO-8601; bắt buộc có múi giờ để không nhầm giờ địa phương."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"Thời điểm phải có múi giờ (ví dụ hậu tố Z): {value}")
    return parsed.astimezone(UTC)


@dataclass(frozen=True)
class ExportWindow:
    """`[start, end]` UTC của run. `run_id` dùng làm tên thư mục nên chỉ cho ký tự an toàn."""

    run_id: str
    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if not _RUN_ID.match(self.run_id):
            raise ValueError(f"run_id không hợp lệ: {self.run_id!r}")
        if self.start.tzinfo is None or self.end.tzinfo is None:
            raise ValueError("start/end phải có múi giờ")
        if self.end <= self.start:
            raise ValueError(f"end ({self.end}) phải sau start ({self.start})")

    @classmethod
    def from_k6_summary(cls, path: Path, grace_seconds: int = 30) -> ExportWindow:
        """Lấy cửa sổ từ `k6-summary.json`; cộng `grace_seconds` vào cuối vì telemetry tới trễ.

        Độ trễ thu thập đo được (catalogue mục 1.4): log ~2 s, trace ~2,5 s, counter 4–10 s, backlog
        queue ~9 s; 30 giây phủ đủ các độ trễ này.
        """
        summary = json.loads(path.read_text(encoding="utf-8"))
        if not summary.get("started_at") or not summary.get("finished_at"):
            raise ValueError(f"{path} thiếu started_at/finished_at")
        return cls(
            run_id=summary["run_id"],
            start=parse_utc(summary["started_at"]),
            end=parse_utc(summary["finished_at"]) + timedelta(seconds=grace_seconds),
        )

    @property
    def start_ns(self) -> int:
        return int(self.start.timestamp()) * 1_000_000_000 + self.start.microsecond * 1_000

    @property
    def end_ns(self) -> int:
        return int(self.end.timestamp()) * 1_000_000_000 + self.end.microsecond * 1_000

    @property
    def seconds(self) -> float:
        return (self.end - self.start).total_seconds()
