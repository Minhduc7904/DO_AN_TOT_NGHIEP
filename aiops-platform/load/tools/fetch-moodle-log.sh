#!/usr/bin/env bash
# Tải log Moodle Unistudium 2022 từ Zenodo và kiểm checksum trước khi giải nén.
#
#   aiops-platform/load/tools/fetch-moodle-log.sh
#
# Nguồn: Milani, Biondi, Franzoni, "Unistudium 2022: students groups logs on moodle", Zenodo v1.2,
# DOI 10.5281/zenodo.13763175, giấy phép CC BY 4.0 — https://zenodo.org/records/13763175
# Dữ liệu ghi vào aiops-platform/load/data/moodle/ (gitignore, không commit — ADR-007).
set -euo pipefail

URL="https://zenodo.org/records/13763175/files/Unistudium_students_groups_logs_2022.zip?download=1"
# md5 lấy từ trang Zenodo; sha256 tính trên tệp tải ngày 17/11/2026 (md5 khớp Zenodo).
EXPECTED_MD5="cdec50cd4a5fc3abf3204f06bf43ee25"
EXPECTED_SHA256="1b6abee439d669b4b101243e85cff5e778f11c22294385b8d84d5429b88863a1"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${MOODLE_DATA_DIR:-$ROOT/data/moodle}"
ZIP="$DEST/Unistudium_students_groups_logs_2022.zip"
mkdir -p "$DEST"

if [[ ! -f "$ZIP" ]]; then
  echo "[moodle] tải $URL" >&2
  curl --fail --location --silent --show-error --output "$ZIP.part" "$URL"
  mv "$ZIP.part" "$ZIP"
fi

actual_md5="$(md5sum "$ZIP" | cut -d' ' -f1)"
actual_sha256="$(sha256sum "$ZIP" | cut -d' ' -f1)"
if [[ "$actual_md5" != "$EXPECTED_MD5" || "$actual_sha256" != "$EXPECTED_SHA256" ]]; then
  echo "[moodle] checksum lệch: md5 $actual_md5 (cần $EXPECTED_MD5), sha256 $actual_sha256 (cần $EXPECTED_SHA256)" >&2
  echo "[moodle] xóa $ZIP và kiểm lại nguồn trước khi dùng" >&2
  exit 1
fi

unzip -o -q "$ZIP" -d "$DEST"
echo "[moodle] checksum khớp; đã giải nén vào $DEST" >&2
find "$DEST" -name '*.csv' -print
