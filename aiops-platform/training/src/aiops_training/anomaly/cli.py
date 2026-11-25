"""Lệnh `fit-iforest` và `detect` của `aiops-training`."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from ..features.baseline import sha256_file
from ..features.leakage import is_healthy
from .detectors import DETECTORS, build_detector
from .iforest import DEFAULT_SEED, code_provenance, fit_models, load_models, save_models
from .run import detect

COMMANDS = ("fit-iforest", "detect")


def register(sub: argparse._SubParsersAction) -> None:
    fit = sub.add_parser(
        "fit-iforest", help="Fit Isolation Forest theo service trên run train khỏe của dataset"
    )
    fit.add_argument("--dataset", type=Path, required=True, help="dataset manifest (JSON)")
    fit.add_argument("--runs-dir", type=Path, required=True, help="Thư mục runs/ của runner")
    fit.add_argument(
        "--features-subdir",
        default="telemetry/features",
        help="Thư mục feature trong mỗi run (đã apply-baseline); mặc định cửa sổ 60 s",
    )
    fit.add_argument("--out", type=Path, required=True, help="File model (.joblib)")
    fit.add_argument(
        "--config",
        type=Path,
        required=True,
        help="Config detector (JSON): hyperparameter và seed ở detectors.iforest",
    )

    run = sub.add_parser("detect", help="Chạy một detector trên thư mục feature của một run")
    run.add_argument("features_dir", type=Path, help="Thư mục feature đã apply-baseline")
    run.add_argument("--detector", choices=DETECTORS, required=True)
    run.add_argument("--config", type=Path, required=True, help="Config detector (JSON)")
    run.add_argument("--model", type=Path, help="Model Isolation Forest (.joblib), cho iforest")
    run.add_argument("--out", type=Path, help="Mặc định <features_dir>/anomalies")


def dispatch(args: argparse.Namespace) -> int:
    if args.command == "fit-iforest":
        return _fit(args)
    return _detect(args)


def _fit(args: argparse.Namespace) -> int:
    manifest = json.loads(args.dataset.read_text(encoding="utf-8"))
    # Chỉ run train khỏe (`case` rỗng), như fit-baseline (evaluation-protocol-v1 mục 9.1).
    runs = {
        slot["run_id"]: args.runs_dir / slot["run_id"] / args.features_subdir
        for slot in manifest.get("slots", [])
        if slot.get("run_id") and slot["split"] == "train" and is_healthy(slot)
    }
    missing = [run_id for run_id, path in runs.items() if not path.exists()]
    if missing:
        raise SystemExit(f"Thiếu feature của run train: {missing}")
    config = json.loads(args.config.read_text(encoding="utf-8"))
    section = config["detectors"]["iforest"]
    provenance = {
        "detector_config_version": config.get("detector_config_version"),
        "detector_config_sha256": sha256_file(args.config),
        "dataset_id": manifest.get("dataset_id"),
        "dataset_manifest_sha256": sha256_file(args.dataset),
        **code_provenance(Path(__file__).resolve().parents[3]),
    }
    models, metadata = fit_models(
        runs,
        section.get("hyperparameters"),
        seed=int(section.get("seed", DEFAULT_SEED)),
        provenance=provenance,
    )
    full = save_models(models, metadata, args.out)
    print(
        json.dumps(
            {
                "fit_runs": full["fit_runs"],
                "window_s": full["window_s"],
                "fit_windows": full["fit_windows"],
                "model_sha256": full["model_sha256"],
            },
            ensure_ascii=False,
        )
    )
    return 0


def _detect(args: argparse.Namespace) -> int:
    config = json.loads(args.config.read_text(encoding="utf-8"))
    section = config["detectors"][args.detector]
    model = load_models(args.model) if args.model else None
    detector = build_detector(args.detector, section, model)
    manifest = detect(
        args.features_dir,
        detector,
        args.out or args.features_dir / "anomalies",
        config={"detector_config_version": config.get("detector_config_version"), **section},
        config_path=args.config,
        model_metadata=model[1] if model else None,
    )
    print(
        json.dumps({k: manifest[k] for k in ("run_id", "detector", "counts")}, ensure_ascii=False)
    )
    return 0
