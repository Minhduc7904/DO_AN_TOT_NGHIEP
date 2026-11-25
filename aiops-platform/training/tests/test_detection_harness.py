"""Evaluation harness end-to-end trên thư mục run dựng tay: đọc file, loại run, lineage, CLI."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from aiops_training.cli import main
from aiops_training.evaluation.detection.config import (
    DEFAULT_EVALUATION_CONFIG,
    TRAINING_ROOT,
    EvaluationConfigError,
    late_tolerance_seconds,
    load_candidates,
    load_evaluation_config,
)
from aiops_training.evaluation.detection.harness import (
    EvaluationError,
    evaluate_detection,
    slot_from_run_manifest,
    slots_from_dataset,
)
from aiops_training.evaluation.detection.records import (
    IncidentRecordError,
    load_incident_record,
    parse_incident_record,
)
from aiops_training.evaluation.detection.selection import (
    combination_from_artifact,
    select_combination,
)

T0 = datetime(2026, 11, 20, 8, 0, tzinfo=UTC)
RUN_S = 2880
PLAN_PATH = "data/plans/test-healthy-spike-v1.json"


def iso(seconds: float) -> str:
    return (T0 + timedelta(seconds=seconds)).isoformat().replace("+00:00", "Z")


def record(run_id: str, detections: list[tuple[str, float]], **overrides) -> dict:
    data = {
        "schema": "incident-record.v1",
        "run_id": run_id,
        "detector": "robust_z",
        "detector_config_version": "robust-z.v1",
        "incident_config_version": "incident.v1",
        "window_seconds": 60,
        "persistence_windows": 5,
        "step_seconds": 15,
        "lineage": {"features": f"{run_id}/features-manifest.json"},
        "incidents": [
            {
                "incident_id": f"{run_id}-{name}",
                "detected_at": iso(seconds),
                "estimated_start_time": iso(seconds - 75),
                "resolved_at": None,
                "affected_services": ["course"],
                "first_symptom": {"service": "course", "feature": "latency_p95"},
                "trigger_reason": "persistence",
                "peak_score": 4.2,
            }
            for name, seconds in detections
        ],
    }
    data.update(overrides)
    return data


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def make_run(
    runs: Path,
    run_id: str,
    *,
    split: str = "validation",
    profile: str = "normal-mixed",
    fault: tuple[float, float] | None = None,
    case: str = "C2",
    status: str | None = "valid",
    quality: str | None = "partial",
    execution: str = "pass",
    detections: list[tuple[str, float]] | None = None,
    plan_sha256: str | None = None,
    workload_seconds: float = RUN_S,
) -> None:
    run_dir = runs / run_id
    write_json(
        run_dir / "run-manifest.json",
        {
            "run_id": run_id,
            "spec": {
                "split": split,
                "workload": {"profile": profile},
                "fault": {"case": case, "align_peak": False} if fault else None,
            },
            "gates": {"execution": {"result": execution}, "data_quality": quality},
            "workload": {"plan_path": PLAN_PATH, "plan_sha256": plan_sha256},
        },
    )
    write_json(
        run_dir / "ground-truth.json",
        {
            "run_id": run_id,
            "run_status": status,
            "scenario_id": case if fault else "healthy",
            "workload_start": iso(0),
            "workload_end": iso(workload_seconds),
            "fault_start": iso(fault[0]) if fault else None,
            "fault_end": iso(fault[1]) if fault else None,
            "verification_result": "succeeded" if fault else "not_applicable",
        },
    )
    if detections is not None:
        write_json(run_dir / "incidents.json", record(run_id, detections))


@pytest.fixture
def campaign(tmp_path: Path):
    runs = tmp_path / "runs"
    load = tmp_path / "load"
    # Kế hoạch healthy-spike: cụm 20 phiên bắt đầu ở giây 1.500–1.519 → đoạn cao điểm chứa cụm.
    plan = {"plan_id": "test-plan", "run_seconds": RUN_S, "sessions": []}
    plan["sessions"] = [{"start_s": 100.0}] + [{"start_s": 1500.0 + i} for i in range(20)]
    plan_file = load / PLAN_PATH
    write_json(plan_file, plan)
    plan_sha = hashlib.sha256(plan_file.read_bytes()).hexdigest()

    make_run(runs, "v-c2", fault=(1080, 1680), detections=[("pre", 900), ("hit", 1110)])
    make_run(runs, "v-c3", fault=(1080, 1980), case="C3", detections=[])
    make_run(runs, "v-healthy-nm", quality="pass", detections=[])
    make_run(
        runs,
        "v-healthy-spike",
        profile="healthy-spike",
        detections=[("p", 1510), ("q", 2500)],
        plan_sha256=plan_sha,
    )
    make_run(runs, "v-invalid", fault=(1080, 1680), case="C4", status="invalid", detections=[])
    make_run(runs, "v-no-incidents", fault=(1080, 1680), case="C6")
    make_run(runs, "v-quality-fail", quality="fail", detections=[])
    dataset = {
        "dataset_id": "dataset-test",
        "slots": [
            {
                "slot_id": "c2",
                "split": "validation",
                "profile": "normal-mixed",
                "case": "C2",
                "align_peak": True,
                "run_id": "v-c2",
                "repeat_index": 1,
                "replaced_run_ids": ["v-c2-old"],
            },
            {
                "slot_id": "c3",
                "split": "validation",
                "profile": "normal-mixed",
                "case": "C3",
                "align_peak": False,
                "run_id": "v-c3",
                "repeat_index": 1,
            },
            {
                "slot_id": "h1",
                "split": "validation",
                "profile": "normal-mixed",
                "case": None,
                "run_id": "v-healthy-nm",
                "repeat_index": 0,
            },
            {
                "slot_id": "h2",
                "split": "validation",
                "profile": "healthy-spike",
                "case": None,
                "run_id": "v-healthy-spike",
                "repeat_index": 0,
            },
            {
                "slot_id": "c4",
                "split": "validation",
                "profile": "normal-mixed",
                "case": "C4",
                "run_id": "v-invalid",
                "repeat_index": 1,
            },
            {
                "slot_id": "c6",
                "split": "validation",
                "profile": "normal-mixed",
                "case": "C6",
                "run_id": "v-no-incidents",
                "repeat_index": 1,
            },
            {
                "slot_id": "h3",
                "split": "validation",
                "profile": "normal-mixed",
                "case": None,
                "run_id": "v-quality-fail",
                "repeat_index": 0,
            },
            {
                "slot_id": "h4",
                "split": "validation",
                "profile": "normal-mixed",
                "case": None,
                "run_id": None,
                "repeat_index": 0,
            },
            {
                "slot_id": "t1",
                "split": "test",
                "profile": "normal-mixed",
                "case": "C2",
                "run_id": None,
                "repeat_index": 2,
            },
        ],
    }
    dataset_path = tmp_path / "dataset.json"
    write_json(dataset_path, dataset)
    return {"runs": runs, "load": load, "dataset": dataset, "dataset_path": dataset_path}


def run_harness(campaign, config=None, config_path=DEFAULT_EVALUATION_CONFIG, **kwargs):
    config = config or load_evaluation_config(config_path)
    kwargs.setdefault("code", {"commit": "abc123", "dirty": False})
    return evaluate_detection(
        slots_from_dataset(campaign["dataset"], "validation"),
        runs_dir=campaign["runs"],
        incidents_template=str(campaign["runs"] / "{run_id}" / "incidents.json"),
        config=config,
        config_path=config_path,
        load_dir=campaign["load"],
        dataset=campaign["dataset"],
        dataset_path=campaign["dataset_path"],
        split="validation",
        generated_at=datetime(2026, 11, 25, tzinfo=UTC),
        **kwargs,
    )


def test_harness_scores_eligible_runs_and_reports_exclusions(campaign):
    artifact = run_harness(campaign)
    summary = artifact["summary"]
    # Late tolerance của cặp (60 s, 5) tra từ detection-candidates-v1.json.
    assert artifact["late_tolerance_seconds"] == 120
    assert summary["pooled"]["n_runs"] == 4
    # v-c2: TP + FP trước fault; v-c3: FN; v-healthy-spike: 2 FP.
    assert (summary["pooled"]["tp"], summary["pooled"]["fp"], summary["pooled"]["fn"]) == (1, 3, 1)
    assert summary["matched_fault_runs"] == 1
    assert summary["excluded_count"] == 4
    assert summary["excluded_by_reason"] == {
        "ground_truth_invalid": ["v-invalid"],
        "incident_record_missing": ["v-no-incidents"],
        "run_not_collected": ["h4"],
        "telemetry_quality_fail": ["v-quality-fail"],
    }
    assert summary["detection_delay"]["by_case"]["C2"]["values_seconds"] == [30.0]
    assert summary["detection_delay"]["by_align_peak"]["true"]["count"] == 1

    rows = {row["run_id"] or row["slot_id"]: row for row in artifact["runs"]}
    assert rows["v-c2"]["matched_incident_id"] == "v-c2-hit"
    assert rows["v-c2"]["fp_incident_count"] == 1
    assert rows["v-c3"]["fn"] == 1 and rows["v-c3"]["detected"] is False
    assert rows["v-healthy-nm"]["healthy_run_false_positive"] == 0
    assert rows["v-invalid"]["inclusion_status"] == "excluded"
    assert summary["healthy"]["by_profile"]["healthy-spike"]["healthy_run_fpr"] == 1.0
    assert summary["eligible_run_ids"] == ["v-c2", "v-c3", "v-healthy-nm", "v-healthy-spike"]
    assert summary["included_by_quality"] == {"partial": 3, "pass": 1}
    assert summary["replaced_runs"] == {"c2": ["v-c2-old"]}
    assert rows["v-c2"]["evaluation_config_version"] == "detection-evaluation.v1"
    assert rows["v-c2"]["scenario_id"] == "C2"
    assert rows["v-c2"]["case_verification_status"] == "succeeded"
    # Chỉ số chính gộp mọi run; chỉ số phụ chỉ fault run (bỏ 2 FP của run khỏe).
    assert summary["pooled"]["precision"] == pytest.approx(1 / 4)
    assert summary["pooled_fault_runs"]["precision"] == pytest.approx(1 / 2)


def test_peak_segment_comes_from_workload_plan(campaign):
    artifact = run_harness(campaign)
    row = next(r for r in artifact["runs"] if r["run_id"] == "v-healthy-spike")
    # Cụm phiên 1.500–1.519 s; bước quét 30 s từ warm-up 360 s, đoạn 600 s sớm nhất chứa cả cụm.
    assert row["peak_segment"]["start"] == iso(930)
    assert row["peak_segment"]["end"] == iso(1530)
    assert row["peak_segment"]["false_alarms"] == 1  # p (1.510 s); q (2.500 s) ngoài cao điểm
    assert row["lineage"]["peak_plan_ref"]["session_starts"] == 20
    assert artifact["summary"]["peak"]["healthy-spike"]["false_alarms"] == 1
    assert "normal-mixed" not in artifact["summary"]["peak"]


def test_peak_plan_mismatch_only_removes_run_from_peak_metric(campaign):
    plan_file = campaign["load"] / PLAN_PATH
    plan_file.write_text(plan_file.read_text(encoding="utf-8") + " ", encoding="utf-8")
    artifact = run_harness(campaign)
    assert artifact["summary"]["peak_unavailable_by_reason"] == {
        "peak_plan_sha256_mismatch": ["v-healthy-spike"]
    }
    assert artifact["summary"]["peak"] == {}
    assert artifact["summary"]["healthy"]["n_runs"] == 2


def test_artifact_lineage_and_bootstrap(campaign):
    artifact = run_harness(campaign)
    lineage = artifact["lineage"]
    candidates_file = TRAINING_ROOT / "configs" / "detection-candidates-v1.json"
    assert (
        lineage["candidates_config"]["sha256"]
        == hashlib.sha256(candidates_file.read_bytes()).hexdigest()
    )
    assert (
        lineage["evaluation_config"]["sha256"]
        == hashlib.sha256(DEFAULT_EVALUATION_CONFIG.read_bytes()).hexdigest()
    )
    assert lineage["analysis_code_commit"] == "abc123"
    assert artifact["generated_at"] == "2026-11-25T00:00:00Z"
    assert artifact["evaluation_config_version"] == "detection-evaluation.v1"
    run = next(r for r in artifact["runs"] if r["run_id"] == "v-c2")
    incident_file = campaign["runs"] / "v-c2" / "incidents.json"
    assert (
        run["lineage"]["incident_artifact_ref"]["sha256"]
        == hashlib.sha256(incident_file.read_bytes()).hexdigest()
    )
    assert run["lineage"]["incident_record_lineage"] == {"features": "v-c2/features-manifest.json"}
    assert "run_ground_truth_ref" in run["lineage"]
    # Mỗi tầng (C2, C3, normal-mixed, healthy-spike) chỉ có một run: CI suy biến.
    stats = artifact["bootstrap"]["statistics"]
    assert artifact["bootstrap"]["resamples"] == 10000
    assert all(entry["status"] == "degenerate" for entry in stats.values())
    # Cùng đầu vào cho cùng id artifact (id không phụ thuộc generated_at).
    again = run_harness(campaign, bootstrap=False)
    assert again["evaluation_artifact_id"] == artifact["evaluation_artifact_id"]


def test_late_tolerance_is_read_from_candidates_file(campaign, tmp_path):
    candidates = load_candidates(TRAINING_ROOT / "configs" / "detection-candidates-v1.json")
    for pair in candidates["window_persistence"]:
        pair["late_tolerance_seconds"] = 999  # khác công thức: chứng minh không tự tính lại
    candidates_path = tmp_path / "candidates.json"
    write_json(candidates_path, candidates)
    config_data = json.loads(DEFAULT_EVALUATION_CONFIG.read_text(encoding="utf-8"))
    config_data["candidates_config"] = str(candidates_path)
    config_path = tmp_path / "evaluation.json"
    write_json(config_path, config_data)
    artifact = run_harness(campaign, config_path=config_path, bootstrap=False)
    assert artifact["late_tolerance_seconds"] == 999
    with pytest.raises(EvaluationConfigError):
        late_tolerance_seconds(candidates, 45, 3)


def test_inconsistent_or_undeclared_combination_is_rejected(campaign):
    write_json(
        campaign["runs"] / "v-c3" / "incidents.json",
        record("v-c3", [], window_seconds=30, persistence_windows=3),
    )
    with pytest.raises(EvaluationError, match="window_seconds"):
        run_harness(campaign, bootstrap=False)
    for run_id in (
        "v-c2",
        "v-c3",
        "v-healthy-nm",
        "v-healthy-spike",
        "v-invalid",
        "v-quality-fail",
    ):
        write_json(
            campaign["runs"] / run_id / "incidents.json",
            record(run_id, [], window_seconds=45, persistence_windows=3),
        )
    with pytest.raises(EvaluationConfigError):
        run_harness(campaign, bootstrap=False)


def test_incident_record_run_id_must_match(campaign):
    write_json(campaign["runs"] / "v-c2" / "incidents.json", record("other-run", []))
    with pytest.raises(EvaluationError, match="run_id"):
        run_harness(campaign, bootstrap=False)


def test_incident_record_schema_validation(tmp_path):
    good = record("r", [("a", 1000)])
    parsed = parse_incident_record(good)
    assert parsed.incidents[0].detected_at == T0 + timedelta(seconds=1000)
    bad_cases = [
        {**good, "schema": "incident-record.v0"},
        {key: value for key, value in good.items() if key != "detector"},
        {**good, "window_seconds": True},
        {**good, "incidents": [good["incidents"][0], good["incidents"][0]]},
        {**good, "incidents": [{**good["incidents"][0], "detected_at": "2026-11-20T08:00:00"}]},
        {**good, "incidents": [{**good["incidents"][0], "estimated_start_time": iso(2000)}]},
    ]
    for data in bad_cases:
        with pytest.raises(IncidentRecordError):
            parse_incident_record(data)
    path = tmp_path / "broken.json"
    path.write_text("{", encoding="utf-8")
    with pytest.raises(IncidentRecordError):
        load_incident_record(path)


def test_evaluation_config_declares_versioned_rules():
    config = load_evaluation_config()
    assert config.version == "detection-evaluation.v1"
    assert config.early_tolerance_s == 0
    assert config.exclude_late_tolerance_tail is True
    assert config.peak_profiles == ("healthy-spike",)
    assert (config.bootstrap_resamples, config.bootstrap_confidence) == (10000, 0.95)
    assert config.raw["late_tolerance"]["persistence_semantics"] == "skip_without_breaking_chain"
    assert config.candidates_path.name == "detection-candidates-v1.json"


def test_cli_evaluate_detection_and_test_split_guard(campaign, tmp_path, capsys):
    out = tmp_path / "eval" / "artifact.json"
    args = [
        "evaluate-detection",
        "--dataset", str(campaign["dataset_path"]),
        "--split", "validation",
        "--runs-dir", str(campaign["runs"]),
        "--incidents", str(campaign["runs"] / "{run_id}" / "incidents.json"),
        "--load-dir", str(campaign["load"]),
        "--out", str(out),
        "--no-bootstrap",
        "--allow-dirty",
    ]  # fmt: skip
    assert main(args) == 0
    artifact = json.loads(out.read_text(encoding="utf-8"))
    assert artifact["schema"] == "detection-evaluation-artifact.v1"
    assert artifact["split"] == "validation"
    assert artifact["bootstrap"] is None
    capsys.readouterr()
    with pytest.raises(EvaluationError, match="split test"):
        main([*args[:3], "--split", "test", *args[5:]])


def test_cli_scores_runs_outside_dataset(campaign, tmp_path):
    out = tmp_path / "pilot.json"
    code = main(
        [
            "evaluate-detection",
            "--run-id",
            "v-c2",
            "--run-id",
            "v-healthy-nm",
            "--runs-dir",
            str(campaign["runs"]),
            "--incidents",
            str(campaign["runs"] / "{run_id}" / "incidents.json"),
            "--out",
            str(out),
            "--no-bootstrap",
            "--allow-dirty",
        ]  # fmt: skip
    )
    assert code == 0
    artifact = json.loads(out.read_text(encoding="utf-8"))
    assert artifact["summary"]["pooled"]["n_runs"] == 2
    assert artifact["summary"]["per_case"]["C2"]["tp"] == 1


def test_only_evaluation_and_ground_truth_read_ground_truth():
    """Ranh giới mục 3.3: module khác không import gói ground_truth hay đọc ground-truth.json."""
    package = TRAINING_ROOT / "src" / "aiops_training"
    allowed = {package / "cli.py"}
    allowed_dirs = {package / "ground_truth", package / "evaluation"}
    pattern = re.compile(r"ground[-_]truth\.json|from \.+ground_truth|aiops_training\.ground_truth")
    offenders = [
        str(path.relative_to(package))
        for path in package.rglob("*.py")
        if path not in allowed
        and not any(parent in allowed_dirs for parent in path.parents)
        and pattern.search(path.read_text(encoding="utf-8"))
    ]
    assert offenders == []


def test_fault_run_whose_matching_window_leaves_evaluation_interval_is_excluded(campaign):
    # fault_end + late_tolerance (120 s) vượt workload_end: interval không phủ khoảng ghép.
    make_run(campaign["runs"], "v-c3", fault=(1080, RUN_S - 60), case="C3", detections=[])
    artifact = run_harness(campaign, bootstrap=False)
    assert artifact["summary"]["excluded_by_reason"]["evaluation_interval_invalid"] == ["v-c3"]
    assert artifact["summary"]["per_case"].keys() == {"C2"}


# --- Chặn split test (B1) ------------------------------------------------------------------


def _slot(campaign, run_id):
    manifest = json.loads((campaign["runs"] / run_id / "run-manifest.json").read_text("utf-8"))
    return slot_from_run_manifest(run_id, manifest)


def _api(campaign, slots, **kwargs):
    return evaluate_detection(
        slots,
        runs_dir=campaign["runs"],
        incidents_template=str(campaign["runs"] / "{run_id}" / "incidents.json"),
        config=load_evaluation_config(),
        config_path=DEFAULT_EVALUATION_CONFIG,
        load_dir=campaign["load"],
        code={"commit": "abc123", "dirty": False},
        bootstrap=False,
        **kwargs,
    )


def test_api_refuses_test_run_without_final_test_before_reading_truth(campaign):
    make_run(campaign["runs"], "t-c2", split="test", fault=(1080, 1680), detections=[])
    # Ground truth hỏng: nếu harness đọc nó trước bước chặn thì lỗi sẽ là JSONDecodeError.
    (campaign["runs"] / "t-c2" / "ground-truth.json").write_text("{", encoding="utf-8")
    with pytest.raises(EvaluationError, match="split test"):
        _api(campaign, [_slot(campaign, "t-c2")])
    with pytest.raises(EvaluationError, match="split test"):
        _api(campaign, [_slot(campaign, "v-c2")], split="test")
    # Slot test của dataset cũng bị chặn, kể cả khi chưa có run.
    with pytest.raises(EvaluationError, match="split test"):
        _api(campaign, slots_from_dataset(campaign["dataset"], "test"))


def test_api_scores_test_run_with_final_test(campaign):
    make_run(campaign["runs"], "t-c2", split="test", fault=(1080, 1680), detections=[("h", 1100)])
    artifact = _api(campaign, [_slot(campaign, "t-c2")], final_test=True)
    assert artifact["final_test"] is True
    assert artifact["summary"]["matched_fault_runs"] == 1


def test_cli_run_id_mode_refuses_test_run(campaign, tmp_path):
    make_run(campaign["runs"], "t-c2", split="test", fault=(1080, 1680), detections=[])
    args = [
        "evaluate-detection",
        "--run-id", "t-c2",
        "--runs-dir", str(campaign["runs"]),
        "--incidents", str(campaign["runs"] / "{run_id}" / "incidents.json"),
        "--out", str(tmp_path / "t.json"),
        "--no-bootstrap",
        "--allow-dirty",
    ]  # fmt: skip
    with pytest.raises(EvaluationError, match="split test"):
        main(args)
    assert main([*args, "--final-test"]) == 0


def test_split_mismatch_between_dataset_and_run_manifest_is_rejected(campaign):
    make_run(campaign["runs"], "v-c3", split="train", fault=(1080, 1980), case="C3", detections=[])
    with pytest.raises(EvaluationError, match="split"):
        run_harness(campaign, bootstrap=False)


# --- Ngưỡng và tính nhất quán của tổ hợp (N1) -----------------------------------------------


def _write_records(campaign, **overrides_by_run):
    for run_id in (
        "v-c2",
        "v-c3",
        "v-healthy-nm",
        "v-healthy-spike",
        "v-invalid",
        "v-quality-fail",
    ):
        path = campaign["runs"] / run_id / "incidents.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data.update(overrides_by_run.get(run_id, overrides_by_run.get("*", {})))
        write_json(path, data)


def test_threshold_is_read_and_recorded(campaign):
    _write_records(campaign, **{"*": {"threshold": 4}})
    artifact = run_harness(campaign, bootstrap=False)
    assert artifact["threshold"] == 4.0
    chosen = combination_from_artifact(artifact, "rz-60-5-4")
    assert chosen.threshold == 4.0
    assert chosen.eligible_run_ids == tuple(artifact["summary"]["eligible_run_ids"])
    assert combination_from_artifact(artifact, "rz", threshold=4).threshold == 4.0
    with pytest.raises(ValueError, match="ngưỡng"):
        combination_from_artifact(artifact, "rz", threshold=5)


def test_threshold_falls_back_to_lineage(campaign):
    _write_records(campaign, **{"*": {"lineage": {"threshold": 3}}})
    assert run_harness(campaign, bootstrap=False)["threshold"] == 3.0
    good = record("r", [], threshold=3, lineage={"threshold": 4})
    with pytest.raises(IncidentRecordError, match="lineage.threshold"):
        parse_incident_record(good)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("detector", "isolation_forest"),
        ("detector_config_version", "robust-z.v2"),
        ("incident_config_version", "incident.v2"),
        ("threshold", 5),
    ],
)
def test_inconsistent_combination_fields_are_rejected(campaign, field, value):
    _write_records(campaign, **{"*": {"threshold": 4}, "v-c3": {"threshold": 4, field: value}})
    with pytest.raises(EvaluationError, match=field):
        run_harness(campaign, bootstrap=False)


def test_selection_from_two_artifacts_on_same_runs(campaign):
    _write_records(campaign, **{"*": {"threshold": 4}})
    first = combination_from_artifact(run_harness(campaign, bootstrap=False), "thr-4")
    _write_records(campaign, **{"*": {"threshold": 5}})
    second = combination_from_artifact(run_harness(campaign, bootstrap=False), "thr-5")
    chosen = select_combination([first, second])
    # Cùng số đếm và mẫu số: hòa tới bước cuối, ngưỡng lớn hơn được chọn.
    assert chosen["selected"] == "thr-5"
    assert chosen["cap_per_hour"] == load_evaluation_config().false_alarm_cap_per_hour


# --- Lý do loại run (mục 20.6) ----------------------------------------------------------------


def test_every_exclusion_reason_is_reported(campaign):
    runs = campaign["runs"]
    make_run(runs, "v-c3", fault=(1080, 1980), case="C3", execution="fail", detections=[])
    make_run(runs, "v-healthy-nm", quality=None, detections=[])
    (runs / "v-quality-fail" / "run-manifest.json").unlink()
    (runs / "v-invalid" / "ground-truth.json").unlink()
    make_run(runs, "v-no-incidents", fault=(1080, 1680), case="C6", status=None, detections=[])
    artifact = run_harness(campaign, bootstrap=False)
    reasons = artifact["summary"]["excluded_by_reason"]
    assert reasons["execution_gate_failed"] == ["v-c3"]
    assert reasons["telemetry_quality_missing"] == ["v-healthy-nm"]
    assert reasons["run_manifest_missing"] == ["v-quality-fail"]
    assert reasons["ground_truth_missing"] == ["v-invalid"]
    assert reasons["ground_truth_run_status_missing"] == ["v-no-incidents"]
    assert not any(reason.endswith("None") for reason in reasons)


def test_case_mismatch_with_dataset_slot_is_excluded(campaign):
    # Slot c3 khai báo C3 nhưng ground truth ghi C2.
    make_run(campaign["runs"], "v-c3", fault=(1080, 1980), case="C2", detections=[])
    artifact = run_harness(campaign, bootstrap=False)
    assert artifact["summary"]["excluded_by_reason"]["ground_truth_case_mismatch"] == ["v-c3"]


def test_fault_in_warmup_or_short_workload_is_interval_invalid(campaign):
    make_run(campaign["runs"], "v-c3", fault=(300, 900), case="C3", detections=[])
    make_run(campaign["runs"], "v-healthy-nm", workload_seconds=200, detections=[])
    artifact = run_harness(campaign, bootstrap=False)
    assert artifact["summary"]["excluded_by_reason"]["evaluation_interval_invalid"] == [
        "v-c3",
        "v-healthy-nm",
    ]


# --- Đoạn cao điểm không tính được (N5) -----------------------------------------------------


def test_peak_plan_missing_sha_missing_and_invalid(campaign, tmp_path):
    runs, load = campaign["runs"], campaign["load"]
    (load / PLAN_PATH).unlink()
    reasons = run_harness(campaign, bootstrap=False)["summary"]["peak_unavailable_by_reason"]
    assert reasons == {"peak_plan_missing": ["v-healthy-spike"]}

    short = {"plan_id": "short", "run_seconds": 600, "sessions": [{"start_s": 10.0}]}
    write_json(load / PLAN_PATH, short)
    make_run(runs, "v-healthy-spike", profile="healthy-spike", detections=[])
    reasons = run_harness(campaign, bootstrap=False)["summary"]["peak_unavailable_by_reason"]
    assert reasons == {"peak_plan_sha256_missing": ["v-healthy-spike"]}

    sha = hashlib.sha256((load / PLAN_PATH).read_bytes()).hexdigest()
    make_run(runs, "v-healthy-spike", profile="healthy-spike", detections=[], plan_sha256=sha)
    reasons = run_harness(campaign, bootstrap=False)["summary"]["peak_unavailable_by_reason"]
    assert reasons == {"peak_plan_invalid": ["v-healthy-spike"]}

    args = [
        "evaluate-detection",
        "--dataset", str(campaign["dataset_path"]),
        "--split", "validation",
        "--runs-dir", str(runs),
        "--incidents", str(runs / "{run_id}" / "incidents.json"),
        "--load-dir", str(load),
        "--out", str(tmp_path / "peak.json"),
        "--no-bootstrap",
        "--allow-dirty",
    ]  # fmt: skip
    assert main(args) == 1
    assert main([*args, "--allow-missing-peak"]) == 0


# --- Code chưa commit (N7) và id artifact ----------------------------------------------------


def test_dirty_code_is_refused_unless_allowed(campaign):
    dirty = {"commit": "abc123", "dirty": True}
    with pytest.raises(EvaluationError, match="chưa commit"):
        run_harness(campaign, bootstrap=False, code=dirty)


def test_allow_dirty_is_recorded(campaign):
    artifact = evaluate_detection(
        slots_from_dataset(campaign["dataset"], "validation"),
        runs_dir=campaign["runs"],
        incidents_template=str(campaign["runs"] / "{run_id}" / "incidents.json"),
        config=load_evaluation_config(),
        config_path=DEFAULT_EVALUATION_CONFIG,
        load_dir=campaign["load"],
        split="validation",
        code={"commit": "abc123", "dirty": True},
        allow_dirty=True,
        bootstrap=False,
    )
    assert artifact["lineage"]["analysis_code_dirty"] is True
    assert artifact["lineage"]["allow_dirty"] is True


def test_artifact_id_does_not_depend_on_paths(campaign, tmp_path):
    first = run_harness(campaign, bootstrap=False)
    moved_root = tmp_path / "elsewhere"
    shutil.copytree(campaign["runs"], moved_root / "runs")
    shutil.copytree(campaign["load"], moved_root / "load")
    shutil.copy(campaign["dataset_path"], moved_root / "dataset.json")
    moved = {
        "runs": moved_root / "runs",
        "load": moved_root / "load",
        "dataset": campaign["dataset"],
        "dataset_path": moved_root / "dataset.json",
    }
    second = run_harness(moved, bootstrap=False)
    assert second["evaluation_artifact_id"] == first["evaluation_artifact_id"]
    assert second["runs"][0]["lineage"] != first["runs"][0]["lineage"]


def test_only_cli_imports_evaluation_package():
    """Code ngoài `evaluation/` (trừ điểm vào `cli.py`) không dùng harness, nên không chạm truth."""
    package = TRAINING_ROOT / "src" / "aiops_training"
    pattern = re.compile(r"aiops_training\.evaluation|from \.+evaluation")
    offenders = [
        str(path.relative_to(package))
        for path in package.rglob("*.py")
        if path != package / "cli.py"
        and package / "evaluation" not in path.parents
        and pattern.search(path.read_text(encoding="utf-8"))
    ]
    assert offenders == []
