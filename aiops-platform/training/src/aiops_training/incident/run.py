"""Chạy incident lifecycle trên `anomalies-<detector>.parquet` của một run, ghi `incidents.json`.

Đầu vào chỉ là đầu ra của `detect` (bảng điểm + manifest lineage); không đọc ground truth.
Schema `incident-record.v1` (đọc bởi harness `evaluation/detection`):

```
{"schema", "run_id", "detector", "detector_config_version", "incident_config_version",
 "window_seconds", "persistence_windows", "step_seconds", "threshold", "incident_config",
 "lineage",
 "incidents": [{"incident_id", "detected_at", "estimated_start_time", "resolved_at",
                "affected_services", "first_symptom", "trigger_reason", "peak_score",
                "peak_score_infinite", "episodes", "timeline"}]}
```
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from .lifecycle import (
    INCIDENT_SCHEMA,
    IncidentConfig,
    WindowScore,
    correlate,
    service_episodes,
)


def _sha256(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def load_config(path: Path) -> IncidentConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    section = data.get("incident", data)
    return IncidentConfig(
        incident_config_version=data.get("incident_config_version")
        or section["incident_config_version"],
        persistence_windows=int(section["persistence_windows"]),
        recovery_windows=int(section["recovery_windows"]),
        merge_gap_seconds=float(section["merge_gap_seconds"]),
        correlation_window_seconds=float(section["correlation_window_seconds"]),
    )


def read_scores(anomalies: Path) -> list[WindowScore]:
    return [
        WindowScore(
            service=row["service_name"],
            window_start=row["window_start"],
            window_end=row["window_end"],
            warmup=row["warmup"],
            flagged=row["flagged"],
            score=row["score"],
            reason=row["reason"],
            top_signal=row["top_signal"],
            top_entity=row["top_entity"],
            top_key=row.get("top_key"),
            observed_keys=frozenset(row.get("observed_keys") or ()),
        )
        for row in pq.read_table(anomalies).to_pylist()
    ]


def build_incidents(
    anomalies: Path, config: IncidentConfig, config_path: Path | None = None
) -> dict[str, Any]:
    """`anomalies`: `anomalies-<detector>.parquet`; manifest `.json` cùng tên nằm cạnh."""
    manifest_path = anomalies.with_suffix(".json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    scores = read_scores(anomalies)
    by_service: dict[str, list[WindowScore]] = defaultdict(list)
    for score in scores:
        by_service[score.service].append(score)
    episodes = []
    for service in sorted(by_service):
        episodes += service_episodes(
            by_service[service],
            config,
            step_s=float(manifest["step_s"]),
            available_after_s=float(manifest["available_after_s"]),
        )
    key = {
        "detector": manifest["detector"],
        "detector_config_version": manifest.get("detector_config_version"),
        "incident_config_version": config.incident_config_version,
        "window_seconds": int(manifest["window_s"]),
        "persistence_windows": config.persistence_windows,
    }
    identity = {
        **key,
        "threshold": manifest.get("threshold"),
        "detector_config_sha256": manifest.get("detector_config_sha256"),
        "incident_config_sha256": hashlib.sha256(
            json.dumps(asdict(config), sort_keys=True).encode("utf-8")
        ).hexdigest(),
    }
    incidents = correlate(episodes, config, manifest["run_id"], identity)
    return {
        "schema": INCIDENT_SCHEMA,
        "run_id": manifest["run_id"],
        **key,
        "step_seconds": int(manifest["step_s"]),
        # Ngưỡng của detector: harness so khớp giữa các run của một tổ hợp (luật chọn mục 6.1.2).
        "threshold": manifest.get("threshold"),
        "available_after_s": manifest["available_after_s"],
        "incident_config": asdict(config),
        "lineage": {
            "anomalies_sha256": _sha256(anomalies),
            "anomalies_manifest_sha256": _sha256(manifest_path),
            "incident_config_file_sha256": _sha256(config_path) if config_path else None,
            "incident_config_sha256": identity["incident_config_sha256"],
            "detector_config_sha256": manifest.get("detector_config_sha256"),
            "threshold": manifest.get("threshold"),
            **manifest.get("lineage", {}),
        },
        "counts": {
            "incidents": len(incidents),
            "episodes": len(episodes),
            "windows": len(scores),
        },
        "incidents": incidents,
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }


def write_incidents(record: dict[str, Any], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
