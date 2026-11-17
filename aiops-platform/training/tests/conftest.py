"""Tiện ích test: giả lập backend Prometheus/Tempo/Loki ở tầng transport của httpx.

Chỉ phần phụ thuộc bên ngoài (HTTP API của backend) là giả; adapter, httpx và pyarrow chạy thật.
Định dạng phản hồi chép từ backend thật của testbed (Prometheus 3, Tempo 3.1, Loki 3.7).
"""

from __future__ import annotations

import base64
from collections.abc import Callable
from datetime import UTC, datetime

import httpx
import pytest

from aiops_training.telemetry.window import ExportWindow

Handler = Callable[[httpx.Request], httpx.Response]


def make_client(
    routes: dict[str, Handler], calls: list[httpx.Request] | None = None
) -> httpx.Client:
    def handle(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request)
        for prefix, handler in routes.items():
            if request.url.path.startswith(prefix):
                return handler(request)
        return httpx.Response(404, json={"error": f"no route {request.url.path}"})

    return httpx.Client(transport=httpx.MockTransport(handle))


def b64_id(hex_id: str) -> str:
    return base64.b64encode(bytes.fromhex(hex_id)).decode()


@pytest.fixture
def window() -> ExportWindow:
    return ExportWindow(
        "run-test-1",
        datetime(2026, 11, 17, 9, 43, 0, tzinfo=UTC),
        datetime(2026, 11, 17, 9, 45, 0, tzinfo=UTC),
    )


@pytest.fixture
def now() -> datetime:
    return datetime(2026, 11, 17, 10, 0, 0, tzinfo=UTC)
