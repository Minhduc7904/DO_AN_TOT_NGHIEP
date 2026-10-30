# Dependency resilience policy v2

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận. Mô tả **hành vi code đang làm** (đối chiếu `lms/packages/common/src` và `env.schema.ts` của từng service ngày 29/10/2026), không phải hành vi mong muốn; chỗ chưa kiểm ghi "chưa kiểm chứng".
>
> **Thay thế:** [dependency-resilience-policy-v1](dependency-resilience-policy-v1.md) (giữ làm lịch sử, không dùng cho dataset mới).
>
> **Cập nhật R-13:** service `auth` và `student` đã gộp thành `identity` ([ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md)); cạnh `auth-student` (và biến `AUTH_STUDENT_*`) không còn, các tham chiếu `auth`/`student` ở dưới đã đổi sang `identity`.
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [http-and-event-contracts-v2](http-and-event-contracts-v2.md), [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md), [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md).
>
> **Phạm vi:** mọi outbound dependency của 11 runtime LMS: HTTP đồng bộ giữa service (gồm Gateway → upstream), lấy service token và tải JWKS, RabbitMQ (outbox, consumer), và các dependency hạ tầng (PostgreSQL, MinIO, SMTP, LLM provider).

## 1. Mục tiêu

Policy này freeze giá trị timeout, retry, circuit breaker, error mapping và telemetry identity để dataset và case RCA dựa trên một hành vi resilience đã biết rõ: retry hoặc breaker nếu thay đổi âm thầm sẽ che hoặc khuếch đại lỗi mà RCA phải truy vết. Policy không thêm endpoint và không đổi business contract. Khác v1, policy này mô tả cả messaging (retry, `.error`, outbox/inbox) và xác thực service-to-service, vì cả hai đều tạo hành vi lan lỗi riêng.

Nguyên tắc chung:

- **Không có retry HTTP ở bất kỳ nơi nào**: mỗi logical call chỉ gọi mạng một lần. Resilience dựa vào timeout, circuit breaker và cache (token, JWKS).
- Lỗi dependency luôn ra ngoài dưới dạng `DEPENDENCY_TIMEOUT` (504) hoặc `DEPENDENCY_UNAVAILABLE` (503) kèm `details.dependency` là identity ở mục 8, trừ khi caller giữ mã nghiệp vụ của dependency (mục 5).
- Lời gọi nào cũng phải có timeout hữu hạn; riêng PostgreSQL và MinIO code không đặt timeout ứng dụng (mục 2).

## 2. Timeout và validation

Mọi biến được validate bằng zod khi khởi động (`parseEnvironment`/schema của service): giá trị ngoài khoảng làm process thoát với lỗi cấu hình, không có giá trị âm thầm bị cắt. Cột "Compose" là giá trị `docker-compose/compose.yaml` đặt; trống nghĩa là Compose không đặt và dùng mặc định của code.

### 2.1. Outbound HTTP

| Caller (process) | Biến cấu hình | Mặc định code | Compose | Khoảng hợp lệ (ms) | Dependency |
| --- | --- | ---: | ---: | --- | --- |
| `gateway` | `GATEWAY_UPSTREAM_TIMEOUT_MS` | 30.000 | 5.000 | 100–300.000 | identity, course, media, notification, scheduler, ai |
| `course` | `COURSE_MEDIA_TIMEOUT_MS` | 3.000 | 3.000 | 100–60.000 | media |
| `course` | `COURSE_AI_TIMEOUT_MS` | 5.000 | 5.000 | 100–60.000 | ai |
| `media` | `MEDIA_IDENTITY_TIMEOUT_MS` | 3.000 | 3.000 | 100–60.000 | identity |
| `notification-worker` | `NOTIFICATION_IDENTITY_TIMEOUT_MS` | 3.000 | 3.000 | 100–60.000 | identity |
| `scheduler-worker` | `SCHEDULER_MEDIA_TIMEOUT_MS` | 60.000 | 60.000 | 100–600.000 | media (cleanup) |
| `ai-worker` | `AI_COURSE_TIMEOUT_MS` | 5.000 | | 100–60.000 | course |
| `ai-worker` | `AI_MEDIA_CONTENT_TIMEOUT_MS` | 30.000 | 30.000 | 100–300.000 | media (tải byte tệp) |

Cơ chế: mỗi request dùng `AbortController` và `setTimeout`, timer được dọn trong `finally` (`HttpQueryClient`, Gateway, JWKS, provider LLM). Với **Gateway**, timeout chỉ áp tới khi upstream trả header phản hồi; phần body (media, CSV, `Range`) được stream tiếp mà không bị giới hạn thời gian. Mặc định code của Gateway (30 giây) khác giá trị Compose (5 giây); số liệu thí nghiệm theo Compose.

