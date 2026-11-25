"""Lệnh `select-detectors` của `aiops-training` (task-06 tuần 16)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

COMMANDS = ("select-detectors",)
ACTIONS = ("setup", "step1", "step2a", "step2b", "freeze", "report", "all")


def register(sub: argparse._SubParsersAction) -> None:
    parser = sub.add_parser(
        "select-detectors",
        help="Chọn window/persistence, tham số incident và ngưỡng trên validation (mục 6.1.3)",
    )
    parser.add_argument("action", choices=ACTIONS, help="Bước cần chạy; all chạy hết theo thứ tự")
    parser.add_argument("--runs-dir", type=Path, help="Thư mục runs/ của runner (trừ report)")
    parser.add_argument(
        "--load-dir", type=Path, help="Thư mục load/ có data/plans (đoạn cao điểm healthy-spike)"
    )
    parser.add_argument(
        "--dataset", type=Path, help="Mặc định experiments/datasets/dataset-v0.json"
    )
    parser.add_argument("--out-dir", type=Path, help="Mặc định evaluations/validation-v1")
    parser.add_argument("--work-dir", type=Path, help="Mặc định artifacts/validation-v1")


def dispatch(args: argparse.Namespace) -> int:
    from .report import write_tables
    from .runner import Context, freeze, setup, step1, step2a, step2b

    if args.action != "report" and (args.runs_dir is None or args.load_dir is None):
        raise SystemExit("--runs-dir và --load-dir là bắt buộc khi chấm")
    ctx = Context(
        runs_dir=args.runs_dir or Path("."),
        load_dir=args.load_dir or Path("."),
        dataset_path=args.dataset,
        out_dir=args.out_dir,
        work_dir=args.work_dir,
    )
    steps = {
        "setup": lambda: setup(ctx),
        "step1": lambda: _brief(step1(ctx)),
        "step2a": lambda: _brief(step2a(ctx)),
        "step2b": lambda: {d: _brief(s) for d, s in step2b(ctx).items()},
        "freeze": lambda: freeze(ctx),
        "report": lambda: {"tables": str(write_tables(ctx))},
    }
    order = ["setup", "step1", "step2a", "step2b", "freeze", "report"]
    for action in order if args.action == "all" else [args.action]:
        print(json.dumps({action: steps[action]()}, ensure_ascii=False, default=str))
    return 0


def _brief(selection: dict) -> dict:
    return {k: selection[k] for k in ("selected", "meets_cap", "rule_applied", "tie_break")}
