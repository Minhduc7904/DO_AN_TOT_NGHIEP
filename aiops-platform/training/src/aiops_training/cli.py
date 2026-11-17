"""CLI của gói `aiops-training`.

uv run aiops-training export --k6-summary ../load/results/<run_id>/k6-summary.json
uv run aiops-training export --run-id r1 --start 2026-11-17T09:43:00Z --end 2026-11-17T09:45:40Z
uv run aiops-training quality artifacts/<run_id>
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

from .telemetry.adapters.loki import LokiAdapter
from .telemetry.adapters.prometheus import PrometheusAdapter
from .telemetry.adapters.tempo import TempoAdapter, TempoExportOptions
from .telemetry.export import ExportOptions, Sources, export_run
from .telemetry.validation.quality import QualityConfig, evaluate, summary_table
from .telemetry.window import ExportWindow, parse_utc


def _export_parser(sub: argparse._SubParsersAction) -> None:
    parser = sub.add_parser("export", help="Export telemetry của một run ra Parquet + manifest")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--k6-summary", type=Path, help="k6-summary.json của run (lấy cửa sổ)")
    source.add_argument("--run-id", help="run_id khi tự khai báo cửa sổ (cần --start, --end)")
    parser.add_argument("--start", help="Thời điểm bắt đầu ISO-8601 có múi giờ")
    parser.add_argument("--end", help="Thời điểm kết thúc ISO-8601 có múi giờ")
    parser.add_argument(
        "--grace-seconds",
        type=int,
        default=30,
        help="Cộng vào cuối cửa sổ khi đọc từ k6 summary (telemetry tới trễ)",
    )
    parser.add_argument("--out", type=Path, default=Path("artifacts"), help="Thư mục kết quả")
    parser.add_argument("--prometheus-url", default="http://127.0.0.1:9090")
    parser.add_argument("--tempo-url", default="http://127.0.0.1:3200")
    parser.add_argument("--loki-url", default="http://127.0.0.1:3100")
    parser.add_argument("--step-seconds", type=int, default=5)
    parser.add_argument("--max-traces", type=int, default=20_000)
    parser.add_argument("--trace-delay-ms", type=int, default=20)
    parser.add_argument("--include-noise-traces", action="store_true")
    parser.add_argument("--include-probe-logs", action="store_true")
    parser.add_argument("--timeout-seconds", type=float, default=15.0)


def _window(args: argparse.Namespace) -> ExportWindow:
    if args.k6_summary:
        return ExportWindow.from_k6_summary(args.k6_summary, grace_seconds=args.grace_seconds)
    if not args.start or not args.end:
        raise SystemExit("--run-id cần kèm --start và --end")
    return ExportWindow(args.run_id, parse_utc(args.start), parse_utc(args.end))


def _run_export(args: argparse.Namespace) -> int:
    window = _window(args)
    with httpx.Client(timeout=args.timeout_seconds) as client:
        sources = Sources(
            prometheus=PrometheusAdapter(client, args.prometheus_url),
            tempo=TempoAdapter(client, args.tempo_url),
            loki=LokiAdapter(client, args.loki_url),
            urls={
                "prometheus": args.prometheus_url,
                "tempo": args.tempo_url,
                "loki": args.loki_url,
            },
        )
        options = ExportOptions(
            step_seconds=args.step_seconds,
            exclude_probe_logs=not args.include_probe_logs,
            tempo=TempoExportOptions(
                max_traces=args.max_traces,
                fetch_delay_ms=args.trace_delay_ms,
                include_noise=args.include_noise_traces,
            ),
        )
        manifest = export_run(window, args.out, sources, options)
    summary = {
        "run_id": manifest["run_id"],
        "out": str(args.out / manifest["run_id"]),
        "modality_availability": manifest["modality_availability"],
        "record_count": manifest["record_count"],
        "errors": manifest["errors"],
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 1 if manifest["errors"] else 0


def _quality_parser(sub: argparse._SubParsersAction) -> None:
    parser = sub.add_parser("quality", help="Kiểm chất lượng artifact export của một run")
    parser.add_argument("artifact_dir", type=Path, help="Thư mục artifact (có manifest.json)")
    parser.add_argument("--silent-threshold-seconds", type=float, default=30.0)


def _run_quality(args: argparse.Namespace) -> int:
    report = evaluate(
        args.artifact_dir, QualityConfig(silent_threshold_s=args.silent_threshold_seconds)
    )
    path = args.artifact_dir / "quality-report.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(summary_table(report))
    print(f"\nĐã ghi {path}")
    return 1 if report["overall_status"] == "fail" else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="aiops-training")
    sub = parser.add_subparsers(dest="command", required=True)
    _export_parser(sub)
    _quality_parser(sub)
    args = parser.parse_args(argv)
    if args.command == "export":
        return _run_export(args)
    if args.command == "quality":
        return _run_quality(args)
    parser.error(f"Lệnh không hỗ trợ: {args.command}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