### 2.2. Xác thực service-to-service

| Biến | Mặc định | Khoảng hợp lệ (ms) | Áp dụng cho |
| --- | ---: | --- | --- |
| `IDENTITY_TOKEN_TIMEOUT_MS` | 3.000 | 100–60.000 | Lấy service token: `gateway`, `course`, `media`, `notification-worker`, `ai-worker`, `scheduler-worker` |
| `IDENTITY_JWKS_TIMEOUT_MS` | 3.000 | 100–60.000 | Tải JWKS của mọi bên verify token (kể cả Gateway) |
| `IDENTITY_JWKS_CACHE_TTL_MS` | 300.000 | 1.000–86.400.000 | Tuổi tối đa của JWKS trước khi coi là cũ |
| `IDENTITY_JWKS_MIN_REFETCH_MS` | 10.000 | 100–3.600.000 | Khoảng tối thiểu giữa hai lần tải JWKS |

Compose không đặt bốn biến này nên dùng mặc định. TTL service token do `identity` quyết định (`IDENTITY_SERVICE_TOKEN_TTL_SECONDS`, mặc định 600 giây).

### 2.3. Hạ tầng và broker

| Dependency | Biến | Mặc định | Ghi chú |
| --- | --- | ---: | --- |
| LLM provider (`ai`, `ai-worker`) | `AI_COMPLETION_TIMEOUT_MS` | 240.000 ms (100–600.000) | Một lượt gọi provider; `AI_HEALTH_CHECK_TIMEOUT_MS` mặc định 6.000 ms cho health check |
| SMTP (`notification-worker`) | `NOTIFICATION_SMTP_TIMEOUT_MS` | 5.000 ms (100–120.000) | Gán cho `connectionTimeout`, `greetingTimeout`, `socketTimeout` của nodemailer: timeout theo từng giai đoạn kết nối, không phải tổng thời gian gửi |
| RabbitMQ kết nối | `<SVC>_RABBITMQ_CONNECT_TIMEOUT_MS` | 5.000 ms (100–60.000) | Kết nối, tạo channel và khai báo topology |
| RabbitMQ publish confirm | `<SVC>_RABBITMQ_CONFIRM_TIMEOUT_MS` | 3.000 ms (100–60.000) | Quá hạn thì `DEPENDENCY_TIMEOUT`, thiếu confirm hoặc broker từ chối thì `DEPENDENCY_UNAVAILABLE` |
| ffmpeg (`media-worker`, thumbnail video) | `MEDIA_FFMPEG_TIMEOUT_MS` | 30.000 ms (1.000–300.000) | Tiến trình cục bộ, không phải dependency mạng |
| PostgreSQL, MinIO | không có | — | Code không đặt timeout riêng; timeout và kích thước pool mặc định của driver **chưa kiểm chứng** |

`AI_WORKER_LEASE_MS` (mặc định 600.000 ms) phải lớn hơn `AI_COMPLETION_TIMEOUT_MS`; hiện mới là quy ước, schema chưa ép. Ngược lại `SCHEDULER_RUN_LEASE_MS` (mặc định 120.000 ms) bị schema ép lớn hơn `SCHEDULER_MEDIA_TIMEOUT_MS`.

## 3. Retry và circuit breaker (HTTP)

### 3.1. Không retry

- `HttpQueryClient` (mọi cạnh service-to-service, kể cả lấy token), Gateway, tải JWKS và gọi LLM provider đều **không retry**, kể cả `GET`. Mỗi logical call gọi `fetch` đúng một lần; không tạo duplicate write do resilience layer. Lời gọi LLM không retry để không tính phí trùng.
- Chỉ được bật retry HTTP sau này khi có ADR/scenario riêng, operation được chứng minh idempotent, attempt/backoff hữu hạn và test chống retry amplification.

### 3.2. Circuit breaker

Breaker nằm trong `HttpQueryClient`, nên áp dụng cho **mọi client service-to-service và cả lời gọi lấy token**, không riêng một cạnh như v1. Mỗi instance client có một breaker riêng, trạng thái chỉ nằm trong bộ nhớ process: không chia sẻ giữa replica hay giữa service và worker.

