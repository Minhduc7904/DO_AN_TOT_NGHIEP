"""Sinh lại mọi bảng của báo cáo chọn trên validation từ file đã commit (`tables.md`).

Chỉ đọc `out_dir` (ledger, lựa chọn, evaluation artifact, incident record của E1); không chấm lại.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .runner import E1_DETECTORS, STEP2B_DETECTORS, Context

CASES = ("C2", "C3", "C4", "C6")
DETECTOR_NAMES = {
    "static": "Ngưỡng tĩnh",
    "robust_z": "Robust z",
    "iforest": "Isolation Forest",
    "fused": "Điểm hợp nhất",
}


def fmt(value: Any, digits: int = 2) -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "có" if value else "không"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if value.is_integer() and digits <= 2:
            return str(int(value))
        return f"{value:.{digits}f}".replace(".", ",")
    return str(value)


def _read(path: Path) -> Any:
    return json.loads(path.read_text("utf-8"))


def _table(header: list[str], rows: list[list[Any]]) -> list[str]:
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    lines += [
        "| " + " | ".join(fmt(c) if not isinstance(c, str) else c for c in r) + " |" for r in rows
    ]
    return lines


def ranking_table(ctx: Context, step: str) -> list[str]:
    selection = _read(ctx.out_dir / f"selection-step{step}.json")
    tie = selection["tie_break"] == "tie_rank_asc"
    header = ["Hạng", "Tổ hợp", "W (s)", "P", "Ngưỡng", "late_tolerance (s)", "Fault khớp"]
    header += ["Báo động giả", "Giờ", "BĐG/giờ", "Đạt ≤ 1/giờ"] + (["tie_rank"] if tie else [])
    fault_runs = {
        cid: _read(ctx.path(rel))["summary"]["pooled"]["n_fault_runs"]
        for cid, rel in selection["artifacts"].items()
    }
    rows = []
    for r in selection["ranking"]:
        row = [
            r["rank"],
            f"`{r['combination_id']}`" + (" **(chọn)**" if r["rank"] == 1 else ""),
            r["window_seconds"],
            r["persistence_windows"],
            fmt(r["threshold"], 3) if r["threshold"] is not None else "—",
            r["late_tolerance_seconds"],
            f"{r['matched_fault_runs']}/{fault_runs[r['combination_id']]}",
            r["false_alarms"],
            fmt(r["false_alarm_hours"]),
            fmt(r["false_alarms_per_hour"]),
            r["meets_cap"],
        ]
        rows.append(row + ([r["tie_rank"]] if tie else []))
    note = (
        f"Luật: {selection['rule_applied']}; hòa cuối theo {selection['tie_break']}; "
        f"tổ hợp chọn `{selection['selected']}`, đạt điều kiện: {fmt(selection['meets_cap'])}."
    )
    return _table(header, rows) + ["", note]


def _healthy(summary: dict[str, Any], profile: str) -> str:
    data = summary["healthy"]["by_profile"].get(profile)
    if not data:
        return "—"
    return (
        f"{data['fp_incidents']} / {fmt(data['hours'])} giờ; FPR {data['n_runs_with_fp']}/"
        f"{data['n_runs']}"
    )


def _peak(summary: dict[str, Any]) -> str:
    data = summary["peak"].get("healthy-spike")
    if not data:
        return "—"
    return f"{data['false_alarms']} / {fmt(data['hours'], 3)} giờ"


def _delay(summary: dict[str, Any], case: str) -> str:
    data = summary["detection_delay"]["by_case"].get(case)
    if not data:
        return "—"
    if not data["values_seconds"]:
        return "FN"
    return " ; ".join(fmt(v, 0) for v in data["values_seconds"])


def e1_table(ctx: Context) -> list[str]:
    header = ["Chỉ số"] + [DETECTOR_NAMES[d] for d in E1_DETECTORS]
    artifacts = {d: _read(ctx.training_root / _e1_artifact(ctx, d)) for d in E1_DETECTORS}
    selections = {d: _selection_for(ctx, d) for d in E1_DETECTORS}

    def row(label, func):
        return [label] + [func(d, artifacts[d]["summary"], artifacts[d]) for d in E1_DETECTORS]

    rows = [
        row("Tổ hợp", lambda d, s, a: f"`{selections[d]['selected']}`"),
        row(
            "Ngưỡng",
            lambda d, s, a: fmt(a["threshold"], 3) if a["threshold"] is not None else "bộ ngưỡng",
        ),
        row("Đạt ≤ 1 BĐG/giờ", lambda d, s, a: fmt(selections[d]["meets_cap"])),
        row(
            "Fault run khớp",
            lambda d, s, a: f"{s['matched_fault_runs']}/{s['pooled']['n_fault_runs']}",
        ),
        row("TP / FP / FN (gộp)", lambda d, s, a: "{tp} / {fp} / {fn}".format(**s["pooled"])),
        row(
            "Precision / Recall / F1",
            lambda d, s, a: " / ".join(fmt(s["pooled"][k]) for k in ("precision", "recall", "f1")),
        ),
        row(
            "Báo động giả (số / giờ)",
            lambda d, s, a: (
                f"{s['false_alarm_rate']['false_alarms']} / {fmt(s['false_alarm_rate']['hours'])}"
            ),
        ),
        row("BĐG/giờ", lambda d, s, a: fmt(s["false_alarm_rate"]["per_hour"])),
        row("Run khỏe `normal-mixed`: FP / giờ; FPR", lambda d, s, a: _healthy(s, "normal-mixed")),
        row(
            "Run khỏe `healthy-spike`: FP / giờ; FPR", lambda d, s, a: _healthy(s, "healthy-spike")
        ),
        row("Đoạn cao điểm 600 s: BĐG / giờ", lambda d, s, a: _peak(s)),
        *(
            row(
                f"Delay {case} (s)" + (" — trùng cao điểm" if case == "C2" else ""),
                lambda d, s, a, case=case: _delay(s, case),
            )
            for case in CASES
        ),
        row("Incident trong khoảng đánh giá", lambda d, s, a: s["pooled"]["n_incidents"]),
    ]
    return _table(header, rows)


def _selection_for(ctx: Context, detector: str) -> dict[str, Any]:
    step = "2a" if detector == "robust_z" else f"2b-{detector}"
    return _read(ctx.out_dir / f"selection-step{step}.json")


def _e1_artifact(ctx: Context, detector: str) -> str:
    selection = _selection_for(ctx, detector)
    return selection["artifacts"][selection["selected"]]


def error_rows(ctx: Context) -> list[dict[str, Any]]:
    """Mọi FP và FN của 4 detector E1 trên validation, kèm thông tin incident để phân tích."""
    rows = []
    for detector in E1_DETECTORS:
        artifact = _read(ctx.training_root / _e1_artifact(ctx, detector))
        for run in artifact["runs"]:
            if run["inclusion_status"] != "eligible":
                continue
            record = _read(ctx.out_dir / "e1" / "incidents" / detector / f"{run['run_id']}.json")
            details = {i["incident_id"]: i for i in record["incidents"]}
            for incident in run["incidents"]:
                if incident["label"] in ("tp", "outside_evaluation_interval"):
                    continue
                info = details[incident["incident_id"]]
                first = info["first_symptom"]
                rows.append(
                    {
                        "detector": detector,
                        "kind": "FP",
                        "run_id": run["run_id"],
                        "case": run["case_id"],
                        "profile": run["profile"],
                        "label": incident["label"],
                        "incident_id": incident["incident_id"],
                        "detected_at": incident["detected_at"],
                        "estimated_start_time": info["estimated_start_time"],
                        "service": first["service"],
                        "evidence_key": first["evidence_key"],
                        "first_window_start": first["window_start"],
                        "affected_services": info["affected_services"],
                        "peak_score": info["peak_score"],
                        "open_at_run_end": info["open_at_run_end"],
                        "fault_start": run.get("fault_start"),
                        "fault_end": run.get("fault_end"),
                    }
                )
            if run["case_id"] and run.get("fn"):
                rows.append(
                    {
                        "detector": detector,
                        "kind": "FN",
                        "run_id": run["run_id"],
                        "case": run["case_id"],
                        "profile": run["profile"],
                        "fault_start": run["fault_start"],
                        "fault_end": run["fault_end"],
                        "matching_interval_end": run["matching_interval_end"],
                        "incidents_in_run": [
                            {
                                "detected_at": i["detected_at"],
                                "label": i["label"],
                                "service": details_of(ctx, detector, run["run_id"], i),
                            }
                            for i in run["incidents"]
                        ],
                    }
                )
    return rows


def details_of(ctx: Context, detector: str, run_id: str, incident: dict[str, Any]) -> str:
    record = _read(ctx.out_dir / "e1" / "incidents" / detector / f"{run_id}.json")
    for item in record["incidents"]:
        if item["incident_id"] == incident["incident_id"]:
            return f"{item['first_symptom']['service']} ({item['first_symptom']['evidence_key']})"
    return "—"


def _hhmmss(iso: str | None) -> str:
    return iso[11:19] if iso else "—"


def error_table(ctx: Context) -> list[str]:
    rows = []
    for e in error_rows(ctx):
        run = e["case"] or e["profile"]
        if e["kind"] == "FP":
            rows.append(
                [
                    DETECTOR_NAMES[e["detector"]],
                    "FP",
                    f"{run} (`{e['label']}`)",
                    _hhmmss(e["detected_at"]),
                    f"{e['service']}: `{e['evidence_key']}`",
                    ", ".join(e["affected_services"]),
                    fmt(e["peak_score"], 3),
                    (
                        f"fault {_hhmmss(e['fault_start'])}–{_hhmmss(e['fault_end'])}"
                        if e["fault_start"]
                        else "run khỏe"
                    )
                    + ("; còn mở cuối run" if e["open_at_run_end"] else ""),
                ]
            )
        else:
            near = (
                "; ".join(
                    f"{_hhmmss(i['detected_at'])} {i['label']} {i['service']}"
                    for i in e["incidents_in_run"]
                )
                or "không có incident"
            )
            rows.append(
                [
                    DETECTOR_NAMES[e["detector"]],
                    "FN",
                    run,
                    "—",
                    "—",
                    "—",
                    "—",
                    f"fault {_hhmmss(e['fault_start'])}–{_hhmmss(e['fault_end'])}, ghép tới "
                    f"{_hhmmss(e['matching_interval_end'])}; incident trong run: {near}",
                ]
            )
    header = ["Detector", "Loại", "Run", "detected_at (UTC)", "Triệu chứng đầu", "Service"]
    header += ["Điểm đỉnh", "Ghi chú"]
    return _table(header, rows)


def train_threshold_table(ctx: Context) -> list[str]:
    window = _read(ctx.out_dir / "selection-step1.json")["chosen"]["window_seconds"]
    data = _read(ctx.out_dir / f"train-thresholds-w{window}.json")
    rows = [[f"`{key}`", fmt(value, 4)] for key, value in sorted(data["thresholds"].items())]
    counts = ", ".join(f"{k}: {v['n_values']} điểm" for k, v in data["scores"].items())
    note = (
        f"Cửa sổ {window} s; {counts}"
        f"; baseline `{data['baseline_sha256'][:12]}`, model `{data['model_sha256'][:12]}`."
    )
    return _table(["Điểm@phân vị", "Ngưỡng"], rows) + ["", note]


def ledger_summary(ctx: Context) -> list[str]:
    entries = ctx.ledger.entries()
    scores = [e for e in entries if e["event"] == "score"]
    commits = sorted({e["code_commit"] for e in scores})
    first = scores[0] if scores else None
    lines = [
        f"- Số dòng ledger: {len(entries)}; lần chấm: {len(scores)}; dùng lại: "
        f"{sum(1 for e in entries if e['event'] == 'reuse')}; lựa chọn: "
        f"{sum(1 for e in entries if e['event'] == 'select')}.",
        f"- Commit của các lần chấm: {', '.join(f'`{c[:7]}`' for c in commits)} (đều chứa merge "
        "commit `f57c322` của PR #103).",
    ]
    if first:
        lines.append(f"- Lần chấm đầu: {first['recorded_at']} (`{first['combination_id']}`).")
    return lines


def build_tables(ctx: Context) -> str:
    parts = ["# Bảng chọn cấu hình phát hiện trên validation (sinh tự động)", ""]
    parts += ["Sinh bằng `uv run aiops-training select-detectors report`; không sửa tay.", ""]
    parts += ["## Ledger", "", *ledger_summary(ctx), ""]
    parts += ["## Bước 1: 12 tổ hợp robust z", "", *ranking_table(ctx, "1"), ""]
    parts += ["## Bước 2a: tham số incident", "", *ranking_table(ctx, "2a"), ""]
    parts += ["## Ngưỡng phân vị trên train", "", *train_threshold_table(ctx), ""]
    for detector in STEP2B_DETECTORS:
        parts += [
            f"## Bước 2b: {DETECTOR_NAMES[detector]}",
            "",
            *ranking_table(ctx, f"2b-{detector}"),
            "",
        ]
    parts += ["## E1 sơ bộ trên validation", "", *e1_table(ctx), ""]
    parts += ["## FP và FN của E1", "", *error_table(ctx), ""]
    return "\n".join(parts)


def write_tables(ctx: Context) -> Path:
    path = ctx.out_dir / "tables.md"
    path.write_text(build_tables(ctx), encoding="utf-8")
    return path
