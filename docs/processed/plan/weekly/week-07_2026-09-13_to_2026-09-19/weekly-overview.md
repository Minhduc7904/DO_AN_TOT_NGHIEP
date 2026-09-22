# Tổng quan tuần 7 — Enrollment, Submission và propagation xuyên service

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Nguồn plan canonical | [Plan v0.2 — Tuần 7](../../plan-v0.2-24-weeks.md#tuần-7--enrollment-submission-và-propagation-xuyên-service) |
| Mục tiêu tuần | Triển khai Enrollment và Submission ở mức MVP, gọi chéo service qua HTTP, có storage mock điều khiển được và trace-context xuyên Gateway/Enrollment/Submission. |
| Trạng thái tuần | Đang thực hiện |

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_implement-enrollment-service](task-01_implement-enrollment-service.md) | Triển khai Enrollment service, migration/seed và call tới Course | Đức | Bách | Cao | Đang thực hiện |
| [task-02_add-enrollment-resilience-and-propagation](task-02_add-enrollment-resilience-and-propagation.md) | Bổ sung resilience và trace-context propagation cho Enrollment→Course | Đức | Bách | Cao | Đã giao |
| [task-03_verify-enrollment-workflow](task-03_verify-enrollment-workflow.md) | Kiểm chứng E2E login → enroll qua Gateway | Đức | Bách | Trung bình | Đã giao |
| [task-04_implement-submission-service](task-04_implement-submission-service.md) | Triển khai Submission service MVP và storage mock điều khiển được | Bách | Đức | Cao | Đã giao |
| [task-05_add-submission-contract-and-storage-tests](task-05_add-submission-contract-and-storage-tests.md) | Bổ sung contract/integration test cho Submission và storage dependency | Bách | Đức | Cao | Đã giao |
| [task-06_verify-enroll-to-submit-workflow](task-06_verify-enroll-to-submit-workflow.md) | Kiểm chứng E2E login → enroll → nộp bài qua Gateway | Bách | Đức | Trung bình | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Pull request đang mở

Chưa có PR nào được mở cho tuần 7.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: task-01 đến task-03 (Enrollment) phải merge vào `main` trước khi task-04 đến task-06 (Submission) bắt đầu, vì Submission gọi Enrollment qua HTTP và task-06 kiểm chứng luồng kết hợp `enroll → nộp bài`. Course từ Week 6 đã merge vào `main`, là dependency sẵn có cho cả hai track. Task-05 có thể bắt đầu viết test scaffold song song với task-04 nhưng chỉ merge sau khi task-04 có contract ổn định.
- Rủi ro: storage mock phải có dependency identity ổn định và điều khiển được latency/error, nếu thiết kế sai sẽ phải sửa lại contract ở task-05/06; trace-context propagation qua nhiều hop (Gateway→Enrollment→Course, Gateway→Submission→Enrollment/Course/storage) dễ đứt gãy nếu một service quên forward header; thời gian tuần ngắn trong khi Submission phụ thuộc Enrollment nên track B có nguy cơ bị dồn cuối tuần.
- Quyết định cần chốt: Theo yêu cầu của Đức ngày 21/09/2026, tuần 7 giữ nguyên ánh xạ vai trò canonical của plan — Đức nhận vai trò A (Enrollment, làm trước), Bách nhận vai trò B (Submission, làm sau, phụ thuộc Enrollment). Không đổi vai trò như tuần 6.

## Tiêu chí kết thúc tuần

- [ ] Luồng `login → enroll → nộp bài` chạy qua Gateway với PostgreSQL thực; Enrollment và Submission có persistence riêng (`enrollment_db`, `submission_db` nếu cần).
- [ ] Ít nhất một HTTP contract test cho Submission↔Course và Submission↔Enrollment.
- [ ] Storage mock có dependency identity ổn định, điều khiển được latency/error và tạo outbound/dependency span riêng biệt.
- [ ] Trace xuyên Gateway, Enrollment, Submission và các dependency giữ W3C context; resilience cơ bản (timeout/retry) khi gọi Course/Enrollment được kiểm tra.
- [ ] Mỗi task có PR riêng, bằng chứng DoD và trạng thái đúng vòng đời review canonical.
