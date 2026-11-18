# faults — cơ chế gây lỗi cho thí nghiệm

Module này tạo ra các "sự cố có kiểm soát" để sinh dữ liệu cho anomaly detection và RCA. Nó không sửa code LMS (LMS đóng băng theo [ADR-006](../../docs/processed/adr/adr-006-trim-project-scope-v1.md)); mọi thứ nằm trong một file Compose ghép thêm vào stack đầy đủ.

Kế hoạch: [plan v0.4 tuần 13–14](../../docs/processed/plan/plan-v0.4-24-weeks.md). Case: [case catalogue v0](../../docs/processed/architecture/complex-case-catalogue-and-rca-result-v0.md) và phần C2 viết lại ở ADR-006.

## Thành phần

| Thành phần | Vai trò | Ở đâu |
| --- | --- | --- |
| `toxiproxy` | Proxy TCP đứng giữa service và dependency; chèn trễ hoặc cắt kết nối lúc đang chạy | `compose.faults.yaml`, danh sách proxy ở `toxiproxy.json` |
| `llm-stub` | Provider LLM giả tương thích OpenAI; chỉnh độ trễ, độ dao động, tỉ lệ lỗi lúc đang chạy | `llm-stub/` |
| `fault-control.mjs` | CLI bật/tắt fault, in một dòng JSON có thời điểm UTC cho mỗi lệnh | `fault-control.mjs` |

Ba proxy, đặt tên theo đường kết nối:

| Proxy | Đường đi | Dependency identity bị ảnh hưởng | Case |
| --- | --- | --- | --- |
| `course-to-postgres` | `course` → `postgres:5432` (chỉ `course_db`) | `course-postgres` | C2 |
| `media-to-minio` | `media` → `minio:9000` | `media-minio` (ghi bởi `media`) | C4 |
| `media-worker-to-minio` | `media-worker` → `minio:9000` | `media-minio` (ghi bởi `media-worker`) | C4 |

C3 dùng `llm-stub`. C6 dùng lệnh `container pause identity` của `fault-control.mjs` (`docker pause`, như [`tracing-smoke`](../../lms/test/observability/tracing-smoke.mjs) đã chạy); overlay đặt `IDENTITY_SERVICE_TOKEN_TTL_SECONDS=60` (biến `FAULTS_SERVICE_TOKEN_TTL_SECONDS`) cho `identity` ở **mọi** run để khoảng yên lặng ngắn lại mà healthy và fault run vẫn cùng cấu hình.

Proxy **luôn nằm trên đường đi**, kể cả ở run healthy, để run healthy và run có lỗi có cùng topology mạng. Độ trễ nền đo bằng `pgbench` (`SELECT 1`, 1 kết nối, 15 giây, 17/11/2026): đi thẳng `postgres` 0,015 ms mỗi truy vấn, qua `toxiproxy` 0,034 ms — chênh khoảng 0,02 ms, không đáng kể so với vài mili giây của một truy vấn thật trong `course`.

## Chạy

Từ thư mục gốc repository, ghép file này **sau** `compose.full.yaml`:

```bash
docker compose --env-file docker-compose/.env \
  -f docker-compose/compose.full.yaml -f aiops-platform/faults/compose.faults.yaml up -d --wait
```

Stack có 23 container (21 của stack đầy đủ cộng `toxiproxy` và `llm-stub`). Cổng chỉ mở trên loopback của host:

| Cổng host | Dịch vụ |
| --- | --- |
| `8474` (`TOXIPROXY_API_PORT`) | API điều khiển toxiproxy |
| `18081` (`LLM_STUB_PORT`) | LLM stub (cả API giả lập lẫn endpoint điều khiển) |

Trong network Compose, `ai`/`ai-worker` gọi stub tại `http://llm-stub:8080/v1`. Provider AI được cấu hình bằng API admin (lưu trong `ai_db`), nên workload hoặc regression phải tạo provider với `base_url` này (biến `REGRESSION_AI_PROVIDER_URL=http://llm-stub:8080/v1`).

> Khi ghép nhiều file bằng `-f`, Compose tính đường dẫn tương đối theo thư mục của file đầu tiên (`docker-compose/`), nên bind mount trong `compose.faults.yaml` viết `../aiops-platform/faults/...`. Đừng đổi thứ tự file.

## Điều khiển fault

```bash
CLI=aiops-platform/faults/fault-control.mjs

node $CLI status                                  # trạng thái 3 proxy và LLM stub
node $CLI latency course-to-postgres 200          # C2: mỗi lượt trả lời từ PostgreSQL chậm thêm 200 ms
node $CLI latency media-to-minio 300 --jitter 50  # C4: trễ MinIO phía media
node $CLI disconnect media-worker-to-minio        # C4: cắt hẳn kết nối media-worker → MinIO
node $CLI clear                                   # gỡ mọi toxic, bật lại mọi proxy

node $CLI llm set --latency-ms 30000 --jitter-ms 5000   # C3: provider chậm
node $CLI llm set --error-rate 0.3 --error-status 503   # C3: lỗi ngắt quãng (chuỗi lỗi theo seed)
node $CLI llm set --error-rate 1 --error-mode disconnect # cắt kết nối thay vì trả lỗi HTTP
node $CLI llm reset                                     # về mặc định

node $CLI container pause identity                      # C6: docker pause aiops-lms-identity-1
node $CLI container unpause identity
```

