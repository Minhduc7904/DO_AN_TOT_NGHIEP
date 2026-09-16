# Task tuần: Triển khai Auth service, migration, seed và phát JWT

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-auth-service` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Hoàn thành |
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

- [x] Migration/seed tạo được `auth_db` từ trạng thái sạch và chạy lại theo quy trình được tài liệu hóa.
- [x] `POST /api/v1/auth/login` với seed credential hợp lệ trả JWT có expiry cùng claim định danh/role cần thiết; credential sai trả error envelope canonical.
- [x] `POST /api/v1/auth/refresh` tuân thủ contract tối thiểu và có test cho token không hợp lệ/hết hạn.
- [x] Auth không truy cập database/source của service khác; secret và password không xuất hiện trong response, log hoặc telemetry.
- [x] Unit/integration tests cho JWT, persistence và error path pass; service build và health check thành công.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-06_2026-09-06_to_2026-09-12/task-01_implement-auth-service/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-06_2026-09-06_to_2026-09-12/task-01_implement-auth-service/output/task-output.md).
- Pull request: [#19](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/19).
- Kết quả review: Không có GitHub `APPROVED`; finalization theo ngoại lệ do Bách xác nhận trực tiếp ngày 16/09/2026. Bách cho biết Đức đã ủy quyền review.

> Ngoại lệ được Bách, người phụ trách task, xác nhận trực tiếp ngày 16/09/2026: không có GitHub `APPROVED`, nhưng completion metadata được finalization trên chính branch/PR với nguồn xác nhận thay thế. Trạng thái này chỉ là sẵn sàng merge; task chỉ canonically hoàn thành project-wide khi commit này vào `main`; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 16/09/2026 — Bách xác nhận finalization theo ngoại lệ; PR #19 ở commit `8686a62` có quality gate, Compose validation và GitGuardian đều pass.
- Ghi chú/tồn đọng: Không có blocker kỹ thuật; thiếu GitHub `APPROVED` được ghi nhận minh bạch theo ngoại lệ. Bách là người duy nhất có quyền merge PR.
