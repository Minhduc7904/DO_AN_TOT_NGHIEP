"""Lệnh `incidents` của `aiops-training`."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .run import build_incidents, load_config, write_incidents

COMMANDS = ("incidents",)


def register(sub: argparse._SubParsersAction) -> None:
    parser = sub.add_parser(
        "incidents", help="Gom cửa sổ bất thường của một detector thành incident (incidents.json)"
    )
    parser.add_argument("anomalies", type=Path, help="anomalies-<detector>.parquet của detect")
    parser.add_argument("--config", type=Path, required=True, help="Incident config (JSON)")
    parser.add_argument("--out", type=Path, help="Mặc định incidents-<detector>.json cạnh đầu vào")


def dispatch(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    record = build_incidents(args.anomalies, config, args.config)
    out = args.out or args.anomalies.with_name(f"incidents-{record['detector']}.json")
    write_incidents(record, out)
    print(
        json.dumps(
            {"run_id": record["run_id"], "detector": record["detector"], **record["counts"]},
            ensure_ascii=False,
        )
    )
    return 0