| Tham số | Biến (theo client) | Mặc định | Khoảng hợp lệ |
| --- | --- | ---: | --- |
| Ngưỡng lỗi liên tiếp | `COURSE_MEDIA_…`, `COURSE_AI_…`, `MEDIA_IDENTITY_…`, `NOTIFICATION_IDENTITY_…`, `SCHEDULER_MEDIA_…`, `AI_COURSE_…`, `AI_MEDIA_…`, `IDENTITY_TOKEN_BREAKER_THRESHOLD` | 3 | 1–100 |
| Cooldown | cùng tiền tố, hậu tố `_BREAKER_COOLDOWN_MS` | 5.000 ms | 1–300.000 |

Compose không đặt các biến này nên dùng mặc định.

Hành vi:

1. **Tính là lỗi** (tăng bộ đếm liên tiếp): timeout, lỗi mạng/DNS/kết nối, phản hồi 5xx (trừ mã trong `passthroughStatuses`), body không parse được thành JSON. **Reset bộ đếm**: mọi phản hồi 2xx/3xx/4xx, kể cả 404/409 nghiệp vụ.
2. Đủ ngưỡng lỗi liên tiếp thì breaker **mở** trong cooldown: request mới bị short-circuit thành `DEPENDENCY_UNAVAILABLE` ngay, không gọi mạng; span có `circuit_breaker_open=true` và metric ghi `status=unavailable`. Request bị short-circuit không tăng bộ đếm.
3. Hết cooldown, breaker **half-open**: đúng một request được thử (probe), các request khác vẫn bị short-circuit. Probe thành công thì đóng; probe thất bại thì mở lại với cooldown mới.
4. Breaker **không retry** request đã thất bại và không làm tăng số lần gọi mạng.
5. `passthroughStatuses` là tùy chọn cho phép trả một số mã 5xx về caller thay vì ném lỗi dependency (không tính vào breaker); client hỗ trợ và có unit test, nhưng hiện chưa service nào dùng.

Không có circuit breaker ở: Gateway → upstream (`gateway-<service>`), tải JWKS (giới hạn bằng khoảng refetch tối thiểu, mục 6.2), publish RabbitMQ (dùng backoff của outbox, mục 4), SMTP, MinIO, PostgreSQL và LLM provider.

## 4. Messaging: outbox, consumer retry, `.error`, inbox

Đây là hành vi của `lms/packages/common/src/messaging`. **Không có queue `.retry` và không có dead-letter exchange**: retry diễn ra trong tiến trình consumer, hết retry thì chuyển sang queue `.error` thường.

### 4.1. Phát command (outbox relay)

- Producer ghi command vào `outbox_messages` **cùng transaction** với dữ liệu nghiệp vụ; một vòng relay nền claim lô bằng `FOR UPDATE SKIP LOCKED` kèm lease rồi publish ra exchange `lms.commands` (direct, persistent, publisher confirm). Nhiều relay (ví dụ `notification` và `notification-worker` cùng đọc một bảng) không giẫm nhau.
- Publish lỗi: giải phóng lease, đặt `available_at = now + backoff`, ghi `last_error` (chỉ tên lỗi). Backoff `min(30.000, 500 × 2^attempts)` ms. **Không có số lần tối đa**: command kẹt lại trong outbox và được thử mãi, nên broker chết không làm service chết nhưng backlog nằm trong DB, không hiện ở metric broker.
- Tham số theo service (`<SVC>` = `COURSE`, `MEDIA`, `NOTIFICATION`, `AI`):

| Biến | Mặc định | Khoảng hợp lệ |
| --- | ---: | --- |
| `<SVC>_OUTBOX_POLL_MS` | 500 ms | 50–60.000 |
| `<SVC>_OUTBOX_BATCH_SIZE` | 20 | 1–500 |
| `<SVC>_OUTBOX_LEASE_MS` | 30.000 ms | 1.000–300.000 |

Giá trị trên đã đối chiếu `env.schema.ts` của cả bốn service.

### 4.2. Nhận command (consumer)

| Biến (`<WORKER>` = `MEDIA_WORKER`, `NOTIFICATION_WORKER`, `AI_WORKER`) | Mặc định | Khoảng hợp lệ | Ghi chú |
| --- | ---: | --- | --- |
| `<WORKER>_PREFETCH` | media 4, notification 4, ai 2 | 1–100 | Số command xử lý đồng thời mỗi queue |
| `<WORKER>_MAX_ATTEMPTS` | 5 | 1–20 | Số lần xử lý tối đa trước khi vào `.error` |
| `<WORKER>_RETRY_DELAY_MS` | 1.000 ms | 0–300.000 | Chờ **cố định** (không backoff) giữa hai lần |

