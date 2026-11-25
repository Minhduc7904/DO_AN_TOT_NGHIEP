"""Kiểm tra chống leakage tự động cho feature và baseline (evaluation-protocol-v1 mục 3.3, 5.1, 7.2,
9.1). Trả danh sách vi phạm; rỗng là đạt.

1. **Split:** không `run_id` nào thuộc hai split trong dataset manifest (kể cả run bị thay).
2. **Fit chỉ trên run train healthy:** mọi run trong `fit_runs` của baseline là run có split `train`
   và `case` rỗng trong manifest; baseline ghi đúng `dataset_id`. Không tin metadata tự khai của
   baseline: khóa của `fit_inputs_sha256` phải trùng `fit_runs`, sha256 của từng run phải bằng
   sha256 của `features-manifest.json` hiện có, và (khi caller truyền) `dataset_manifest_sha256`
   phải bằng sha256 của dataset manifest đang kiểm.
3. **Không có trường ground truth trong feature:** tên cột của mọi bảng feature và khóa trong
   `features-manifest.json` không chứa trường truth của mục 3.3 (`fault_*`, `root_cause_*`,
   `expected_*`, `scenario_id`, `case_id`…).
4. **Cùng phiên bản:** mọi run và baseline dùng cùng `feature_config_version` và
   `noise_filter_version` (mục 8.5: áp như nhau cho mọi run).
5. **Không dùng dữ liệu tương lai:**
   - manifest feature khai báo quy tắc gán theo thời điểm của pipeline hiện hành (span theo
     `end_time`, mẫu trong `[window_start, window_end)`) và độ trễ thu thập `AVAILABLE_AFTER_S`;
   - `run_id` của manifest feature và manifest export (`<thư mục feature>/../manifest.json`) trùng
     run đang kiểm, `time_end` của feature trùng `time_end` của export;
   - manifest feature ghi mốc bắt đầu truy vấn (`causality.query_started_at`) và nguồn mốc; mốc
     không muộn hơn mốc nào ghi trong file (`query_started_at` của export, `steps.export.started_at`
     của `run-manifest.json`), nguồn file đã khai thì phải còn;
   - mọi `window_end` ≤ min(`time_end`, mốc sớm nhất trong các nguồn trên − độ trễ lớn nhất);
   - manifest export được ghi (`generated_at`) không sớm hơn `time_end` + độ trễ lớn nhất.
"""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from typing import Any

import pyarrow.compute as pc
import pyarrow.parquet as pq

from ..telemetry.window import parse_utc
from .baseline import FEATURE_MANIFEST, read_feature_meta, sha256_file
from .pipeline import (
    AVAILABLE_AFTER_S,
    FEATURE_VERSION,
    MAX_DELAY_S,
    NOISE_FILTER_VERSION,
    TABLES,
    query_start_sources,
)

#: Trường truth/control không được đi vào feature path (evaluation-protocol-v1 mục 3.3).
TRUTH_FIELDS = frozenset(
    {
        "fault_id",
        "fault_type",
        "fault_target",
        "fault_target_kind",
        "fault_intensity",
        "fault_parameters",
        "fault_start",
        "fault_end",
        "root_cause_service",
        "root_cause_component",
        "expected_symptom",
        "expected_symptom_services",
        "expected_symptom_lag",
        "expected_propagation_path",
        "expected_evidence",
        "scenario_id",
        "case_id",
        "repeat_index",
        "split",
    }
)
#: Manifest của artifact export, nằm ở thư mục cha của thư mục feature (bố cục mặc định của
#: `aiops-training features` và của runner).
EXPORT_MANIFEST = "manifest.json"


def is_healthy(slot: dict[str, Any]) -> bool:
    """Slot healthy: có khóa `case` và giá trị rỗng (evaluation-protocol-v1 mục 9.1)."""
    return "case" in slot and slot["case"] is None


