"""Tổ hợp ứng viên sinh từ `detection-candidates.v1/v2` (evaluation-protocol-v1 mục 6.1.2, 6.1.3).

Config detector và incident của mỗi tổ hợp sinh tất định từ ứng viên (JSON `sort_keys`, thụt 2),
nên sha256 tái lập được và đối chiếu được với lineage của evaluation artifact (`candidate_binding`
của v2). Config detector không chứa `combination_id`: các tổ hợp chỉ khác tham số incident dùng
chung một config detector và một lần `detect`, nên tổ hợp (120, 120) của bước 2a trùng đúng tổ hợp
đã chấm ở bước 1.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ...incident.run import load_config

#: Tiền tố phiên bản của mọi config sinh trong lượt chọn này.
PREFIX = "validation-v1"
STEP_SECONDS = 15


@dataclass
class Combination:
    combination_id: str
    step: str
    detector: str
    window_seconds: int
    persistence_windows: int
    detector_section: dict[str, Any]
    incident: dict[str, Any]
    tie_rank: int | None = None
    #: Phần mô tả ứng viên (quantile, bộ trọng số...) ghi vào ledger; không vào sha.
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def detector_config_version(self) -> str:
        if self.detector == "robust_z":
            return f"{PREFIX}.robust_z-z{_num(self.detector_section['threshold'])}"
        tag = self.meta["candidate_id"]
        # Ngưỡng theo phân vị phụ thuộc độ dài cửa sổ (baseline, model của cửa sổ đó).
        if self.detector in ("iforest", "fused"):
            return f"{PREFIX}.{tag}-w{self.window_seconds}"
        return f"{PREFIX}.{tag}"

    @property
    def incident_config_version(self) -> str:
        i = self.incident
        return (
            f"{PREFIX}.incident-w{self.window_seconds}-p{i['persistence_windows']}"
            f"-m{_num(i['merge_gap_seconds'])}-g{_num(i['max_chain_gap_seconds'])}"
        )

    def detector_config(self, candidate_set_version: str) -> dict[str, Any]:
        return {
            "detector_config_version": self.detector_config_version,
            "candidate_set_version": candidate_set_version,
            "detectors": {self.detector: self.detector_section},
        }

    def incident_config(self, candidate_set_version: str) -> dict[str, Any]:
        return {
            "incident_config_version": self.incident_config_version,
            "candidate_set_version": candidate_set_version,
            "incident": self.incident,
        }


def _num(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def serialize(doc: dict[str, Any]) -> bytes:
    return (json.dumps(doc, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_config(doc: dict[str, Any], path: Path) -> str:
    """Ghi config (ghi đè nếu khác nội dung thì báo lỗi); trả sha256 của file."""
    data = serialize(doc)
    if path.exists() and path.read_bytes() != data:
        raise ValueError(f"{path} đã có với nội dung khác: config sinh từ ứng viên không tất định")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return sha256_bytes(data)


def incident_identity_sha256(path: Path) -> str:
    """sha256 mà `incident/run.py` ghi vào record: băm `asdict(IncidentConfig)` đã đọc từ file."""
    config = load_config(path)
    return sha256_bytes(json.dumps(asdict(config), sort_keys=True).encode("utf-8"))


def recovery_windows(window_seconds: int) -> int:
    """`W / 15 + 1` (luật cố định của v2)."""
    if window_seconds % STEP_SECONDS:
        raise ValueError(f"Cửa sổ {window_seconds} s không chia hết cho bước {STEP_SECONDS} s")
    return window_seconds // STEP_SECONDS + 1


def incident_section(
    v2: dict[str, Any], window_seconds: int, persistence: int, merge_gap: float, chain_gap: float
) -> dict[str, Any]:
    fixed = v2["fixed_rules"]["incident"]
    return {
        "persistence_windows": persistence,
        "recovery_windows": recovery_windows(window_seconds),
        "merge_gap_seconds": merge_gap,
        "correlation_window_seconds": fixed["correlation_window_seconds"],
        "max_chain_gap_seconds": chain_gap,
    }


def step1_id(window_seconds: int, persistence: int, threshold: float) -> str:
    return f"w{window_seconds}-p{persistence}-z{_num(threshold)}"


def step1_combinations(v1: dict[str, Any], v2: dict[str, Any]) -> list[Combination]:
    """12 tổ hợp: 4 cặp window/persistence × 3 ngưỡng robust z, tham số incident của bước 1."""
    values = v2["step1"]["incident_values"]
    combos = []
    for pair in v1["window_persistence"]:
        window, persistence = int(pair["window_seconds"]), int(pair["persistence_windows"])
        for threshold in v1["robust_z_thresholds"]:
            combos.append(
                Combination(
                    combination_id=step1_id(window, persistence, threshold),
                    step="1",
                    detector="robust_z",
                    window_seconds=window,
                    persistence_windows=persistence,
                    detector_section={"threshold": threshold},
                    incident=incident_section(
                        v2,
                        window,
                        persistence,
                        values["merge_gap_seconds"],
                        values["max_chain_gap_seconds"],
                    ),
                    meta={"late_tolerance_seconds": pair["late_tolerance_seconds"]},
                )
            )
    return combos


def step2a_combinations(
    v2: dict[str, Any], window_seconds: int, persistence: int, threshold: float
) -> list[Combination]:
    """4 bộ tham số incident, robust z với window/persistence/ngưỡng của bước 1."""
    return [
        Combination(
            combination_id=candidate["id"],
            step="2a",
            detector="robust_z",
            window_seconds=window_seconds,
            persistence_windows=persistence,
            detector_section={"threshold": threshold},
            incident=incident_section(
                v2,
                window_seconds,
                persistence,
                candidate["merge_gap_seconds"],
                candidate["max_chain_gap_seconds"],
            ),
            tie_rank=int(candidate["tie_rank"]),
            meta={"candidate_id": candidate["id"]},
        )
        for candidate in v2["step2a_incident"]["candidates"]
    ]


def iforest_section(v2: dict[str, Any], threshold: float) -> dict[str, Any]:
    fixed = v2["fixed_rules"]["iforest"]
    params = dict(fixed["hyperparameters"])
    # v2 ghi "min(256, số cửa sổ fit của service)"; fit_models tự lấy min với số cửa sổ.
    if not str(params["max_samples"]).startswith("min(256"):
        raise ValueError(f"max_samples của v2 không như đã cài: {params['max_samples']}")
    params["max_samples"] = 256
    return {"threshold": threshold, "seed": int(fixed["seed"]), "hyperparameters": params}


def step2b_combinations(
    v2: dict[str, Any],
    window_seconds: int,
    persistence: int,
    incident: dict[str, Any],
    thresholds: dict[str, float],
) -> dict[str, list[Combination]]:
    """Ngưỡng tĩnh (3), Isolation Forest (3), fused (6).

    `thresholds`: ngưỡng phân vị tính trên train, khóa `iforest@<q>` và `fused-<trọng số>@<q>`.
    """

    def combo(detector, candidate, section, meta):
        return Combination(
            combination_id=candidate["id"],
            step=f"2b-{detector}",
            detector=detector,
            window_seconds=window_seconds,
            persistence_windows=persistence,
            detector_section=section,
            incident=dict(incident),
            tie_rank=int(candidate["tie_rank"]),
            meta={"candidate_id": candidate["id"], **meta},
        )

    step = v2["step2b"]
    static = [
        combo("static", c, {"thresholds": dict(c["thresholds"])}, {})
        for c in step["static"]["candidates"]
    ]
    iforest = []
    for c in step["iforest"]["candidates"]:
        key = quantile_key("iforest", c["quantile"])
        iforest.append(
            combo(
                "iforest",
                c,
                iforest_section(v2, thresholds[key]),
                {"quantile": c["quantile"], "threshold_key": key},
            )
        )
    fused = []
    weights = step["fused"]["weights"]
    for c in step["fused"]["candidates"]:
        key = quantile_key(f"fused-{c['weights']}", c["quantile"])
        section = {"threshold": thresholds[key], "weights": dict(weights[c["weights"]])}
        fused.append(
            combo(
                "fused",
                c,
                section,
                {"quantile": c["quantile"], "weights_id": c["weights"], "threshold_key": key},
            )
        )
    return {"static": static, "iforest": iforest, "fused": fused}


def quantile_key(score_name: str, quantile: float) -> str:
    return f"{score_name}@{quantile}"


def quantile_scores(v2: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    """Các điểm cần phân vị trên train: (tên, detector, phần config không gồm ngưỡng)."""
    weights = v2["step2b"]["fused"]["weights"]
    return [
        ("iforest", "iforest", {}),
        *((f"fused-{name}", "fused", {"weights": dict(w)}) for name, w in weights.items()),
    ]
