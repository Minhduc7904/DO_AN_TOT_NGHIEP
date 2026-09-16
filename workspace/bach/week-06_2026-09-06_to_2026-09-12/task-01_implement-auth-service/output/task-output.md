# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-auth-service` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 15/09/2026 |
| Hoàn thành thực tế |  |
| Tổng thời lượng |  |
| Pull request | [#19](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/19) |
| Người review | Đức |
| Kết quả review | Chờ Đức review trên GitHub |

## Báo cáo công việc đã làm

Đã triển khai Auth service độc lập, gồm endpoint login/refresh, JWT HS256 có `sub`, `role`, `exp`, `jti`, refresh token opaque có rotation, repository PostgreSQL, migration/seed idempotent, error envelope canonical và OpenTelemetry bootstrap. Đã cập nhật Compose để tạo `auth_db` riêng và khởi động Auth sau PostgreSQL.

Format check, build, lint và toàn bộ test CI cục bộ pass. Compose project cô lập từ volume mới đã xác nhận PostgreSQL tạo `auth_db`, Auth healthy, login/refresh/error envelope đúng contract và migration chạy lại vẫn có đúng một seed user.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Auth service, migration/seed và test | Code | [`lms/services/auth/`](../../../../../lms/services/auth/) |
| Compose Auth và khởi tạo `auth_db` | Code / Cấu hình | [`docker-compose/`](../../../../../docker-compose/) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Migration/seed tạo `auth_db` từ trạng thái sạch và chạy lại theo tài liệu | Đạt | Compose volume mới tạo `auth_db`; chạy lại `node dist/scripts/migrate.js` và query seed user trả `1`. |
| Login/refresh theo contract, JWT có expiry/claims và error path có kiểm thử | Đạt | 4 test Auth pass; runtime Compose xác nhận login, refresh token rotation và `401 UNAUTHORIZED` envelope. |
| Không cross-service database/source import và không lộ secret, password, JWT hoặc PII | Đạt | Architecture boundary test/lint pass; assertion telemetry Auth pass và test HTTP xác nhận response không chứa password. |
| Unit/integration tests, build và health check pass | Đạt | `pnpm run ci:verify` pass; Auth container healthy trong Compose cô lập. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Chưa có.
- Việc chưa hoàn thành hoặc trở ngại: Chờ review/vote `APPROVED` hợp lệ từ Đức trên GitHub.
- Bước tiếp theo: Đức review PR #19; Bách xử lý feedback nếu có, hoặc finalization metadata sau `APPROVED` hợp lệ.

> `Hoàn thành thực tế` là thời điểm Bách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ Đức và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, Bách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge.
