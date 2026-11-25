"""Chấm detection trên một tập run: đọc incident record và ground truth, ra evaluation artifact.

Evaluation artifact giữ phần detection của evaluation-protocol-v1 mục 22 cho từng run, bảng tổng
hợp mục 20.2, run bị loại theo lý do (mục 20.6), bootstrap CI (mục 20.7) và lineage.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .bootstrap import bootstrap_ci
from .config import TRAINING_ROOT, EvaluationConfig, late_tolerance_seconds, load_candidates
from .matching import OUTSIDE_INTERVAL, Interval, RunDetection, evaluate_run
from .metrics import RunUnit, summarize
from .peak import PeakPlanError, load_plan_peak
from .records import (
    IncidentRecord,
    load_incident_record,
    parse_run_truth,
)

ARTIFACT_SCHEMA = "detection-evaluation-artifact.v1"
GROUND_TRUTH_FILE = "ground-truth.json"
RUN_MANIFEST_FILE = "run-manifest.json"


class EvaluationError(ValueError):
    pass


@dataclass(frozen=True)
class RunSlot:
    """Run cần chấm; `run_id` None là slot chưa thu."""

    run_id: str | None
    split: str | None
    case: str | None
    profile: str | None
    align_peak: bool | None = None
    slot_id: str | None = None
    repeat_index: int | None = None


def slots_from_dataset(manifest: dict[str, Any], split: str) -> list[RunSlot]:
    return [
        RunSlot(
            run_id=slot.get("run_id"),
            split=slot["split"],
            case=slot.get("case"),
            profile=slot.get("profile"),
            align_peak=slot.get("align_peak"),
            slot_id=slot.get("slot_id"),
            repeat_index=slot.get("repeat_index"),
        )
        for slot in manifest.get("slots", [])
        if slot.get("split") == split
    ]


def slot_from_run_manifest(run_id: str, run_manifest: dict[str, Any]) -> RunSlot:
    """Run ngoài dataset manifest (ví dụ pilot): nhãn phân tầng lấy từ spec của runner."""
    spec = run_manifest.get("spec", {})
    fault = spec.get("fault") or {}
    return RunSlot(
        run_id=run_id,
        split=spec.get("split"),
        case=fault.get("case"),
        profile=(spec.get("workload") or {}).get("profile"),
        align_peak=fault.get("align_peak") if fault else None,
        repeat_index=spec.get("repeat_index"),
    )


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def code_provenance(root: Path) -> dict[str, Any]:
    """Commit của code harness; `dirty` khi cây làm việc có thay đổi chưa commit."""
    try:
        commit = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        status = subprocess.run(
            ["git", "-C", str(root), "status", "--porcelain", "--", "."],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return {"commit": None, "dirty": None}
    return {"commit": commit, "dirty": bool(status.strip())}


def _iso(moment: datetime | None) -> str | None:
    if moment is None:
        return None
    return moment.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _read_json(path: Path) -> dict[str, Any] | None:
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def _check_consistent(records: dict[str, IncidentRecord]) -> IncidentRecord:
    first = next(iter(records.values()))
    keys = (
        "detector",
        "detector_config_version",
        "incident_config_version",
        "window_seconds",
        "persistence_windows",
        "step_seconds",
    )
    for run_id, record in records.items():
        for key in keys:
            if getattr(record, key) != getattr(first, key):
                raise EvaluationError(
                    f"Incident record của {run_id} có {key}={getattr(record, key)!r}, "
                    f"khác {getattr(first, key)!r}: một artifact chỉ chấm một tổ hợp"
                )
    return first


def _run_row(
    slot: RunSlot,
    detection: RunDetection | None,
    *,
    reasons: list[str],
    gates: dict[str, Any],
    lineage: dict[str, Any],
    peak: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "run_id": slot.run_id,
        "slot_id": slot.slot_id,
        "split": slot.split,
        "case_id": slot.case,
        "profile": slot.profile,
        "repeat_index": slot.repeat_index,
        "align_peak": slot.align_peak,
        "inclusion_status": "eligible" if not reasons else "excluded",
        "exclusion_reasons": reasons,
        "execution_status": gates.get("execution"),
        "telemetry_quality_status": gates.get("data_quality"),
        "ground_truth_run_status": gates.get("ground_truth"),
    }
    if detection is not None:
        interval = detection.evaluation_interval
        row.update(
            {
                "evaluation_start": _iso(interval.start),
                "evaluation_end": _iso(interval.end),
                "fault_start": _iso(detection.fault_window.start)
                if detection.fault_window
                else None,
                "fault_end": _iso(detection.fault_window.end) if detection.fault_window else None,
                "matching_interval_end": _iso(detection.matching_interval.end)
                if detection.matching_interval
                else None,
                **detection.detection_fields(),
                "false_alarms": detection.false_alarms,
                "false_alarm_exposure_seconds": detection.exposure_s,
                "incidents": [
                    {
                        "incident_id": incident.incident_id,
                        "detected_at": _iso(incident.detected_at),
                        "label": detection.labels[incident.incident_id],
                    }
                    for incident in detection.incidents
                ],
                "diagnostic_outside_interval": sum(
                    1 for label in detection.labels.values() if label == OUTSIDE_INTERVAL
                ),
            }
        )
        if detection.peak is not None:
            row["peak_segment"] = {
                "start": _iso(detection.peak["start"]),
                "end": _iso(detection.peak["end"]),
                "false_alarms": detection.peak["false_alarms"],
                "exposure_seconds": detection.peak["exposure_s"],
            }
    if peak is not None:
        row["peak_status"] = peak
    row["lineage"] = lineage
    return row


def evaluate_detection(
    slots: list[RunSlot],
    *,
    runs_dir: Path,
    incidents_template: str,
    config: EvaluationConfig,
    config_path: Path,
    load_dir: Path,
    dataset: dict[str, Any] | None = None,
    dataset_path: Path | None = None,
    split: str | None = None,
    bootstrap: bool = True,
    generated_at: datetime | None = None,
    code: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if "{run_id}" not in incidents_template:
        raise EvaluationError("Mẫu đường dẫn incident record phải chứa {run_id}")
    candidates_path = config.candidates_path
    candidates = load_candidates(candidates_path)

    prepared: list[dict[str, Any]] = []
    records: dict[str, IncidentRecord] = {}
    for slot in slots:
        reasons: list[str] = []
        gates: dict[str, Any] = {}
        lineage: dict[str, Any] = {}
        entry: dict[str, Any] = {
            "slot": slot,
            "reasons": reasons,
            "gates": gates,
            "lineage": lineage,
        }
        prepared.append(entry)
        if slot.run_id is None:
            reasons.append("run_not_collected")
            continue
        run_dir = runs_dir / slot.run_id
        manifest_path = run_dir / RUN_MANIFEST_FILE
        run_manifest = _read_json(manifest_path)
        if run_manifest is None:
            reasons.append("run_manifest_missing")
        else:
            lineage["run_manifest_ref"] = {
                "path": str(manifest_path),
                "sha256": sha256_file(manifest_path),
            }
            spec_split = (run_manifest.get("spec") or {}).get("split")
            if split is not None and spec_split != split:
                raise EvaluationError(f"{slot.run_id}: run manifest ghi split {spec_split!r}")
            manifest_gates = run_manifest.get("gates") or {}
            gates["execution"] = (manifest_gates.get("execution") or {}).get("result")
            gates["data_quality"] = manifest_gates.get("data_quality")
            if gates["execution"] != "pass":
                reasons.append("execution_gate_failed")
            if gates["data_quality"] not in config.accepted_quality_statuses:
                reasons.append(
                    "telemetry_quality_fail"
                    if gates["data_quality"] == "fail"
                    else "telemetry_quality_missing"
                )
            entry["run_manifest"] = run_manifest
        truth_path = run_dir / GROUND_TRUTH_FILE
        truth_data = _read_json(truth_path)
        if truth_data is None:
            reasons.append("ground_truth_missing")
        else:
            lineage["run_ground_truth_ref"] = {
                "path": str(truth_path),
                "sha256": sha256_file(truth_path),
            }
            gates["ground_truth"] = truth_data.get("run_status")
            if truth_data.get("run_status") != "valid":
                reasons.append(f"ground_truth_{truth_data.get('run_status')}")
            else:
                entry["truth"] = parse_run_truth(truth_data)
        incident_path = Path(incidents_template.format(run_id=slot.run_id))
        if not incident_path.is_file():
            reasons.append("incident_record_missing")
        else:
            record = load_incident_record(incident_path)
            if record.run_id != slot.run_id:
                raise EvaluationError(
                    f"{incident_path}: run_id {record.run_id!r} khác run {slot.run_id!r}"
                )
            lineage["incident_artifact_ref"] = {
                "path": str(incident_path),
                "sha256": sha256_file(incident_path),
            }
            lineage["incident_record_lineage"] = record.lineage
            entry["record"] = record
            records[slot.run_id] = record

    if not records:
        raise EvaluationError("Không có incident record nào để xác định tổ hợp được chấm")
    combo = _check_consistent(records)
    if combo.step_seconds != candidates.get("step_seconds"):
        raise EvaluationError(
            f"step_seconds {combo.step_seconds} khác tập ứng viên "
            f"({candidates.get('step_seconds')})"
        )
    tolerance = late_tolerance_seconds(candidates, combo.window_seconds, combo.persistence_windows)

    units: list[RunUnit] = []
    rows: list[dict[str, Any]] = []
    for entry in prepared:
        slot: RunSlot = entry["slot"]
        reasons = entry["reasons"]
        truth = entry.get("truth")
        detection = None
        peak_status = None
        if not reasons and truth is not None:
            if truth.is_fault_run != (slot.case is not None):
                raise EvaluationError(
                    f"{slot.run_id}: ground truth ({truth.scenario_id}) không khớp case {slot.case}"
                )
            interval = Interval(
                truth.workload_start + timedelta(seconds=config.warmup_s), truth.workload_end
            )
            fault_window = None
            if truth.is_fault_run:
                fault_window = Interval(truth.fault_start, truth.fault_end)
                if not (
                    interval.start <= fault_window.start
                    and fault_window.end + timedelta(seconds=tolerance) <= interval.end
                ):
                    reasons.append("evaluation_interval_invalid")
            peak = None
            if not reasons and not truth.is_fault_run and slot.profile in config.peak_profiles:
                workload = entry["run_manifest"].get("workload") or {}
                plan_path = load_dir / str(workload.get("plan_path"))
                try:
                    plan_peak, reference = load_plan_peak(
                        plan_path,
                        workload.get("plan_sha256"),
                        warmup_s=config.warmup_s,
                        duration_s=config.peak_duration_s,
                        step_s=config.peak_scan_step_s,
                    )
                except PeakPlanError as error:
                    peak_status = {"status": "unavailable", "reason": error.reason}
                else:
                    peak = plan_peak.anchor(truth.workload_start)
                    peak_status = {"status": "ok"}
                    entry["lineage"]["peak_plan_ref"] = reference
            if not reasons:
                detection = evaluate_run(
                    slot.run_id,
                    entry["record"].incidents,
                    interval,
                    fault_window=fault_window,
                    late_tolerance_s=tolerance,
                    exclude_late_tolerance_tail=config.exclude_late_tolerance_tail,
                    peak=peak,
                )
                units.append(
                    RunUnit(
                        detection=detection,
                        case=slot.case,
                        profile=str(slot.profile),
                        align_peak=slot.align_peak,
                    )
                )
        rows.append(
            _run_row(
                slot,
                detection,
                reasons=reasons,
                gates=entry["gates"],
                lineage=entry["lineage"],
                peak=peak_status,
            )
        )

    excluded: dict[str, list[str | None]] = {}
    for row in rows:
        for reason in row["exclusion_reasons"]:
            excluded.setdefault(reason, []).append(row["run_id"] or row["slot_id"])
    peak_unavailable = {}
    for row in rows:
        status = row.get("peak_status")
        if status and status["status"] != "ok":
            peak_unavailable.setdefault(status["reason"], []).append(row["run_id"])

    summary = summarize(units, config.false_alarm_cap_per_hour)
    summary["excluded_count"] = sum(1 for row in rows if row["exclusion_reasons"])
    summary["excluded_by_reason"] = {k: sorted(v, key=str) for k, v in sorted(excluded.items())}
    summary["peak_unavailable_by_reason"] = peak_unavailable
    summary["n_slots"] = len(rows)

    code = code if code is not None else code_provenance(TRAINING_ROOT)
    lineage = {
        "evaluation_config": {"path": str(config_path), "sha256": sha256_file(config_path)},
        "candidates_config": {
            "path": str(candidates_path),
            "sha256": sha256_file(candidates_path),
            "candidate_set_version": candidates.get("candidate_set_version"),
        },
        "dataset_manifest": (
            {
                "path": str(dataset_path),
                "sha256": sha256_file(dataset_path),
                "dataset_id": dataset.get("dataset_id") if dataset else None,
            }
            if dataset_path
            else None
        ),
        "analysis_code_commit": code.get("commit"),
        "analysis_code_dirty": code.get("dirty"),
    }
    identity = json.dumps(
        {
            "config": lineage["evaluation_config"]["sha256"],
            "candidates": lineage["candidates_config"]["sha256"],
            "dataset": lineage["dataset_manifest"],
            "code": code.get("commit"),
            "runs": [row["lineage"] for row in rows],
        },
        sort_keys=True,
    )
    artifact: dict[str, Any] = {
        "schema": ARTIFACT_SCHEMA,
        "evaluation_artifact_id": "det-eval-" + hashlib.sha256(identity.encode()).hexdigest()[:16],
        "protocol_version": config.raw.get("protocol_version"),
        "evaluation_config_version": config.version,
        "generated_at": _iso(generated_at or datetime.now(UTC)),
        "dataset_id": dataset.get("dataset_id") if dataset else None,
        "split": split,
        "detector": combo.detector,
        "detector_config_version": combo.detector_config_version,
        "incident_config_version": combo.incident_config_version,
        "window_seconds": combo.window_seconds,
        "persistence_windows": combo.persistence_windows,
        "step_seconds": combo.step_seconds,
        "late_tolerance_seconds": tolerance,
        "early_tolerance_seconds": config.early_tolerance_s,
        "summary": summary,
        "bootstrap": (
            bootstrap_ci(
                units,
                resamples=config.bootstrap_resamples,
                seed=config.bootstrap_seed,
                confidence=config.bootstrap_confidence,
            )
            if bootstrap
            else None
        ),
        "runs": rows,
        "lineage": lineage,
    }
    return artifact
