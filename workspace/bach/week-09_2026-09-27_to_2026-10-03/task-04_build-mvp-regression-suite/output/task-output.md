# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_build-mvp-regression-suite` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 12/10/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa xác định |
| Pull request | Chưa tạo |
| Người review | Chưa có |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- 12/10/2026: Khởi tạo branch, input/output và chuyển task sang `Đang thực hiện`; chưa triển khai regression suite.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Chưa có | Code | Sẽ cập nhật khi triển khai `lms/test/` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Một command reset/seed rồi kiểm chứng hai workflow từ trạng thái sạch | Chưa đạt | Chưa triển khai |
| Bao phủ timeout HTTP, dependency unavailable và failure/recovery messaging | Chưa đạt | Chưa triển khai |
| Assertions topology và trace correlation sync/async | Chưa đạt | Chưa triển khai |
| Async polling có timeout, ổn định ba lần liên tiếp, có diagnostics | Chưa đạt | Chưa triển khai |
| Chạy trong CI hoặc có lý do tách job; `pnpm run ci:verify` và Compose smoke pass | Chưa đạt | Chưa triển khai |
| URL/số PR và `Chờ review` được commit/push vào PR head trước review | Chưa đạt | Chưa tạo PR |
| `APPROVED` hợp lệ và finalization trước merge | Chưa đạt | Chưa review |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có.
- Việc chưa hoàn thành hoặc trở ngại: W9 task-02 và task-03 của Đức chưa merge nên chưa thể hoàn thiện bước reset/seed và ca failure/recovery messaging.
- Bước tiếp theo: Dựng khung regression trong `lms/test/`, happy path hai workflow và các ca lỗi HTTP trên `main` hiện tại.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
