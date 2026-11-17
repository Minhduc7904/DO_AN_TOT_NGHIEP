# faults — cơ chế gây lỗi cho thí nghiệm

Module này tạo ra các "sự cố có kiểm soát" để sinh dữ liệu cho anomaly detection và RCA. Nó không sửa code LMS (LMS đóng băng theo [ADR-006](../../docs/processed/adr/adr-006-trim-project-scope-v1.md)); mọi thứ nằm trong một file Compose ghép thêm vào stack đầy đủ.

Kế hoạch: [plan v0.3 tuần 13–14](../../docs/processed/plan/plan-v0.3-24-weeks.md). Case: [case catalogue v0](../../docs/processed/architecture/complex-case-catalogue-and-rca-result-v0.md) và phần C2 viết lại ở ADR-006.

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

C3 dùng `llm-stub`. C6 không cần module này: `docker pause` container `identity` như [`tracing-smoke`](../../lms/test/observability/tracing-smoke.mjs) đã chạy.

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
- Chưa có fault manifest và lịch bật/tắt theo run (tuần 14), chưa có ghi ground truth (tuần 14–15).

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
