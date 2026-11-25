"""Bốn loại điểm bất thường theo (cửa sổ, service), cùng interface đầu ra (blueprint mục 9).

- `static`: ngưỡng cố định trên giá trị thô (blueprint mục 9.1), mô phỏng cảnh báo vận hành thủ
  công; baseline E1 và đối chứng phát hiện cho RQ6. Điểm = max(giá trị / ngưỡng) với tín hiệu `up`,
  max(ngưỡng / giá trị) với tín hiệu `down`; vượt khi điểm > 1 (giá trị vượt hẳn ngưỡng, hoặc với
  `down` thấp hẳn dưới ngưỡng: `consumers` = 0 dưới ngưỡng 1 cho điểm vô cùng).
- `robust_z`: max z có hướng của mọi tín hiệu triệu chứng (z của baseline healthy v1). Thang đo khi
  MAD = 0 theo evaluation-protocol-v1 mục 6.1.2 (đã cài ở `features/baseline.py`).
- `iforest`: Isolation Forest theo service (`iforest.py`).
- `fused`: điểm hợp nhất M/T/L (blueprint mục 9.7). Điểm modality = max(0, max z có hướng của tín
  hiệu thuộc modality đó); điểm hợp nhất = trung bình có trọng số trên các modality **có dữ liệu**
  trong cửa sổ (trọng số chuẩn hóa lại). Fallback chỉ khi modality thật sự không có giá trị
  (worker không có HTTP/log, cửa sổ dưới số span tối thiểu); không đổi cách chạy theo chất lượng
  export của run.

Quy tắc chung (`signals.py`): cửa sổ im lặng (`telemetry_silent`) **luôn** vượt ngưỡng ở cả bốn loại
điểm với `reason = "telemetry_silent"` và điểm rỗng; `flagged = None` **chỉ** khi service không có
giá trị triệu chứng nào (cùng nghĩa ở cả bốn detector; luật null theo từng tín hiệu ở lifecycle)
(không bất thường, không làm đứt persistence).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Protocol

from .signals import MODALITIES, Observation, ServiceWindow

DETECTORS = ("static", "robust_z", "iforest", "fused")


@dataclass
class Score:
    score: float | None
    flagged: bool | None
    reason: str  # "threshold" | "below_threshold" | "telemetry_silent" | "no_data"
    components: dict[str, float | None] = field(default_factory=dict)
    top: Observation | None = None
    top_score: float | None = None
    #: Khóa bằng chứng của cửa sổ vượt (`Observation.key`): tín hiệu mà chính detector coi là bất
    #: thường. Lifecycle đếm persistence theo từng khóa (luật cửa sổ không dữ liệu theo feature).
    evidence: tuple[str, ...] = ()


def _keys(observations) -> tuple[str, ...]:
    return tuple(sorted({obs.key for obs in observations}))


class Detector(Protocol):
    name: str
    threshold: float

    def score(self, window: ServiceWindow) -> Score: ...


def _silent_or_empty(window: ServiceWindow) -> Score | None:
    if window.silent:
        return Score(None, True, "telemetry_silent")
    if not window.has_data:
        return Score(None, None, "no_data")
    return None


def _decide(score: float | None, threshold: float) -> tuple[bool | None, str]:
    if score is None:
        return None, "no_data"
    hit = score > threshold
    return hit, "threshold" if hit else "below_threshold"


def _max_z(observations: list[Observation]) -> tuple[float | None, Observation | None]:
    best: tuple[float | None, Observation | None] = (None, None)
    for obs in observations:
        if obs.z is None:
            continue
        if best[0] is None or obs.z > best[0]:
            best = (obs.z, obs)
    return best


def _modality_scores(window: ServiceWindow) -> dict[str, float | None]:
    scores: dict[str, float | None] = {}
    for modality in MODALITIES:
        observed = [obs for obs in window.observations if obs.signal.modality == modality]
        if not any(obs.value is not None for obs in observed):
            scores[modality] = None  # modality không có dữ liệu trong cửa sổ
            continue
        top, _ = _max_z(observed)
        # Có giá trị nhưng thiếu baseline (nhóm chưa thấy ở train) → không đóng góp, coi như 0.
        scores[modality] = max(0.0, top) if top is not None else 0.0
    return scores


@dataclass
class StaticThreshold:
    """`thresholds`: `{"<bảng>.<cột>": ngưỡng}` trên giá trị thô; tín hiệu thiếu ngưỡng bỏ qua."""

    thresholds: dict[str, float]
    threshold: float = 1.0
    name: str = "static"

    def __post_init__(self) -> None:
        bad = {name: limit for name, limit in self.thresholds.items() if not limit > 0}
        if bad:
            raise ValueError(f"Ngưỡng tĩnh phải dương: {bad}")

    def score(self, window: ServiceWindow) -> Score:
        early = _silent_or_empty(window)
        if early:
            return early
        best: float | None = None
        best_obs: Observation | None = None
        over: list[Observation] = []
        components: dict[str, float | None] = {m: None for m in MODALITIES}
        for obs in window.observations:
            limit = self.thresholds.get(obs.signal.name)
            if limit is None or obs.value is None:
                continue
            if obs.signal.direction == "up":
                ratio = obs.value / limit
            else:
                ratio = limit / obs.value if obs.value > 0 else math.inf
            modality = obs.signal.modality
            current = components[modality]
            components[modality] = ratio if current is None else max(current, ratio)
            if ratio > self.threshold:
                over.append(obs)
            if best is None or ratio > best:
                best, best_obs = ratio, obs
        if best is None:
            # Có dữ liệu triệu chứng nhưng không tín hiệu nào có ngưỡng: không vượt (không phải
            # cửa sổ null, để "không dữ liệu" có cùng nghĩa ở cả bốn detector).
            return Score(None, False, "below_threshold", components)
        flagged, reason = _decide(best, self.threshold)
        return Score(best, flagged, reason, components, best_obs, best, _keys(over))


@dataclass
class RobustZ:
    threshold: float
    name: str = "robust_z"

    def score(self, window: ServiceWindow) -> Score:
        early = _silent_or_empty(window)
        if early:
            return early
        top, obs = _max_z(window.observations)
        components = _modality_scores(window)
        if top is None:
            # Có giá trị nhưng mọi nhóm đều thiếu baseline: không có căn cứ để vượt; không phải
            # cửa sổ null (cùng nghĩa ở cả bốn detector).
            return Score(None, False, "below_threshold", components)
        flagged, reason = _decide(top, self.threshold)
        over = [o for o in window.observations if o.z is not None and o.z > self.threshold]
        return Score(top, flagged, reason, components, obs, top, _keys(over))


@dataclass
class Fused:
    threshold: float
    weights: dict[str, float] = field(
        default_factory=lambda: {modality: 1.0 / len(MODALITIES) for modality in MODALITIES}
    )
    name: str = "fused"

    def __post_init__(self) -> None:
        unknown = set(self.weights) - set(MODALITIES)
        if unknown or any(w < 0 for w in self.weights.values()):
            raise ValueError(f"Trọng số modality không hợp lệ: {self.weights}")

    def score(self, window: ServiceWindow) -> Score:
        early = _silent_or_empty(window)
        if early:
            return early
        components = _modality_scores(window)
        present = {m: s for m, s in components.items() if s is not None and self.weights.get(m, 0)}
        total = sum(self.weights[m] for m in present)
        if not present or total == 0:
            # Chỉ có modality trọng số 0: không có căn cứ để vượt (không phải cửa sổ null).
            return Score(None, False, "below_threshold", components)
        fused = sum(self.weights[m] * s for m, s in present.items()) / total
        # Tín hiệu đỉnh chỉ lấy từ modality có đóng góp vào điểm.
        contributing = [o for o in window.observations if o.signal.modality in present]
        _, obs = _max_z(contributing)
        flagged, reason = _decide(fused, self.threshold)
        positive = [o for o in contributing if o.z is not None and o.z > 0]
        return Score(
            fused, flagged, reason, components, obs, obs.z if obs else None, _keys(positive)
        )


def build_detector(name: str, config: dict[str, Any], model: Any = None) -> Detector:
    """`config`: phần cấu hình của detector (xem `configs/detector-dev-v1.json`)."""
    if name == "static":
        return StaticThreshold(thresholds=dict(config["thresholds"]))
    if name == "robust_z":
        return RobustZ(threshold=float(config["threshold"]))
    if name == "fused":
        return Fused(threshold=float(config["threshold"]), weights=dict(config["weights"]))
    if name == "iforest":
        from .iforest import IForestDetector

        if model is None:
            raise ValueError("iforest cần model đã fit (--model)")
        return IForestDetector(model=model, threshold=float(config["threshold"]))
    raise ValueError(f"Detector không hỗ trợ: {name} (có {DETECTORS})")
