"""Dựng `RunGroundTruth` (schema v1 mục 8) từ nhật ký thực thi của một run.

Nguồn sự thật:
- workload: `k6-summary.json` (task-02/03 tuần 14) — cửa sổ traffic, profile, seed, tham số;
- fault: nhật ký `fault-schedule.mjs` (`faults.jsonl`) — thời điểm bật/tắt **thực tế** từ control
  plane;
  `fault_start` không bao giờ suy ra từ dấu hiệu bất thường (schema v1 mục 8.2);
- nhãn và kỳ vọng: fault manifest (`aiops-platform/faults/manifests/`) và `cases.CASE_TRUTH`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..telemetry.window import parse_utc
from .cases import CASE_TRUTH, HEALTHY_TRUTH, expected_symptom_lag

GROUND_TRUTH_SCHEMA_VERSION = "ground-truth.v1"

REQUIRED_FIELDS = (
    "ground_truth_schema_version",
    "scenario_id",
    "run_id",
    "repeat_index",
    "run_status",
    "run_start",
    "run_end",
    "workload_profile",
    "workload_seed",
    "workload_parameters",
    "workload_start",
    "workload_end",
    "fault_type",
    "fault_parameters",
)
FAULT_RUN_FIELDS = (
    "fault_id",
    "fault_target",
    "fault_target_kind",
    "fault_intensity",
    "fault_start",
    "fault_end",
    "root_cause_service",
    "root_cause_component",
)


class GroundTruthError(ValueError):
    pass


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def _result(steps_ok: list[bool]) -> str:
    if not steps_ok:
        return "not_applicable"
    if all(steps_ok):
        return "succeeded"
    return "failed" if not any(steps_ok) else "partial"


def _fault_section(case: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any]:
    case_id = case["case_id"]
    mine = [record for record in records if record.get("case_id") == case_id]
    # Nhật ký có thể được append qua nhiều lần chạy: chỉ lấy lần lập lịch cuối cùng của case (kèm
    # precheck ngay trước nó).
    starts = [index for index, record in enumerate(mine) if record["event"] == "fault.scheduled"]
    if starts:
        first = starts[-1]
        if first > 0 and mine[first - 1]["event"] == "fault.precheck":
            first -= 1
        mine = mine[first:]
    activate = next((r for r in mine if r["event"] == "fault.activate"), None)
    deactivate = next((r for r in reversed(mine) if r["event"] == "fault.deactivate"), None)
    precheck = next((r for r in mine if r["event"] == "fault.precheck"), None)
    scheduled = next((r for r in mine if r["event"] == "fault.scheduled"), None)
    activation = _result([step["ok"] for step in activate["steps"]]) if activate else "failed"
    deactivation = _result([step["ok"] for step in deactivate["steps"]]) if deactivate else "failed"
    token_ttl = None
    for item in (precheck or {}).get("results", []):
        if item.get("name") == "IDENTITY_SERVICE_TOKEN_TTL_SECONDS" and item.get("actual"):
            token_ttl = int(item["actual"])
    truth = CASE_TRUTH[case_id]
    return {
        "fault_id": truth["fault_id"],
        "fault_type": case["fault_type"],
        "fault_target": truth["fault_target"],
        "fault_target_kind": truth["fault_target_kind"],
        "fault_intensity": "; ".join(" ".join(argv) for argv in case["activate"]),
        "fault_parameters": {
            "case_id": case_id,
            "injector": case["injector"],
            "activate": case["activate"],
            "deactivate": case["deactivate"],
            "fault_duration_s": (scheduled or {}).get("fault_duration_s", case["fault_duration_s"]),
            "alignment": (scheduled or {}).get("alignment"),
            "requires": (precheck or {}).get("results", []),
            **({"IDENTITY_SERVICE_TOKEN_TTL_SECONDS": token_ttl} if token_ttl else {}),
        },
        # Chỉ ghi khoảng hoạt động thật khi bật thành công (schema v1 mục 8.2).
        "fault_start": activate["ts"] if activation == "succeeded" else None,
        "fault_end": deactivate["ts"] if activation == "succeeded" and deactivate else None,
        "root_cause_service": case["root_cause_service"],
        "root_cause_component": case["root_cause_component"],
        "expected_symptom": truth["expected_symptom"],
        "expected_propagation_path": truth["expected_propagation_path"],
        "expected_evidence": truth["expected_evidence"],
        "expected_symptom_services": truth["expected_symptom_services"],
        "expected_symptom_lag": expected_symptom_lag(case_id, token_ttl),
        "activation_result": activation,
        "activation_details": activate,
        "deactivation_result": deactivation,
        "deactivation_details": deactivate,
        "_precheck_ok": precheck is None or precheck.get("ok", False),
        "_aborted": bool(deactivate and deactivate.get("reason") == "aborted"),
    }


def build_ground_truth(
    *,
    run_id: str,
    scenario_id: str,
    repeat_index: int,
    workload: dict[str, Any],
    fault_manifest: dict[str, Any] | None = None,
    case_id: str | None = None,
    fault_records: list[dict[str, Any]] | None = None,
    provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """`workload` là `k6-summary.json`; `case_id` None nghĩa là run healthy."""
    provenance = provenance or {}
    invalid: list[str] = []
    record: dict[str, Any] = {
        "ground_truth_schema_version": GROUND_TRUTH_SCHEMA_VERSION,
        "scenario_id": scenario_id,
        "run_id": run_id,
        "repeat_index": repeat_index,
        "run_start": workload.get("started_at"),
        "run_end": workload.get("finished_at"),
        "workload_profile": workload.get("plan_id") or workload.get("workload_profile"),
        "workload_seed": workload.get("workload_seed", workload.get("seed")),
        "workload_parameters": {
            key: workload.get(key)
            for key in (
                "scenario",
                "plan_path",
                "plan_source",
                "phase",
                "window_start_s",
                "run_seconds",
                "sessions_planned",
                "course_map",
            )
            if key in workload
        },
        "workload_start": workload.get("started_at"),
        "workload_end": workload.get("finished_at"),
    }
    if case_id is None:
        record.update(
            {
                "fault_id": None,
                "fault_type": "none",
                "fault_target": None,
                "fault_target_kind": None,
                "fault_intensity": None,
                "fault_parameters": {},
                "fault_start": None,
                "fault_end": None,
                "root_cause_service": None,
                "root_cause_component": None,
                **HEALTHY_TRUTH,
                "expected_symptom_services": None,
                "expected_symptom_lag": None,
                "activation_result": "not_applicable",
                "activation_details": None,
                "deactivation_result": "not_applicable",
                "deactivation_details": None,
            }
        )
    else:
        if fault_manifest is None or fault_records is None:
            raise GroundTruthError("Fault run cần fault manifest và nhật ký fault")
        case = next((c for c in fault_manifest["cases"] if c["case_id"] == case_id), None)
        if case is None:
            raise GroundTruthError(f"Manifest không có case {case_id}")
        section = _fault_section(case, fault_records)
        if not section.pop("_precheck_ok"):
            invalid.append("precheck_failed")
        if section.pop("_aborted"):
            invalid.append("fault_aborted")
        if section["activation_result"] != "succeeded":
            invalid.append(f"activation_{section['activation_result']}")
        if section["deactivation_result"] != "succeeded":
            invalid.append(f"deactivation_{section['deactivation_result']}")
        record.update(section)
        record["fault_parameters"]["manifest_version"] = fault_manifest.get("manifest_version")

    record.update(
        {
            "reset_start": None,
            "reset_end": None,
            "reset_result": "not_applicable",
            # Fault run chỉ `valid` sau khi kiểm chứng (apply_verification); healthy không có check.
            "verification_result": "not_applicable" if case_id is None else "failed",
            "verification_checks": [],
            "code_commit": provenance.get("code_commit"),
            "service_versions": provenance.get("service_versions", {}),
            "environment_profile": provenance.get("environment_profile"),
            "environment_config_version": provenance.get("environment_config_version"),
            "invalid_reasons": invalid,
            "notes": provenance.get("notes", []),
        }
    )
    if case_id is not None:
        invalid.append("verification_not_run")
    failed = not record["run_start"] or not record["run_end"]
    if failed:
        invalid.append("workload_window_missing")
    elif record.get("fault_start") and record.get("fault_end"):
        inside = (
            parse_utc(record["workload_start"])
            <= parse_utc(record["fault_start"])
            <= parse_utc(record["fault_end"])
            <= parse_utc(record["workload_end"])
        )
        if not inside:
            invalid.append("fault_outside_workload")
    # mục 8.3: thiếu cửa sổ tải nghĩa là run không hoàn tất (failed); vi phạm khác là invalid.
    record["run_status"] = "failed" if failed else ("invalid" if invalid else "valid")
    check_required(record)
    return record


def check_required(record: dict[str, Any]) -> None:
    missing = [name for name in REQUIRED_FIELDS if name not in record]
    if record.get("fault_type") != "none" and record.get("run_status") == "valid":
        missing += [name for name in FAULT_RUN_FIELDS if record.get(name) in (None, "")]
    if missing:
        raise GroundTruthError(f"RunGroundTruth thiếu trường bắt buộc: {missing}")
