# API Gateway

Gateway là trust boundary HTTP của LMS. Các route `POST /api/v1/auth/login` và `POST /api/v1/auth/refresh` được chuyển tiếp tới Auth mà không cần access token. Route `/api/v1/courses` yêu cầu Bearer JWT HS256 hợp lệ; Gateway chỉ chuyển `x-principal-id` và `x-principal-role` do chính nó derive từ claim `sub` và `role`.

## Chạy cục bộ

Từ thư mục `lms`, sao chép `services/gateway/.env.example` thành `services/gateway/.env`, bảo đảm Auth/Course đang chạy, rồi dùng `pnpm --filter @aiops-lms/gateway start:dev`.

`GATEWAY_UPSTREAM_TIMEOUT_MS` là timeout cho từng outbound request. Gateway không retry mặc định; lỗi kết nối map thành `503 DEPENDENCY_UNAVAILABLE`, timeout map thành `504 DEPENDENCY_TIMEOUT`, và không trả raw stack trace.

## Kiểm chứng W1

Chạy `pnpm run test:w1` từ `lms/` để kiểm chứng workflow `Client → Gateway → Auth → JWT` với repository Auth trong bộ nhớ được reset trước mỗi test. Bộ test xác minh login từ seed user, JWT được Gateway chấp nhận ở route bảo vệ, credential sai, JWT hết hạn/sai chữ ký, role không được phép, Auth timeout và chuỗi W3C gồm Gateway server span, Gateway client span và Auth server span.

Gateway tạo client span cho mỗi lời gọi outbound và inject trace context từ client span đó; vì vậy Auth nhận cùng trace ID nhưng một parent span ID mới thay vì nhận nguyên `traceparent` của Client.

Assertion này không khởi động PostgreSQL thật và không xác nhận span dependency `auth-postgres`: repository in-memory được dùng để CI chạy lặp lại, còn instrumentation PostgreSQL chưa được cấu hình trong Auth. Khi có instrumentation, cần bổ sung assertion dependency signal với identity `auth-postgres`.
