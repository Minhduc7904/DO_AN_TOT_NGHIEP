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
from .signals import (
    AVAILABLE_AFTER_S,
    MODALITIES,
    SIGNAL_SET_VERSION,
    SIGNALS,
    service_windows,
)

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
        # Khóa bằng chứng của cửa sổ vượt (`<bảng>.<cột>@<thực thể>`, hoặc
        # `telemetry_silent@<service>`) và khóa các tín hiệu có giá trị trong cửa sổ: lifecycle dùng
        # để áp luật cửa sổ không dữ liệu theo từng tín hiệu (`signals.py`).
        ("top_key", pa.string()),
        ("evidence_keys", pa.list_(pa.string())),
        ("observed_keys", pa.list_(pa.string())),
        ("missing_modalities", pa.list_(pa.string())),
        ("detector_config_version", pa.string()),
    ]
)
#: Ý nghĩa của `score_metrics/traces/logs`: z có hướng (robust_z, fused, iforest) hoặc tỉ lệ
#: giá trị/ngưỡng (static, rỗng khi modality không có tín hiệu nào có ngưỡng).
COMPONENT_MEANING = {
    "static": "max(giá trị / ngưỡng) theo modality",
    "robust_z": "max(0, max z có hướng) theo modality",
    "fused": "max(0, max z có hướng) theo modality",
    "iforest": "max(0, max z có hướng) theo modality (model dùng cả vector)",
}


def silence_key(service: str) -> str:
    return f"telemetry_silent@{service}"


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
    manifest_path = features_dir / "features-manifest.json"
    meta = json.loads(manifest_path.read_text(encoding="utf-8"))
    applied_path = features_dir / "baseline-apply.json"
    if not applied_path.exists():
        raise ValueError(f"Thiếu {applied_path}: chạy apply-baseline trước detect")
    applied = json.loads(applied_path.read_text(encoding="utf-8"))
    window_s = int(meta.get("window_s") or meta["config"]["window_s"])
    if applied.get("features_manifest_sha256") != _sha256(manifest_path):
        raise ValueError("Bảng z được sinh từ manifest feature khác bản hiện có: chạy lại apply")
    if applied.get("window_s") is not None and int(applied["window_s"]) != window_s:
        raise ValueError(f"Baseline áp cho cửa sổ {applied['window_s']} s, feature là {window_s} s")
    if model_metadata:
        if int(model_metadata["window_s"]) != window_s:
            raise ValueError(
                f"Model fit trên cửa sổ {model_metadata['window_s']} s, feature là {window_s} s"
            )
        if model_metadata["baseline_sha256"] != applied.get("baseline_sha256"):
            raise ValueError("Model và feature của run dùng hai baseline khác nhau")
        expected = [signal.name for signal in SIGNALS]
        if (
            model_metadata.get("signal_set_version") != SIGNAL_SET_VERSION
            or model_metadata.get("feature_order") != expected
        ):
            raise ValueError("Model fit trên bộ tín hiệu/thứ tự khác bộ tín hiệu hiện hành")
    rows = []
    counts = {"flagged": 0, "below_threshold": 0, "no_data": 0, "telemetry_silent": 0}
    for window in service_windows(features_dir):
        result = detector.score(window)
        top = result.top
        observed = [silence_key(window.service), *window.observed_keys()]
        if result.reason == "telemetry_silent":
            top_key = silence_key(window.service)
            evidence = [top_key]
        elif result.flagged:
            top_key = top.key if top is not None else None
            # Detector không chỉ ra được tín hiệu nào: mọi tín hiệu quan sát được là bằng chứng,
            # nên cửa sổ có dữ liệu nào sau đó cũng có thể làm đứt chuỗi.
            evidence = list(result.evidence) or window.observed_keys()
        else:
            top_key, evidence = None, []
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
                "top_key": top_key,
                "evidence_keys": evidence,
                "observed_keys": observed,
                "missing_modalities": [m for m in MODALITIES if not window.available(m)],
                "detector_config_version": config.get("detector_config_version"),
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
        "component_meaning": COMPONENT_MEANING.get(detector.name),
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
