"""Kiểm tra chống leakage tự động cho feature và baseline (evaluation-protocol-v1 mục 3.3, 5.1, 7.2,
9.1). Trả danh sách vi phạm; rỗng là đạt.

1. **Split:** không `run_id` nào thuộc hai split trong dataset manifest (kể cả run bị thay).
2. **Fit chỉ trên train:** mọi run trong `fit_runs` của baseline là run train của manifest; baseline
   ghi đúng `dataset_id`.
3. **Không có trường ground truth trong feature:** tên cột của mọi bảng feature và khóa trong
   `features-manifest.json` không chứa trường truth của mục 3.3 (`fault_*`, `root_cause_*`,
   `expected_*`, `scenario_id`, `case_id`…).
4. **Cùng phiên bản:** mọi run và baseline dùng cùng `feature_config_version` và
   `noise_filter_version` (mục 8.5: áp như nhau cho mọi run).
5. **Không dùng dữ liệu tương lai:** manifest feature khai báo quy tắc gán theo thời điểm của
   pipeline hiện hành (span theo `end_time`, mẫu trong `[window_start, window_end)`) và độ trễ
   thu thập.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from .baseline import read_feature_meta
from .pipeline import AVAILABLE_AFTER_S, FEATURE_VERSION, NOISE_FILTER_VERSION, TABLES

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


def _slots_by_run(manifest: dict[str, Any]) -> dict[str, set[str]]:
    splits: dict[str, set[str]] = {}
    for slot in manifest.get("slots", []):
        for run_id in [slot.get("run_id"), *slot.get("replaced_run_ids", [])]:
            if run_id:
                splits.setdefault(run_id, set()).add(slot["split"])
    return splits


def _keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for item in value.values() for key in _keys(item)}
    if isinstance(value, list):
        return {key for item in value for key in _keys(item)}
    return set()


def check_leakage(
    manifest: dict[str, Any],
    baseline: dict[str, Any] | None,
    feature_dirs: dict[str, Path],
) -> list[str]:
    errors: list[str] = []
    splits = _slots_by_run(manifest)
    for run_id, names in sorted(splits.items()):
        if len(names) > 1:
            errors.append(f"run {run_id} thuộc nhiều split: {sorted(names)}")

    if baseline is not None:
        if baseline.get("dataset_id") != manifest.get("dataset_id"):
            errors.append(
                f"baseline fit trên dataset {baseline.get('dataset_id')}, "
                f"không phải {manifest.get('dataset_id')}"
            )
        for run_id in baseline.get("fit_runs", []):
            names = splits.get(run_id, set())
            if names != {"train"}:
                errors.append(f"baseline fit trên run {run_id} thuộc split {sorted(names) or '∅'}")

    versions = set()
    if baseline is not None:
        versions.add((baseline["feature_config_version"], baseline["noise_filter_version"]))
    for run_id, directory in sorted(feature_dirs.items()):
        meta = read_feature_meta(directory)
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
        if run_id not in splits:
            errors.append(f"{run_id}: không có trong dataset manifest")
    if len(versions) > 1:
        errors.append(f"phiên bản feature/lọc nhiễu không đồng nhất: {sorted(map(str, versions))}")
    expected = (FEATURE_VERSION, NOISE_FILTER_VERSION)
    if versions and versions != {expected}:
        errors.append(f"cần {expected}, có {sorted(map(str, versions))}")
    return errors
