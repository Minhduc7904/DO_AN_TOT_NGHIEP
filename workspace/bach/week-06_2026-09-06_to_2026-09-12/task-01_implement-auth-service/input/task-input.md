# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-auth-service` |
| Tên task | Triển khai Auth service, migration, seed và phát JWT |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Chưa bắt đầu |
| Ngày tạo | 10/09/2026 |
| Thời gian dự kiến | 10/09/2026 |
| Nhánh thực hiện | `feat/week-06/task-01-implement-auth-service` |
| Pull request dự kiến | PR từ nhánh task vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Triển khai Auth service cho W1 với login/refresh tối thiểu, JWT expiry/role claims, `auth_db`, migration/seed, health/configuration, error envelope và telemetry bootstrap canonical.

### Phạm vi không thực hiện

Không làm IAM/SSO production-grade, Gateway/Course, remote introspection, shared business model hoặc đưa credential/JWT/PII vào telemetry.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Auth service và test | Code | `lms/services/auth/` |
| Migration/seed Auth | Code | `lms/infrastructure/postgres/` hoặc migration thuộc Auth theo convention đã chốt |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: Week 5 baseline; HTTP contract v1; backend blueprint; data ownership matrix.
- Người cần phối hợp: Đức review boundary, migration, seed và JWT claims.
- Rủi ro hoặc giả định: thuật toán/key/TTL JWT qua cấu hình; seed chỉ chứa dữ liệu thử nghiệm an toàn.

## Definition of Done

- [ ] Migration/seed tạo `auth_db` từ trạng thái sạch và chạy lại theo tài liệu.
- [ ] Login/refresh đúng contract; JWT có expiry/claims cần thiết; error paths có kiểm thử.
- [ ] Không cross-service database/source import và không lộ secret, password, JWT hoặc PII.
- [ ] Unit/integration tests, build và health check pass.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
