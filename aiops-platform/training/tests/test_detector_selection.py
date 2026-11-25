"""Task-06 tuần 16: tổ hợp ứng viên, ràng buộc artifact với ứng viên, ledger và luật phân vị."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
import pytest

from aiops_training.evaluation.detection.config import TRAINING_ROOT
from aiops_training.evaluation.detector_selection import ledger as ledger_module
from aiops_training.evaluation.detector_selection.candidates import (
    incident_identity_sha256,
    quantile_key,
    serialize,
    sha256_bytes,
    step1_combinations,
    step1_id,
    step2a_combinations,
    step2b_combinations,
    write_config,
)
from aiops_training.evaluation.detector_selection.ledger import Ledger, LedgerError, scoring_code
from aiops_training.evaluation.detector_selection.runner import (
    SelectionError,
    check_binding,
    quantile_values,
)
from aiops_training.incident.run import load_config

V1 = json.loads((TRAINING_ROOT / "configs" / "detection-candidates-v1.json").read_text("utf-8"))
V2 = json.loads((TRAINING_ROOT / "configs" / "detection-candidates-v2.json").read_text("utf-8"))


def _thresholds() -> dict[str, float]:
    keys = [quantile_key("iforest", q) for q in (0.99, 0.995, 0.999)]
    keys += [quantile_key(f"fused-{w}", q) for w in ("equal", "w442") for q in (0.99, 0.995, 0.999)]
    return {key: 0.5 + i / 100 for i, key in enumerate(keys)}


# --- tổ hợp ------------------------------------------------------------------------------------


def test_step1_is_the_declared_grid_with_step1_incident_values():
    combos = step1_combinations(V1, V2)
    assert len(combos) == V2["combinations"]["step1"] == 12
    assert len({c.combination_id for c in combos}) == 12
    pairs = {(c.window_seconds, c.persistence_windows) for c in combos}
    assert pairs == {(30, 3), (30, 4), (60, 5), (60, 6)}
    for combo in combos:
        assert combo.detector == "robust_z"
        assert combo.detector_section["threshold"] in (3, 4, 5)
        assert combo.incident == {
            "persistence_windows": combo.persistence_windows,
            # Luật cố định của v2: W / 15 + 1.
            "recovery_windows": combo.window_seconds // 15 + 1,
            "merge_gap_seconds": 120,
            "correlation_window_seconds": 300,
            "max_chain_gap_seconds": 120,
        }
    # Các tổ hợp chỉ khác persistence dùng chung một config detector (một lần detect).
    by_version = {c.detector_config_version for c in combos}
    assert by_version == {f"validation-v1.robust_z-z{z}" for z in (3, 4, 5)}


def test_step2a_has_declared_tie_ranks_and_one_combination_equal_to_step1():
    combos = step2a_combinations(V2, 60, 5, 4)
    assert [c.combination_id for c in combos] == [
        "merge300-chain120",
        "merge300-chain300",
        "merge120-chain120",
        "merge120-chain300",
    ]
    assert [c.tie_rank for c in combos] == [1, 2, 3, 4]
    step1 = next(c for c in step1_combinations(V1, V2) if c.combination_id == step1_id(60, 5, 4))
    same = [c for c in combos if c.incident == step1.incident]
    assert [c.combination_id for c in same] == ["merge120-chain120"]
    # Cùng phiên bản và nội dung config: artifact bước 1 dùng lại được nguyên vẹn (v2 `reuse`).
    assert same[0].incident_config(V2["candidate_set_version"]) == step1.incident_config(
        V2["candidate_set_version"]
    )
    assert same[0].detector_config("v2") == step1.detector_config("v2")


def test_step2b_uses_declared_candidates_and_train_quantile_thresholds():
    incident = step2a_combinations(V2, 60, 5, 4)[0].incident
    groups = step2b_combinations(V2, 60, 5, incident, _thresholds())
    assert {k: len(v) for k, v in groups.items()} == {"static": 3, "iforest": 3, "fused": 6}
    total = 12 + 4 + sum(len(v) for v in groups.values())
    assert total == V2["combinations"]["total"] == 28
    for combos in groups.values():
        assert [c.tie_rank for c in combos] == list(range(1, len(combos) + 1))
        assert all(c.incident == incident and c.window_seconds == 60 for c in combos)
    iforest = groups["iforest"][0]
    assert iforest.combination_id == "iforest-q0.999"
    assert iforest.detector_section["threshold"] == _thresholds()["iforest@0.999"]
    assert iforest.detector_section["hyperparameters"] == {
        "n_estimators": 200,
        "max_samples": 256,
        "max_features": 1.0,
        "bootstrap": False,
    }
    assert iforest.detector_section["seed"] == 20260819
    fused = groups["fused"][1]
    assert fused.combination_id == "fused-w442-q0.999"
    assert fused.detector_section["weights"] == {"metrics": 0.4, "traces": 0.4, "logs": 0.2}
    assert fused.detector_section["threshold"] == _thresholds()["fused-w442@0.999"]
    # Phiên bản config detector khác nhau cho mọi tổ hợp bước 2b.
    versions = [c.detector_config_version for cs in groups.values() for c in cs]
    assert len(set(versions)) == len(versions)


def test_step2b_without_a_train_threshold_fails():
    incident = step2a_combinations(V2, 60, 5, 4)[0].incident
    thresholds = _thresholds()
    del thresholds["fused-equal@0.995"]
    with pytest.raises(KeyError):
        step2b_combinations(V2, 60, 5, incident, thresholds)


# --- ràng buộc artifact ↔ ứng viên --------------------------------------------------------------


def test_config_files_are_deterministic_and_refuse_different_content(tmp_path):
    combo = step1_combinations(V1, V2)[0]
    doc = combo.detector_config("detection-candidates.v2")
    path = tmp_path / "d.json"
    sha = write_config(doc, path)
    assert sha == sha256_bytes(serialize(doc)) == write_config(doc, path)
    with pytest.raises(ValueError, match="nội dung khác"):
        write_config({**doc, "detectors": {"robust_z": {"threshold": 9}}}, path)


def test_incident_identity_sha_matches_what_incident_run_records(tmp_path):
    combo = step1_combinations(V1, V2)[0]
    path = tmp_path / "i.json"
    write_config(combo.incident_config("detection-candidates.v2"), path)
    config = load_config(path)
    assert config.recovery_windows == 3 and config.max_chain_gap_seconds == 120.0
    # Cùng công thức với incident/run.py: sha256(json.dumps(asdict(config), sort_keys=True)).
    from dataclasses import asdict

    expected = sha256_bytes(json.dumps(asdict(config), sort_keys=True).encode("utf-8"))
    assert incident_identity_sha256(path) == expected


def _artifact(combo, detector_sha, incident_sha, **overrides):
    artifact = {
        "detector": combo.detector,
        "detector_config_version": combo.detector_config_version,
        "incident_config_version": combo.incident_config_version,
        "detector_config_sha256": detector_sha,
        "incident_config_sha256": incident_sha,
        "model_sha256": None,
        "window_seconds": combo.window_seconds,
        "persistence_windows": combo.persistence_windows,
        "threshold": float(combo.detector_section["threshold"]),
    }
    return {**artifact, **overrides}


def test_binding_accepts_the_generated_combination_and_rejects_any_drift():
    combo = step1_combinations(V1, V2)[0]
    check_binding(_artifact(combo, "d", "i"), combo, "d", "i", None)
    for field, value in [
        ("detector_config_sha256", "other"),
        ("incident_config_sha256", "other"),
        ("threshold", 99.0),
        ("persistence_windows", 9),
        ("model_sha256", "m"),
    ]:
        with pytest.raises(SelectionError, match="không khớp ứng viên"):
            check_binding(_artifact(combo, "d", "i", **{field: value}), combo, "d", "i", None)


# --- luật phân vị ------------------------------------------------------------------------------


def _row(score, warmup=False, reason="below_threshold", flagged=False):
    return {"score": score, "warmup": warmup, "reason": reason, "flagged": flagged}


def test_quantile_values_drop_warmup_silent_null_flag_and_null_score():
    rows = [
        _row(1.0),
        _row(2.0, flagged=True, reason="threshold"),
        _row(50.0, warmup=True),
        _row(60.0, reason="telemetry_silent", flagged=True),
        _row(None, flagged=None, reason="no_data"),
        _row(70.0, flagged=None),
        _row(None),
    ]
    values = quantile_values(rows)
    assert sorted(values.tolist()) == [1.0, 2.0]
    assert np.quantile(values, 0.5, method="linear") == 1.5


def test_quantile_values_refuse_infinite_or_empty_scores():
    with pytest.raises(SelectionError, match="vô hạn"):
        quantile_values([_row(1.0), _row(float("inf"))])
    with pytest.raises(SelectionError, match="Không có điểm"):
        quantile_values([_row(1.0, warmup=True)])


# --- ledger -----------------------------------------------------------------------------------


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


@pytest.fixture
def repo(tmp_path):
    repo = tmp_path / "repo"
    (repo / "src").mkdir(parents=True)
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "t@example.com")
    _git(repo, "config", "user.name", "t")
    (repo / "src" / "a.py").write_text("a = 1\n")
    (repo / "configs").mkdir()
    (repo / "configs" / "c.json").write_text("{}\n")
    for name in ("pyproject.toml", "uv.lock"):
        (repo / name).write_text("x\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "base")
    return repo


def test_scoring_requires_the_candidates_v2_merge_commit_and_clean_code(repo):
    required = _git(repo, "rev-parse", "HEAD")
    (repo / "src" / "b.py").write_text("b = 1\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "after")
    assert scoring_code(repo, required)["contains_candidates_v2_merge"] == required
    # Nhánh không chứa commit khai báo: từ chối.
    _git(repo, "checkout", "-q", "--orphan", "other")
    _git(repo, "commit", "-qm", "orphan")
    with pytest.raises(LedgerError, match="không chứa merge commit"):
        scoring_code(repo, required)
    _git(repo, "checkout", "-q", "master" if "master" in _git(repo, "branch") else "main")
    (repo / "src" / "a.py").write_text("a = 2\n")
    with pytest.raises(LedgerError, match="chưa commit"):
        scoring_code(repo, required)


def test_default_required_commit_is_the_pr103_merge():
    assert ledger_module.CANDIDATES_V2_MERGE_COMMIT.startswith("f57c322")


def test_ledger_appends_numbered_entries_and_finds_them(tmp_path):
    ledger = Ledger(tmp_path / "ledger.jsonl")
    ledger.append("setup", code={"commit": "x"})
    ledger.append("score", step="1", combination_id="w30-p3-z3")
    ledger.append("score", step="1", combination_id="w30-p3-z4")
    assert [e["seq"] for e in ledger.entries()] == [1, 2, 3]
    assert len(ledger.find("score", step="1")) == 2
    assert ledger.find("score", combination_id="w30-p3-z4")[0]["seq"] == 3
    assert ledger.find("select") == []


# --- runner: kiểm đầu vào, đọc lại sau dừng giữa chừng --------------------------------------------


@pytest.fixture
def ctx(tmp_path, monkeypatch):
    from aiops_training.evaluation.detector_selection.runner import Context

    context = Context(
        runs_dir=tmp_path / "runs", load_dir=tmp_path / "load", out_dir=tmp_path / "out"
    )
    # Không gọi git trong test: commit giả chứa merge commit của PR #103.
    monkeypatch.setattr(
        Context, "code", lambda self: {"commit": "c1", "dirty": False, "code_tree": "src=t1"}
    )
    return context


def test_reproduction_run_freezes_into_its_own_directory(ctx, tmp_path):
    from aiops_training.evaluation.detector_selection.runner import Context

    assert ctx.freeze_dir == tmp_path / "out" / "frozen"
    assert ctx.models_dir == tmp_path / "out" / "models-bin"
    default = Context(runs_dir=tmp_path, load_dir=tmp_path)
    assert default.freeze_dir == TRAINING_ROOT / "configs"
    assert default.models_dir == TRAINING_ROOT / "models"
    assert default.out_dir == TRAINING_ROOT / "evaluations" / "validation-v1"


def test_inputs_changed_after_setup_are_refused(ctx):
    from aiops_training.evaluation.detector_selection.runner import _require_setup, input_hashes

    with pytest.raises(SelectionError, match="Chưa chạy setup"):
        _require_setup(ctx)
    inputs = input_hashes(ctx)
    ctx.ledger.append("setup", **inputs)
    assert _require_setup(ctx)["candidates_v2"] == inputs["candidates_v2"]
    other = Ledger(ctx.out_dir / "other.jsonl")
    other.append("setup", **{**inputs, "baselines": {"60": {"path": "x", "sha256": "y"}}})
    ctx.ledger = other
    with pytest.raises(SelectionError, match="Đầu vào đã đổi"):
        _require_setup(ctx)


def test_selection_is_read_back_only_when_its_sha_matches_the_ledger(ctx):
    from aiops_training.evaluation.detector_selection.runner import _existing_selection

    assert _existing_selection(ctx, "1") is None
    path = ctx.out_dir / "selection-step1.json"
    path.parent.mkdir(parents=True)
    path.write_text('{"selected": "w60-p5-z4"}\n')
    with pytest.raises(LedgerError, match="không có dòng select"):
        _existing_selection(ctx, "1")
    ctx.ledger.append(
        "select", step="1", file=ctx.rel(path), sha256=sha256_bytes(path.read_bytes())
    )
    assert _existing_selection(ctx, "1") == {"selected": "w60-p5-z4"}
    path.write_text('{"selected": "w30-p3-z3"}\n')
    with pytest.raises(LedgerError, match="khác sha256"):
        _existing_selection(ctx, "1")


def test_score_reads_back_a_recorded_combination_and_never_rescored(ctx):
    from aiops_training.evaluation.detector_selection.runner import score

    combo = step1_combinations(V1, V2)[0]
    path = ctx.out_dir / "step1" / f"{combo.combination_id}.json"
    path.parent.mkdir(parents=True)
    path.write_text('{"threshold": 3.0}\n')
    # Artifact có sẵn mà ledger không có dòng score: không ghi đè, không chấm.
    with pytest.raises(LedgerError, match="không có dòng score"):
        score(ctx, combo)
    ctx.ledger.append(
        "score",
        step="1",
        combination_id=combo.combination_id,
        artifact=ctx.rel(path),
        artifact_sha256=sha256_bytes(path.read_bytes()),
        code_commit="c1",
    )
    assert score(ctx, combo) == {"threshold": 3.0}
    path.write_text('{"threshold": 4.0}\n')
    with pytest.raises(LedgerError, match="khác sha256"):
        score(ctx, combo)


def test_score_refuses_code_different_from_setup(ctx):
    from aiops_training.evaluation.detector_selection.runner import input_hashes, score

    # Code của lượt chọn ghi ở setup; commit chỉ đổi evaluations/ giữ nguyên tree nên vẫn chấm
    # tiếp được, còn đổi code (kể cả giữa bước 1 và 2a) thì từ chối.
    ctx.ledger.append("setup", code={"code_tree": "src=t0"}, **input_hashes(ctx))
    with pytest.raises(LedgerError, match="Code đã đổi so với lúc setup"):
        score(ctx, step1_combinations(V1, V2)[0])


def test_code_tree_identifies_code_paths_not_the_commit(repo):
    from aiops_training.evaluation.detector_selection.ledger import code_tree

    before = code_tree(repo)
    (repo / "evaluations").mkdir()
    (repo / "evaluations" / "ledger.jsonl").write_text("{}\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "ledger")
    assert code_tree(repo) == before
    (repo / "src" / "a.py").write_text("a = 3\n")
    _git(repo, "commit", "-qam", "code change")
    assert code_tree(repo) != before
