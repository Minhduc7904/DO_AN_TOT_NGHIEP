# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-grade-completed-contract-and-notification-skeleton` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 27/09/2026 |
| Hoàn thành thực tế | Chưa xác định — chờ review, approval và finalization trước merge |
| Tổng thời lượng | Chưa tổng kết — task chưa finalization |
| Pull request | [#31](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/31) |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Tạo contract strict version 1 và fixture canonical cho event `grade.completed`, gồm envelope, payload, producer và trace context.
- Ghi tài liệu routing RabbitMQ và quy tắc compatibility cho event contract.
- Dựng Notification service skeleton với health endpoint, validation cấu hình và RabbitMQ binding; consumer chỉ xác thực fixture, chưa xử lý notification hoặc duplicate.
- Tạo PR #31 để Đức rà soát sự tương thích field publisher/consumer trước task-05.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Contract, schema và fixture `grade.completed` v1 | Docs / Code | `lms/contracts/events/grade-completed/`, `lms/contracts/src/events/grade-completed.ts` |
| Notification skeleton | Code | `lms/services/notification/` |
| Pull request | Khác | [#31](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/31) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Contract version 1 có event ID, name, schema version, occurred time UTC, producer, payload và trace context; có validation/fixture. | Đạt | `gradeCompletedEventSchema`, `gradeCompletedV1Fixture`; contract build thành công. |
| Notification skeleton chạy health/config rõ ràng, consume fixture theo contract và không cross-service database/source import. | Đạt | `lms/services/notification/`; 3 unit tests Notification đạt với Node 22.13.1. |
| Đức đã rà soát field publisher/consumer; điểm chưa chốt được ghi trong PR/card task. | Chưa đạt | PR #31 đang chờ Đức review; mục `Cần review` yêu cầu xác nhận field và event name canonical. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Đạt | Commit `a734486` trên nhánh Task 1 và PR #31. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Đạt | Metadata này được commit/push cùng cập nhật trạng thái PR-ready trên nhánh Task 1. |
| Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge. | Chưa đạt | Chưa có review GitHub `APPROVED`; chưa thực hiện finalization hoặc merge. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có thay đổi phạm vi substantive.
- Việc chưa hoàn thành hoặc trở ngại: Cần Đức rà soát compatibility publisher; chưa có GitHub `APPROVED` nên không được finalization/merge.
- Bước tiếp theo: Đức review PR #31. Nếu có feedback, xử lý trên nhánh này; nếu `APPROVED`, ghi completion metadata, xin re-approval nếu approval stale rồi mới merge.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
