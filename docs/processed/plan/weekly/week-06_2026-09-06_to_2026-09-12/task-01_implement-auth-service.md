# Task tuần: Triển khai Auth service, migration, seed và phát JWT

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-auth-service` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức review boundary Auth, migration và JWT claims |
| Ưu tiên | Cao |
| Hạn dự kiến | 10/09/2026 |
| Nhánh thực hiện | `feat/week-06/task-01-implement-auth-service` |

## Yêu cầu và phạm vi

### Cần thực hiện

Triển khai Auth service theo contract W1 gồm login/refresh tối thiểu, phát JWT có expiry và role/claim cần thiết, sở hữu `auth_db`, có migration/seed tái lập và error envelope canonical. Tích hợp health/configuration và OpenTelemetry bootstrap từ nền Week 5.

### Không thực hiện

- Không triển khai IAM/SSO, OAuth provider, quản trị tài khoản đầy đủ hoặc remote token introspection.
- Không triển khai Gateway, Course hoặc dùng chung entity/repository với service khác.
- Không ghi password, JWT, secret hoặc PII vào log/telemetry.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: Week 5 task-01 đến task-04; HTTP contract v1; backend blueprint; data ownership matrix.
- Người hoặc phần việc cần phối hợp: Đức review migration, seed và claim contract trước khi task-02 dùng.
- Rủi ro/giả định: chọn thuật toán/key JWT và TTL qua cấu hình; seed chỉ chứa dữ liệu thử nghiệm an toàn.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Auth service và test | Code | `lms/services/auth/` |
| Migration/seed Auth | Code | `lms/infrastructure/postgres/` hoặc migration thuộc `lms/services/auth/` theo convention đã chốt |

## Definition of Done

- [ ] Migration/seed tạo được `auth_db` từ trạng thái sạch và chạy lại theo quy trình được tài liệu hóa.
- [ ] `POST /api/v1/auth/login` với seed credential hợp lệ trả JWT có expiry cùng claim định danh/role cần thiết; credential sai trả error envelope canonical.
- [ ] `POST /api/v1/auth/refresh` tuân thủ contract tối thiểu và có test cho token không hợp lệ/hết hạn.
- [ ] Auth không truy cập database/source của service khác; secret và password không xuất hiện trong response, log hoặc telemetry.
- [ ] Unit/integration tests cho JWT, persistence và error path pass; service build và health check thành công.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo trên nhánh task.
- Output workspace: Chưa tạo trên nhánh task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — task được giao cho Bách theo thứ tự thực hiện đầu Week 6.
- Ghi chú/tồn đọng: chỉ bắt đầu khi các dependency Week 5 cần thiết đã có trên `main`.
