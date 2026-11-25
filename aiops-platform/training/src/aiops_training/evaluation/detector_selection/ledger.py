"""Ledger chấm validation: mỗi lần chấm, dùng lại, chọn, freeze là một dòng JSON, chỉ ghi thêm.

Mọi lần chấm phải chạy trên commit chứa merge commit của PR khai báo `detection-candidates.v2`
(PR #103, evaluation-protocol-v1 mục 6.1.3 "Thực thi") và code training không có thay đổi chưa
commit. Ledger nằm ngoài `configs/`: harness coi thay đổi chưa commit trong `configs/` là code bẩn
và từ chối chấm, nên ghi ledger vào đó sẽ chặn chính lần chấm kế tiếp.
"""

from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..detection.harness import CODE_PATHSPEC, code_provenance

#: Merge commit của PR #103 (task-05 tuần 16) trên `main`.
CANDIDATES_V2_MERGE_COMMIT = "f57c322654baf57fc9753fdf6652606343b734a9"


class LedgerError(RuntimeError):
    pass


def scoring_code(training_root: Path, required_commit: str = CANDIDATES_V2_MERGE_COMMIT) -> dict:
    """Commit hiện tại nếu được phép chấm; ngược lại báo lỗi."""
    code = code_provenance(training_root)
    if code.get("commit") is None or code.get("dirty") is not False:
        raise LedgerError(
            "Code training có thay đổi chưa commit hoặc không kiểm được bằng git: commit trước khi "
            "chấm validation"
        )
    ancestor = subprocess.run(
        ["git", "-C", str(training_root), "merge-base", "--is-ancestor", required_commit, "HEAD"],
        capture_output=True,
        text=True,
    )
    if ancestor.returncode != 0:
        raise LedgerError(
            f"HEAD {code['commit']} không chứa merge commit {required_commit} của PR khai báo "
            "detection-candidates.v2: không được chấm validation"
        )
    return {
        **code,
        "code_tree": code_tree(training_root),
        "contains_candidates_v2_merge": required_commit,
    }


def code_tree(training_root: Path) -> str:
    """Định danh nội dung code của HEAD: tree/blob sha của `CODE_PATHSPEC` (src, configs,
    pyproject.toml, uv.lock). Commit chỉ đổi `evaluations/` (ledger, artifact) không đổi giá trị
    này; commit sửa code thì đổi. Mọi bước của một lượt chọn phải cùng giá trị ghi ở `setup`."""
    shas = []
    for name in CODE_PATHSPEC:
        result = subprocess.run(
            ["git", "-C", str(training_root), "rev-parse", f"HEAD:./{name}"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise LedgerError(f"Không đọc được {name} ở HEAD: {result.stderr.strip()}")
        shas.append(f"{name}={result.stdout.strip()}")
    return ";".join(shas)


class Ledger:
    def __init__(self, path: Path) -> None:
        self.path = path

    def entries(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        return [json.loads(line) for line in self.path.read_text("utf-8").splitlines() if line]

    def append(self, event: str, **fields: Any) -> dict[str, Any]:
        entries = self.entries()
        entry = {
            "seq": len(entries) + 1,
            "event": event,
            "recorded_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            **fields,
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")
        return entry

    def find(self, event: str, **match: Any) -> list[dict[str, Any]]:
        return [
            e
            for e in self.entries()
            if e["event"] == event and all(e.get(k) == v for k, v in match.items())
        ]
