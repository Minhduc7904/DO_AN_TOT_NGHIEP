"""Tín hiệu triệu chứng mà detector dùng, và cách gom feature về (cửa sổ, service).

Quy tắc dùng chung cho mọi detector (analysis blueprint mục 9; evaluation-protocol-v1 mục 6.1.1
bảng F, 6.1.2, 17.8 — E1 chỉ đổi detector):

- **Tín hiệu triệu chứng** (`SIGNALS`, phiên bản `SIGNAL_SET_VERSION`): lỗi, độ trễ, hàng đợi ứ và
  mất consumer, theo lớp lỗi của catalogue case (`ground_truth/cases.py`: độ trễ dependency, độ trễ
  HTTP, lỗi, message chờ ack, runtime im lặng). Không dùng tín hiệu tải (`request_rate`,
  `call_count`, `cpu_usage`, `memory_usage`): tải tăng theo nhịp giờ và cao điểm là hợp lệ,
  không phải triệu chứng. Bỏ `latency_p50`, `latency_p99`, `duration_mean`, `duration_p99` vì
  trùng thông tin với p95 cùng nguồn.
- **Hướng:** `up` là tăng mới bất thường; `down` (chỉ `consumers`) là giảm mới bất thường. Điểm có
  hướng = z với `up`, −z với `down`.
- **Trace chỉ dùng tỉ lệ** (bảng F, hệ quả (c)): `trace_error_rate`, không dùng `span_count` hay số
  đếm tuyệt đối, để trace mẫu không đổi ý nghĩa của tín hiệu.
- **Quy về service:** bảng service theo `service_name`; cạnh theo **phía gọi** (`caller_service`,
  nơi đo được lời gọi chậm/lỗi; dependency như `course-postgres` không phải service ứng viên);
  hàng đợi theo **consumer** (`consumer_service`).
- **Im lặng:** `telemetry_silent` của service (runtime ngừng nhịp tim) là tín hiệu riêng, không
  đi qua z; `caller_silent`/`consumer_silent` là cùng cờ của runtime đó.
- **Cửa sổ không dữ liệu** (`skip_without_breaking_chain`, evaluation-protocol-v1 mục 6.1.2) xét ở
  hai mức, như nhau cho mọi detector:
  - service không có giá trị nào của tín hiệu triệu chứng (và không im lặng): `flagged` rỗng;
  - mức tín hiệu: mỗi cửa sổ ghi khóa của các tín hiệu có giá trị (`observed_keys`, dạng
    `<bảng>.<cột>@<thực thể>`) và khóa của tín hiệu làm nó vượt (`top`). Lifecycle chỉ để một
    cửa sổ không vượt làm đứt chuỗi khi nó **quan sát được** ít nhất một tín hiệu đang là bằng chứng
    của chuỗi; nếu mọi tín hiệu bằng chứng đều rỗng (cạnh thưa không có lời gọi, như C3) thì cửa sổ
    là null với chuỗi đó. Tín hiệu luôn có giá trị (`log_error_rate`, hàng đợi) vì vậy không che
    mất luật này.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from ..features.pipeline import AVAILABLE_AFTER_S as PIPELINE_AVAILABLE_AFTER_S

SIGNAL_SET_VERSION = "signals.v1"
MODALITIES = ("metrics", "traces", "logs")


@dataclass(frozen=True)
class Signal:
    table: str
    column: str
    direction: str  # "up" | "down"
    modality: str

    @property
    def name(self) -> str:
        return f"{self.table}.{self.column}"


SIGNALS: tuple[Signal, ...] = (
    Signal("service", "error_rate", "up", "metrics"),
    Signal("service", "latency_p95", "up", "metrics"),
    Signal("service", "downstream_latency_p95", "up", "metrics"),
    Signal("service", "trace_error_rate", "up", "traces"),
    Signal("service", "log_error_rate", "up", "logs"),
    Signal("edge", "error_ratio", "up", "metrics"),
    Signal("edge", "timeout_ratio", "up", "metrics"),
    Signal("edge", "duration_p95", "up", "metrics"),
    Signal("queue", "messages_ready", "up", "metrics"),
    Signal("queue", "messages_unacked", "up", "metrics"),
    Signal("queue", "consumers", "down", "metrics"),
)
#: Hàng đợi dead-letter (`*.error`) không có consumer theo thiết kế: `consumers` = 0 là bình thường,
#: nên tín hiệu mất consumer chỉ áp cho hàng đợi thường. `messages_ready` của dead-letter vẫn dùng
#: (message rơi vào đó là dấu hiệu xử lý lỗi).
NOT_FOR_DEAD_LETTER = frozenset({"queue.consumers"})
OWNER: dict[str, str] = {
    "service": "service_name",
    "edge": "caller_service",
    "queue": "consumer_service",
}
ENTITY: dict[str, tuple[str, ...]] = {
    "service": ("service_name",),
    "edge": ("caller_service", "dependency_identity"),
    "queue": ("consumer_service", "queue"),
}
Z_FILES: dict[str, str] = {
    "service": "service_windows_z.parquet",
    "edge": "edge_windows_z.parquet",
    "queue": "queue_windows_z.parquet",
}
#: Độ trễ thu thập theo modality của feature pipeline: modality chậm nhất mà detector dùng (metric
#: 10 s, mục 6.1.2) cộng vào `detected_at` ở incident lifecycle.
AVAILABLE_AFTER_S = PIPELINE_AVAILABLE_AFTER_S


def directional(signal: Signal, z: float | None) -> float | None:
    if z is None:
        return None
    return z if signal.direction == "up" else -z


@dataclass(frozen=True)
class Observation:
    """Giá trị một tín hiệu của một thực thể (service, cạnh, hàng đợi) trong một cửa sổ."""

    signal: Signal
    entity: str
    value: float | None
    z: float | None  # z đã có hướng; None khi không có giá trị hoặc thiếu baseline

    @property
    def key(self) -> str:
        """Khóa bằng chứng `<bảng>.<cột>@<thực thể>`: lifecycle dùng để biết cửa sổ sau có quan sát
        được đúng tín hiệu đã làm cửa sổ trước vượt hay không (luật cửa sổ không dữ liệu)."""
        return f"{self.signal.name}@{self.entity}"


@dataclass
class ServiceWindow:
    run_id: str
    window_start: datetime
    window_end: datetime
    warmup: bool
    service: str
    silent: bool = False
    observations: list[Observation] = field(default_factory=list)

    @property
    def has_data(self) -> bool:
        return any(obs.value is not None for obs in self.observations)

    def observed_keys(self) -> list[str]:
        """Khóa của các tín hiệu có giá trị trong cửa sổ."""
        return sorted(obs.key for obs in self.observations if obs.value is not None)

    def available(self, modality: str) -> bool:
        return any(
            obs.value is not None for obs in self.observations if obs.signal.modality == modality
        )


def _entity(row: dict[str, Any], table: str) -> str:
    return "|".join(str(row[column]) for column in ENTITY[table])


def service_windows(features_dir: Path) -> list[ServiceWindow]:
    """Đọc `<bảng>_windows_z.parquet` (đầu ra của `apply-baseline`) và gom theo (cửa sổ, service).

    Chỉ dùng giá trị feature và z đã có; không đọc ground truth hay thông tin nào ngoài thư mục
    feature của run.
    """
    by_key: dict[tuple[datetime, str], ServiceWindow] = {}
    signals_by_table: dict[str, list[Signal]] = defaultdict(list)
    for signal in SIGNALS:
        signals_by_table[signal.table].append(signal)
    for table, file_name in Z_FILES.items():
        path = features_dir / file_name
        if not path.exists():
            if table == "service":
                raise FileNotFoundError(f"Thiếu {path}: chạy apply-baseline trước")
            continue
        for row in pq.read_table(path).to_pylist():
            owner = row[OWNER[table]]
            if not owner:
                # Không quy được về service nào (dữ liệu thật chưa gặp): bỏ dòng, không đoán.
                continue
            key = (row["window_start"], owner)
            window = by_key.get(key)
            if window is None:
                window = by_key[key] = ServiceWindow(
                    run_id=row["run_id"],
                    window_start=row["window_start"],
                    window_end=row["window_end"],
                    warmup=row["warmup"],
                    service=owner,
                )
            if table == "service":
                window.silent = bool(row["telemetry_silent"])
            entity = _entity(row, table)
            for signal in signals_by_table[table]:
                if signal.name in NOT_FOR_DEAD_LETTER and row.get("dead_letter"):
                    continue
                value = row.get(signal.column)
                window.observations.append(
                    Observation(
                        signal=signal,
                        entity=entity,
                        value=None if value is None else float(value),
                        z=directional(signal, row.get(f"{signal.column}_z")),
                    )
                )
    return sorted(by_key.values(), key=lambda w: (w.window_start, w.service))
