"""Từ vựng định danh canonical của topology v2 (service catalogue v2, ADR-005, ADR-006)."""

from __future__ import annotations

#: 11 runtime phát telemetry: 7 service + 4 worker.
RUNTIMES: tuple[str, ...] = (
    "gateway",
    "identity",
    "course",
    "media",
    "media-worker",
    "notification",
    "notification-worker",
    "scheduler",
    "scheduler-worker",
    "ai",
    "ai-worker",
)

#: Tập ứng viên nguyên nhân gốc: mọi runtime trừ `gateway` (ADR-006).
CANDIDATE_SET: tuple[str, ...] = tuple(name for name in RUNTIMES if name != "gateway")

#: Tên span gốc của trace nhiễu (case catalogue mục 1.5): probe `/ready`, `/health` của mọi runtime
#: và vòng thăm dò DB mỗi giây của `scheduler-worker`. Không mang thông tin về luồng nghiệp vụ.
NOISE_TRACE_ROOT_NAMES: frozenset[str] = frozenset(
    {
        "GET /ready",
        "GET /health",
        "scheduler-postgres run.claim-next",
        "scheduler-postgres run.fail-exhausted",
        "scheduler-postgres job.lock-due-cron",
    }
)

#: Route probe sinh access log mỗi 5 giây ở mọi runtime.
PROBE_ROUTES: tuple[str, ...] = ("/ready", "/health")
