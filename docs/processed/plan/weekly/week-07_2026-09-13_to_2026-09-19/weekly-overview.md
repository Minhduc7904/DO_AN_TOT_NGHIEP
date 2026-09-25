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
| [task-01_implement-enrollment-service](task-01_implement-enrollment-service.md) | Triển khai Enrollment service, migration/seed và call tới Course | Đức | Bách | Cao | Hoàn thành |
| [task-02_add-enrollment-resilience-and-propagation](task-02_add-enrollment-resilience-and-propagation.md) | Bổ sung resilience và trace-context propagation cho Enrollment→Course | Đức | Bách | Cao | Hoàn thành |
| [task-03_verify-enrollment-workflow](task-03_verify-enrollment-workflow.md) | Kiểm chứng E2E login → enroll qua Gateway | Đức | Bách | Trung bình | Hoàn thành |
| [task-04_implement-submission-service](task-04_implement-submission-service.md) | Triển khai Submission service MVP và storage mock điều khiển được | Bách | Đức | Cao | Hoàn thành |
| [task-05_add-submission-contract-and-storage-tests](task-05_add-submission-contract-and-storage-tests.md) | Bổ sung contract/integration test cho Submission và storage dependency | Bách | Đức | Cao | Hoàn thành |
| [task-06_verify-enroll-to-submit-workflow](task-06_verify-enroll-to-submit-workflow.md) | Kiểm chứng E2E login → enroll → nộp bài qua Gateway | Bách | Đức | Trung bình | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Pull request liên quan

- [#25](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/25) — `task-01_implement-enrollment-service`, đã merge vào `main` theo ngoại lệ workflow (Bách không thể review, Đức tự review thay Bách; không có `APPROVED` GitHub).
- [#26](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/26) — `task-02_add-enrollment-resilience-and-propagation`, base `main` (nội dung xếp chồng trên #25, đã merge), đã merge vào `main` theo ngoại lệ workflow (Bách không thể review, Đức tự review thay Bách; không có `APPROVED` GitHub).
- [#27](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/27) — `task-03_verify-enrollment-workflow`, base `main` (nội dung xếp chồng trên #26, #25), đã merge vào `main` theo ngoại lệ workflow (Bách không thể review hay chạy độc lập, Đức tự review thay Bách; không có `APPROVED` GitHub). Toàn bộ track Enrollment (task-01→03) tuần 7 đã hoàn thành.
- [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28) — `task-04_implement-submission-service`, base `main`; finalization trên branch theo ngoại lệ do Bách xác nhận trực tiếp sau vòng re-review kỹ thuật; không có GitHub `APPROVED`.
- [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29) — `task-05_add-submission-contract-and-storage-tests`, base `main`; đã finalization trên task branch theo ngoại lệ do Bách chỉ thị trực tiếp ngày 25/09/2026 sau khi xác nhận Đức cho phép ủy quyền. Tự review kỹ thuật không thay thế GitHub `APPROVED`; PR chưa merge, còn phụ thuộc giới hạn branch protection và thao tác merge của Bách.

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
