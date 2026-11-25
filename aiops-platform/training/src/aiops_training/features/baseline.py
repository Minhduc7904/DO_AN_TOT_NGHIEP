"""Baseline healthy fit **chỉ trên run train** và áp cho mọi run (evaluation-protocol-v1 mục 9.1).

- `fit_baseline`: đọc bảng feature của các run train, bỏ cửa sổ warm-up và cửa sổ runtime im lặng,
  tính median và thang đo theo (bảng, khóa, cột): 1,4826 × MAD; MAD = 0 thì 1,2533 × MeanAD;
  cả hai bằng 0 thì sàn theo đơn vị (`UNIT_FLOOR`). Kết quả là một artifact JSON có phiên bản,
  ghi run đã dùng, sha256 manifest feature của từng run và phiên bản feature/lọc nhiễu.
- `apply_baseline`: tính robust z = (x − median) / thang đo đã fit cho một run bất kỳ
  (train, validation hay test) **chỉ bằng tham số đã fit**; không fit lại. Nhóm không có trong
  baseline (ví dụ cạnh chỉ xuất hiện khi có fault) cho z rỗng và `baseline_missing = true`.

Chọn run nào để fit do caller quyết định (CLI đọc slot có split `train` và `case` rỗng, tức run
healthy, từ dataset manifest); kiểm tra leakage (`leakage.py`) xác nhận lại sau.
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

from .pipeline import DEFAULT_WINDOW_S, TABLES, feature_window_s

BASELINE_SCHEMA = "feature-baseline.v2"
FEATURE_MANIFEST = "features-manifest.json"
#: Ghi cạnh `<bảng>_windows_z.parquet`: baseline nào (sha256) đã sinh ra z (evaluation-protocol-v1
#: mục 21.1, lineage feature → baseline).
APPLY_MANIFEST = "baseline-apply.json"
MAD_TO_SIGMA = 1.4826
#: Modified z-score (Iglewicz & Hoaglin): MAD = 0 thì dùng 1,2533 × độ lệch tuyệt đối trung bình.
MEANAD_TO_SIGMA = 1.2533
#: Quy tắc thang đo. v1 (khai báo 23/11/2026, `detection-candidates-v1.json`): 1,4826 × MAD; MAD = 0
#: thì 1,2533 × MeanAD; cả hai bằng 0 thì sàn theo đơn vị. v2 (25/11/2026, trước mọi lần chấm
#: validation; khai báo ở `detection-candidates.v2`): như v1 nhưng thang đo **không nhỏ hơn** sàn
#: theo đơn vị. Lý do: trên run train, MAD bằng sai số dấu phẩy động (8,7e-19 với
#: `media-worker.downstream_latency_p95`) hoặc rất nhỏ (latency 0,1–1 ms) làm z tới 1e15 ngay trên
#: run khỏe; sàn là thay đổi nhỏ nhất coi là có nghĩa nên cũng là thang đo nhỏ nhất hợp lý.
SCALE_RULE = "mad|meanad|unit_floor.v2"
SCALE_RULE_V1 = "mad|meanad|unit_floor.v1"
#: Sàn thang đo theo đơn vị khi đặc trưng hằng trên train (MAD = MeanAD = 0): thay đổi nhỏ nhất
#: coi là có nghĩa. z = 3 trên tỉ lệ lỗi hằng 0 là tăng 3 điểm phần trăm; mất một consumer là z = 5.
UNIT_FLOOR: dict[str, float] = {
    "ratio": 0.01,
    "seconds": 0.01,
    "per_second": 0.05,
    "calls": 1.0,
    "messages": 1.0,
    "consumers": 0.2,
    "cpu_seconds_per_second": 0.01,
    "memory_bytes": 1_048_576.0,
}
COLUMN_UNIT: dict[str, str] = {
    "request_rate": "per_second",
    "error_rate": "ratio",
    "latency_p50": "seconds",
    "latency_p95": "seconds",
    "latency_p99": "seconds",
    "cpu_usage": "cpu_seconds_per_second",
    "memory_usage": "memory_bytes",
    "trace_error_rate": "ratio",
    "downstream_latency_p95": "seconds",
    "log_error_rate": "per_second",
    "call_count": "calls",
    "error_ratio": "ratio",
    "timeout_ratio": "ratio",
    "duration_mean": "seconds",
    "duration_p95": "seconds",
    "messages_ready": "messages",
    "messages_unacked": "messages",
    "consumers": "consumers",
}

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


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_feature_meta(features_dir: Path) -> dict[str, Any]:
    return json.loads((features_dir / FEATURE_MANIFEST).read_text(encoding="utf-8"))


def robust_scale(samples: list[float], column: str, rule: str = SCALE_RULE) -> dict[str, float]:
    """Median và thang đo của robust z theo `rule` (mặc định `SCALE_RULE` v2)."""
    if rule not in (SCALE_RULE, SCALE_RULE_V1):
        raise BaselineError(f"Quy tắc thang đo không hỗ trợ: {rule}")
    median = statistics.median(samples)
    deviations = [abs(value - median) for value in samples]
    mad = statistics.median(deviations)
    meanad = statistics.fmean(deviations)
    floor = UNIT_FLOOR[COLUMN_UNIT[column]]
    if mad > 0:
        scale, basis = MAD_TO_SIGMA * mad, "mad"
    elif meanad > 0:
        scale, basis = MEANAD_TO_SIGMA * meanad, "meanad"
    else:
        scale, basis = floor, "unit_floor"
    if rule == SCALE_RULE and scale < floor:
        scale, basis = floor, f"unit_floor>{basis}"
    return {
        "median": median,
        "mad": mad,
        "meanad": meanad,
        "scale": scale,
        "scale_basis": basis,
        "n": len(samples),
    }


def baseline_window_s(
    baseline: dict[str, Any], train_dirs: dict[str, Path] | None = None
) -> tuple[int, bool]:
    """Độ dài cửa sổ của baseline và cờ legacy.

    Baseline fit trước task-02 tuần 16 (`baselines/dataset-v0.json`) không có `window_s` và
    **không** được ghi lại (đổi file làm đổi sha256 trong lineage). Khi đó suy từ manifest feature
    của các run fit (`train_dirs`, như `check-leakage` có); không có thư mục thì lấy cửa sổ mặc
    định 60 s, cửa sổ duy nhất có trước task-02. Cả hai trường hợp trả cờ legacy = True.
    """
    if baseline.get("window_s") is not None:
        return int(baseline["window_s"]), False
    if train_dirs:
        sizes = {
            feature_window_s(read_feature_meta(directory))
            for run_id, directory in train_dirs.items()
            if run_id in baseline.get("fit_runs", []) and (directory / FEATURE_MANIFEST).exists()
        }
        if len(sizes) == 1:
            return sizes.pop(), True
        if len(sizes) > 1:
            raise BaselineError(f"Run fit của baseline có độ dài cửa sổ khác nhau: {sorted(sizes)}")
    return DEFAULT_WINDOW_S, True


def fit_baseline(feature_dirs: dict[str, Path], provenance: dict | None = None) -> dict[str, Any]:
    """`feature_dirs`: `run_id → thư mục feature` của các run train."""
    if not feature_dirs:
        raise BaselineError("Cần ít nhất một run train để fit")
    versions = set()
    window_sizes = set()
    values: dict[str, dict[str, dict[str, list[float]]]] = {
        table: defaultdict(lambda: defaultdict(list)) for table in TABLES
    }
    inputs = {}
    for run_id, directory in sorted(feature_dirs.items()):
        meta = read_feature_meta(directory)
        if meta["run_id"] != run_id:
            raise BaselineError(f"{directory} là feature của {meta['run_id']}, không phải {run_id}")
        versions.add((meta["feature_config_version"], meta["noise_filter_version"]))
        window_sizes.add(feature_window_s(meta))
        inputs[run_id] = sha256_file(directory / FEATURE_MANIFEST)
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
    if len(window_sizes) != 1:
        raise BaselineError(f"Run train có độ dài cửa sổ khác nhau: {sorted(window_sizes)}")
    feature_version, noise_version = versions.pop()
    stats: dict[str, dict[str, dict[str, dict[str, float]]]] = {}
    for table, groups in values.items():
        stats[table] = {}
        for key, columns in sorted(groups.items()):
            stats[table][key] = {}
            for column, samples in columns.items():
                stats[table][key][column] = robust_scale(samples, column)
    return {
        "schema": BASELINE_SCHEMA,
        "feature_config_version": feature_version,
        "noise_filter_version": noise_version,
        "window_s": window_sizes.pop(),
        "fit_runs": sorted(feature_dirs),
        "fit_inputs_sha256": inputs,
        "scale_rule": SCALE_RULE,
        "unit_floor": UNIT_FLOOR,
        "excluded_windows": ["warmup", "telemetry_silent/caller_silent/consumer_silent"],
        **(provenance or {}),
        "stats": stats,
    }


def apply_baseline(
    features_dir: Path,
    baseline: dict[str, Any],
    out_dir: Path | None = None,
    baseline_sha256: str | None = None,
) -> dict[str, Any]:
    """Ghi `<bảng>_windows_z.parquet` (cột gốc + `<cột>_z` + `baseline_missing`) và
    `baseline-apply.json` (lineage: sha256 của file baseline do caller truyền, schema, phiên bản,
    run đã fit, sha256 manifest feature đầu vào)."""
    meta = read_feature_meta(features_dir)
    if baseline.get("schema") != BASELINE_SCHEMA:
        raise BaselineError(f"Baseline schema {baseline.get('schema')}, cần {BASELINE_SCHEMA}")
    for field in ("feature_config_version", "noise_filter_version"):
        if meta[field] != baseline[field]:
            raise BaselineError(
                f"{field} của run ({meta[field]}) khác baseline ({baseline[field]})"
            )
    window_s, legacy = baseline_window_s(baseline)
    if feature_window_s(meta) != window_s:
        raise BaselineError(
            f"Feature của run có cửa sổ {feature_window_s(meta)} s, baseline fit trên cửa sổ "
            f"{window_s} s{' (legacy, suy ra)' if legacy else ''}"
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
                    (value - stat["median"]) / stat["scale"]
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
    result = {
        "run_id": meta["run_id"],
        "features_manifest_sha256": sha256_file(features_dir / FEATURE_MANIFEST),
        "baseline_sha256": baseline_sha256,
        "baseline_schema": baseline["schema"],
        "baseline_dataset_id": baseline.get("dataset_id"),
        "baseline_fit_runs": baseline["fit_runs"],
        "feature_config_version": baseline["feature_config_version"],
        "noise_filter_version": baseline["noise_filter_version"],
        "window_s": window_s,
        "baseline_window_s_legacy": legacy,
        "rows": counts,
    }
    (target / APPLY_MANIFEST).write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return result
