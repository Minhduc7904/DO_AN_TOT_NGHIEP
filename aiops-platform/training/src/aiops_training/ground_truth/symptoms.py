"""Đo độ trễ từ `fault_start` tới triệu chứng đầu tiên của từng case MVP (evaluation-protocol-v1 mục
7.3) và xem triệu chứng có lan ra ngoài đường request của nguyên nhân không (mục 5.2 điều kiện 2).

Dùng cho pilot: chốt thời lượng fault active (lớn hơn độ trễ triệu chứng cộng window và
persistence) và ghi `case_verification_status`. Đây **không** phải detector và không đi vào feature
(cùng ranh giới với `validate.py`): ngưỡng cố định, so với đoạn ngay trước fault của chính run.

Mỗi tín hiệu được tính trên lưới thời điểm của mẫu metric (bước export 5 s), bằng cửa sổ trượt
`window_s` kết thúc tại mỗi mẫu:

- `latency`: trung bình Δsum/Δcount của histogram trong cửa sổ ≥ `latency_ratio` × trung bình của
  đoạn trước fault và cao hơn trung bình đó ít nhất `latency_min_delta_s`. Cửa sổ không có lời gọi
  nào thì bỏ qua (không có dữ liệu, không phải "khỏe").
- `counter`: mức tăng trong cửa sổ > mức tăng kỳ vọng theo tốc độ trước fault × `counter_ratio` và
  > mức tăng lớn nhất của một cửa sổ trước fault (trước fault bằng 0 thì chỉ cần tăng).
- `gauge`: giá trị > `gauge_ratio` × lớn nhất trước fault (và hơn ít nhất 1).
- `stall`: counter (ví dụ CPU của tiến trình) không tăng trong cả cửa sổ, trong khi trước fault
  luôn tăng: tiến trình ngừng chạy dù series vẫn còn mẫu.

Thời điểm triệu chứng là **cuối** cửa sổ đầu tiên vượt ngưỡng và vượt tiếp ở `persistence` cửa sổ có
dữ liệu kế tiếp, nên độ trễ đo được là cận trên với sai số tối đa `window_s` cộng độ trễ thu thập
(counter 4–10 s, mục 7.2).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from ..telemetry.window import parse_utc
from .validate import SERIES_KEY, counter_increase, load_metrics

Kind = Literal["latency", "counter", "gauge", "stall"]
#: `root_cause`: chính thành phần bị lỗi; `request_path`: service nằm trên đường request đi qua
#: nguyên nhân (gateway → service → dependency); `outside_request_path`: tiến trình/luồng khác.
Role = Literal["root_cause", "request_path", "outside_request_path"]


@dataclass(frozen=True)
class SymptomSignal:
    signal_id: str
    kind: Kind
    #: Tên metric; với `latency` là tên gốc của histogram (không có `_sum`/`_count`).
    metric: str
    match: dict[str, str]
    role: Role
    description: str
    #: Bỏ các `operation_name` này (ví dụ `ping` của health probe: không phải traffic của workload).
    exclude_operations: tuple[str, ...] = ()


def _dep(service: str, dependency: str, role: Role, description: str, **extra) -> SymptomSignal:
    return SymptomSignal(
        signal_id=f"{service}:{dependency}:latency",
        kind="latency",
        metric="lms_dependency_duration_seconds",
        match={"service_name": service, "dependency_identity": dependency},
        role=role,
        description=description,
        **extra,
    )


def _errors(service: str, dependency: str, role: Role, description: str) -> SymptomSignal:
    return SymptomSignal(
        signal_id=f"{service}:{dependency}:errors",
        kind="counter",
        metric="lms_dependency_error_count_total",
        match={"service_name": service, "dependency_identity": dependency},
        role=role,
        description=description,
    )


PROBE = ("ping",)
_EPS = timedelta(microseconds=1)

CASE_SIGNALS: dict[str, list[SymptomSignal]] = {
    "C2": [
        _dep("course", "course-postgres", "root_cause", "truy vấn của course tới PostgreSQL"),
        _dep("gateway", "gateway-course", "request_path", "gateway chờ course"),
        _dep("ai-worker", "ai-worker-course", "outside_request_path", "ai-worker gọi course"),
    ],
    "C3": [
        _dep("ai-worker", "ai-llm-provider", "root_cause", "ai-worker gọi provider LLM"),
        SymptomSignal(
            signal_id="ai-worker:run-ai-job:unacked",
            kind="gauge",
            metric="rabbitmq_detailed_queue_messages_unacked",
            match={"service_name": "ai-worker", "queue": "ai-worker--run-ai-job-v1"},
            role="outside_request_path",
            description="job AI đang chạy dở (message chưa ack) ở ai-worker",
        ),
        SymptomSignal(
            signal_id="ai-worker:extract-ai-document:unacked",
            kind="gauge",
            metric="rabbitmq_detailed_queue_messages_unacked",
            match={"service_name": "ai-worker", "queue": "ai-worker--extract-ai-document-v1"},
            role="outside_request_path",
            description="tài liệu đang trích xuất dở ở ai-worker",
        ),
        _dep("ai-worker", "ai-worker-course", "outside_request_path", "ai-worker gọi course"),
    ],
    "C4": [
        _dep(
            "media",
            "media-minio",
            "root_cause",
            "media gọi MinIO (bỏ ping của probe)",
            exclude_operations=PROBE,
        ),
        _dep(
            "media-worker",
            "media-minio",
            "outside_request_path",
            "media-worker (thumbnail) gọi MinIO (bỏ ping của probe)",
            exclude_operations=PROBE,
        ),
        _dep("gateway", "gateway-media", "request_path", "gateway chờ media"),
        _dep("course", "course-media", "outside_request_path", "course gọi media"),
        _dep(
            "scheduler-worker",
            "scheduler-worker-media",
            "outside_request_path",
            "scheduler-worker (dọn media theo lịch) gọi media",
        ),
    ],
    "C6": [
        SymptomSignal(
            signal_id="identity:cpu:stall",
            kind="stall",
            metric="process_cpu_time_seconds_total",
            match={"service_name": "identity"},
            role="root_cause",
            description="CPU của identity ngừng tăng (tiến trình bị pause)",
        ),
        _errors("gateway", "gateway-identity", "request_path", "đăng nhập/refresh qua gateway lỗi"),
        _errors(
            "gateway",
            "gateway-identity-token",
            "outside_request_path",
            "gateway không lấy được token dịch vụ (sau TTL)",
        ),
        SymptomSignal(
            signal_id="gateway:http:5xx",
            kind="counter",
            metric="http_server_request_count_total",
            match={"service_name": "gateway", "http_status_class": "5xx"},
            role="outside_request_path",
            description="request qua gateway trả 5xx (mọi route)",
        ),
        *(
            _errors(worker, f"{worker}-identity-token", "outside_request_path", "worker mất token")
            for worker in ("ai-worker", "notification-worker", "scheduler-worker")
        ),
    ],
}


@dataclass(frozen=True)
class SymptomConfig:
    baseline_s: float = 300.0
    window_s: float = 15.0
    #: Số cửa sổ có dữ liệu liên tiếp (tính cả cửa sổ đầu) phải vượt ngưỡng.
    persistence: int = 2
    latency_ratio: float = 2.0
    #: Mức tăng tuyệt đối tối thiểu: tránh báo nhầm khi trước fault chỉ có vài lời gọi vài ms (trễ
    #: chèn ở pilot là 200–300 ms, LLM 30 s).
    latency_min_delta_s: float = 0.05
    #: Ngưỡng khi trước fault không có lời gọi nào (như `validate.py`).
    latency_floor_s: float = 0.1
    counter_ratio: float = 3.0
    gauge_ratio: float = 2.0
    #: Tìm triệu chứng tới `fault_end` + đoạn này (triệu chứng muộn, mục 17.3).
    tail_s: float = 300.0


@dataclass
class _Series:
    points: dict[tuple, list[tuple[datetime, float]]] = field(default_factory=dict)

    def increase(self, start: datetime, end: datetime) -> float:
        return sum(counter_increase(p, start, end) for p in self.points.values())

    def gauge(self, start: datetime, end: datetime) -> float | None:
        # Tổng theo series của mẫu cuối cùng trong cửa sổ.
        values = [
            [v for ts, v in p if start <= ts < end][-1]
            for p in self.points.values()
            if any(start <= ts < end for ts, _ in p)
        ]
        return sum(values) if values else None

    def timestamps(self) -> list[datetime]:
        return sorted({ts for p in self.points.values() for ts, _ in p})


def _select(all_series, metric: str, signal: SymptomSignal) -> _Series:
    out = _Series()
    for key, points in all_series.items():
        fields = dict(zip(SERIES_KEY, key, strict=True))
        if fields["metric_name"] != metric:
            continue
        if any(fields.get(name) != value for name, value in signal.match.items()):
            continue
        if fields.get("operation_name") in signal.exclude_operations:
            continue
        out.points[key] = points
    return out


def _metrics_for(signal: SymptomSignal) -> list[str]:
    if signal.kind == "latency":
        return [f"{signal.metric}_sum", f"{signal.metric}_count"]
    return [signal.metric]


def _evaluate(signal, all_series, fault_start, fault_end, config) -> dict[str, Any]:
    window = timedelta(seconds=config.window_s)
    base = (fault_start - timedelta(seconds=config.baseline_s), fault_start)
    search_end = fault_end + timedelta(seconds=config.tail_s)
    names = _metrics_for(signal)
    primary = _select(all_series, names[0], signal)
    count_series = _select(all_series, names[1], signal) if signal.kind == "latency" else None
    stamps = [ts for ts in primary.timestamps() if ts - window >= base[0]]

    def value_at(ts: datetime) -> float | None:
        # Cửa sổ (ts − window, ts]: gồm mẫu tại ts (hàm bên dưới nhận khoảng nửa mở [start, end)).
        start, end = ts - window + _EPS, ts + _EPS
        if count_series is not None:
            count = count_series.increase(start, end)
            return primary.increase(start, end) / count if count > 0 else None
        if signal.kind in ("counter", "stall"):
            return primary.increase(start, end)
        return primary.gauge(start, end)

    result: dict[str, Any] = {
        **{k: v for k, v in asdict(signal).items() if k != "exclude_operations"},
        "exclude_operations": list(signal.exclude_operations),
        "observed": False,
        "onset": None,
        "lag_s": None,
    }
    if not primary.points:
        return {**result, "status": "no_data"}

    if count_series is not None:
        calls = count_series.increase(*base)
        baseline = primary.increase(*base) / calls if calls > 0 else None
        threshold = (
            config.latency_floor_s
            if baseline is None
            else max(config.latency_ratio * baseline, baseline + config.latency_min_delta_s)
        )

        def exceeds(v: float) -> bool:
            return v >= threshold

        result["baseline"] = {"mean_s": baseline, "calls": calls}
    elif signal.kind == "counter":
        rate = primary.increase(*base) / config.baseline_s
        expected = rate * config.window_s
        # Counter thưa (vài lỗi rải rác trước fault): một lỗi rơi vào cửa sổ đã vượt `ratio` × trung
        # bình, nên ngưỡng còn phải lớn hơn mức tăng lớn nhất của một cửa sổ trước fault.
        busiest = max(
            (v for ts in stamps if base[0] + window <= ts < base[1] if (v := value_at(ts))),
            default=0.0,
        )
        threshold = max(expected * config.counter_ratio, busiest)

        def exceeds(v: float) -> bool:
            return v > threshold

        result["baseline"] = {"increase_per_window": expected, "max_window_increase": busiest}
    elif signal.kind == "gauge":
        values = [v for ts in stamps if base[0] <= ts < base[1] and (v := value_at(ts)) is not None]
        peak = max(values) if values else 0.0
        threshold = max(peak * config.gauge_ratio, peak + 1)

        def exceeds(v: float) -> bool:
            return v >= threshold

        result["baseline"] = {"max": peak}
    else:  # stall
        windows = [value_at(ts) for ts in stamps if base[0] + window <= ts < base[1]]
        alive = bool(windows) and all(v and v > 0 for v in windows)
        threshold = 0.0

        def exceeds(v: float) -> bool:
            return alive and v <= 0

        result["baseline"] = {"always_increasing": alive}
    result["threshold"] = threshold

    during = [
        (ts, v)
        for ts in stamps
        if fault_start < ts <= search_end and (v := value_at(ts)) is not None
    ]
    result["peak_during_fault"] = max((v for _, v in during), default=None)
    for index, (ts, value) in enumerate(during):
        if not exceeds(value):
            continue
        following = during[index : index + config.persistence]
        if len(following) == config.persistence and all(exceeds(v) for _, v in following):
            result.update(
                observed=True,
                onset=ts.isoformat().replace("+00:00", "Z"),
                lag_s=(ts - fault_start).total_seconds(),
                after_fault_end=ts > fault_end,
            )
            break
    result["status"] = "observed" if result["observed"] else "not_observed"
    return result


def measure_symptoms(
    case_id: str,
    fault_start: datetime,
    fault_end: datetime,
    artifact_dir: Path,
    config: SymptomConfig | None = None,
) -> dict[str, Any]:
    config = config or SymptomConfig()
    if case_id not in CASE_SIGNALS:
        raise ValueError(f"Không có tín hiệu triệu chứng cho case {case_id}")
    signals = CASE_SIGNALS[case_id]
    names = {name for signal in signals for name in _metrics_for(signal)}
    all_series = load_metrics(artifact_dir, names)
    results = [_evaluate(s, all_series, fault_start, fault_end, config) for s in signals]

    def first(roles: tuple[str, ...]) -> float | None:
        lags = [r["lag_s"] for r in results if r["observed"] and r["role"] in roles]
        return min(lags) if lags else None

    return {
        "case_id": case_id,
        "fault_start": fault_start.isoformat().replace("+00:00", "Z"),
        "fault_end": fault_end.isoformat().replace("+00:00", "Z"),
        "config": asdict(config),
        "signals": results,
        "root_cause_lag_s": first(("root_cause",)),
        "first_symptom_lag_s": first(("request_path", "outside_request_path")),
        "outside_request_path_lag_s": first(("outside_request_path",)),
        "outside_request_path_observed": any(
            r["observed"] for r in results if r["role"] == "outside_request_path"
        ),
    }


def measure_from_ground_truth(
    ground_truth: dict[str, Any], artifact_dir: Path, config: SymptomConfig | None = None
) -> dict[str, Any]:
    case_id = (ground_truth.get("fault_parameters") or {}).get("case_id")
    if not case_id or not ground_truth.get("fault_start") or not ground_truth.get("fault_end"):
        raise ValueError("RunGroundTruth không có case hoặc khoảng fault đã đóng")
    return measure_symptoms(
        case_id,
        parse_utc(ground_truth["fault_start"]),
        parse_utc(ground_truth["fault_end"]),
        artifact_dir,
        config,
    )
