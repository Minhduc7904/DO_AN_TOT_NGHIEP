# Task tuần: Triển khai Enrollment service, migration/seed và call tới Course

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-enrollment-service` |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Đức |
| Collaborator | Bách review HTTP contract Enrollment↔Course và data ownership |
| Ưu tiên | Cao |
| Hạn dự kiến | 17/09/2026 |
| Nhánh thực hiện | `feat/week-07/task-01-implement-enrollment-service` |

## Yêu cầu và phạm vi

### Cần thực hiện

Triển khai Enrollment service ở mức MVP: tạo enrollment (student ghi danh vào course), liệt kê enrollment theo student hoặc course, persistence riêng trong `enrollment_db`, migration/seed tái lập. Enrollment gọi Course qua HTTP (service-to-service, không đọc `course_db` trực tiếp) để xác nhận course tồn tại trước khi tạo enrollment.

### Không thực hiện

- Không triển khai Submission hoặc gọi Submission; đây thuộc task-04.
- Không đọc `course_db`, `auth_db` hay source/entity/repository của service khác.
- Không thêm resilience nâng cao (retry/circuit-breaker) hay trace-context propagation chi tiết; các phần này thuộc task-02.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: Course service (task-04/05 Week 6) đã merge vào `main`; HTTP contract v1 và data ownership matrix; Gateway/Auth (task-01/02 Week 6) đã merge.
- Người hoặc phần việc cần phối hợp: Bách review contract Enrollment↔Course, data ownership `enrollment_db`.
- Rủi ro/giả định: schema Enrollment chỉ chứa field tối thiểu (student id, course id, trạng thái, thời điểm tạo); ID giữ opaque string tại boundary, khớp quy ước Course Week 6.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Enrollment API, call tới Course, migration/seed và test | Code | `lms/services/enrollment/` |
| CI kiểm tra PostgreSQL Enrollment | Code | `.github/workflows/ci.yml` |

## Definition of Done

- [ ] Endpoint tạo enrollment và liệt kê enrollment đúng response/error contract canonical, validation và quyền được kiểm tra.
- [ ] Enrollment gọi Course qua HTTP để xác nhận course tồn tại trước khi tạo enrollment; course không tồn tại trả lỗi rõ ràng theo error envelope canonical.
- [ ] Migration/seed tạo `enrollment_db` từ trạng thái sạch và chạy lại không nhân bản dữ liệu.
- [ ] Enrollment là owner duy nhất của schema/data; không cross-service database hoặc source import.
- [ ] Unit và PostgreSQL integration tests pass; build, lint, health và CI pass.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-07_2026-09-13_to_2026-09-19/task-01_implement-enrollment-service/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-07_2026-09-13_to_2026-09-19/task-01_implement-enrollment-service/output/task-output.md).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — task được giao cho Đức theo yêu cầu chia task tuần 7 (Đức làm trước, Bách làm sau).
- Cập nhật gần nhất: 22/09/2026 — Đức bắt đầu triển khai trên nhánh `feat/week-07/task-01-implement-enrollment-service` (base `main`); tạo hồ sơ input trong `workspace/duc/`.
- Ghi chú/tồn đọng: `tools/sync-plan-json-and-timeline.ps1` cần `pwsh`, không sẵn có trong môi trường thực hiện; timeline đang chờ đồng bộ, giống ngoại lệ đã ghi nhận ở Week 6 (`task-03_verify-login-workflow.md`).
