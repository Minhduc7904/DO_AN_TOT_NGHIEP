"""Chạy một detector trên thư mục feature của một run và ghi `AnomalyRecord` (blueprint mục 6.4).

Đầu ra trong `<out>`:

- `anomalies-<detector>.parquet`: một dòng mỗi (cửa sổ, service); cột ở `ANOMALY_SCHEMA`.
- `anomalies-<detector>.json`: lineage (feature manifest, baseline-apply, model, config) và đếm.

Không đọc ground truth: đầu vào chỉ là thư mục feature đã `apply-baseline`.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from .detectors import Detector
from .signals import AVAILABLE_AFTER_S, SIGNAL_SET_VERSION, service_windows

ANOMALY_SCHEMA_VERSION = "anomaly-record.v1"
ANOMALY_SCHEMA = pa.schema(
    [
        ("run_id", pa.string()),
        ("detector", pa.string()),
        ("window_start", pa.timestamp("ns", tz="UTC")),
        ("window_end", pa.timestamp("ns", tz="UTC")),
        ("warmup", pa.bool_()),
        ("service_name", pa.string()),
        ("score", pa.float64()),
        ("threshold", pa.float64()),
        ("flagged", pa.bool_()),  # rỗng: cửa sổ không có dữ liệu
        ("reason", pa.string()),
        ("telemetry_silent", pa.bool_()),
        ("score_metrics", pa.float64()),
        ("score_traces", pa.float64()),
        ("score_logs", pa.float64()),
        ("top_signal", pa.string()),
        ("top_entity", pa.string()),
        ("top_value", pa.float64()),
        ("top_score", pa.float64()),
    ]
)


def _sha256(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def detect(
    features_dir: Path,
    detector: Detector,
    out_dir: Path,
    *,
    config: dict[str, Any],
    config_path: Path | None = None,
    model_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta = json.loads((features_dir / "features-manifest.json").read_text(encoding="utf-8"))
    applied_path = features_dir / "baseline-apply.json"
    applied = json.loads(applied_path.read_text(encoding="utf-8")) if applied_path.exists() else {}
    window_s = int(meta["config"]["window_s"])
    if model_metadata and int(model_metadata["window_s"]) != window_s:
        raise ValueError(
            f"Model fit trên cửa sổ {model_metadata['window_s']} s, feature là {window_s} s"
        )
    if (
        model_metadata
        and applied.get("baseline_sha256")
        and model_metadata["baseline_sha256"] != applied["baseline_sha256"]
    ):
        raise ValueError("Model và feature của run dùng hai baseline khác nhau")
    rows = []
    counts = {"flagged": 0, "below_threshold": 0, "no_data": 0, "telemetry_silent": 0}
    for window in service_windows(features_dir):
        result = detector.score(window)
        top = result.top
        rows.append(
            {
                "run_id": window.run_id,
                "detector": detector.name,
                "window_start": window.window_start,
                "window_end": window.window_end,
                "warmup": window.warmup,
                "service_name": window.service,
                "score": result.score,
                "threshold": detector.threshold,
                "flagged": result.flagged,
                "reason": result.reason,
                "telemetry_silent": window.silent,
                "score_metrics": result.components.get("metrics"),
                "score_traces": result.components.get("traces"),
                "score_logs": result.components.get("logs"),
                "top_signal": top.signal.name if top else None,
                "top_entity": top.entity if top else None,
                "top_value": top.value if top else None,
                "top_score": result.top_score,
            }
        )
        if result.reason == "telemetry_silent":
            counts["telemetry_silent"] += 1
        elif result.flagged is None:
            counts["no_data"] += 1
        elif result.flagged:
            counts["flagged"] += 1
        else:
            counts["below_threshold"] += 1
    out_dir.mkdir(parents=True, exist_ok=True)
    table_path = out_dir / f"anomalies-{detector.name}.parquet"
    pq.write_table(pa.Table.from_pylist(rows, ANOMALY_SCHEMA), table_path)
    manifest = {
        "schema": ANOMALY_SCHEMA_VERSION,
        "run_id": meta["run_id"],
        "detector": detector.name,
        "detector_config_version": config.get("detector_config_version"),
        "detector_config": config,
        "detector_config_sha256": _sha256(config_path) if config_path else None,
        "signal_set_version": SIGNAL_SET_VERSION,
        "threshold": detector.threshold,
        "window_s": window_s,
        "step_s": int(meta["config"]["step_s"]),
        "available_after_s": AVAILABLE_AFTER_S["metrics"],
        "lineage": {
            "features_manifest_sha256": _sha256(features_dir / "features-manifest.json"),
            "feature_config_version": meta.get("feature_config_version"),
            "noise_filter_version": meta.get("noise_filter_version"),
            "baseline_sha256": applied.get("baseline_sha256"),
            "baseline_fit_runs": applied.get("baseline_fit_runs"),
            "model_sha256": (model_metadata or {}).get("model_sha256"),
            "model_fit_runs": (model_metadata or {}).get("fit_runs"),
        },
        "rows": len(rows),
        "counts": counts,
        "output": table_path.name,
        "output_sha256": _sha256(table_path),
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    (out_dir / f"anomalies-{detector.name}.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return manifest
