"""CLI của gói `aiops-training`.

uv run aiops-training export --k6-summary ../load/results/<run_id>/k6-summary.json
uv run aiops-training export --run-id r1 --start 2026-11-17T09:43:00Z --end 2026-11-17T09:45:40Z
uv run aiops-training quality artifacts/<run_id>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import httpx

from .features.baseline import apply_baseline, fit_baseline
from .features.leakage import check_leakage
from .features.pipeline import write_features
from .ground_truth.build import build_ground_truth, read_jsonl
from .ground_truth.symptoms import SymptomConfig, measure_from_ground_truth, measure_symptoms
from .ground_truth.validate import apply_verification, verify
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
    parser.add_argument("--max-traces", type=int, default=TempoExportOptions.max_traces)
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


def _features_parser(sub: argparse._SubParsersAction) -> None:
    parser = sub.add_parser("features", help="Sinh đặc trưng theo cửa sổ (feature pipeline v1)")
    parser.add_argument("artifact_dir", type=Path, help="Thư mục artifact (có manifest.json)")
    parser.add_argument("--out", type=Path, help="Mặc định <artifact_dir>/features")


def _run_features(args: argparse.Namespace) -> int:
    meta = write_features(args.artifact_dir, args.out)
    keys = (
        "run_id",
        "feature_config_version",
        "noise_filter_version",
        "windows",
        "service_rows",
        "edge_rows",
        "queue_rows",
        "silent_windows",
    )
    print(json.dumps({key: meta[key] for key in keys}, ensure_ascii=False))
    return 0


def _ground_truth_parser(sub: argparse._SubParsersAction) -> None:
    parser = sub.add_parser(
        "ground-truth", help="Dựng RunGroundTruth của một run và kiểm chứng với telemetry"
    )
    parser.add_argument("--k6-summary", type=Path, required=True, help="k6-summary.json của run")
    parser.add_argument("--run-id", help="Mặc định lấy từ k6-summary.json")
    parser.add_argument("--scenario-id", help="Mặc định: case (fault run) hoặc 'healthy'")
    parser.add_argument("--repeat-index", type=int, default=0)
    parser.add_argument("--case", help="C2 | C3 | C4 | C6; bỏ trống là run healthy")
    parser.add_argument("--fault-log", type=Path, help="faults.jsonl của fault-schedule.mjs")
    parser.add_argument("--fault-manifest", type=Path, help="fault-manifest-v2.json")
    parser.add_argument("--artifact", type=Path, help="Thư mục artifact export để kiểm chứng")
    parser.add_argument("--code-commit")
    parser.add_argument("--environment-profile", default="compose-full+faults")
    parser.add_argument("--out", type=Path, required=True, help="Đường dẫn ghi ground-truth.json")


def _run_ground_truth(args: argparse.Namespace) -> int:
    workload = json.loads(args.k6_summary.read_text(encoding="utf-8"))
    manifest = (
        json.loads(args.fault_manifest.read_text(encoding="utf-8")) if args.fault_manifest else None
    )
    record = build_ground_truth(
        run_id=args.run_id or workload["run_id"],
        scenario_id=args.scenario_id or (args.case or "healthy"),
        repeat_index=args.repeat_index,
        workload=workload,
        fault_manifest=manifest,
        case_id=args.case,
        fault_records=read_jsonl(args.fault_log) if args.fault_log else None,
        provenance={
            "code_commit": args.code_commit,
            "environment_profile": args.environment_profile,
        },
    )
    if args.artifact:
        record = apply_verification(record, verify(record, args.artifact))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    brief = {
        "run_id": record["run_id"],
        "run_status": record["run_status"],
        "fault_start": record["fault_start"],
        "fault_end": record["fault_end"],
        "verification_result": record["verification_result"],
        "checks": {c["check_name"]: c["result"] for c in record["verification_checks"]},
        "invalid_reasons": record["invalid_reasons"],
    }
    print(json.dumps(brief, ensure_ascii=False))
    return 0 if record["run_status"] == "valid" else 1


def _features_of(runs_dir: Path, run_id: str) -> Path:
    return runs_dir / run_id / "telemetry" / "features"


def _manifest_runs(manifest: dict, split: str | None = None) -> list[str]:
    return sorted(
        slot["run_id"]
        for slot in manifest.get("slots", [])
        if slot.get("run_id") and (split is None or slot["split"] == split)
    )


def _baseline_parsers(sub: argparse._SubParsersAction) -> None:
    fit = sub.add_parser("fit-baseline", help="Fit median/MAD trên các run train của dataset")
    fit.add_argument("--dataset", type=Path, required=True, help="dataset manifest (JSON)")
    fit.add_argument("--runs-dir", type=Path, required=True, help="Thư mục runs/ của runner")
    fit.add_argument("--out", type=Path, required=True, help="File baseline JSON")
    apply = sub.add_parser("apply-baseline", help="Tính robust z của một run theo baseline đã fit")
    apply.add_argument("features_dir", type=Path)
    apply.add_argument("--baseline", type=Path, required=True)
    apply.add_argument("--out", type=Path, help="Mặc định ghi cạnh bảng feature")
    leak = sub.add_parser("check-leakage", help="Kiểm leakage của feature/baseline theo dataset")
    leak.add_argument("--dataset", type=Path, required=True)
    leak.add_argument("--runs-dir", type=Path, required=True)
    leak.add_argument("--baseline", type=Path)


def _run_fit_baseline(args: argparse.Namespace) -> int:
    text = args.dataset.read_text(encoding="utf-8")
    manifest = json.loads(text)
    # Chỉ đọc run có split train (mục 9.1); kiểm tra leakage xác nhận lại sau.
    runs = {
        run_id: _features_of(args.runs_dir, run_id) for run_id in _manifest_runs(manifest, "train")
    }
    missing = [run_id for run_id, path in runs.items() if not path.exists()]
    if missing:
        raise SystemExit(f"Thiếu feature của run train: {missing}")
    baseline = fit_baseline(
        runs,
        provenance={
            "dataset_id": manifest.get("dataset_id"),
            "dataset_manifest_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        },
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(baseline, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    groups = {table: len(stats) for table, stats in baseline["stats"].items()}
    print(json.dumps({"fit_runs": baseline["fit_runs"], "groups": groups}, ensure_ascii=False))
    return 0


def _run_apply_baseline(args: argparse.Namespace) -> int:
    baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
    print(json.dumps(apply_baseline(args.features_dir, baseline, args.out), ensure_ascii=False))
    return 0


def _run_check_leakage(args: argparse.Namespace) -> int:
    manifest = json.loads(args.dataset.read_text(encoding="utf-8"))
    baseline = json.loads(args.baseline.read_text(encoding="utf-8")) if args.baseline else None
    dirs = {
        run_id: path
        for run_id in _manifest_runs(manifest)
        if (path := _features_of(args.runs_dir, run_id)).exists()
    }
    errors = check_leakage(manifest, baseline, dirs)
    print(
        json.dumps({"runs_checked": sorted(dirs), "errors": errors}, ensure_ascii=False, indent=2)
    )
    return 1 if errors else 0


def _symptoms_parser(sub: argparse._SubParsersAction) -> None:
    parser = sub.add_parser(
        "symptoms",
        help="Đo độ trễ từ fault_start tới triệu chứng đầu tiên của case (pilot, mục 7.3)",
    )
    parser.add_argument("artifact_dir", type=Path, help="Thư mục artifact (có metrics.parquet)")
    parser.add_argument("--ground-truth", type=Path, help="ground-truth.json (case, khoảng fault)")
    parser.add_argument("--case", help="C2 | C3 | C4 | C6 khi tự khai báo khoảng (đối chứng)")
    parser.add_argument("--fault-start", help="ISO-8601 có múi giờ, đi cùng --case")
    parser.add_argument("--fault-end", help="ISO-8601 có múi giờ, đi cùng --case")
    parser.add_argument("--window-seconds", type=float, default=SymptomConfig.window_s)
    parser.add_argument("--out", type=Path, help="Ghi kết quả JSON vào đường dẫn này")


def _run_symptoms(args: argparse.Namespace) -> int:
    config = SymptomConfig(window_s=args.window_seconds)
    if args.ground_truth:
        record = json.loads(args.ground_truth.read_text(encoding="utf-8"))
        result = measure_from_ground_truth(record, args.artifact_dir, config)
    elif args.case and args.fault_start and args.fault_end:
        result = measure_symptoms(
            args.case,
            parse_utc(args.fault_start),
            parse_utc(args.fault_end),
            args.artifact_dir,
            config,
        )
    else:
        raise SystemExit("Cần --ground-truth, hoặc --case kèm --fault-start và --fault-end")
    text = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
    keys = (
        "case_id",
        "root_cause_lag_s",
        "first_symptom_lag_s",
        "outside_request_path_lag_s",
        "outside_request_path_observed",
    )
    brief = {key: result[key] for key in keys}
    brief["signals"] = {
        s["signal_id"]: s["lag_s"] if s["observed"] else s["status"] for s in result["signals"]
    }
    print(json.dumps(brief, ensure_ascii=False))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="aiops-training")
    sub = parser.add_subparsers(dest="command", required=True)
    _export_parser(sub)
    _quality_parser(sub)
    _features_parser(sub)
    _ground_truth_parser(sub)
    _symptoms_parser(sub)
    _baseline_parsers(sub)
    args = parser.parse_args(argv)
    if args.command == "symptoms":
        return _run_symptoms(args)
    if args.command == "fit-baseline":
        return _run_fit_baseline(args)
    if args.command == "apply-baseline":
        return _run_apply_baseline(args)
    if args.command == "check-leakage":
        return _run_check_leakage(args)
    if args.command == "export":
        return _run_export(args)
    if args.command == "quality":
        return _run_quality(args)
    if args.command == "features":
        return _run_features(args)
    if args.command == "ground-truth":
        return _run_ground_truth(args)
    parser.error(f"Lệnh không hỗ trợ: {args.command}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