def _slots_by_run(manifest: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    slots: dict[str, list[dict[str, Any]]] = {}
    for slot in manifest.get("slots", []):
        for run_id in [slot.get("run_id"), *slot.get("replaced_run_ids", [])]:
            if run_id:
                slots.setdefault(run_id, []).append(slot)
    return slots


def _keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for item in value.values() for key in _keys(item)}
    if isinstance(value, list):
        return {key for item in value for key in _keys(item)}
    return set()


def _check_baseline(
    baseline: dict[str, Any],
    manifest: dict[str, Any],
    slots: dict[str, list[dict[str, Any]]],
    feature_dirs: dict[str, Path],
    manifest_sha256: str | None,
) -> list[str]:
    errors: list[str] = []
    if baseline.get("dataset_id") != manifest.get("dataset_id"):
        errors.append(
            f"baseline fit trên dataset {baseline.get('dataset_id')}, "
            f"không phải {manifest.get('dataset_id')}"
        )
    if manifest_sha256 is not None and baseline.get("dataset_manifest_sha256") != manifest_sha256:
        errors.append(
            f"baseline ghi dataset_manifest_sha256 {baseline.get('dataset_manifest_sha256')}, "
            f"dataset manifest đang kiểm có sha256 {manifest_sha256}"
        )
    fit_runs = baseline.get("fit_runs", [])
    for run_id in fit_runs:
        run_slots = slots.get(run_id, [])
        names = {slot["split"] for slot in run_slots}
        if names != {"train"}:
            errors.append(f"baseline fit trên run {run_id} thuộc split {sorted(names) or '∅'}")
        elif not all(is_healthy(slot) for slot in run_slots):
            cases = sorted(str(slot.get("case", "<không khai báo>")) for slot in run_slots)
            errors.append(f"baseline fit trên run {run_id} không healthy (case {cases})")
    inputs = baseline.get("fit_inputs_sha256") or {}
    if set(inputs) != set(fit_runs):
        errors.append(f"fit_inputs_sha256 có run {sorted(inputs)} khác fit_runs {sorted(fit_runs)}")
    for run_id in sorted(set(inputs) & set(fit_runs)):
        directory = feature_dirs.get(run_id)
        if directory is None:
            errors.append(f"baseline: không có feature của run fit {run_id} để đối chiếu sha256")
        elif sha256_file(directory / FEATURE_MANIFEST) != inputs[run_id]:
            errors.append(
                f"baseline: sha256 features-manifest của {run_id} khác giá trị lúc fit "
                f"({inputs[run_id]})"
            )
    return errors


