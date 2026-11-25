"""Bootstrap percentile CI theo run, phân tầng (evaluation-protocol-v1 mục 20.7).

Fault run phân tầng theo case, run khỏe theo profile. Một tầng chỉ có một run thì mọi lần lấy mẫu
lại đều chọn đúng run đó: CI của chỉ số dùng tầng ấy suy biến và được báo `degenerate`.
"""

from __future__ import annotations

import random
from collections import defaultdict
from collections.abc import Callable, Sequence
from typing import Any

from .metrics import RunUnit, counts, false_alarm_rate, healthy_rates

Statistic = Callable[[Sequence[RunUnit]], float | None]


def _recall(units: Sequence[RunUnit]) -> float | None:
    return counts(units)["recall"]


def _precision(units: Sequence[RunUnit]) -> float | None:
    return counts(units)["precision"]


def _f1(units: Sequence[RunUnit]) -> float | None:
    return counts(units)["f1"]


def _false_alarms_per_hour(units: Sequence[RunUnit]) -> float | None:
    return false_alarm_rate(units)["per_hour"]


def _fp_per_healthy_hour(units: Sequence[RunUnit]) -> float | None:
    return healthy_rates(units)["fp_per_healthy_hour"]


def _healthy_run_fpr(units: Sequence[RunUnit]) -> float | None:
    return healthy_rates(units)["healthy_run_fpr"]


#: Tên chỉ số → (hàm, loại run tham gia: "fault", "healthy" hoặc cả hai).
STATISTICS: dict[str, tuple[Statistic, frozenset[str]]] = {
    "recall": (_recall, frozenset({"fault"})),
    "precision": (_precision, frozenset({"fault", "healthy"})),
    "f1": (_f1, frozenset({"fault", "healthy"})),
    "false_alarms_per_hour": (_false_alarms_per_hour, frozenset({"fault", "healthy"})),
    "fp_per_healthy_hour": (_fp_per_healthy_hour, frozenset({"healthy"})),
    "healthy_run_fpr": (_healthy_run_fpr, frozenset({"healthy"})),
}


def percentile(sorted_values: Sequence[float], q: float) -> float:
    """Nội suy tuyến tính tại vị trí `q × (n − 1)` của dãy đã sắp."""
    if not sorted_values:
        raise ValueError("Dãy rỗng")
    position = q * (len(sorted_values) - 1)
    low = int(position)
    high = min(low + 1, len(sorted_values) - 1)
    return sorted_values[low] + (sorted_values[high] - sorted_values[low]) * (position - low)


def _strata(units: Sequence[RunUnit]) -> dict[str, list[RunUnit]]:
    groups: dict[str, list[RunUnit]] = defaultdict(list)
    for unit in units:
        groups[unit.stratum].append(unit)
    # Sắp theo tên tầng và run_id để cùng seed luôn cho cùng chuỗi lấy mẫu.
    return {
        name: sorted(group, key=lambda u: u.detection.run_id)
        for name, group in sorted(groups.items())
    }


def bootstrap_ci(
    units: Sequence[RunUnit],
    *,
    resamples: int,
    seed: int,
    confidence: float = 0.95,
    statistics: Sequence[str] | None = None,
) -> dict[str, Any]:
    names = list(statistics or STATISTICS)
    strata = _strata(units)
    rng = random.Random(seed)
    samples: dict[str, list[float]] = {name: [] for name in names}
    for _ in range(resamples):
        resample: list[RunUnit] = []
        for group in strata.values():
            resample.extend(group[rng.randrange(len(group))] for _ in range(len(group)))
        for name in names:
            value = STATISTICS[name][0](resample)
            if value is not None:
                samples[name].append(value)

    alpha = (1 - confidence) / 2
    result: dict[str, Any] = {}
    for name in names:
        function, kinds = STATISTICS[name]
        involved = {
            stratum: len(group)
            for stratum, group in strata.items()
            if ("fault" if group[0].is_fault_run else "healthy") in kinds
        }
        single = sorted(stratum for stratum, size in involved.items() if size == 1)
        values = sorted(samples[name])
        entry: dict[str, Any] = {
            "point": function(units),
            "ci_low": None,
            "ci_high": None,
            "strata": involved,
            "degenerate_strata": single,
            "valid_resamples": len(values),
        }
        if not involved or not values:
            entry["status"] = "undefined"
        elif single:
            entry["status"] = "degenerate"
        else:
            entry["status"] = "ok"
            entry["ci_low"] = percentile(values, alpha)
            entry["ci_high"] = percentile(values, 1 - alpha)
        result[name] = entry
    return {
        "method": "percentile",
        "confidence": confidence,
        "resamples": resamples,
        "seed": seed,
        "unit": "run",
        "statistics": result,
    }
