import json
from datetime import UTC, datetime

import pytest

from aiops_training.telemetry.window import ExportWindow, parse_utc


def test_from_k6_summary_adds_grace(tmp_path):
    summary = tmp_path / "k6-summary.json"
    summary.write_text(
        json.dumps(
            {
                "run_id": "k6-level1-evidence",
                "started_at": "2026-11-17T09:43:01.008Z",
                "finished_at": "2026-11-17T09:45:07.465Z",
            }
        )
    )
    window = ExportWindow.from_k6_summary(summary, grace_seconds=30)
    assert window.run_id == "k6-level1-evidence"
    assert window.start == datetime(2026, 11, 17, 9, 43, 1, 8000, tzinfo=UTC)
    assert window.end == datetime(2026, 11, 17, 9, 45, 37, 465000, tzinfo=UTC)
    assert window.start_ns == 1794908581008000000


def test_rejects_unsafe_run_id_and_reversed_window():
    start = datetime(2026, 11, 17, 9, 0, tzinfo=UTC)
    with pytest.raises(ValueError, match="run_id"):
        ExportWindow("../etc", start, start.replace(minute=5))
    with pytest.raises(ValueError, match="phải sau"):
        ExportWindow("ok", start, start)


def test_parse_utc_requires_timezone():
    assert parse_utc("2026-11-17T09:43:00Z").tzinfo is not None
    with pytest.raises(ValueError, match="múi giờ"):
        parse_utc("2026-11-17T09:43:00")
