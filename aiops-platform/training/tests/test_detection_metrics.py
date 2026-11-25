"""Ghép incident–fault, chỉ số, đoạn cao điểm, luật chọn và bootstrap của evaluation harness.

Incident và mốc ground truth dựng tay theo lịch mặc định của fault manifest v2 (run 2.880 s,
warm-up 360 s, fault C2 ở giây 1.080–1.680). Mọi giá trị kỳ vọng tính độc lập từ các mốc này.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from aiops_training.evaluation.detection.bootstrap import bootstrap_ci, percentile
from aiops_training.evaluation.detection.matching import (
    FP_AFTER_LATE_TOLERANCE,
    FP_BEFORE_FAULT,
    FP_DUPLICATE,
    FP_HEALTHY,
    MATCHED,
    OUTSIDE_INTERVAL,
    Interval,
    PeakSegment,
    evaluate_run,
)
from aiops_training.evaluation.detection.metrics import (
    RunUnit,
    counts,
    meets_cap,
    precision_recall_f1,
    summarize,
)
from aiops_training.evaluation.detection.peak import peak_window
from aiops_training.evaluation.detection.records import Incident
from aiops_training.evaluation.detection.selection import CombinationResult, select_combination

T0 = datetime(2026, 11, 20, 8, 0, tzinfo=UTC)
RUN_S = 2880
WARMUP_S = 360
FAULT = (1080, 1680)
LATE = 120.0
EVAL = Interval(T0 + timedelta(seconds=WARMUP_S), T0 + timedelta(seconds=RUN_S))


def at(seconds: float) -> datetime:
    return T0 + timedelta(seconds=seconds)


def incident(incident_id: str, detected_s: float) -> Incident:
    return Incident(
        incident_id=incident_id,
        detected_at=at(detected_s),
        estimated_start_time=at(detected_s - 60),
        resolved_at=None,
        affected_services=("course",),
        peak_score=None,
    )


def fault_run(run_id: str, *detections: tuple[str, float], fault=FAULT, **kwargs):
    return evaluate_run(
        run_id,
        [incident(name, s) for name, s in detections],
        EVAL,
        fault_window=Interval(at(fault[0]), at(fault[1])),
        late_tolerance_s=LATE,
        **kwargs,
    )


def healthy_run(run_id: str, *detections: tuple[str, float], peak=None):
    return evaluate_run(run_id, [incident(name, s) for name, s in detections], EVAL, peak=peak)


# --- Ghép incident với fault (mục 17.2–17.5) ---------------------------------------------------


def test_incident_inside_matching_interval_is_tp_with_delay():
    result = fault_run("r", ("a", 1100))
    assert (result.tp, result.fp, result.fn) == (1, 0, 0)
    assert result.labels == {"a": MATCHED}
    assert result.detection_delay_s == 1100 - FAULT[0]


def test_incident_before_fault_is_fp_and_fault_is_fn():
    # Incident mở trước fault rồi còn mở khi fault bắt đầu vẫn là FP (mục 17.2).
    result = fault_run("r", ("early", FAULT[0] - 1))
    assert result.labels == {"early": FP_BEFORE_FAULT}
    assert (result.tp, result.fp, result.fn) == (0, 1, 1)
    assert result.detection_delay_s is None


def test_late_tolerance_bound_is_closed_and_later_is_fp():
    edge = FAULT[1] + LATE
    on_edge = fault_run("r", ("edge", edge))
    assert on_edge.labels == {"edge": MATCHED}
    late = fault_run("r", ("late", edge + 1))
    assert late.labels == {"late": FP_AFTER_LATE_TOLERANCE}
    assert (late.tp, late.fp, late.fn) == (0, 1, 1)


def test_detection_exactly_at_fault_start_has_zero_delay():
    result = fault_run("r", ("a", FAULT[0]))
    assert result.labels == {"a": MATCHED}
    assert result.detection_delay_s == 0


def test_duplicate_incidents_earliest_matches_rest_fp():
    result = fault_run("r", ("second", 1300), ("first", 1200), ("third", 1500))
    assert result.matched_incident_id == "first"
    assert result.labels["second"] == FP_DUPLICATE
    assert result.labels["third"] == FP_DUPLICATE
    assert (result.tp, result.fp, result.fn) == (1, 2, 0)


def test_same_detected_at_tie_breaks_by_incident_id():
    result = fault_run("r", ("inc-b", 1200), ("inc-a", 1200))
    assert result.matched_incident_id == "inc-a"
    assert result.labels["inc-b"] == FP_DUPLICATE


def test_fault_run_without_incident_is_fn():
    result = fault_run("r")
    assert (result.tp, result.fp, result.fn) == (0, 0, 1)
    assert result.detection_fields()["detected"] is False
    assert result.detection_fields()["detection_delay_seconds"] is None


def test_healthy_run_without_incident_has_no_false_positive():
    result = healthy_run("h")
    assert (result.tp, result.fp, result.fn) == (0, 0, 0)
    assert result.detection_fields()["healthy_run_false_positive"] == 0
    assert result.detection_fields()["detected"] is None


def test_healthy_run_incidents_are_fp():
    result = healthy_run("h", ("x", 1000), ("y", 2000))
    assert set(result.labels.values()) == {FP_HEALTHY}
    assert result.fp == 2
    assert result.detection_fields()["healthy_run_false_positive"] == 1


def test_incidents_outside_evaluation_interval_are_diagnostic_only():
    # Trong warm-up và sau workload_end: không TP, không FP, không báo động giả.
    result = fault_run("r", ("warmup", WARMUP_S - 1), ("after", RUN_S + 5), ("hit", 1100))
    assert result.labels["warmup"] == OUTSIDE_INTERVAL
    assert result.labels["after"] == OUTSIDE_INTERVAL
    assert (result.tp, result.fp, result.fn, result.false_alarms) == (1, 0, 0, 0)
    healthy = healthy_run("h", ("warmup", 10))
    assert (healthy.fp, healthy.false_alarms) == (0, 0)
    assert healthy.detection_fields()["healthy_run_false_positive"] == 0


def test_incidents_exactly_at_evaluation_bounds_are_inside():
    # Evaluation interval đóng hai đầu: đúng evaluation_start và đúng evaluation_end đều được tính.
    result = healthy_run("h", ("at-start", WARMUP_S), ("at-end", RUN_S))
    assert result.labels == {"at-start": FP_HEALTHY, "at-end": FP_HEALTHY}
    assert result.false_alarms == 2


# --- Mẫu số 0 và tỉ lệ (mục 17.6) --------------------------------------------------------------


def test_zero_denominators_give_null_not_zero():
    assert precision_recall_f1(0, 0, 0) == {"precision": None, "recall": None, "f1": None}
    assert precision_recall_f1(0, 0, 2) == {"precision": None, "recall": 0.0, "f1": None}
    # Precision = Recall = 0: F1 có mẫu số 0 nên cũng là null.
    assert precision_recall_f1(0, 3, 1)["f1"] is None
    assert precision_recall_f1(1, 1, 1) == pytest.approx(
        {"precision": 0.5, "recall": 0.5, "f1": 0.5}
    )


def test_pooled_counts_over_fault_and_healthy_runs():
    units = [
        RunUnit(fault_run("c2", ("dup0", 1000), ("a", 1100), ("b", 1200)), "C2", "normal-mixed"),
        RunUnit(fault_run("c3"), "C3", "normal-mixed"),
        RunUnit(healthy_run("h", ("x", 900)), None, "normal-mixed"),
    ]
    pooled = counts(units)
    # c2: 1 TP + 2 FP (trước fault, trùng); c3: FN; h: 1 FP.
    assert (pooled["tp"], pooled["fp"], pooled["fn"]) == (1, 3, 1)
    assert pooled["precision"] == pytest.approx(1 / 4)
    assert pooled["recall"] == pytest.approx(1 / 2)
    assert pooled["n_incidents"] == 4
    # Chỉ số phụ chỉ trên fault run: bỏ FP của run khỏe.
    fault_only = summarize(units, cap_per_hour=1.0)["pooled_fault_runs"]
    assert (fault_only["tp"], fault_only["fp"], fault_only["fn"]) == (1, 2, 1)
    assert fault_only["precision"] == pytest.approx(1 / 3)


def test_cap_comparison_is_exact_at_the_boundary():
    hour_us = 3600 * 1_000_000
    assert meets_cap(2, 2 * hour_us, 1.0) is True
    assert meets_cap(2, 2 * hour_us - 1, 1.0) is False
    assert meets_cap(0, 0, 1.0) is False
    # 7 báo động giả trong 7 giờ: 7/7 bằng đúng cap, phép chia số thực không được làm lệch.
    assert meets_cap(7, 7 * hour_us, 1) is True


# --- Mẫu số báo động giả/giờ (mục 6.1.2, 17.7) ---------------------------------------------------


def test_false_alarm_denominator_excludes_fault_and_late_tolerance_tail():
    fault = fault_run("c2", ("before", 900), ("hit", 1100), ("dup", 1200), ("after", 2000))
    # Chỉ incident ngoài [fault_start, fault_end + late_tolerance] là báo động giả.
    assert fault.false_alarms == 2
    assert fault.exposure_s == (RUN_S - WARMUP_S) - (FAULT[1] + LATE - FAULT[0])
    kept_tail = fault_run("c2", fault=FAULT, exclude_late_tolerance_tail=False)
    assert kept_tail.exposure_s == (RUN_S - WARMUP_S) - (FAULT[1] - FAULT[0])

    healthy = healthy_run("h", ("x", 1000))
    assert healthy.exposure_s == RUN_S - WARMUP_S
    summary = summarize(
        [RunUnit(fault, "C2", "normal-mixed"), RunUnit(healthy, None, "normal-mixed")],
        cap_per_hour=1.0,
    )
    rate = summary["false_alarm_rate"]
    hours = ((RUN_S - WARMUP_S) * 2 - (FAULT[1] + LATE - FAULT[0])) / 3600
    assert rate["false_alarms"] == 3
    assert rate["hours"] == pytest.approx(hours)
    assert rate["per_hour"] == pytest.approx(3 / hours)
    assert rate["meets_cap"] is False
    # FP incidents per healthy hour chỉ dùng run khỏe (mục 17.7).
    assert summary["healthy"]["fp_per_healthy_hour"] == pytest.approx(
        1 / ((RUN_S - WARMUP_S) / 3600)
    )
    assert summary["healthy"]["healthy_run_fpr"] == 1.0


def test_healthy_rates_by_profile_and_zero_healthy_runs():
    units = [
        RunUnit(healthy_run("n"), None, "normal-mixed"),
        RunUnit(healthy_run("s", ("x", 1500)), None, "healthy-spike"),
    ]
    summary = summarize(units, cap_per_hour=1.0)
    by_profile = summary["healthy"]["by_profile"]
    assert by_profile["normal-mixed"]["healthy_run_fpr"] == 0.0
    assert by_profile["healthy-spike"]["healthy_run_fpr"] == 1.0
    assert summary["healthy"]["healthy_run_fpr"] == 0.5
    only_fault = summarize([RunUnit(fault_run("c"), "C2", "normal-mixed")], cap_per_hour=1.0)
    assert only_fault["healthy"]["healthy_run_fpr"] is None
    assert only_fault["healthy"]["fp_per_healthy_hour"] is None


# --- Detection Delay theo case (mục 17.5, 20.2) --------------------------------------------------


def test_delay_per_case_excludes_fn():
    units = [
        RunUnit(fault_run("c2a", ("a", 1100)), "C2", "normal-mixed", align_peak=True),
        RunUnit(fault_run("c2b", ("b", 1140)), "C2", "normal-mixed", align_peak=False),
        RunUnit(fault_run("c6a"), "C6", "normal-mixed", align_peak=False),
    ]
    delay = summarize(units, cap_per_hour=1.0)["detection_delay"]
    assert delay["count"] == 2
    assert delay["fn"] == 1
    assert delay["mean_seconds"] == pytest.approx(((1100 - 1080) + (1140 - 1080)) / 2)
    assert delay["by_case"]["C2"]["median_seconds"] == pytest.approx(40)
    assert delay["by_case"]["C6"] == {
        "count": 0,
        "fn": 1,
        "mean_seconds": None,
        "median_seconds": None,
        "values_seconds": [],
    }
    assert delay["by_align_peak"]["true"]["values_seconds"] == [20.0]


# --- Đoạn cao điểm ----------------------------------------------------------------------------


def test_peak_window_picks_densest_segment_after_warmup_earliest_on_tie():
    starts = [10, 20, 30] + [1000 + i for i in range(5)] + [2000 + i for i in range(5)]
    peak = peak_window(starts, run_seconds=RUN_S, warmup_s=WARMUP_S, duration_s=600, step_s=30)
    # Đoạn trong warm-up không được chọn; hai cụm 5 phiên bằng nhau thì lấy đoạn sớm nhất chứa cụm.
    assert peak.session_starts == 5
    assert peak.start_s <= 1000 and peak.end_s > 1004
    assert peak.start_s == WARMUP_S + 30 * ((1004 - 600 - WARMUP_S) // 30 + 1)
    with pytest.raises(ValueError):
        peak_window(starts, run_seconds=900, warmup_s=WARMUP_S, duration_s=600, step_s=30)


def test_false_alarms_in_peak_segment():
    peak = PeakSegment(at(1500), at(2100))
    result = healthy_run(
        "s", ("before", 1499), ("start", 1500), ("inside", 2000), ("end", 2100), peak=peak
    )
    # Nửa mở [start, end): incident đúng ở end không thuộc cao điểm.
    assert result.peak["false_alarms"] == 2
    assert result.peak["exposure_s"] == 600
    summary = summarize([RunUnit(result, None, "healthy-spike")], cap_per_hour=1.0)
    assert summary["peak"]["healthy-spike"]["per_hour"] == pytest.approx(2 / (600 / 3600))


# --- Luật chọn (mục 6.1.2) --------------------------------------------------------------------


SHARED = {
    "cap_per_hour": 1.0,
    "eligible_run_ids": ("c2", "c3", "h"),
    "evaluation_config_version": "detection-evaluation.v1",
    "candidates_sha256": "abc",
    "detector": "robust_z",
}


def combo(cid, threshold, late, matched, alarms, hours=2.0, **overrides):
    # Mỗi ứng viên có config detector riêng (sha khác nhau) trừ khi test ghi đè.
    fields = {**SHARED, "detector_config_sha256": f"sha-{cid}", **overrides}
    return CombinationResult(
        combination_id=cid,
        threshold=threshold,
        late_tolerance_seconds=late,
        matched_fault_runs=matched,
        false_alarms=alarms,
        exposure_us=round(hours * 3600 * 1_000_000),
        **fields,
    )


def test_selection_respects_cap_before_matches():
    results = [
        combo("noisy", 3, 60, matched=4, alarms=3),  # 1,5/giờ: vượt cap
        combo("quiet", 5, 135, matched=3, alarms=2),  # đúng 1/giờ: đạt (biên đóng)
    ]
    chosen = select_combination(results)
    assert chosen["selected"] == "quiet"
    assert chosen["meets_cap"] is True
    assert chosen["cap_per_hour"] == 1.0
    assert [row["combination_id"] for row in chosen["ranking"]] == ["quiet", "noisy"]


def test_selection_order_matches_then_alarms_then_tolerance_then_threshold():
    results = [
        combo("fewer-matches", 5, 60, matched=2, alarms=0),
        combo("more-alarms", 5, 60, matched=4, alarms=1),
        combo("larger-tol", 5, 120, matched=4, alarms=0),
        combo("lower-thr", 3, 60, matched=4, alarms=0),
        combo("best", 4, 60, matched=4, alarms=0),
    ]
    ranking = [row["combination_id"] for row in select_combination(results)["ranking"]]
    assert ranking == ["best", "lower-thr", "larger-tol", "more-alarms", "fewer-matches"]


def test_selection_same_counts_different_exposure_compares_rates():
    # Cùng 2 báo động giả và cùng số fault run khớp; mẫu số khác do late_tolerance khác.
    results = [
        combo("short-exposure", 5, 60, matched=4, alarms=2, hours=2.0),
        combo("long-exposure", 5, 135, matched=4, alarms=2, hours=2.5),
    ]
    ranking = select_combination(results)["ranking"]
    assert [row["combination_id"] for row in ranking] == ["long-exposure", "short-exposure"]
    assert ranking[0]["false_alarms_per_hour"] == pytest.approx(0.8)


def test_selection_fallback_when_no_combination_meets_cap():
    results = [
        combo("a", 3, 60, matched=4, alarms=6),
        combo("b", 5, 60, matched=1, alarms=4),
        combo("c", 4, 60, matched=3, alarms=4),
        combo("zero-hours", 5, 60, matched=4, alarms=0, hours=0),
    ]
    chosen = select_combination(results)
    assert chosen["rule_applied"] == "fallback_min_false_alarms"
    assert chosen["meets_cap"] is False
    # Hòa 2/giờ giữa b và c: nhiều fault run khớp hơn thắng; tỉ lệ không xác định xếp cuối.
    assert [row["combination_id"] for row in chosen["ranking"]] == ["c", "b", "a", "zero-hours"]


def test_selection_fallback_ties_break_by_late_tolerance_then_threshold():
    results = [
        combo("tol-135", 5, 135, matched=3, alarms=4),
        combo("tol-60-thr-3", 3, 60, matched=3, alarms=4),
        combo("tol-60-thr-5", 5, 60, matched=3, alarms=4),
    ]
    chosen = select_combination(results)
    assert chosen["rule_applied"] == "fallback_min_false_alarms"
    ranking = [row["combination_id"] for row in chosen["ranking"]]
    assert ranking == ["tol-60-thr-5", "tol-60-thr-3", "tol-135"]


def test_selection_rejects_duplicates_empty_and_incomparable_results():
    with pytest.raises(ValueError):
        select_combination([])
    with pytest.raises(ValueError):
        select_combination([combo("x", 3, 60, 1, 0), combo("x", 4, 60, 1, 0)])
    for name, value in (
        ("eligible_run_ids", ("c2", "h")),
        ("evaluation_config_version", "detection-evaluation.v2"),
        ("candidates_sha256", "def"),
        ("detector", "isolation_forest"),
        ("cap_per_hour", 2.0),
    ):
        with pytest.raises(ValueError, match=name):
            select_combination([combo("x", 3, 60, 1, 0), combo("y", 4, 60, 1, 0, **{name: value})])


# --- Bootstrap (mục 20.7) ---------------------------------------------------------------------


def test_percentile_linear_interpolation():
    assert percentile([0.0, 10.0], 0.25) == pytest.approx(2.5)
    assert percentile([1.0, 2.0, 3.0], 0.5) == 2.0
    assert percentile([5.0], 0.975) == 5.0


def _units_two_per_stratum():
    return [
        RunUnit(fault_run("c2a", ("a", 1100)), "C2", "normal-mixed"),
        RunUnit(fault_run("c2b"), "C2", "normal-mixed"),
        RunUnit(fault_run("c3a", ("b", 1200)), "C3", "normal-mixed"),
        RunUnit(fault_run("c3b", ("c", 1300), ("d", 2500)), "C3", "normal-mixed"),
        RunUnit(healthy_run("h1", ("x", 1000)), None, "normal-mixed"),
        RunUnit(healthy_run("h2"), None, "normal-mixed"),
    ]


def test_bootstrap_is_deterministic_for_same_seed():
    units = _units_two_per_stratum()
    first = bootstrap_ci(units, resamples=500, seed=7)
    second = bootstrap_ci(units, resamples=500, seed=7)
    assert first == second
    recall = first["statistics"]["recall"]
    assert recall["status"] == "ok"
    assert recall["point"] == pytest.approx(3 / 4)
    # Resample theo tầng: mỗi case giữ 2 run, recall chỉ nhận các mức k/4 trong [0,5; 1].
    assert 0.5 <= recall["ci_low"] < recall["ci_high"] <= 1.0
    assert first["statistics"]["healthy_run_fpr"]["strata"] == {"profile:normal-mixed": 2}


def test_bootstrap_hand_computed_interval():
    # Một tầng 4 run (3 TP, 1 FN): recall của lần lấy mẫu = k/4, k ~ Binomial(4; 0,75).
    # P(k <= 0) = 0,4% < 2,5% < P(k <= 1) = 5,1% nên phân vị 2,5% là 1/4;
    # P(k = 4) = 31,6% > 2,5% nên phân vị 97,5% là 1. Hai mốc cách xa ngưỡng, không phụ thuộc seed.
    units = [
        RunUnit(fault_run("a", ("x", 1100)), "C2", "normal-mixed"),
        RunUnit(fault_run("b", ("y", 1100)), "C2", "normal-mixed"),
        RunUnit(fault_run("c", ("z", 1100)), "C2", "normal-mixed"),
        RunUnit(fault_run("d"), "C2", "normal-mixed"),
    ]
    recall = bootstrap_ci(units, resamples=10000, seed=20261125)["statistics"]["recall"]
    assert recall["status"] == "ok"
    assert (recall["ci_low"], recall["ci_high"]) == (0.25, 1.0)


def test_bootstrap_different_seed_gives_different_result():
    units = _units_two_per_stratum()

    def bounds(seed):
        stats = bootstrap_ci(units, resamples=30, seed=seed)["statistics"]
        return [(entry["ci_low"], entry["ci_high"]) for entry in stats.values()]

    assert bounds(1) != bounds(2)


def test_bootstrap_partially_degenerate_keeps_interval():
    units = [
        RunUnit(fault_run("c2", ("a", 1100)), "C2", "normal-mixed"),
        RunUnit(fault_run("c3a"), "C3", "normal-mixed"),
        RunUnit(fault_run("c3b", ("b", 1200)), "C3", "normal-mixed"),
        RunUnit(healthy_run("h", ("x", 1000)), None, "healthy-spike"),
    ]
    stats = bootstrap_ci(units, resamples=200, seed=1)["statistics"]
    recall = stats["recall"]
    assert recall["status"] == "partially_degenerate"
    assert recall["degenerate_strata"] == ["case:C2"]
    # C2 luôn TP, C3 có 0–2 TP: recall của lần lấy mẫu nằm trong {1/3, 2/3, 1}.
    assert 1 / 3 - 1e-9 <= recall["ci_low"] <= recall["ci_high"] <= 1.0


def test_bootstrap_reports_degenerate_when_every_stratum_has_one_run():
    units = [
        RunUnit(fault_run("c2", ("a", 1100)), "C2", "normal-mixed"),
        RunUnit(fault_run("c3"), "C3", "normal-mixed"),
        RunUnit(healthy_run("h", ("x", 1000)), None, "healthy-spike"),
    ]
    stats = bootstrap_ci(units, resamples=200, seed=1)["statistics"]
    assert stats["recall"]["status"] == "degenerate"
    assert stats["recall"]["degenerate_strata"] == ["case:C2", "case:C3"]
    assert stats["recall"]["ci_low"] is None and stats["recall"]["ci_high"] is None
    assert stats["healthy_run_fpr"]["status"] == "degenerate"
    assert stats["healthy_run_fpr"]["degenerate_strata"] == ["profile:healthy-spike"]


def test_bootstrap_undefined_without_runs_of_that_kind():
    units = [RunUnit(fault_run("c2a", ("a", 1100)), "C2", "normal-mixed")]
    stats = bootstrap_ci(units, resamples=10, seed=1)["statistics"]
    assert stats["healthy_run_fpr"]["status"] == "undefined"
    assert stats["healthy_run_fpr"]["point"] is None


def test_selection_rejects_two_ids_with_identical_identity():
    same = {"detector_config_sha256": "d1", "incident_config_sha256": "i1", "model_sha256": None}
    with pytest.raises(ValueError, match="khóa định danh"):
        select_combination([combo("a", 1.0, 60, 4, 0, **same), combo("b", 1.0, 60, 4, 0, **same)])
    # Ngưỡng tĩnh: cùng threshold 1.0, khác bộ ngưỡng trong config thì là hai tổ hợp hợp lệ.
    other = {**same, "detector_config_sha256": "d2"}
    chosen = select_combination(
        [combo("a", 1.0, 60, 4, 0, **same), combo("b", 1.0, 60, 4, 0, **other)]
    )
    assert {row["combination_id"] for row in chosen["ranking"]} == {"a", "b"}
    assert chosen["ranking"][0]["detector_config_sha256"] in {"d1", "d2"}
