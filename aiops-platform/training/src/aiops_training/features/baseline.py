"""Baseline healthy fit **chỉ trên run train** và áp cho mọi run (evaluation-protocol-v1 mục 9.1).

- `fit_baseline`: đọc bảng feature của các run train, bỏ cửa sổ warm-up và cửa sổ runtime im lặng,
  tính median và MAD theo (bảng, khóa, cột). Kết quả là một artifact JSON có phiên bản, ghi run đã
  dùng, sha256 manifest feature của từng run và phiên bản feature/lọc nhiễu.
- `apply_baseline`: tính robust z = (x − median) / max(1,4826 × MAD, `min_scale`) cho một run bất kỳ
  (train, validation hay test) **chỉ bằng tham số đã fit**; không fit lại. Nhóm không có trong
  baseline (ví dụ cạnh chỉ xuất hiện khi có fault) cho z rỗng và `baseline_missing = true`.

Chọn run nào để fit do caller quyết định (CLI đọc split `train` từ dataset manifest); kiểm tra
leakage (`leakage.py`) xác nhận lại sau.
"""

from __future__ import annotations

import hashlib
import json
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from .pipeline import TABLES

BASELINE_SCHEMA = "feature-baseline.v1"
MAD_TO_SIGMA = 1.4826

FEATURE_COLUMNS: dict[str, tuple[str, ...]] = {
    "service": (
        "request_rate",
        "error_rate",
        "latency_p50",
        "latency_p95",
        "latency_p99",
        "cpu_usage",
        "memory_usage",
        "trace_error_rate",
        "downstream_latency_p95",
        "log_error_rate",
    ),
    "edge": ("call_count", "error_ratio", "timeout_ratio", "duration_mean", "duration_p95"),
    "queue": ("messages_ready", "messages_unacked", "consumers"),
}
KEYS: dict[str, tuple[str, ...]] = {
    "service": ("service_name",),
    "edge": ("caller_service", "dependency_identity"),
    "queue": ("consumer_service", "queue"),
}
SILENT: dict[str, str] = {
    "service": "telemetry_silent",
    "edge": "caller_silent",
    "queue": "consumer_silent",
}


class BaselineError(ValueError):
    pass


def _key(row: dict[str, Any], table: str) -> str:
    return "|".join(str(row[column]) for column in KEYS[table])


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_feature_meta(features_dir: Path) -> dict[str, Any]:
    return json.loads((features_dir / "features-manifest.json").read_text(encoding="utf-8"))


def fit_baseline(
    feature_dirs: dict[str, Path], min_scale: float = 1e-3, provenance: dict | None = None
) -> dict[str, Any]:
    """`feature_dirs`: `run_id → thư mục feature` của các run train."""
    if not feature_dirs:
        raise BaselineError("Cần ít nhất một run train để fit")
    versions = set()
    values: dict[str, dict[str, dict[str, list[float]]]] = {
        table: defaultdict(lambda: defaultdict(list)) for table in TABLES
    }
    inputs = {}
    for run_id, directory in sorted(feature_dirs.items()):
        meta = read_feature_meta(directory)
        if meta["run_id"] != run_id:
            raise BaselineError(f"{directory} là feature của {meta['run_id']}, không phải {run_id}")
        versions.add((meta["feature_config_version"], meta["noise_filter_version"]))
        inputs[run_id] = _sha256(directory / "features-manifest.json")
        for table, (file_name, _) in TABLES.items():
            path = directory / file_name
            if not path.exists():
                continue
            for row in pq.read_table(path).to_pylist():
                if row["warmup"] or row[SILENT[table]]:
                    continue
                key = _key(row, table)
                for column in FEATURE_COLUMNS[table]:
                    if row.get(column) is not None:
                        values[table][key][column].append(float(row[column]))
    if len(versions) != 1:
        raise BaselineError(
            f"Run train có phiên bản feature/lọc nhiễu khác nhau: {sorted(versions)}"
        )
    feature_version, noise_version = versions.pop()
    stats: dict[str, dict[str, dict[str, dict[str, float]]]] = {}
    for table, groups in values.items():
        stats[table] = {}
        for key, columns in sorted(groups.items()):
            stats[table][key] = {}
            for column, samples in columns.items():
                median = statistics.median(samples)
                mad = statistics.median(abs(value - median) for value in samples)
                stats[table][key][column] = {"median": median, "mad": mad, "n": len(samples)}
    return {
        "schema": BASELINE_SCHEMA,
        "feature_config_version": feature_version,
        "noise_filter_version": noise_version,
        "fit_runs": sorted(feature_dirs),
        "fit_inputs_sha256": inputs,
        "min_scale": min_scale,
        "excluded_windows": ["warmup", "telemetry_silent/caller_silent/consumer_silent"],
        **(provenance or {}),
        "stats": stats,
    }


def _scale(entry: dict[str, float], min_scale: float) -> float:
    return max(MAD_TO_SIGMA * entry["mad"], min_scale)


def apply_baseline(
    features_dir: Path, baseline: dict[str, Any], out_dir: Path | None = None
) -> dict[str, Any]:
    """Ghi `<bảng>_windows_z.parquet` (cột gốc + `<cột>_z` + `baseline_missing`)."""
    meta = read_feature_meta(features_dir)
    for field in ("feature_config_version", "noise_filter_version"):
        if meta[field] != baseline[field]:
            raise BaselineError(
                f"{field} của run ({meta[field]}) khác baseline ({baseline[field]})"
            )
    target = out_dir or features_dir
    target.mkdir(parents=True, exist_ok=True)
    counts = {}
    for table, (file_name, schema) in TABLES.items():
        path = features_dir / file_name
        if not path.exists():
            continue
        rows = pq.read_table(path).to_pylist()
        groups = baseline["stats"].get(table, {})
        for row in rows:
            entry = groups.get(_key(row, table))
            row["baseline_missing"] = entry is None
            for column in FEATURE_COLUMNS[table]:
                stat = (entry or {}).get(column)
                value = row.get(column)
                row[f"{column}_z"] = (
                    (value - stat["median"]) / _scale(stat, baseline["min_scale"])
                    if stat is not None and value is not None
                    else None
                )
        z_schema = schema
        for column in FEATURE_COLUMNS[table]:
            z_schema = z_schema.append(pa.field(f"{column}_z", pa.float64()))
        z_schema = z_schema.append(pa.field("baseline_missing", pa.bool_()))
        name = file_name.replace(".parquet", "_z.parquet")
        pq.write_table(pa.Table.from_pylist(rows, z_schema), target / name)
        counts[table] = len(rows)
    return {"run_id": meta["run_id"], "baseline_fit_runs": baseline["fit_runs"], "rows": counts}