Luồng khi handler ném lỗi:

1. Nếu `attempt < MAX_ATTEMPTS`: chờ `RETRY_DELAY_MS` (giữ slot prefetch trong lúc chờ) rồi **publish lại chính command đó vào cùng queue** với header `x-attempt` tăng 1, rồi ack message cũ.
2. Hết `MAX_ATTEMPTS`: ghi nguyên message vào `<queue>.error` (durable, persistent), gọi `onFault` để cập nhật job/batch sang `FAILED` (route nào có khai báo), rồi ack.
3. Message không đúng envelope (JSON hỏng hoặc sai schema): chuyển **thẳng** vào `.error`, không retry, không gọi `onFault`.
4. Không phát lại hoặc ghi `.error` được: `nack` kèm requeue, không mất command.
5. Khi process đang tắt (`stop`), không retry; message chưa ack được broker giao lại.
6. Consumer tự đăng ký lại sau khi channel đóng ngoài ý muốn (chờ 1 giây mỗi lần thử).

`.error` không được xử lý lại tự động; mỗi queue canonical có một `.error` đi kèm (24 queue gồm 12 canonical và 12 `.error`, theo [complex-case catalogue](complex-case-catalogue-and-rca-result-v0.md) mục 1.1), và kích thước của nó là tín hiệu RCA. Lỗi xử lý cũng thấy ở span CONSUMER có status `ERROR`; worker chưa có log riêng khi xử lý.

### 4.3. Idempotency (inbox)

Giao nhận là at-least-once nên handler phải idempotent. `runOnce` chèn `(message_id, consumer)` vào `inbox_states` và chạy handler trong **cùng transaction**: trùng `message_id` thì bỏ qua và ack (`deduplicated`); handler lỗi thì rollback cả dấu xử lý để lần giao lại được xử lý lại. Đã đối chiếu `runOnce` ở các use case của `media-worker` (thumbnail, đồng bộ/xóa usage, usage thông báo), `ai-worker` (trích văn bản, chạy job) và `snapshot-batch` của `notification-worker`. Handler còn lại (ví dụ dispatch batch) dựa vào lease và unique key theo từng bản ghi; **chưa kiểm chứng đầy đủ**.

### 4.4. Retry và lease ở mức ứng dụng (không phải resilience layer)

Các cơ chế sau nằm trong nghiệp vụ nhưng ảnh hưởng tới lan lỗi và số lần gọi dependency, nên liệt kê để RCA không nhầm với retry của hạ tầng:

| Cơ chế | Giá trị mặc định | Hành vi |
| --- | --- | --- |
| Item thông báo (`notification-worker`) | `NOTIFICATION_ITEM_MAX_ATTEMPTS` 3; `NOTIFICATION_ITEM_RETRY_DELAY_MS` 1.000 ms | Gửi email lỗi thì item sang `RETRY`, chờ `base × 2^(n-1)` rồi gửi lại; hết lượt thì `FAILED`, batch có thể `PARTIAL_FAILED`; claim bằng lease |
| Run scheduler | `SCHEDULER_RUN_LEASE_MS` 120.000 ms; `SCHEDULER_RUN_MAX_ATTEMPTS` 3 | Worker chết thì lease hết hạn và run được nhận lại tới hết lượt, sau đó `FAILED` (`RUN_LEASE_EXPIRED`) |
| Tài liệu AI | tối đa 3 lần trích; lease `AI_WORKER_LEASE_MS` 600.000 ms | Lease hết hạn thì nhận lại tới hết lượt rồi `FAILED` |
| Job AI | lặp agent tối đa 6 lượt gọi provider | Job `RUNNING` quá hạn lease thì `FAILED` `WORKER_INTERRUPTED` và **không chạy lại** (tránh ghi trùng) |
| Thumbnail media | dùng retry của consumer; hết lượt thì thumbnail và job `FAILED` | Client có thể retry thủ công qua API |

## 5. Error mapping

### 5.1. Quy tắc chung của `HttpQueryClient` (service-to-service)