def _check_time(run_id: str, directory: Path, meta: dict[str, Any]) -> list[str]:
    """Mục 5 của docstring module, phần đối chiếu với manifest export và mốc truy vấn."""
    path = directory.parent / EXPORT_MANIFEST
    if not path.exists():
        return [f"{run_id}: không có manifest export {path} để kiểm thời điểm"]
    export = json.loads(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if export.get("run_id") != run_id:
        errors.append(f"{run_id}: manifest export thuộc run {export.get('run_id')}")
    time_end = export.get("time_end")
    if meta.get("time_end") != time_end:
        errors.append(
            f"{run_id}: time_end của feature ({meta.get('time_end')}) khác manifest export "
            f"({time_end})"
        )
    if not time_end or not export.get("generated_at"):
        return [*errors, f"{run_id}: manifest export thiếu time_end hoặc generated_at"]
    end = parse_utc(time_end)
    if parse_utc(export["generated_at"]) < end + timedelta(seconds=MAX_DELAY_S):
        errors.append(
            f"{run_id}: export ghi lúc {export['generated_at']}, sớm hơn time_end + "
            f"{MAX_DELAY_S:g} s (độ trễ thu thập lớn nhất)"
        )
    causality = meta.get("causality") or {}
    declared, source = causality.get("query_started_at"), causality.get("query_started_at_source")
    if not declared:
        return [*errors, f"{run_id}: features-manifest không ghi mốc bắt đầu truy vấn"]
    queried_at = parse_utc(declared)
    recorded = query_start_sources(directory.parent, export)
    if source != "cli" and source not in recorded:
        errors.append(f"{run_id}: nguồn mốc truy vấn {source} không có trong file của run")
    for name, value in sorted(recorded.items()):
        if queried_at > value:
            errors.append(
                f"{run_id}: mốc truy vấn {declared} muộn hơn {name} ({value.isoformat()})"
            )
    # Mốc cắt theo mốc sớm nhất biết được, không chỉ mốc feature tự khai.
    earliest = min([queried_at, *recorded.values()])
    cutoff = min(end, earliest - timedelta(seconds=MAX_DELAY_S))
    for file_name, _ in TABLES.values():
        table_path = directory / file_name
        if not table_path.exists():
            continue
        last = pc.max(pq.read_table(table_path, columns=["window_end"]).column(0)).as_py()
        if last is not None and last > cutoff:
            errors.append(
                f"{run_id}: {file_name} có window_end {last.isoformat()} sau mốc cắt "
                f"{cutoff.isoformat()} (min(time_end, mốc truy vấn − {MAX_DELAY_S:g} s))"
            )
    return errors


def check_leakage(
    manifest: dict[str, Any],
    baseline: dict[str, Any] | None,
    feature_dirs: dict[str, Path],
    manifest_sha256: str | None = None,
) -> list[str]:
    """`feature_dirs`: `run_id → thư mục feature`. `manifest_sha256`: sha256 của file dataset
    manifest đã đọc ra `manifest` (CLI truyền); không truyền thì bỏ qua phép đối chiếu này."""
    errors: list[str] = []
    slots = _slots_by_run(manifest)
    for run_id, run_slots in sorted(slots.items()):
        names = {slot["split"] for slot in run_slots}
        if len(names) > 1:
            errors.append(f"run {run_id} thuộc nhiều split: {sorted(names)}")

    if baseline is not None:
        errors += _check_baseline(baseline, manifest, slots, feature_dirs, manifest_sha256)

    versions = set()
    if baseline is not None:
        versions.add((baseline["feature_config_version"], baseline["noise_filter_version"]))
    for run_id, directory in sorted(feature_dirs.items()):
        meta = read_feature_meta(directory)
        if meta.get("run_id") != run_id:
            errors.append(f"{run_id}: features-manifest thuộc run {meta.get('run_id')}")
        versions.add((meta.get("feature_config_version"), meta.get("noise_filter_version")))
        leaked = _keys(meta) & TRUTH_FIELDS
        if leaked:
            errors.append(f"{run_id}: features-manifest có trường truth {sorted(leaked)}")
        for file_name, _ in TABLES.values():
            path = directory / file_name
            if path.exists():
                leaked = set(pq.read_schema(path).names) & TRUTH_FIELDS
                if leaked:
                    errors.append(f"{run_id}: {file_name} có cột truth {sorted(leaked)}")
        causality = meta.get("causality") or {}
        if (
            "end_time" not in str(causality.get("traces"))
            or causality.get("available_after_s") != AVAILABLE_AFTER_S
        ):
            errors.append(
                f"{run_id}: feature không khai báo quy tắc thời điểm của {FEATURE_VERSION}"
            )
        errors += _check_time(run_id, directory, meta)
        if run_id not in slots:
            errors.append(f"{run_id}: không có trong dataset manifest")
    if len(versions) > 1:
        errors.append(f"phiên bản feature/lọc nhiễu không đồng nhất: {sorted(map(str, versions))}")
    expected = (FEATURE_VERSION, NOISE_FILTER_VERSION)
    if versions and versions != {expected}:
        errors.append(f"cần {expected}, có {sorted(map(str, versions))}")
    return errors