Mỗi lệnh in **một dòng JSON** có `ts` (UTC), `ok`, hành động và kết quả. Runner (tuần 15) ghi các dòng này vào nhật ký run làm dấu vết thời điểm fault thật. LLM stub cũng ghi một dòng `control.updated` vào log container mỗi lần đổi cấu hình.

### Ý nghĩa tham số

- `latency` của toxiproxy là toxic `latency` chiều **downstream** (dữ liệu từ dependency về service): mỗi gói trả lời bị giữ thêm `ms` (± `jitter`). Một thao tác cần nhiều lượt hỏi-đáp thì chậm gấp nhiều lần (đọc nội dung media cần hai lượt tới MinIO nên trễ 300 ms làm request chậm khoảng 600 ms).
- `disconnect` tắt proxy: kết nối đang mở bị cắt, kết nối mới bị từ chối. `reconnect` hoặc `clear` bật lại.
- LLM stub: độ trễ thực = `latency_ms` + số ngẫu nhiên trong `[0, jitter_ms]`; request lỗi khi số ngẫu nhiên < `error_rate`. Mỗi request rút đúng hai số từ bộ sinh số có seed (`--seed`, mặc định `LLM_STUB_SEED=1`), nên cùng cấu hình và cùng thứ tự request cho cùng chuỗi lỗi. Trễ và lỗi chỉ áp vào `POST /v1/chat/completions`; health check `GET /v1/models` chỉ bị ảnh hưởng khi đặt `--affect-models true`.
- `llm set` chỉ đổi các trường được truyền; trường lạ hoặc giá trị ngoài miền bị từ chối (HTTP 400) và cấu hình cũ giữ nguyên.

## Giới hạn

- Upload trực tiếp từ client lên MinIO (presigned POST tới `MINIO_PUBLIC_URL`) **không đi qua proxy**; proxy chỉ chặn kết nối phía server của `media` và `media-worker` (kiểm tra object, promote, đọc nội dung, thumbnail, xóa).
- `course-to-postgres` chỉ áp cho `course`; các service khác vẫn nối thẳng `postgres`, đúng với C2 (`root_cause_component=course-postgres`).
- Metric bộ đếm lỗi (ví dụ `lms_dependency_request_count_total{status="unavailable"}`) là **chuỗi mới** khi lỗi đầu tiên xảy ra; `increase()`/`rate()` của Prometheus không đếm mẫu đầu của chuỗi mới nên có thể trả 0 cho đợt lỗi đầu. Feature pipeline phải xử lý chuỗi xuất hiện giữa cửa sổ (đọc giá trị thô, coi giá trị trước đó là 0).
- `container pause|unpause` chỉ nhận 11 service runtime của LMS; tên container là `<COMPOSE_PROJECT_NAME>-<service>-1` (mặc định `aiops-lms`).

## Fault manifest và bộ chạy lịch

[`manifests/fault-manifest-v1.json`](manifests/fault-manifest-v1.json) mô tả 4 case MVP theo [case catalogue v0](../../docs/processed/architecture/complex-case-catalogue-and-rca-result-v0.md) và [telemetry-and-ground-truth-schema-v1](../../docs/processed/architecture/telemetry-and-ground-truth-schema-v1.md) mục 9: nhãn ground truth (`fault_type`, `root_cause_service`, `root_cause_component`), lệnh bật/tắt (chính là tham số dòng lệnh của `fault-control.mjs`), thời lượng, điều kiện tiên quyết.

| Case | Bật | Gỡ | Thời lượng khởi đầu |
| --- | --- | --- | --- |
| C2 | `latency course-to-postgres 200 --jitter 20` | `clear course-to-postgres` | 600 s |
| C3 | `llm set --latency-ms 30000 --jitter-ms 5000` | `llm reset` | 600 s |
| C4 | `latency media-to-minio 300 --jitter 30` và `media-worker-to-minio` như vậy | `clear` hai proxy | 600 s |
| C6 | `container pause identity` (cần TTL token dịch vụ 60 s) | `container unpause identity` | 300 s |

Mọi giá trị là **điểm khởi đầu trước pilot**; pilot tuần 15 chốt thời lượng và cường độ (evaluation-protocol-v1 mục 6.1, 7.3). Run 48 phút: phút 0–6 warm-up, fault mặc định bắt đầu ở phút 18, sau khi gỡ giữ ít nhất 10 phút recovery.

```bash
S=aiops-platform/faults/fault-schedule.mjs
node $S validate                                         # kiểm manifest
node $S plan --case C2                                   # in lịch: activate_at_s, deactivate_at_s
node $S plan --case C4 --align-peak aiops-platform/load/data/plans/moodle-normal-mixed-k4-v1.json
node $S run --case C6 --run-start 2026-11-18T05:00:00Z --log results/<run_id>/faults.jsonl
```