| Tín hiệu từ dependency boundary | Kết quả canonical của caller |
| --- | --- |
| Local `AbortController` timeout | HTTP 504, `DEPENDENCY_TIMEOUT` |
| Upstream HTTP 504 | HTTP 504, `DEPENDENCY_TIMEOUT` |
| Network/DNS/connection error | HTTP 503, `DEPENDENCY_UNAVAILABLE` |
| Upstream HTTP 500–503 hoặc 505–599 (kể cả 502) | HTTP 503, `DEPENDENCY_UNAVAILABLE` |
| Response không parse được thành JSON | HTTP 503, `DEPENDENCY_UNAVAILABLE` |
| Circuit breaker đang mở | HTTP 503, `DEPENDENCY_UNAVAILABLE`, không gọi mạng |
| Response 2xx sai schema (caller kiểm bằng zod) | HTTP 503, `DEPENDENCY_UNAVAILABLE` |
| 2xx/3xx/4xx khác | Trả về cho caller quyết định theo nghiệp vụ (mục 5.2); không tính là dependency failure ở breaker |

Metric chỉ có vocabulary `status` hữu hạn: `ok`, `timeout`, `unavailable`, `expected_failure` (hiện chỉ dùng cho lời gọi LLM bị provider từ chối: xác thực sai hoặc request bị từ chối). Mã `DEPENDENCY_*` mang `details.dependency` là identity.

### 5.2. Ngữ nghĩa nghiệp vụ theo từng cạnh

| Cạnh | Phản hồi 4xx của dependency | Ghi chú |
| --- | --- | --- |
| `media-identity`, `notification-worker-identity` | `404` thành `null`; mã khác `200` thành `DEPENDENCY_UNAVAILABLE` | |
| `course-media` | Mọi mã khác `200` thành `DEPENDENCY_UNAVAILABLE` | Không có ngữ nghĩa nghiệp vụ cho 4xx ở cạnh này |
| `course-ai` | Giữ nguyên mã nghiệp vụ, HTTP status và `details` của `ai` (ví dụ `AI_JOB_ALREADY_ACTIVE`, `AI_DOCUMENTS_NOT_EXTRACTED`, 404) | Body lỗi không đọc được thì `DEPENDENCY_UNAVAILABLE` |
| `ai-worker-course`, `ai-worker-media` | Giữ nguyên mã nghiệp vụ và status của `course`/`media` để lưu vào job (`upstreamError`); riêng tạo quiz, `400` được trả về cho model sửa thay vì làm hỏng job | |
| `scheduler-worker-media` | `4xx` làm run kết thúc `FAILED` với `MEDIA_CLEANUP_REJECTED`; phản hồi 200 sai contract thành lỗi `MEDIA_CLEANUP_INVALID_RESPONSE` (502 của run) | 503/504 do breaker/timeout được use case ghi thành mã lỗi của run |

### 5.3. Gateway

Gateway **không** ánh xạ lại lỗi của upstream: mọi phản hồi của service phía sau (kể cả 4xx/5xx và mã nghiệp vụ) được trả nguyên vẹn (status, header, body). Gateway chỉ tự sinh envelope khi: không có route (`404`), thiếu/sai user token (`401`), sai role (`403`), upstream không kết nối được (`503 DEPENDENCY_UNAVAILABLE`, `details.dependency=gateway-<service>`), upstream không trả header trong `GATEWAY_UPSTREAM_TIMEOUT_MS` (`504 DEPENDENCY_TIMEOUT`), hoặc không lấy được service token (`503/504` với `details.dependency=gateway-identity-token`). Phản hồi 5xx của upstream vẫn được ghi là lỗi ở span và metric `lms_dependency_*` của `gateway-<service>` (status `timeout` nếu 504, còn lại `unavailable`), nên telemetry thấy lỗi dù client nhận đúng body gốc. Đây là khác biệt so với v1, nơi Gateway cũng ánh xạ 500–599 sang `503 DEPENDENCY_UNAVAILABLE`.

## 6. Xác thực service-to-service (ADR-004)

Lấy service token (`<caller>-identity-token`) và tải JWKS (`<caller>-identity-jwks`) là outbound HTTP có timeout bắt buộc và telemetry như mọi dependency. Lấy token đi qua `HttpQueryClient` (có breaker, không retry); tải JWKS gọi `fetch` trực tiếp (không breaker, không retry).

### 6.1. Service token

`ServiceTokenProvider` cache token **theo audience** và không bắt request thường chờ `identity`:

