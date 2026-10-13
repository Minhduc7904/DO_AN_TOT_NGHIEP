# Input task

## Thông tin chung

| Trường               | Nội dung                                                        |
| -------------------- | --------------------------------------------------------------- |
| Mã task              | `task-03_implement-reset-and-seed-command`                      |
| Tên task             | Tạo lệnh reset và seed Testbed MVP                              |
| Người phụ trách      | Đức                                                             |
| Tuần thực hiện       | `week-09_2026-09-27_to_2026-10-03`                              |
| Trạng thái           | Đang thực hiện                                                  |
| Ngày tạo             | 13/10/2026                                                      |
| Thời gian dự kiến    | 13/10/2026                                                      |
| Nhánh thực hiện      | `feat/week-09/task-03-implement-reset-and-seed-command`         |
| Pull request dự kiến | PR riêng vào `main` sau substantive work và bằng chứng kiểm thử |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo entrypoint Node đa nền tảng để reset project Compose local/test đã xác nhận, dựng lại Testbed MVP, kiểm tra health và tạo fingerprint seed xác định cho năm database, Redis, RabbitMQ, Storage Mock và Notification. Lệnh phải fail closed, gọi process bằng argument array, dừng ngay khi lỗi và có kiểm thử reset hai lần cho cùng fingerprint.

### Phạm vi không thực hiện

- Không cho phép production, project ngoài allowlist hoặc Compose/env file ngoài repository.
- Không tác động project Compose khác project đã xác nhận.
- Không thêm database cho Notification, persistence cho dedup hoặc topology RabbitMQ production-grade.
- Không sửa hồ sơ thuộc `workspace/bach/`.

## Sản phẩm dự kiến

| Sản phẩm                           | Loại | Vị trí hoặc link dự kiến                          |
| ---------------------------------- | ---- | ------------------------------------------------- |
| Entrypoint reset/seed fail-closed  | Code | `lms/scripts/reset-and-seed.mjs`                  |
| Unit và Compose integration smoke  | Test | `lms/test/testbed-reset/`, `lms/package.json`, CI |
| Fixed principal seed xuyên service | Code | migration Auth, Enrollment, Submission và Grading |
| Hướng dẫn vận hành và recovery     | Docs | `docker-compose/README.md`                        |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: Compose baseline sau W9 task-02; migration/seed của Auth, Course, Enrollment, Submission và Grading.
- Người cần phối hợp: Reviewer agent độc lập sau khi PR chuyển `Chờ review`.
- Rủi ro hoặc giả định: Docker Compose v2 phải hỗ trợ `up --wait`; reset xóa volume của đúng project được xác nhận; `.env` local không được commit.

## Definition of Done

- [x] Một lệnh duy nhất reset năm database, Redis, RabbitMQ, Storage Mock và Notification của đúng project local/test đã xác nhận.
- [x] Guard từ chối thiếu/mismatch confirm, production, project ngoài allowlist và Compose/env path ngoài repository; child process luôn dùng argument array, không qua shell.
- [x] Student/instructor Auth dùng UUID cố định; Enrollment, Submission và Grading dùng cùng principal seed; password hash không nằm trong fingerprint.
- [x] Sau `down --volumes --remove-orphans` và `up --build -d --wait`, health/fingerprint được xác minh; lỗi bất kỳ bước nào trả exit code khác 0 và không báo thành công giả.
- [x] Unit test guard và failure semantics pass; Compose smoke reset hai lần cho fingerprint đã sort giống nhau, Redis sạch và RabbitMQ queue ở baseline.
- [ ] `format:check`, build, lint, unit test, telemetry, `ci:verify`, Compose config và `git diff --check` pass.
- [ ] Sản phẩm đã được commit/push trên nhánh task và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request có mô tả đúng template; review/finalization được thực hiện ở giai đoạn riêng theo vòng đời canonical hoặc ngoại lệ được ghi nhận trung thực.
