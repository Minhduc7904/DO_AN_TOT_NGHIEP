"""Incident lifecycle (task-03 tuần 16): máy trạng thái, thời điểm, gộp incident, CLI.

Lifecycle chạy thật trên `WindowScore` dựng tay; phần end-to-end dùng feature giả của
`test_anomaly` qua baseline, detector và lifecycle thật.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from test_anomaly import _feature_dir, _train_and_apply

from aiops_training.anomaly.detectors import RobustZ
from aiops_training.anomaly.run import detect
from aiops_training.cli import main
from aiops_training.incident.lifecycle import (
    IncidentConfig,
    WindowScore,
    correlate,
    service_episodes,
)

T0 = datetime(2026, 11, 23, 9, 0, tzinfo=UTC)
STEP = 15.0
DELAY = 10.0
KEY = {
    "detector": "robust_z",
    "detector_config_version": "d1",
    "incident_config_version": "i1",
    "window_seconds": 60,
    "persistence_windows": 3,
}


def _config(**overrides) -> IncidentConfig:
    values = {
        "incident_config_version": "i1",
        "persistence_windows": 3,
        "recovery_windows": 2,
        "merge_gap_seconds": 60,
        "correlation_window_seconds": 120,
        "max_chain_gap_seconds": 600,
    }
    values.update(overrides)
    return IncidentConfig(**values)


def _windows(
    pattern: str, service: str = "course", window_s: int = 60, offset: int = 0, warmup: int = 0
) -> list[WindowScore]:
    """`pattern`: mỗi ký tự một cửa sổ bước 15 s — `x` vượt (bằng chứng: cạnh), `.` không vượt
    (quan sát được cạnh), `o` không vượt và **không** quan sát được cạnh (chỉ có log, như cạnh thưa
    không có lời gọi), `_` không dữ liệu, `s` im lặng, `i` vượt với điểm vô cùng, `l` vượt do log,
    `a` vượt mà detector không chỉ ra tín hiệu nào (bằng chứng = mọi tín hiệu quan sát được)."""
    edge = f"edge.duration_p95@{service}|dep"
    silence = f"telemetry_silent@{service}"
    log = f"service.log_error_rate@{service}"
    full = {silence, log, edge}
    table = {
        # ký tự: (flagged, score, reason, observed, evidence, top_key)
        "x": (True, None, "threshold", full, {edge}, edge),
        ".": (False, 1.0, "below_threshold", full, set(), None),
        "o": (False, 1.0, "below_threshold", {silence, log}, set(), None),
        "_": (None, None, "no_data", {silence}, set(), None),
        "s": (True, None, "telemetry_silent", {silence}, {silence}, silence),
        "i": (True, math.inf, "threshold", full, {edge}, edge),
        "l": (True, 5.0, "threshold", full, {log}, log),
        "a": (True, 5.0, "threshold", full, full, None),
    }
    result = []
    for index, char in enumerate(pattern):
        start = T0 + timedelta(seconds=STEP * (index + offset))
        flagged, score, reason, observed, evidence, top_key = table[char]
        if char == "x":
            score = 5.0 + index
        result.append(
            WindowScore(
                service=service,
                window_start=start,
                window_end=start + timedelta(seconds=window_s),
                warmup=index < warmup,
                flagged=flagged,
                score=score,
                reason=reason,
                top_signal=top_key.split("@")[0] if top_key else None,
                top_entity=top_key.split("@")[1] if top_key else None,
                top_key=top_key,
                evidence_keys=frozenset(evidence),
                observed_keys=frozenset(observed),
            )
        )
    return result


def _end(index: int, window_s: int = 60) -> datetime:
    return T0 + timedelta(seconds=STEP * index + window_s)


def _episodes(pattern: str, **kwargs):
    config = kwargs.pop("config", _config())
    return service_episodes(_windows(pattern, **kwargs), config, STEP, DELAY)


# --- Máy trạng thái của một service ---------------------------------------------------------------


def test_persistence_skips_null_windows_without_breaking_the_chain():
    # x _ x _ x: ba cửa sổ có dữ liệu vượt liên tiếp (cửa sổ null bỏ qua) → mở ở cửa sổ thứ 5.
    (episode,) = _episodes("x_x_x....")
    assert episode.opened.window_end == _end(4)
    assert episode.opened_at == _end(4) + timedelta(seconds=DELAY)
    # Ước lượng bắt đầu: bước cuối của cửa sổ vượt đầu tiên.
    assert episode.estimated_start_time == _end(0) - timedelta(seconds=STEP)


def test_a_non_flagged_data_window_breaks_the_chain():
    assert _episodes("xx.xx.xx.") == []
    (episode,) = _episodes("xx.xxx...")
    assert episode.first.window_end == _end(3)


def test_windows_without_the_evidence_signal_do_not_break_the_chain():
    # C3: cạnh thưa. Cửa sổ giữa các lời gọi không vượt nhưng chỉ có log/hàng đợi, không quan sát
    # được cạnh đang là bằng chứng → bỏ qua, chuỗi tích lũy tiếp.
    five = _config(persistence_windows=5)
    (episode,) = _episodes("xxooxooxox....", config=five)
    assert episode.opened.window_end == _end(9)
    # Cửa sổ quan sát được chính cạnh đó mà không vượt thì đứt chuỗi.
    assert _episodes("xxo.xooox....", config=five) == []


def test_evidence_of_different_signals_does_not_accumulate():
    # 3 cửa sổ vượt do cạnh thưa, 10 phút yên không quan sát cạnh, rồi 2 cửa sổ vượt do log: hai
    # chuỗi dài 3 và 2, không mở đợt (persistence 5).
    five = _config(persistence_windows=5)
    assert _episodes("xxx" + "o" * 40 + "ll" + "..", config=five) == []
    # Cửa sổ vượt do log quan sát được cạnh mà cạnh bình thường: chuỗi của cạnh đứt.
    assert _episodes("xxlxx" + "....", config=five) == []
    (episode,) = _episodes("xxoxoxox....", config=five)
    assert episode.evidence_key == "edge.duration_p95@course|dep"


def test_old_chain_restarts_after_max_gap():
    # Cạnh thưa: lời gọi chậm (4 cửa sổ), 20 phút không có lời gọi, lời gọi chậm nữa (4 cửa sổ).
    pattern = "xxxx" + "o" * 80 + "xxxx" + "...."
    assert (
        _episodes(pattern, config=_config(persistence_windows=5, max_chain_gap_seconds=120)) == []
    )
    # Không giới hạn (khoảng lớn hơn 20 phút): hai sự kiện đơn lẻ cộng thành một chuỗi.
    (episode,) = _episodes(
        pattern, config=_config(persistence_windows=5, max_chain_gap_seconds=3600)
    )
    assert episode.estimated_start_time == _end(0) - timedelta(seconds=STEP)
    # C3 thật: hai lời gọi cách nhau 75 s (khoảng giữa hai cửa sổ vượt ≈ 30 s) vẫn nối được.
    (c3,) = _episodes(
        "xxxxoxxxx....", config=_config(persistence_windows=5, max_chain_gap_seconds=120)
    )
    assert c3.evidence_key == "edge.duration_p95@course|dep"


def test_flagged_window_without_evidence_is_rejected():
    window = _windows("x")[0]
    bad = WindowScore(**{**window.__dict__, "evidence_keys": frozenset()})
    with pytest.raises(ValueError, match="evidence_keys"):
        service_episodes([bad], _config(), STEP, DELAY)


def test_flagged_window_without_named_signal_is_broken_by_any_normal_window():
    # Bằng chứng = mọi tín hiệu quan sát được, nên cửa sổ bình thường làm đứt; 4 < 5.
    assert _episodes("a" + "." * 99 + "aaaa", config=_config(persistence_windows=5)) == []


def test_silent_chain_breaks_when_heartbeat_returns():
    # Khóa im lặng luôn được quan sát (nhịp tim có hay không): cửa sổ hết im lặng làm đứt chuỗi.
    assert _episodes("ss.ss.ss.") == []


def test_null_windows_during_recovery_do_not_count():
    (episode,) = _episodes("xxx._._x..")
    # Recovery cần 2 cửa sổ không vượt *có dữ liệu* liên tiếp: `._.` đủ 2 → RESOLVED ở cửa sổ 5.
    assert episode.resolved_at == _end(5) + timedelta(seconds=DELAY)


def test_recovery_reopen_and_resolution():
    # Mở ở cửa sổ 2; một cửa sổ yên (RECOVERING) rồi vượt lại (OPEN); hai cửa sổ yên → RESOLVED.
    (episode,) = _episodes("xxx.x...")
    states = [event["state"] for event in episode.events]
    assert states == ["SUSPECTED", "OPEN", "RECOVERING", "OPEN", "RECOVERING", "RESOLVED"]
    assert episode.resolved_at == _end(6) + timedelta(seconds=DELAY)
    # Sau RESOLVED, chuỗi mới cần đủ persistence lại.
    again = _episodes("xxx..xxx")
    assert len(again) == 2


def test_warmup_windows_are_ignored_and_silent_windows_count_as_flagged():
    assert _episodes("xxx...", warmup=3) == []
    (episode,) = _episodes("sss...")
    assert episode.opened.reason == "telemetry_silent"
    assert episode.peak() is None  # cửa sổ im lặng không có điểm


def test_unresolved_episode_has_no_resolved_at():
    (episode,) = _episodes("..xxxxx")
    assert episode.resolved_at is None


@pytest.mark.parametrize(
    ("window_s", "persistence"),
    [(30, 3), (30, 4), (60, 5), (60, 6)],
)
def test_detected_at_for_each_candidate_window_and_persistence(window_s, persistence):
    candidates = json.loads(
        (Path(__file__).parents[1] / "configs" / "detection-candidates-v1.json").read_text()
    )
    pairs = {
        (c["window_seconds"], c["persistence_windows"]) for c in candidates["window_persistence"]
    }
    assert (window_s, persistence) in pairs
    (episode,) = service_episodes(
        _windows("x" * 10, window_s=window_s),
        _config(persistence_windows=persistence),
        STEP,
        DELAY,
    )
    # Vượt từ cửa sổ đầu: detected_at = window_end của cửa sổ thứ `persistence` + 10 s.
    expected = T0 + timedelta(seconds=window_s + (persistence - 1) * STEP + DELAY)
    assert episode.opened_at == expected


# --- Gộp thành incident ---------------------------------------------------------------------------


def _incidents(*series: list[WindowScore], **config):
    cfg = _config(**config)
    episodes = [e for windows in series for e in service_episodes(windows, cfg, STEP, DELAY)]
    return correlate(episodes, cfg, "run-1", KEY)


def test_simultaneous_services_form_one_incident():
    (incident,) = _incidents(
        _windows("xxxx....", "identity"),
        _windows(".xxxx...", "gateway"),
        _windows("..xxxx..", "ai-worker"),
    )
    assert incident["affected_services"] == ["ai-worker", "gateway", "identity"]
    assert incident["first_symptom"]["service"] == "identity"
    assert incident["detected_at"] == (_end(2) + timedelta(seconds=DELAY)).isoformat().replace(
        "+00:00", "Z"
    )
    assert incident["resolved_at"] is not None
    assert [e["state"] for e in incident["timeline"]].count("OPEN") == 3


def test_merge_gap_joins_relapse_and_separates_later_episode():
    # Đợt 2 mở 75 s sau khi đợt 1 hồi phục: trong merge gap 120 s → cùng incident.
    near = _incidents(
        _windows("xxx.." + "..." + "xxx.."), merge_gap_seconds=120, correlation_window_seconds=0
    )
    assert len(near) == 1 and len(near[0]["episodes"]) == 2
    # Merge gap 30 s, cửa sổ tương quan 0: tách thành hai incident.
    far = _incidents(
        _windows("xxx.." + "..." + "xxx.."), merge_gap_seconds=30, correlation_window_seconds=0
    )
    assert len(far) == 2


def test_correlation_window_alone_joins_a_resolved_incident():
    # course mở ở cửa sổ 2, hồi phục ở cửa sổ 4; media mở ở cửa sổ 12 (ngoài merge gap 0) nhưng
    # trong cửa sổ tương quan 300 s kể từ detected_at → cùng incident.
    (incident,) = _incidents(
        _windows("xxx..........", "course"),
        _windows("..........xxx", "media"),
        merge_gap_seconds=0,
        correlation_window_seconds=300,
    )
    assert incident["affected_services"] == ["course", "media"]
    assert incident["open_at_run_end"] is True
    split = _incidents(
        _windows("xxx..........", "course"),
        _windows("..........xxx", "media"),
        merge_gap_seconds=0,
        correlation_window_seconds=60,
    )
    assert len(split) == 2


def test_first_symptom_can_come_from_a_later_opened_episode():
    # media: chuỗi bắt đầu sớm hơn nhưng đạt persistence muộn hơn → first_symptom là media.
    (incident,) = _incidents(
        _windows("x_x_x_x....", "media"),
        _windows(".xxxx......", "course"),
        persistence_windows=4,
    )
    assert incident["episodes"][0]["service"] == "course"
    assert incident["first_symptom"]["service"] == "media"


def test_still_open_incident_absorbs_later_episodes():
    # course chưa hồi phục tới cuối run: incident còn mở, đợt của media về sau nhập vào nó; harness
    # sẽ tính FP (mở trước fault) + FN theo mục 17.2, lifecycle không tách theo mốc fault.
    (incident,) = _incidents(
        _windows("xxxxxxxxxxxxxxxxxxxx", "course"),
        _windows("............xxxx....", "media"),
        merge_gap_seconds=0,
        correlation_window_seconds=0,
    )
    assert incident["resolved_at"] is None
    assert incident["affected_services"] == ["course", "media"]


def test_incident_ids_and_output_are_deterministic_and_inf_scores_are_json_safe():
    first = _incidents(_windows("xxxi..", "media-worker"), _windows("xxx...", "course"))
    second = _incidents(_windows("xxx...", "course"), _windows("xxxi..", "media-worker"))
    assert first == second
    assert first[0]["incident_id"].startswith("inc-")
    assert first[0]["peak_score_infinite"] is True and first[0]["peak_score"] is None
    json.dumps(first, allow_nan=False)  # không có inf/NaN trong JSON
    other = correlate(
        [e for e in service_episodes(_windows("xxx...", "course"), _config(), STEP, DELAY)],
        _config(),
        "run-1",
        {**KEY, "persistence_windows": 4},
    )
    assert other[0]["incident_id"] != first[0]["incident_id"]
    # Hai ứng viên ngưỡng (cùng version config) không bao giờ trùng id.
    episodes = service_episodes(_windows("xxx...", "course"), _config(), STEP, DELAY)
    z3 = correlate(episodes, _config(), "run-1", {**KEY, "threshold": 3})
    z4 = correlate(episodes, _config(), "run-1", {**KEY, "threshold": 4})
    assert z3[0]["incident_id"] != z4[0]["incident_id"]


def test_config_validation():
    with pytest.raises(ValueError):
        _config(persistence_windows=0)
    with pytest.raises(ValueError):
        _config(merge_gap_seconds=-1)
    with pytest.raises(ValueError):
        _config(max_chain_gap_seconds=-1)


# --- Hết chuỗi feature → detector → incident ------------------------------------------------------


def test_cli_builds_incidents_from_detector_output_without_ground_truth(tmp_path, capsys):
    fault = _feature_dir(
        tmp_path, "pilot-fault", course_latency=lambda i: 2.0 if 25 <= i < 32 else 0.05
    )
    _train_and_apply(tmp_path, {"pilot-fault": fault})
    (fault.parent.parent / "ground-truth.json").write_text("{not json", encoding="utf-8")
    out = tmp_path / "out"
    detect(fault, RobustZ(threshold=4), out, config={"threshold": 4})
    config = Path(__file__).parents[1] / "configs" / "incident-dev-v1.json"
    anomalies = out / "anomalies-robust_z.parquet"
    # Đầu ra detector schema cũ (thiếu cột bằng chứng) bị từ chối thay vì ra 0 incident.
    manifest_path = anomalies.with_suffix(".json")
    original = manifest_path.read_text(encoding="utf-8")
    manifest_path.write_text(original.replace("anomaly-record.v2", "anomaly-record.v1"), "utf-8")
    with pytest.raises(ValueError, match="schema"):
        main(["incidents", str(anomalies), "--config", str(config)])
    manifest_path.write_text(original, "utf-8")
    # Đầu ra detector không có phiên bản config: không dùng được cho harness → từ chối.
    with pytest.raises(ValueError, match="detector_config_version"):
        main(["incidents", str(anomalies), "--config", str(config)])
    detect(
        fault,
        RobustZ(threshold=4),
        out,
        config={"threshold": 4, "detector_config_version": "d-test.v1"},
    )
    assert main(["incidents", str(anomalies), "--config", str(config)]) == 0
    capsys.readouterr()
    record = json.loads((out / "incidents-robust_z.json").read_text(encoding="utf-8"))
    assert record["schema"] == "incident-record.v1"
    assert record["window_seconds"] == 60 and record["persistence_windows"] == 5
    assert record["threshold"] == 4
    assert record["lineage"]["anomalies_sha256"] and record["lineage"]["baseline_sha256"]
    (incident,) = record["incidents"]
    assert incident["affected_services"] == ["course"]
    assert incident["first_symptom"]["signal"] == "service.latency_p95"
    # Cửa sổ 60 s đầu tiên chứa dữ liệu chậm kết thúc ở cửa sổ index 25; mở sau 5 cửa sổ vượt.
    t0 = datetime(2026, 11, 23, 9, 0, tzinfo=UTC)
    assert incident["detected_at"] == (
        t0 + timedelta(seconds=15 * 29 + 60 + 10)
    ).isoformat().replace("+00:00", "Z")
    assert main(["incidents", str(anomalies), "--config", str(config)]) == 0
    again = json.loads((out / "incidents-robust_z.json").read_text(encoding="utf-8"))
    assert again["incidents"] == record["incidents"]