- **Làm mới nền ở 50% TTL**, single-flight (nhiều request đồng thời dùng chung một lần lấy). Request vẫn nhận token cũ ngay trong lúc làm mới. Với TTL mặc định 600 giây: làm mới nền sau khoảng 300 giây, mỗi cặp (caller, audience).
- **Stale-while-error**: làm mới nền lỗi thì tiếp tục dùng token cũ **đến khi hết hạn**; sau lỗi, lần làm mới nền kế tiếp bị giãn **5 giây** để không dồn lên `identity` đang lỗi (mỗi lần thử đi qua breaker của `<caller>-identity-token`).
- Chỉ khi **chưa có token hoặc token đã hết hạn** thì request mới chờ lấy token; lúc đó lỗi của nguồn được ném ra: timeout hoặc 5xx/mạng/breaker mở thành `DEPENDENCY_TIMEOUT`/`DEPENDENCY_UNAVAILABLE` với `details.dependency=<caller>-identity-token`. Lỗi này xảy ra **trước** khi mở span của dependency đích nên không bị tính nhầm cho upstream.
- `401/403` từ `identity` khi xin token là cấu hình sai (`client_id`/`client_secret`/`audience`) nên thành `SERVICE_CLIENT_INVALID` (401), không phải dependency lỗi và không tính vào breaker. Mọi phản hồi khác `200` hoặc sai schema thành `DEPENDENCY_UNAVAILABLE`.
- Hệ quả: `identity` chết **không** gây lỗi ngay ở request thường; lỗi chỉ lộ sau tối đa ~một TTL (khoảng yên lặng), rồi lan ra mọi service qua cạnh `<caller>-identity-token` (case FG/C6). Giá trị đo được: lỗi `gateway-identity-token` xuất hiện 72 giây sau khi dừng `identity` khi TTL = 60 giây (complex-case catalogue, C6).

### 6.2. JWKS

`HttpJwksKeyProvider` verify token luôn cục bộ; chỉ tải JWKS khi cần:

- Tải khi chưa có khóa, khi cache quá `IDENTITY_JWKS_CACHE_TTL_MS` (5 phút) ở lần dùng kế tiếp, hoặc khi gặp `kid` lạ (xoay khóa). Mọi lần tải bị giới hạn **tối đa một lần mỗi `IDENTITY_JWKS_MIN_REFETCH_MS` (10 giây)** và single-flight.
- **Stale-while-error**: tải lỗi mà khóa của `kid` đó đã có trong cache thì tiếp tục dùng khóa cũ — **không có thời hạn tuyệt đối** (khác token, khóa cũ được dùng đến khi tải lại thành công). `kid` chưa biết mà tải lỗi thì ném `DEPENDENCY_TIMEOUT`/`DEPENDENCY_UNAVAILABLE` (`details.dependency=<service>-identity-jwks`); cold start khi `identity` chưa lên cũng rơi vào trường hợp này.
- Chưa tải được vì còn trong khoảng 10 giây mà `kid` chưa biết thì trả "không có khóa", token bị từ chối `401 SERVICE_TOKEN_INVALID` (hoặc `UNAUTHORIZED` với user token), không ném lỗi dependency.
- Khi tải thành công, bộ khóa trong cache được thay hoàn toàn bằng JWKS mới; token ký bằng khóa đã bị loại bị từ chối (cơ sở của case FH).

### 6.3. Mã lỗi

Timeout/network/5xx từ `identity` → `DEPENDENCY_TIMEOUT`/`DEPENDENCY_UNAVAILABLE` với `details.dependency` là identity ở mục 8; `401/403` từ `identity` khi xin token → `SERVICE_CLIENT_INVALID`; token không hợp lệ ở bên nhận → `SERVICE_TOKEN_*`/`TOKEN_TYPE_MISMATCH` (xem [http-and-event-contracts-v2](http-and-event-contracts-v2.md) mục 2).

## 7. Hạ tầng không có breaker

| Dependency | Hành vi khi lỗi |
| --- | --- |
| PostgreSQL (`<service>-postgres`) | Lỗi truy vấn thành lỗi use case; không retry, không breaker, không timeout ứng dụng riêng. Pool cạn hoặc truy vấn chậm chỉ hiện gián tiếp qua độ trễ `<service>-postgres` (chưa có metric pool) |
| MinIO (`media-minio`) | Mọi lỗi (trừ "không có object", do caller quyết định) thành `DEPENDENCY_UNAVAILABLE`; không retry, không timeout ứng dụng riêng |
| SMTP (`notification-smtp`) | Lỗi gửi thành lỗi item; retry theo mục 4.4 (retry nghiệp vụ, không phải retry HTTP) |
| LLM provider (`ai-llm-provider`) | Timeout/mạng thành `DEPENDENCY_TIMEOUT`/`DEPENDENCY_UNAVAILABLE`; mã `AI_PROVIDER_*` do `ai` ánh xạ; không theo redirect để API key không sang host khác; không retry, không breaker |

## 8. Dependency identity và telemetry

