# API Gateway

Gateway là trust boundary HTTP của LMS. Các route `POST /api/v1/auth/{student,instructor,admin}/login` và `POST /api/v1/auth/refresh` được chuyển tiếp tới Auth mà không cần access token. Các route `/api/v1/courses`, `/api/v1/enrollments`, `/api/v1/submissions` và `/api/v1/grades` yêu cầu Bearer JWT HS256 hợp lệ; Gateway chỉ chuyển `x-principal-id` và `x-principal-role` do chính nó derive từ claim `sub` và `role`.

## Chạy cục bộ

Từ thư mục `lms`, sao chép `services/gateway/.env.example` thành `services/gateway/.env`, bảo đảm Auth/Course đang chạy, rồi dùng `pnpm --filter @aiops-lms/gateway start:dev`.

`GATEWAY_UPSTREAM_TIMEOUT_MS` là timeout cho từng outbound request, mặc định 5.000 ms và chỉ nhận 100–60.000 ms. Gateway không retry: local timeout hoặc upstream `504` map thành `504 DEPENDENCY_TIMEOUT`; lỗi network hoặc upstream 5xx khác map thành `503 DEPENDENCY_UNAVAILABLE`; business 4xx giữ nguyên envelope.

Outbound telemetry dùng identity hữu hạn `gateway-auth`, `gateway-course`, `gateway-enrollment`, `gateway-submission`, `gateway-grading` với client span và ba metric `gateway.dependency.request.count`, `gateway.dependency.error.count`, `gateway.dependency.duration`. Metric label không chứa path động, principal hoặc resource ID. Policy đầy đủ nằm tại [`dependency-resilience-policy-v1.md`](../../../docs/processed/architecture/dependency-resilience-policy-v1.md).

## Kiểm chứng W1

Các bộ e2e `test:w1`, `test:w1:postgres` dựa trên repository Auth v1 đã bị gỡ khi `auth` chuyển sang Prisma (R-04). Luồng `Client → Gateway → Auth → JWT` được kiểm bằng smoke observability trên Compose (đăng nhập qua Gateway bằng tài khoản seed) và sẽ có regression mới ở R-11. Test dependency của Gateway: `node services/gateway/test/telemetry/dependency.telemetry-test.mjs`.

Gateway tạo client span cho mỗi lời gọi outbound và inject trace context từ client span đó; vì vậy Auth nhận cùng trace ID nhưng một parent span ID mới thay vì nhận nguyên `traceparent` của Client.

Suite in-memory không khởi động PostgreSQL và không xác nhận span dependency `auth-postgres`; suite PostgreSQL xác nhận persistence/seed nhưng Auth vẫn chưa có instrumentation PostgreSQL. Khi có instrumentation, cần bổ sung assertion dependency signal với identity `auth-postgres`.
