# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-grade-to-notification-workflow` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 12/10/2026 — mới hoàn tất setup, chưa triển khai task chính |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa tổng kết |
| Pull request | Chưa tạo |
| Người review | Đức (dự kiến) |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Đã đồng bộ `main`, tạo branch riêng và khởi tạo hồ sơ input/output cho Task 03.
- Đã chuyển card task và tổng quan Week 8 sang `Đang thực hiện`.
- Chưa triển khai hoặc thay đổi code/test thuộc sản phẩm chính của task.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Input task | Tài liệu | `workspace/bach/week-08_2026-09-20_to_2026-09-26/task-03_verify-grade-to-notification-workflow/input/task-input.md` |
| Branch task | Khác | `test/week-08/task-03-verify-grade-to-notification-workflow` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| W5 chạy từ dữ liệu sạch đến Notification và kiểm tra error envelope | Chưa thực hiện | Chưa bắt đầu task chính |
| HTTP và RabbitMQ topology cùng async correlation được kiểm chứng | Chưa thực hiện | Chưa bắt đầu task chính |
| Duplicate event và fault slowdown/backlog được kiểm chứng | Chưa thực hiện | Chưa bắt đầu task chính |
| Chuỗi test chạy ổn định và có báo cáo giới hạn | Chưa thực hiện | Chưa bắt đầu task chính |
| Sản phẩm được lưu/đẩy và truy cập được | Chưa đạt | Hiện mới có hồ sơ setup và branch task |
| URL PR và trạng thái `Chờ review` có trên PR head | Chưa đạt | PR chưa tạo |
| PR có review hợp lệ và completion metadata | Chưa đạt | Chưa đến bước review/finalization |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Chưa có thay đổi phạm vi.
- Việc chưa hoàn thành hoặc trở ngại: Toàn bộ work và bằng chứng DoD chưa thực hiện. Đồng bộ JSON/timeline chưa chạy được vì môi trường thiếu PowerShell; Bách đã xác nhận tiếp tục setup theo ngoại lệ.
- Bước tiếp theo: Khảo sát baseline W5 hiện có, triển khai kiểm chứng tích hợp đầy đủ, chạy các cổng test phù hợp, rồi tạo PR và cập nhật trạng thái `Chờ review` trên chính PR head.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