Mỗi dependency call có client span và ba metric `lms_dependency_request_count`, `lms_dependency_error_count`, `lms_dependency_duration` (xem [observability README](../../../lms/packages/observability/README.md)). Identity canonical của các cạnh HTTP (danh mục đầy đủ gồm DB, MinIO, SMTP, LLM, RabbitMQ ở catalogue v2 mục 2.2 và complex-case catalogue mục 1.1):

| Edge | `dependency_identity` | `operation_name` |
| --- | --- | --- |
| Gateway → identity, course, media, notification, scheduler, ai | `gateway-<service>` | HTTP method |
| Gateway → identity (lấy token) | `gateway-identity-token` | `POST /internal/v1/auth/service-token` |
| course, media, notification-worker, ai-worker, scheduler-worker → identity (lấy token) | `<caller>-identity-token` | `POST /internal/v1/auth/service-token` |
| Mọi bên verify token → identity (JWKS) | `<service>-identity-jwks` | `GET jwks` |
| course → media | `course-media` | `<METHOD> <path>` |
| course → ai | `course-ai` | `<METHOD> <path>` |
| media → identity | `media-identity` | `<METHOD> <path>` |
| notification-worker → identity | `notification-worker-identity` | `<METHOD> <path>` |
| scheduler-worker → media | `scheduler-worker-media` | `<METHOD> <path>` |
| ai-worker → course | `ai-worker-course` | `<METHOD> <path>` |
| ai-worker → media | `ai-worker-media` | `<METHOD> <path>` |

Lưu ý:

- **`operation_name` của `HttpQueryClient` là `<METHOD> <path>` thô**, nên một số cạnh có ID trong operation: `GET /internal/v1/students/<id>` (`media-identity`, `notification-worker-identity`), `GET /internal/v1/ai/jobs/<job_id>` (`course-ai`), `…/courses/<id>/lessons/<id>/…` (`ai-worker-course`), `…/media/<id>/content` (`ai-worker-media`). Điều này **lệch** với quy tắc của v1 (operation hữu hạn, không đưa ID vào metric label). Giảm nhẹ hiện có: view của SDK chỉ cho phép allowlist thuộc tính và giới hạn 512 tổ hợp mỗi instrument, phần tràn không chứa ID gốc; hành vi chính xác khi tràn chưa kiểm chứng. Đây là điểm cần Đức quyết định (chuẩn hóa operation bằng route template) trước khi thu dataset; policy này chưa sửa code.
- Cạnh RabbitMQ chỉ có span (PRODUCER/CONSUMER mang `dependency_identity=<service.name>-rabbitmq`, `operation_name` là `publish`/`consume`); **không có** metric `lms_dependency_*` cho RabbitMQ, chỉ có metric broker. Lỗi publish ném `DEPENDENCY_*` với `details.dependency=rabbitmq` (chưa theo identity canonical).
- Metric label chỉ chứa identity/operation/status; không đưa principal ID, resource ID, `message_id`, credential, token, query string hoặc fault truth vào label. Span có thể giữ path để chẩn đoán nhưng không ghi query string, credential hay token.

## 9. Kiểm chứng

Test hiện có chứng minh các hành vi trên:

- `lms/packages/common/test/unit/clients.spec.ts`: breaker mở/half-open/đóng, timeout thành `DEPENDENCY_TIMEOUT`, 5xx thành `DEPENDENCY_UNAVAILABLE` và breaker mở sau ngưỡng, `passthroughStatuses`, 4xx trả về caller, forward correlation id và query.
- `lms/packages/common/test/unit/service-auth.spec.ts`: cache token theo audience và single-flight, làm mới nền ở 50% TTL, stale-while-error của token và JWKS, `kid` lạ refetch tối đa một lần mỗi khoảng tối thiểu, ma trận loại token.
- `lms/packages/common/test/unit/messaging.spec.ts`: envelope và tên queue, ghi outbox, relay đánh dấu đã phát hoặc lên lịch thử lại khi lỗi, inbox bỏ qua message trùng, consumer khi channel đã đóng (không retry, không unhandled rejection), `stop` chờ command đang xử lý. `lms/packages/common/test/integration/rabbitmq-outbox.integration.mjs` (RabbitMQ thật): retry đủ `maxAttempts` rồi command nằm trong `<queue>.error`.
- `lms/services/gateway/test/telemetry/dependency.telemetry-test.mjs` (qua `pnpm run test:telemetry`): span và metric dependency của Gateway.
- `tracing-smoke` trong `pnpm run test:observability`: kịch bản `identity` ngừng phản hồi (login lỗi ngay tại `gateway-identity`, token còn hạn vẫn dùng được, lỗi `gateway-identity-token` sau khi token dịch vụ hết hạn, phục hồi sau `unpause`); `metrics-smoke`: dừng một worker làm backlog tăng, command sai vào `.error`, drain khi phục hồi.
- `pnpm run ci:verify` (`format:check`, build, lint, test) và `docker compose config` phải pass trước khi chuyển `Chờ review`.

