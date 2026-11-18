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
# run_id định danh một lần chạy (export telemetry, ground truth, tên provider/job/idempotency key phía
# server đều theo nó). Dùng lại sẽ ghi đè kết quả và va tên đã tạo ở lần trước, nên từ chối.
if [[ -n "$(ls -A "$RESULTS_HOST_DIR/$RUN_ID" 2>/dev/null)" ]]; then
  echo "RUN_ID=$RUN_ID đã có kết quả ở $RESULTS_HOST_DIR/$RUN_ID; đặt RUN_ID mới" >&2
  exit 2
fi
mkdir -p "$RESULTS_HOST_DIR/$RUN_ID"

# Chỉ chuyển các biến cấu hình đã biết (xem lib/config.js) vào container.
PASS_THROUGH=(BASE_URL SEED DURATION JOURNEYS VUS THINK_MIN_S THINK_MAX_S W7_PAUSE_S
  W7_RETENTION_HOURS W5_MAX_BATCHES_PER_VU LLM_PROVIDER_URL SEED_STUDENTS SEED_INSTRUCTORS
  SEED_PASSWORD ADMIN_EMAIL ADMIN_PASSWORD ASYNC_TIMEOUT_S
  VUS_W1 VUS_W2 VUS_W3 VUS_W4 VUS_W5 VUS_W6 VUS_W7
  PLAN WORKLOAD_SEED WINDOW_START_S WINDOW_S STUDENT_PRE_VUS STUDENT_MAX_VUS
  PROFILE INSTRUCTOR_PRE_VUS INSTRUCTOR_MAX_VUS MEDIA_POOL_SIZE)
ENV_ARGS=(-e "RUN_ID=$RUN_ID" -e "RESULTS_DIR=/results")
for name in "${PASS_THROUGH[@]}"; do
  if [[ -n "${!name:-}" ]]; then ENV_ARGS+=(-e "$name=${!name}"); fi
done

# Mức 2/2+: nhật ký thao tác đi qua console.log → log JSON của k6 → tách thành actions.jsonl,
# sessions.jsonl (workload-design-v1 mục 11.2). Mức 1 giữ log trên terminal như cũ.
LOG_ARGS=()
if [[ "$SCENARIO" != "level-1" ]]; then
  LOG_ARGS=(--log-format json --log-output "file=/results/$RUN_ID/k6-log.jsonl")
fi

echo "[k6] run_id=$RUN_ID scenario=$SCENARIO kết quả: $RESULTS_HOST_DIR/$RUN_ID" >&2
status=0
docker run --rm --network host -u "$(id -u):$(id -g)" \
  -v "$ROOT:/load:ro" -v "$RESULTS_HOST_DIR:/results" \
  "${ENV_ARGS[@]}" "$K6_IMAGE" run "${LOG_ARGS[@]}" "$@" "/load/scenarios/$SCENARIO.js" || status=$?
if [[ ${#LOG_ARGS[@]} -gt 0 && -f "$RESULTS_HOST_DIR/$RUN_ID/k6-log.jsonl" ]]; then
  node "$ROOT/tools/split-workload-log.mjs" "$RESULTS_HOST_DIR/$RUN_ID" >&2
fi
exit "$status"
