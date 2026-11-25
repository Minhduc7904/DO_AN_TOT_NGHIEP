"""Incident lifecycle từ `AnomalyRecord` của một detector (analysis blueprint mục 6.5, 10).

**Máy trạng thái theo service** (`NORMAL → SUSPECTED → OPEN → RECOVERING → RESOLVED`), xác định
hoàn toàn theo config:

- Chỉ xét cửa sổ ngoài warm-up (cờ `warmup` của feature). Lifecycle không đọc mốc nào của
  `RunGroundTruth` hay evaluation interval; lọc theo evaluation interval là việc của harness.
- **Persistence theo từng khóa bằng chứng** (luật cửa sổ không dữ liệu theo feature,
  `skip_without_breaking_chain`, evaluation-protocol-v1 mục 6.1.2). Mỗi cửa sổ vượt mang tập khóa
  bằng chứng (`evidence_keys`: tín hiệu mà chính detector coi là bất thường, ví dụ
  `edge.duration_p95@ai-worker|ai-worker-llm-provider`). Mỗi khóa có một chuỗi riêng:
  - cửa sổ vượt cộng vào chuỗi của từng khóa trong bằng chứng của nó;
  - một khóa chỉ đứt chuỗi khi một cửa sổ **quan sát được** khóa đó (`observed_keys`) mà khóa không
    nằm trong bằng chứng của cửa sổ (tín hiệu có dữ liệu và bình thường);
  - cửa sổ không quan sát được khóa (cạnh thưa không có lời gọi, như C3), hoặc `flagged` rỗng
    (service không có giá trị triệu chứng nào), không cộng cũng không làm đứt chuỗi của khóa đó.

  Bằng chứng của các tín hiệu khác nhau không cộng dồn với nhau: 3 cửa sổ vượt do cạnh thưa rồi
  2 cửa sổ vượt do log là hai chuỗi dài 3 và 2, không phải một chuỗi dài 5.
- `NORMAL` + cửa sổ vượt → `SUSPECTED` (có ít nhất một chuỗi). Khi mọi chuỗi đứt → `NORMAL`.
  Một chuỗi bất kỳ đủ `persistence_windows` cửa sổ → `OPEN`.
- `OPEN` + cửa sổ không vượt → `RECOVERING`; `RECOVERING` + cửa sổ vượt → `OPEN`;
  đủ `recovery_windows` cửa sổ không vượt liên tiếp (có dữ liệu) → `RESOLVED` (về `NORMAL` cho đợt
  sau). Recovery không đòi quan sát được bằng chứng: nếu đòi, một cạnh chỉ xuất hiện trong lúc
  fault sẽ giữ đợt mở mãi; cạnh thưa hồi phục sớm rồi mở lại thì được gộp lại bằng merge gap.
- **Thời điểm:**
  - `opened_at` (= `detected_at` của đợt) = `window_end` của cửa sổ hoàn tất persistence +
    `available_after_s` của detector (metric 10 s, mục 6.1.2);
  - `estimated_start_time` = `window_end` của cửa sổ vượt đầu tiên của chuỗi − `step_s`: khi cửa
    sổ kết thúc sớm hơn một bước có dữ liệu và chưa vượt, phần dữ liệu mới làm cửa sổ này vượt nằm
    ở bước cuối của nó (blueprint mục 10.4, "cửa sổ bất thường đầu tiên"). Giới hạn: nếu cửa sổ
    trước đó không có dữ liệu (cạnh thưa) thì thời điểm thật có thể sớm tới `window_start`;
  - `resolved_at` = `window_end` của cửa sổ hoàn tất recovery + `available_after_s`; rỗng nếu tới
    cuối run vẫn chưa hồi phục.

**Gộp thành incident** (tạm thời, chỉ theo thời gian; đồ thị phụ thuộc v2 thay ở tuần 17): đợt của
mọi service sắp theo `opened_at`; một đợt nhập incident đang xét nếu nó mở không muộn hơn
`incident_end + merge_gap_seconds` (incident_end = `resolved_at` lớn nhất, hoặc vô cùng khi còn
mở) **hoặc** trong `correlation_window_seconds` kể từ `detected_at` của incident. Như vậy C6 (nhiều
service lỗi cùng lúc) thành một incident có nhiều `affected_services`, và một service tái phát sau
khoảng ngắn không thành incident mới. Một incident mở trước fault rồi kéo dài qua fault vẫn là một
incident (harness tính FP + FN theo mục 17.2); lifecycle không tách theo mốc fault vì không biết mốc
đó.

`incident_id` xác định: băm của `run_id`, detector, ngưỡng, phiên bản và sha256 nội dung của config
detector và incident, cặp window/persistence và `window_end` của cửa sổ mở đầu tiên (mục 17.4 dùng
nó để phá hòa; hai ứng viên ngưỡng không bao giờ trùng id).
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

INCIDENT_SCHEMA = "incident-record.v1"
STATES = ("NORMAL", "SUSPECTED", "OPEN", "RECOVERING", "RESOLVED")


@dataclass(frozen=True)
class IncidentConfig:
    incident_config_version: str
    persistence_windows: int
    recovery_windows: int
    merge_gap_seconds: float
    correlation_window_seconds: float

    def __post_init__(self) -> None:
        if self.persistence_windows < 1 or self.recovery_windows < 1:
            raise ValueError("persistence_windows và recovery_windows phải ≥ 1")
        if self.merge_gap_seconds < 0 or self.correlation_window_seconds < 0:
            raise ValueError("merge_gap_seconds và correlation_window_seconds phải ≥ 0")


@dataclass(frozen=True)
class WindowScore:
    """Một dòng `AnomalyRecord` (đủ trường mà lifecycle cần)."""

    service: str
    window_start: datetime
    window_end: datetime
    warmup: bool
    flagged: bool | None
    score: float | None
    reason: str
    top_signal: str | None = None
    top_entity: str | None = None
    top_key: str | None = None
    evidence_keys: frozenset[str] = frozenset()
    observed_keys: frozenset[str] = frozenset()


@dataclass
class Episode:
    """Một đợt bất thường của một service: từ chuỗi đầu tiên tới khi hồi phục."""

    service: str
    first: WindowScore
    opened: WindowScore
    opened_at: datetime
    estimated_start_time: datetime
    resolved_at: datetime | None = None
    windows: list[WindowScore] = field(default_factory=list)
    evidence_key: str | None = None  # khóa có chuỗi đủ persistence
    events: list[dict[str, Any]] = field(default_factory=list)

    def peak(self) -> WindowScore | None:
        # Điểm vô cùng (ngưỡng tĩnh khi mất hết consumer) là đỉnh thật; JSON ghi nó bằng
        # `peak_score` rỗng kèm `peak_score_infinite`.
        scored = [w for w in self.windows if w.flagged and w.score is not None]
        return max(scored, key=lambda w: w.score, default=None)


def _event(state: str, window: WindowScore, at: datetime) -> dict[str, Any]:
    return {
        "state": state,
        "at": at,
        "window_start": window.window_start,
        "window_end": window.window_end,
        "signal": window.top_signal,
        "entity": window.top_entity,
        "score": window.score,
        "reason": window.reason,
    }


def service_episodes(
    windows: list[WindowScore],
    config: IncidentConfig,
    step_s: float,
    available_after_s: float,
) -> list[Episode]:
    """Chạy máy trạng thái trên các cửa sổ của **một** service (sắp theo thời gian)."""
    delay = timedelta(seconds=available_after_s)
    step = timedelta(seconds=step_s)
    episodes: list[Episode] = []
    state = "NORMAL"
    chains: dict[str, list[WindowScore]] = {}
    quiet = 0
    current: Episode | None = None
    for window in sorted(windows, key=lambda w: w.window_start):
        if window.warmup or window.flagged is None:
            continue
        if state in ("NORMAL", "SUSPECTED"):
            evidence = window.evidence_keys if window.flagged else frozenset()
            for key in [k for k in chains if k in window.observed_keys and k not in evidence]:
                del chains[key]  # tín hiệu có dữ liệu và bình thường: chuỗi của nó đứt
            for key in evidence:
                chains.setdefault(key, []).append(window)
            state = "SUSPECTED" if chains else "NORMAL"
            reached = [k for k, chain in chains.items() if len(chain) >= config.persistence_windows]
            if reached:
                key = min(reached, key=lambda k: (chains[k][0].window_start, k))
                chain = chains[key]
                opened_at = window.window_end + delay
                current = Episode(
                    service=window.service,
                    first=chain[0],
                    opened=window,
                    opened_at=opened_at,
                    estimated_start_time=chain[0].window_end - step,
                    windows=list(chain),
                    evidence_key=key,
                )
                current.events.append(_event("SUSPECTED", chain[0], chain[0].window_end + delay))
                current.events.append(_event("OPEN", window, opened_at))
                episodes.append(current)
                state, chains, quiet = "OPEN", {}, 0
            continue
        # OPEN hoặc RECOVERING
        assert current is not None
        current.windows.append(window)
        if window.flagged:
            if state == "RECOVERING":
                current.events.append(_event("OPEN", window, window.window_end + delay))
            state, quiet = "OPEN", 0
            continue
        quiet += 1
        if state == "OPEN":
            current.events.append(_event("RECOVERING", window, window.window_end + delay))
            state = "RECOVERING"
        if quiet >= config.recovery_windows:
            current.resolved_at = window.window_end + delay
            current.events.append(_event("RESOLVED", window, current.resolved_at))
            state, current, quiet = "NORMAL", None, 0
    return episodes


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def _incident_id(run_id: str, key: dict[str, Any], opened: WindowScore) -> str:
    raw = "|".join(
        [
            run_id,
            str(key["detector"]),
            str(key["detector_config_version"]),
            str(key["incident_config_version"]),
            str(key["window_seconds"]),
            str(key["persistence_windows"]),
            str(key.get("threshold")),
            str(key.get("detector_config_sha256")),
            str(key.get("incident_config_sha256")),
            _iso(opened.window_end) or "",
        ]
    )
    return "inc-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def correlate(
    episodes: list[Episode], config: IncidentConfig, run_id: str, key: dict[str, Any]
) -> list[dict[str, Any]]:
    """Gộp đợt của mọi service thành incident theo thời gian (merge gap, cửa sổ tương quan)."""
    gap = timedelta(seconds=config.merge_gap_seconds)
    corr = timedelta(seconds=config.correlation_window_seconds)
    groups: list[list[Episode]] = []
    for episode in sorted(episodes, key=lambda e: (e.opened_at, e.service)):
        if groups:
            group = groups[-1]
            detected = group[0].opened_at
            ends = [e.resolved_at for e in group]
            still_open = any(end is None for end in ends)
            end = None if still_open else max(ends)
            if still_open or episode.opened_at <= end + gap or episode.opened_at <= detected + corr:
                group.append(episode)
                continue
        groups.append([episode])
    incidents = []
    for group in groups:
        first = min(group, key=lambda e: (e.estimated_start_time, e.opened_at, e.service))
        opener = group[0]
        ends = [e.resolved_at for e in group]
        peaks = [p for p in (e.peak() for e in group) if p is not None]
        peak = max(peaks, key=lambda w: w.score, default=None)
        timeline = sorted(
            (
                {**event, "service": episode.service}
                for episode in group
                for event in episode.events
            ),
            key=lambda event: (event["at"], event["service"], STATES.index(event["state"])),
        )
        incidents.append(
            {
                "incident_id": _incident_id(run_id, key, opener.opened),
                "detected_at": _iso(opener.opened_at),
                "estimated_start_time": _iso(first.estimated_start_time),
                "resolved_at": None if any(end is None for end in ends) else _iso(max(ends)),
                # Chẩn đoán gộp quá rộng (incident còn mở hấp thụ mọi đợt về sau). `duration_s`
                # tính từ `detected_at` tới `resolved_at` lớn nhất.
                "open_at_run_end": any(end is None for end in ends),
                "duration_s": None
                if any(end is None for end in ends)
                else (max(ends) - opener.opened_at).total_seconds(),
                "affected_services": sorted({e.service for e in group}),
                "first_symptom": {
                    "service": first.service,
                    "signal": first.first.top_signal,
                    "entity": first.first.top_entity,
                    "window_start": _iso(first.first.window_start),
                    "window_end": _iso(first.first.window_end),
                    "score": _finite(first.first.score),
                    "reason": first.first.reason,
                },
                "trigger_reason": (
                    f"{config.persistence_windows} cửa sổ vượt liên tiếp ở {opener.service} "
                    f"({opener.opened.reason}: {opener.evidence_key or '—'})"
                ),
                "peak_score": _finite(peak.score) if peak else None,
                "peak_score_infinite": bool(
                    peak and peak.score is not None and math.isinf(peak.score)
                ),
                "episodes": [
                    {
                        "service": e.service,
                        "evidence_key": e.evidence_key,
                        "opened_at": _iso(e.opened_at),
                        "estimated_start_time": _iso(e.estimated_start_time),
                        "resolved_at": _iso(e.resolved_at),
                    }
                    for e in group
                ],
                "timeline": [
                    {
                        **{
                            k: v
                            for k, v in event.items()
                            if k not in ("at", "window_start", "window_end", "score")
                        },
                        "at": _iso(event["at"]),
                        "window_start": _iso(event["window_start"]),
                        "window_end": _iso(event["window_end"]),
                        "score": _finite(event["score"]),
                    }
                    for event in timeline
                ],
            }
        )
    return incidents


def _finite(value: float | None) -> float | None:
    return value if value is not None and math.isfinite(value) else None