Chưa có test riêng cho: số lần gọi mạng bằng 1 ở từng client của v2, hành vi khi `operation_name` vượt 512 tổ hợp, timeout/pool mặc định của PostgreSQL và MinIO.

## 10. Điểm chưa kiểm chứng và việc mở

- Timeout và kích thước pool mặc định của PostgreSQL (`pg`/Prisma adapter) và MinIO client: code không đặt, chưa kiểm chứng.
- `AI_WORKER_LEASE_MS > AI_COMPLETION_TIMEOUT_MS` mới là quy ước, chưa ép bằng schema.
- Chuẩn hóa `operation_name` để không chứa ID (mục 8) và metric publish/consume RabbitMQ, độ trễ outbox: quyết định của Đức.
- Giới hạn tốc độ cho `POST /internal/v1/auth/service-token` chưa có ([http-and-event-contracts-v2](http-and-event-contracts-v2.md) mục 10).

## Khác biệt so với bản trước

| Mục | v1 (Testbed MVP) | v2 (theo code) |
| --- | --- | --- |
| Phạm vi | Outbound HTTP của Gateway, Enrollment, Submission, Grading; không có messaging | Mọi outbound dependency của 11 runtime: HTTP, token/JWKS, RabbitMQ, hạ tầng |
| Caller và timeout | 4 biến (`GATEWAY_UPSTREAM_TIMEOUT_MS`, `ENROLLMENT_COURSE_…`, `SUBMISSION_DEPENDENCY_…`, `GRADING_DEPENDENCY_…`), mặc định Gateway 5.000 ms | Mỗi cạnh một biến (bảng 2.1); mặc định code của Gateway là 30.000 ms, Compose đặt 5.000 ms; thêm timeout token, JWKS, LLM, SMTP, RabbitMQ |
| Circuit breaker | Chỉ cạnh `Enrollment → Course` | Mọi `HttpQueryClient` và lấy token; ngưỡng 3 lỗi liên tiếp, cooldown 5 giây (cấu hình theo client); Gateway → upstream và JWKS không có breaker |
| Retry | HTTP retry tắt; không định nghĩa retry/DLQ cho messaging | HTTP retry vẫn tắt; thêm retry consumer trong tiến trình (mặc định 5 lần, chờ cố định 1 giây, không có queue `.retry` hay DLX) rồi `<queue>.error`; outbox backoff không giới hạn số lần; inbox idempotent |
| Error mapping của Gateway | Gateway ánh xạ upstream 504 → 504, 500–503/505–599 → 503 | Gateway trả nguyên vẹn phản hồi upstream; chỉ tự sinh 404/401/403/503/504 trong các trường hợp ở mục 5.3 |
| Business 4xx | Course 404, Submission 404, `{ enrolled: false }` | Theo từng cạnh v2 (mục 5.2): hồ sơ student 404 → `null`, `ai`/`course`/`media` giữ mã nghiệp vụ, `course-media` coi mọi mã khác 2xx là dependency lỗi |
| Dependency identity | 10 cạnh HTTP (`gateway-*`, `enrollment-course`, `submission-*`, `grading-submission`) với `operation_name` hữu hạn | Cạnh mới (`course-media`, `course-ai`, `media-identity`, `notification-worker-identity`, `scheduler-worker-media`, `ai-worker-course`, `ai-worker-media`, `<caller>-identity-token`, `<service>-identity-jwks`); `operation_name` là `<METHOD> <path>` thô nên một số cạnh có ID (lệch quy tắc v1, ghi ở mục 8) |
| Xác thực service-to-service | Mục "Bổ sung v2" ngắn ở cuối bản v1 | Mục 6 viết lại đầy đủ: token (làm mới nền 50% TTL, single-flight, giãn 5 giây sau lỗi, stale đến hết hạn), JWKS (cache 5 phút, refetch tối đa 10 giây một lần, stale không thời hạn) |
| Kiểm chứng | `format:check`, build, lint, unit test, `test:telemetry`, `ci:verify`, `git diff --check`, `docker compose config` | Dẫn test và smoke thực tế của v2 (mục 9), nêu rõ các khoảng chưa có test |