- `--align-peak <kế hoạch phát lại>`: đặt cửa sổ fault vào đoạn có nhiều phiên bắt đầu nhất (ADR-007: mỗi case có ít nhất một run fault trùng cao điểm tải), vẫn giữ warm-up và recovery.
- `run` kiểm điều kiện tiên quyết (`docker inspect` biến môi trường của container), chờ tới mốc, bật, chờ, gỡ. Mỗi sự kiện là một dòng JSON có `ts` UTC thật (`fault.precheck`, `fault.scheduled`, `fault.activate` kèm `drift_ms`, `fault.deactivate`); đây là nguồn `fault_start`/`fault_end` của `RunGroundTruth`. Bật lỗi một phần thì gỡ ngay; Ctrl-C/SIGTERM luôn gỡ fault trước khi thoát (mã 130).

## Bằng chứng chạy thử manifest (18/11/2026)

Stack đầy đủ + overlay (`identity` có `IDENTITY_SERVICE_TOKEN_TTL_SECONDS=60`), tải nền k6 mức 1 15 phút (`RUN_ID=w14-t05-fault-trial`), chạy lần lượt bốn case bằng `fault-schedule.mjs run` với cửa sổ rút ngắn (120–150 s) để vừa một run. Mọi lệnh bật/tắt thành công, lệch mốc 0–1 ms. Kiểm chứng bằng `aiops-training ground-truth --artifact` (task-06) trên telemetry đã export:

| Case | Bật → gỡ (UTC) | Kiểm chứng | Số đo |
| --- | --- | --- | --- |
| C2 | 05:08:24 → 05:10:24 | `dependency_latency_increased` đạt | `course-postgres` trung bình 1,9 ms (32.964 lời gọi trước fault) → 373 ms (388 lời gọi) |
| C4 | 05:11:24 → 05:13:24 | đạt | `media-minio` 1,3 ms → 369 ms (234 lời gọi) |
| C3 | 05:14:24 → 05:16:54 | đạt | `ai-llm-provider` 1,2 ms → 31,6 s (3 lời gọi) |
| C6 | 05:17:54 → 05:20:24 | `root_cause_heartbeat_stopped`, `symptom_observed_within_lag_window` đạt | CPU của `identity` tăng 7,67 s trong 5 phút trước, 0 khi pause; 5xx ở gateway bắt đầu từ phút 05:19 (khoảng yên lặng ~70 s), hết sau phút 05:21 |

Ghi chú: hành trình mức 1 không có backoff nên khi C6 làm mọi request lỗi nhanh, VU lặp lại liên tục (≈ 1.000–1.700 request 5xx/s trong 3 phút) — đây là giới hạn của mức 1, không phải của fault. Mức 2/2+ thử lại có backoff và bỏ ngang phiên (workload-design-v1 mục 6). Số lời gọi C3 trong cửa sổ fault chỉ vừa đủ ngưỡng 3: run thật cần đủ job AI (workload-design-v1 mục 8.5).

## Bằng chứng kiểm chứng (17/11/2026)

Stack đầy đủ + overlay, 23 container healthy.

- Regression W1–W7 qua proxy và LLM stub (`REGRESSION_AI_PROVIDER_URL=http://llm-stub:8080/v1`): 52/52 test đạt.
- Mỗi giai đoạn 40 giây, request lặp liên tục; p50 đọc bằng `histogram_quantile(0.5, …lms_dependency_duration_seconds_bucket…[30s])` (giá trị nội suy theo bucket):

| Fault | Trước | Đang bật | Sau khi gỡ |
| --- | --- | --- | --- |
| `latency course-to-postgres 200` (`GET /api/v1/courses`) | client p50 2 ms; `course-postgres` p50 0,0025 s | client p50 204 ms; p50 0,175 s | client p50 3 ms; p50 0,0025 s |
| `latency media-to-minio 300` (`GET /api/v1/media/:id/content`) | client p50 5 ms; `media-minio` p50 0,0025 s | client p50 607 ms; p50 0,689 s | client p50 3 ms; p50 0,0025 s |

- `llm set --latency-ms 2000 --jitter-ms 500` rồi chạy regression `ai-lesson`: job vẫn `COMPLETED`; `ai-llm-provider POST chat/completions` trung bình 2,36 s.
- `llm set --error-rate 1`: job AI `FAILED` với `AI_PROVIDER_ERROR`; `lms_dependency_request_count_total{service_name="ai-worker",dependency_identity="ai-llm-provider",status="unavailable"}` = 2; `llm reset` đưa về bình thường.

## Test

```bash
node --test 'aiops-platform/faults/**/*.test.mjs'
```

Test chạy không cần Docker: logic của stub (seed, tỉ lệ lỗi, miền giá trị), stub qua HTTP thật trên cổng ngẫu nhiên, và CLI (phân tích dòng lệnh, lệnh `llm` trên stub thật). Lệnh proxy của CLI được kiểm chứng trên toxiproxy thật ở mục bằng chứng, không dùng toxiproxy giả.
