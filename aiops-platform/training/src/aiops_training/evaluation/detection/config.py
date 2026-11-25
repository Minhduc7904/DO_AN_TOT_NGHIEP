"""Evaluation config có version và tra `late_tolerance` từ tập ứng viên đã khai báo."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

#: Thư mục `aiops-platform/training`, gốc của đường dẫn tương đối trong config.
TRAINING_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_EVALUATION_CONFIG = TRAINING_ROOT / "configs" / "detection-evaluation-v1.json"


class EvaluationConfigError(ValueError):
    pass


@dataclass(frozen=True)
class EvaluationConfig:
    version: str
    early_tolerance_s: float
    warmup_s: float
    exclude_late_tolerance_tail: bool
    false_alarm_cap_per_hour: float
    peak_profiles: tuple[str, ...]
    peak_duration_s: float
    peak_scan_step_s: float
    bootstrap_resamples: int
    bootstrap_seed: int
    bootstrap_confidence: float
    accepted_quality_statuses: tuple[str, ...]
    candidates_path: Path
    raw: dict[str, Any]


def _get(data: dict[str, Any], *keys: str) -> Any:
    value: Any = data
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            raise EvaluationConfigError(f"Evaluation config thiếu {'.'.join(keys)}")
        value = value[key]
    return value


def load_evaluation_config(path: Path = DEFAULT_EVALUATION_CONFIG) -> EvaluationConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    early = float(_get(data, "early_tolerance_seconds"))
    if early != 0:
        # Mục 17.2: không cho credit phát hiện trước fault.
        raise EvaluationConfigError("early_tolerance_seconds phải bằng 0 (mục 17.2)")
    resamples = int(_get(data, "bootstrap", "resamples"))
    confidence = float(_get(data, "bootstrap", "confidence"))
    if resamples < 1 or not 0 < confidence < 1:
        raise EvaluationConfigError("bootstrap.resamples >= 1 và 0 < confidence < 1")
    candidates = Path(_get(data, "candidates_config"))
    return EvaluationConfig(
        version=str(_get(data, "evaluation_config_version")),
        early_tolerance_s=early,
        warmup_s=float(_get(data, "evaluation_interval", "warmup_seconds")),
        exclude_late_tolerance_tail=bool(
            _get(data, "false_alarm_rate", "exclude_late_tolerance_tail")
        ),
        false_alarm_cap_per_hour=float(_get(data, "false_alarm_rate", "cap_per_hour")),
        peak_profiles=tuple(_get(data, "peak_segment", "profiles")),
        peak_duration_s=float(_get(data, "peak_segment", "duration_seconds")),
        peak_scan_step_s=float(_get(data, "peak_segment", "scan_step_seconds")),
        bootstrap_resamples=resamples,
        bootstrap_seed=int(_get(data, "bootstrap", "seed")),
        bootstrap_confidence=confidence,
        accepted_quality_statuses=tuple(_get(data, "eligibility", "accepted_quality_statuses")),
        candidates_path=candidates if candidates.is_absolute() else TRAINING_ROOT / candidates,
        raw=data,
    )


def load_candidates(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def late_tolerance_seconds(
    candidates: dict[str, Any], window_seconds: int, persistence_windows: int
) -> float:
    """Giá trị duy nhất lấy từ `window_persistence` của tập ứng viên (không tự tính lại)."""
    for pair in candidates.get("window_persistence", []):
        if (
            pair.get("window_seconds") == window_seconds
            and pair.get("persistence_windows") == persistence_windows
        ):
            return float(pair["late_tolerance_seconds"])
    raise EvaluationConfigError(
        f"Cặp window={window_seconds} s, persistence={persistence_windows} không có trong "
        f"{candidates.get('candidate_set_version', 'tập ứng viên')}"
    )
