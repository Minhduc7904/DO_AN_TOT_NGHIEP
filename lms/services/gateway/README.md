# API Gateway

Gateway là trust boundary HTTP của LMS. Các route `POST /api/v1/auth/login` và `POST /api/v1/auth/refresh` được chuyển tiếp tới Auth mà không cần access token. Route `/api/v1/courses` yêu cầu Bearer JWT HS256 hợp lệ; Gateway chỉ chuyển `x-principal-id` và `x-principal-role` do chính nó derive từ claim `sub` và `role`.

## Chạy cục bộ

Từ thư mục `lms`, sao chép `services/gateway/.env.example` thành `services/gateway/.env`, bảo đảm Auth/Course đang chạy, rồi dùng `pnpm --filter @aiops-lms/gateway start:dev`.

`GATEWAY_UPSTREAM_TIMEOUT_MS` là timeout cho từng outbound request. Gateway không retry mặc định; lỗi kết nối map thành `503 DEPENDENCY_UNAVAILABLE`, timeout map thành `504 DEPENDENCY_TIMEOUT`, và không trả raw stack trace.
