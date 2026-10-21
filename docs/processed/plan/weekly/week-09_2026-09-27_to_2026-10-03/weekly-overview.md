# Tổng quan tuần 9 — Hardening Testbed MVP

## Thông tin tuần

| Trường               | Nội dung                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tuần                 | `week-09_2026-09-27_to_2026-10-03`                                                                                                                           |
| Nguồn plan canonical | [Plan v0.2 — Tuần 9](../../plan-v0.2-24-weeks.md#tuần-9--hardening-testbed-mvp)                                                                              |
| Mục tiêu tuần        | Hoàn thiện Testbed MVP v0.1: chuẩn hóa resilience, kiểm chứng messaging, có reset/seed thống nhất, regression E2E và bằng chứng dựng lại từ môi trường sạch. |
| Trạng thái tuần      | Hoàn thành                                                                                                                                               |

> Kế hoạch W9 được cụ thể hóa hồi tố ngày 11/10/2026 để bù tiến độ sau W8. Mốc tuần canonical vẫn là 27/09/2026–03/10/2026; hạn task bên dưới là mốc bù tiến độ, không thay đổi phạm vi milestone.

## Danh sách task

| Mã task                                                                                   | Task                                                              | Người phụ trách | Collaborator                             | Ưu tiên    | Trạng thái     |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------- | ---------------------------------------- | ---------- | -------------- |
| [task-01_standardize-dependency-resilience](task-01_standardize-dependency-resilience.md) | Chuẩn hóa timeout, retry và error propagation cho dependency HTTP | Đức             | Không có                                 | Cao        | Hoàn thành     |
| [task-02_harden-messaging-delivery](task-02_harden-messaging-delivery.md)                 | Hardening publisher/consumer idempotency và failure handling      | Đức             | Không có                                 | Cao        | Hoàn thành     |
| [task-03_implement-reset-and-seed-command](task-03_implement-reset-and-seed-command.md)   | Tạo lệnh reset/seed thống nhất cho Testbed MVP                    | Đức             | Không có                                 | Cao        | Hoàn thành     |
| [task-04_build-mvp-regression-suite](task-04_build-mvp-regression-suite.md)               | Xây regression E2E và telemetry assertions cho các workflow chính | Bách            | Đức hỗ trợ môi trường testbed            | Cao        | Hoàn thành     |
| [task-05_validate-fresh-setup-and-m2-gate](task-05_validate-fresh-setup-and-m2-gate.md)   | Xác minh fresh setup và Gate M2                                   | Đức            | Không có; tiếp quản theo chỉ thị Đức | Trung bình | Hoàn thành |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: W8 task-02 phải hoàn thiện Notification consumer trước task-02 W9; W8 task-03 phải có workflow `grade → notification` trước regression W9; task-04 W9 phụ thuộc task-01, task-02 và task-03 W9; task-05 chạy sau task-04.
- Rủi ro còn lại: Gate M2 canonical `Chờ xử lý` vì thiếu bằng chứng Bách tự giải thích hai workflow. Fresh setup đã có kiểm chứng độc lập Đức; task-05 đóng theo ngoại lệ Đức xác nhận ngày 21/10/2026.
- Phân công hiện hành: Đức phụ trách task-01–03 và tiếp quản task-05 theo chỉ thị ngày 21/10/2026; Bách giữ quyền tác giả task-04 và lịch sử validation task-05.

## Thứ tự thực hiện đề xuất

1. Song song task-01 và task-03 để chốt resilience HTTP và khả năng tái lập dữ liệu.
2. Hoàn tất dependency W8 task-02 rồi thực hiện task-02 W9 trên publisher/consumer thật.
3. Chạy task-04 sau khi các lớp HTTP, messaging và reset/seed ổn định.
4. Dùng kết quả task-04 để thực hiện task-05 và đánh giá Gate M2.

## Tiêu chí kết thúc tuần

- [x] Sáu business service `Auth`, `Course`, `Enrollment`, `Submission`, `Grading`, `Notification` và Gateway chạy trong topology MVP cùng PostgreSQL, Redis và RabbitMQ.
- [x] Timeout, retry và error propagation của dependency HTTP có policy thống nhất, test được và không nhân retry ngoài chủ đích.
- [x] Publisher/consumer `grade.completed` chứng minh semantics at-least-once, deduplicate theo `event_id`, giữ correlation và xử lý failure/recovery quan sát được.
- [x] Có một lệnh reset/seed tái lập dữ liệu Testbed MVP từ trạng thái sạch và chạy lặp lại cho kết quả xác định.
- [x] Regression suite bao phủ ít nhất hai workflow xuyên service, các nhánh error/latency quan trọng và telemetry assertions tương ứng.
- [x] Fresh setup chạy được theo tài liệu; Gate M2 có bằng chứng và ghi rõ giới hạn nếu chưa có người kiểm chứng thứ hai.
- [x] Mỗi task có PR riêng, bằng chứng DoD và trạng thái theo vòng đời task canonical.

## Đối chiếu ngày 21/10/2026

Ngày 21/10/2026, Đức chỉ thị tiếp quản task thay Bách và xác nhận ngoại lệ, cho phép commit/push/merge PR #40 sau cảnh báo. Không có GitHub APPROVED; không xác nhận Gate M2 hai thành viên đạt khi thiếu phần giải thích của Bách.

Task-01–04 đã merge qua PR #35, #37, #38, #39. Task-05 tiếp quản bởi Đức tại [PR #40](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/40); [kiểm chứng độc lập](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/40#issuecomment-6314205006) pass. Các ghi chú chờ kiểm chứng phía trên là lịch sử kế hoạch. Gate M2 canonical vẫn `Chờ xử lý`; thiếu phần giải thích của Bách.

W9 hoàn tất 5/5 task theo ngoại lệ đã xác nhận sau khi PR #40 vào main. Việc đóng tuần không xác nhận Gate M2 canonical đạt; tiêu chí hai thành viên vẫn chưa đủ bằng chứng. Task-05: không có GitHub APPROVED, readiness đã push tại `5b1fe85`, finalization trên chính PR trước merge.
