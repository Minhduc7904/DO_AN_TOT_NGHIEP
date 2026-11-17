#!/usr/bin/env bash
# Chạy một scenario k6 bằng image grafana/k6 có version cố định (máy không cần cài k6).
#
#   aiops-platform/load/run-k6.sh level-1 [tham số thêm cho `k6 run`]
#
# Container dùng network của host: upload trực tiếp lên MinIO đi tới URL presigned ký cho
# `MINIO_PUBLIC_URL` (mặc định http://localhost:9000), chỉ host mới gọi được địa chỉ đó.
# Tóm tắt run ghi vào $RESULTS_HOST_DIR/<RUN_ID>/k6-summary.json (mặc định aiops-platform/load/results/).
set -euo pipefail

K6_IMAGE="grafana/k6:1.3.0"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIO="${1:?Dùng: run-k6.sh <scenario> (ví dụ level-1) [tham số k6]}"
shift
SCRIPT="$ROOT/scenarios/$SCENARIO.js"
[[ -f "$SCRIPT" ]] || { echo "Không có scenario $SCRIPT" >&2; exit 2; }

export RUN_ID="${RUN_ID:-k6-${SCENARIO}-$(date -u +%Y%m%dT%H%M%SZ)}"
RESULTS_HOST_DIR="${RESULTS_HOST_DIR:-$ROOT/results}"
mkdir -p "$RESULTS_HOST_DIR/$RUN_ID"

# Chỉ chuyển các biến cấu hình đã biết (xem lib/config.js) vào container.
PASS_THROUGH=(BASE_URL SEED DURATION JOURNEYS VUS THINK_MIN_S THINK_MAX_S W7_PAUSE_S
  W7_RETENTION_HOURS W5_MAX_BATCHES_PER_VU LLM_PROVIDER_URL SEED_STUDENTS SEED_INSTRUCTORS
  SEED_PASSWORD ADMIN_EMAIL ADMIN_PASSWORD ASYNC_TIMEOUT_S
  VUS_W1 VUS_W2 VUS_W3 VUS_W4 VUS_W5 VUS_W6 VUS_W7)
ENV_ARGS=(-e "RUN_ID=$RUN_ID" -e "RESULTS_DIR=/results")
for name in "${PASS_THROUGH[@]}"; do
  if [[ -n "${!name:-}" ]]; then ENV_ARGS+=(-e "$name=${!name}"); fi
done

echo "[k6] run_id=$RUN_ID scenario=$SCENARIO kết quả: $RESULTS_HOST_DIR/$RUN_ID" >&2
exec docker run --rm --network host -u "$(id -u):$(id -g)" \
  -v "$ROOT:/load:ro" -v "$RESULTS_HOST_DIR:/results" \
  "${ENV_ARGS[@]}" "$K6_IMAGE" run "$@" "/load/scenarios/$SCENARIO.js"
