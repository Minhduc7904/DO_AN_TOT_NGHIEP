# Dependency resilience policy v1

> **Phạm vi:** các outbound HTTP dependency của Gateway, Enrollment, Submission và Grading trong Testbed MVP.
>
> **Nguồn canonical liên quan:** [`http-and-event-contracts-v1.md`](http-and-event-contracts-v1.md), [`data-ownership-and-fault-matrix-v1.md`](data-ownership-and-fault-matrix-v1.md).

## 1. Mục tiêu

Policy này freeze giá trị timeout, retry, error mapping và telemetry identity cho campaign Testbed MVP. Policy không thay đổi business contract, không thêm endpoint và không định nghĩa retry/DLQ cho messaging.

## 2. Timeout và validation

| Caller     | Biến cấu hình                      | Mặc định | Khoảng hợp lệ | Dependency áp dụng                            |
| ---------- | ---------------------------------- | -------: | ------------: | --------------------------------------------- |
| Gateway    | `GATEWAY_UPSTREAM_TIMEOUT_MS`      | 5.000 ms | 100–60.000 ms | Auth, Course, Enrollment, Submission, Grading |
| Enrollment | `ENROLLMENT_COURSE_TIMEOUT_MS`     | 3.000 ms | 100–60.000 ms | Course                                        |
| Submission | `SUBMISSION_DEPENDENCY_TIMEOUT_MS` | 3.000 ms | 100–60.000 ms | Course, Enrollment, Storage Mock              |
| Grading    | `GRADING_DEPENDENCY_TIMEOUT_MS`    | 3.000 ms | 100–60.000 ms | Submission                                    |

Mỗi outbound request dùng `AbortController` và dọn timer trong `finally`; không có request chờ vô hạn. Giá trị ngoài khoảng phải làm service fail fast khi validate environment.

## 3. Retry và circuit breaker

- **HTTP retry tắt** trong MVP cho mọi method, kể cả `GET`. Mỗi logical dependency call chỉ được gọi `fetch` một lần.
- Không retry `POST`, `PUT` hoặc operation có side effect; do đó không tạo duplicate write do resilience layer.
- Circuit breaker `Enrollment → Course` được giữ nguyên. Breaker chỉ short-circuit request mới sau ngưỡng lỗi và cho phép một half-open probe sau cooldown; nó **không retry** request đã thất bại và không làm tăng số lần gọi network.
- Chỉ được bật retry HTTP sau này khi có ADR/scenario riêng, operation được chứng minh idempotent, attempt/backoff hữu hạn và test chống retry amplification.

## 4. Error mapping

| Tín hiệu từ dependency boundary             | Kết quả canonical của caller                             |
| ------------------------------------------- | -------------------------------------------------------- |
| Local `AbortController` timeout             | HTTP 504, `DEPENDENCY_TIMEOUT`                           |
| Upstream HTTP 504                           | HTTP 504, `DEPENDENCY_TIMEOUT`                           |
| Network/DNS/connection error                | HTTP 503, `DEPENDENCY_UNAVAILABLE`                       |
| Upstream HTTP 500–503 hoặc 505–599          | HTTP 503, `DEPENDENCY_UNAVAILABLE`                       |
| Response 2xx sai schema/không parse được    | HTTP 503, `DEPENDENCY_UNAVAILABLE`                       |
| Business 4xx đã có semantics trong contract | Giữ business semantics; không tính là dependency failure |

Business semantics hiện hành:

- Gateway giữ nguyên status và error envelope 4xx từ upstream.
- `Enrollment → Course` và `Submission → Course`: Course `404` trở thành kết quả `không tồn tại` để application map theo business contract.
- `Grading → Submission`: Submission `404` trở thành `null` để application map `NOT_FOUND`.
- `Submission → Enrollment`: `{ "enrolled": false }` là kết quả business bình thường, không phải dependency failure.

## 5. Dependency identity và telemetry

| Edge                      | `dependency_identity`   | `operation_name` hữu hạn |
| ------------------------- | ----------------------- | ------------------------ |
| Gateway → Auth            | `gateway-auth`          | HTTP method              |
| Gateway → Course          | `gateway-course`        | HTTP method              |
| Gateway → Enrollment      | `gateway-enrollment`    | HTTP method              |
| Gateway → Submission      | `gateway-submission`    | HTTP method              |
| Gateway → Grading         | `gateway-grading`       | HTTP method              |
| Enrollment → Course       | `enrollment-course`     | `exists`                 |
| Submission → Course       | `submission-course`     | `exists`                 |
| Submission → Enrollment   | `submission-enrollment` | `check`                  |
| Submission → Storage Mock | `submission-storage`    | `put`                    |
| Grading → Submission      | `grading-submission`    | `get`                    |

Mỗi dependency call phải có client span và ba metric `*.dependency.request.count`, `*.dependency.error.count`, `*.dependency.duration`. Trạng thái metric chỉ dùng vocabulary hữu hạn `ok`, `timeout`, `unavailable` và business outcome hữu hạn đã được canonical hóa (nếu có).

Metric label chỉ chứa identity/operation/status hữu hạn. Cấm đưa route/path động, principal ID, course/submission/grade/event ID, credential, token, query string hoặc fault truth vào metric label. Span có thể giữ `url.path` để chẩn đoán nhưng không ghi query string, credential hay token.

## 6. Kiểm chứng bắt buộc

- Unit test của mỗi HTTP client kiểm tra timeout, upstream `504`, 5xx/network, business `404` phù hợp và số lần `fetch` bằng 1.
- Gateway telemetry test kiểm tra đủ năm identity, client span, request/error/duration metrics và không có resource/principal/credential trong metric labels.
- Integration test hiện hành của Submission/Grading tiếp tục chứng minh timeout/unavailable propagation và business `404` không bị tính sai thành dependency failure.
- `format:check`, build, lint, unit test, `test:telemetry`, `ci:verify`, `git diff --check` và `docker compose config` phải pass trước khi chuyển `Chờ review`.
