# API Gateway

Gateway là trust boundary HTTP của LMS. Các route `POST /api/v1/auth/login` và `POST /api/v1/auth/refresh` được chuyển tiếp tới Auth mà không cần access token. Route `/api/v1/courses` yêu cầu Bearer JWT HS256 hợp lệ; Gateway chỉ chuyển `x-principal-id` và `x-principal-role` do chính nó derive từ claim `sub` và `role`.

## Chạy cục bộ

Từ thư mục `lms`, sao chép `services/gateway/.env.example` thành `services/gateway/.env`, bảo đảm Auth/Course đang chạy, rồi dùng `pnpm --filter @aiops-lms/gateway start:dev`.

`GATEWAY_UPSTREAM_TIMEOUT_MS` là timeout cho từng outbound request. Gateway không retry mặc định; lỗi kết nối map thành `503 DEPENDENCY_UNAVAILABLE`, timeout map thành `504 DEPENDENCY_TIMEOUT`, và không trả raw stack trace.

## Kiểm chứng W1

Chạy `pnpm run test:w1` từ `lms/` để kiểm chứng workflow `Client → Gateway → Auth → JWT` với repository Auth trong bộ nhớ được reset trước mỗi test. Bộ test xác minh credential sai, JWT hết hạn/sai chữ ký, role không được phép, Auth timeout và chuỗi W3C gồm Gateway server span, Gateway client span và Auth server span.

Kiểm chứng luồng persistence thực chạy riêng bằng `pnpm run test:w1:postgres`. Script này yêu cầu biến `W1_AUTH_DATABASE_URL`, xóa hai bảng Auth, chạy migration/seed canonical, khởi động Auth với `PostgresAuthRepository`, đăng nhập seed user qua Gateway và dùng JWT đó tại route bảo vệ. GitHub Actions cung cấp PostgreSQL sạch cho bước này. Khi chạy cục bộ, khởi động PostgreSQL tạm rồi đặt URL trước khi chạy script, ví dụ với PowerShell:

```powershell
docker run --rm --name aiops-w1-postgres -e POSTGRES_DB=auth_db -e POSTGRES_USER=w1_test -e POSTGRES_PASSWORD=w1_test_password -p 5432:5432 postgres:17.6-alpine
$env:W1_AUTH_DATABASE_URL = 'postgresql://w1_test:w1_test_password@127.0.0.1:5432/auth_db'
pnpm run test:w1:postgres
```

Gateway tạo client span cho mỗi lời gọi outbound và inject trace context từ client span đó; vì vậy Auth nhận cùng trace ID nhưng một parent span ID mới thay vì nhận nguyên `traceparent` của Client.

Suite in-memory không khởi động PostgreSQL và không xác nhận span dependency `auth-postgres`; suite PostgreSQL xác nhận persistence/seed nhưng Auth vẫn chưa có instrumentation PostgreSQL. Khi có instrumentation, cần bổ sung assertion dependency signal với identity `auth-postgres`.
