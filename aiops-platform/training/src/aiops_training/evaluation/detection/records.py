"""Đọc incident record (đầu ra của incident lifecycle) và `RunGroundTruth` cho harness.

Đây là chỗ duy nhất ngoài gói `ground_truth` đọc file ground truth (evaluation-protocol-v1 mục 3.3).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from ...telemetry.window import parse_utc

INCIDENT_RECORD_SCHEMA = "incident-record.v1"

_RECORD_FIELDS: dict[str, type | tuple[type, ...]] = {
    "schema": str,
    "run_id": str,
    "detector": str,
    "detector_config_version": str,
    "incident_config_version": str,
    "window_seconds": int,
    "persistence_windows": int,
    "step_seconds": int,
    "lineage": dict,
    "incidents": list,
}
_INCIDENT_FIELDS: dict[str, type | tuple[type, ...]] = {
    "incident_id": str,
    "detected_at": str,
    "estimated_start_time": str,
    "affected_services": list,
    "first_symptom": dict,
    "trigger_reason": str,
}


class IncidentRecordError(ValueError):
    pass


class GroundTruthReadError(ValueError):
    pass


@dataclass(frozen=True)
class Incident:
    incident_id: str
    detected_at: datetime
    estimated_start_time: datetime
    resolved_at: datetime | None
    affected_services: tuple[str, ...]
    peak_score: float | None


@dataclass(frozen=True)
class IncidentRecord:
    run_id: str
    detector: str
    detector_config_version: str
    incident_config_version: str
    window_seconds: int
    persistence_windows: int
    step_seconds: int
    lineage: dict[str, Any]
    incidents: tuple[Incident, ...]


def _check_type(where: str, data: dict[str, Any], fields: dict[str, Any]) -> None:
    for name, kind in fields.items():
        if name not in data:
            raise IncidentRecordError(f"{where}: thiếu trường {name}")
        value = data[name]
        # bool là con của int trong Python; không nhận true/false cho trường số nguyên.
        if not isinstance(value, kind) or (kind is int and isinstance(value, bool)):
            raise IncidentRecordError(f"{where}: {name} phải là {kind.__name__}")


def _time(where: str, value: Any) -> datetime:
    try:
        return parse_utc(value)
    except (TypeError, ValueError, AttributeError) as error:
        raise IncidentRecordError(f"{where}: thời điểm không hợp lệ {value!r}") from error


def parse_incident_record(data: Any) -> IncidentRecord:
    if not isinstance(data, dict):
        raise IncidentRecordError("Incident record phải là object JSON")
    if data.get("schema") != INCIDENT_RECORD_SCHEMA:
        raise IncidentRecordError(
            f"schema phải là {INCIDENT_RECORD_SCHEMA}, nhận {data.get('schema')!r}"
        )
    _check_type("incident record", data, _RECORD_FIELDS)
    if data["window_seconds"] <= 0 or data["persistence_windows"] <= 0 or data["step_seconds"] <= 0:
        raise IncidentRecordError("window_seconds, persistence_windows, step_seconds phải > 0")
    incidents: list[Incident] = []
    seen: set[str] = set()
    for index, item in enumerate(data["incidents"]):
        where = f"incidents[{index}]"
        if not isinstance(item, dict):
            raise IncidentRecordError(f"{where}: phải là object")
        _check_type(where, item, _INCIDENT_FIELDS)
        if item["incident_id"] in seen:
            raise IncidentRecordError(f"{where}: incident_id trùng {item['incident_id']}")
        seen.add(item["incident_id"])
        detected = _time(f"{where}.detected_at", item["detected_at"])
        estimated = _time(f"{where}.estimated_start_time", item["estimated_start_time"])
        if estimated > detected:
            raise IncidentRecordError(f"{where}: estimated_start_time sau detected_at")
        resolved = item.get("resolved_at")
        resolved_at = None if resolved is None else _time(f"{where}.resolved_at", resolved)
        if resolved_at is not None and resolved_at < detected:
            raise IncidentRecordError(f"{where}: resolved_at trước detected_at")
        score = item.get("peak_score")
        if score is not None and (isinstance(score, bool) or not isinstance(score, int | float)):
            raise IncidentRecordError(f"{where}: peak_score phải là số hoặc null")
        if not all(isinstance(service, str) for service in item["affected_services"]):
            raise IncidentRecordError(f"{where}: affected_services phải là danh sách chuỗi")
        incidents.append(
            Incident(
                incident_id=item["incident_id"],
                detected_at=detected,
                estimated_start_time=estimated,
                resolved_at=resolved_at,
                affected_services=tuple(item["affected_services"]),
                peak_score=None if score is None else float(score),
            )
        )
    return IncidentRecord(
        run_id=data["run_id"],
        detector=data["detector"],
        detector_config_version=data["detector_config_version"],
        incident_config_version=data["incident_config_version"],
        window_seconds=data["window_seconds"],
        persistence_windows=data["persistence_windows"],
        step_seconds=data["step_seconds"],
        lineage=data["lineage"],
        incidents=tuple(incidents),
    )


def load_incident_record(path: Path) -> IncidentRecord:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise IncidentRecordError(f"{path}: JSON không hợp lệ") from error
    return parse_incident_record(data)


@dataclass(frozen=True)
class RunTruth:
    """Phần của `RunGroundTruth` mà harness cần; `fault_*` là None với run khỏe."""

    run_id: str
    run_status: str
    scenario_id: str
    workload_start: datetime
    workload_end: datetime
    fault_start: datetime | None
    fault_end: datetime | None

    @property
    def is_fault_run(self) -> bool:
        return self.fault_start is not None


def parse_run_truth(data: dict[str, Any]) -> RunTruth:
    fault_start = data.get("fault_start")
    fault_end = data.get("fault_end")
    if (fault_start is None) != (fault_end is None):
        raise GroundTruthReadError("fault_start và fault_end phải cùng có hoặc cùng null")
    try:
        truth = RunTruth(
            run_id=data["run_id"],
            run_status=data["run_status"],
            scenario_id=data["scenario_id"],
            workload_start=parse_utc(data["workload_start"]),
            workload_end=parse_utc(data["workload_end"]),
            fault_start=None if fault_start is None else parse_utc(fault_start),
            fault_end=None if fault_end is None else parse_utc(fault_end),
        )
    except (KeyError, TypeError, ValueError, AttributeError) as error:
        raise GroundTruthReadError(f"RunGroundTruth không đọc được: {error!r}") from error
    if truth.fault_start and truth.fault_end and truth.fault_end < truth.fault_start:
        raise GroundTruthReadError("fault_end trước fault_start")
    return truth


def load_run_truth(path: Path) -> RunTruth:
    return parse_run_truth(json.loads(path.read_text(encoding="utf-8")))
