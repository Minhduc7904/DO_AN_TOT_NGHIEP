# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-xx_short-title` |
| Người phụ trách | Đức hoặc Bách |
| Trạng thái | Đang thực hiện / Chờ review / Hoàn thành / Chờ xử lý |
| Bắt đầu thực tế |  |
| Hoàn thành thực tế |  |
| Tổng thời lượng |  |
| Pull request |  |
| Người review |  |
| Kết quả review | `APPROVED` / `CHANGES_REQUESTED` / Chưa review |

## Báo cáo công việc đã làm

<!-- Nêu ngắn gọn các bước hoặc kết quả thực tế. -->

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
|  | Docs / Code / Khác |  |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Điều kiện 1 | Đạt / Chưa đạt | Link, đường dẫn hoặc mô tả kiểm tra |
| Điều kiện 2 | Đạt / Chưa đạt | Link, đường dẫn hoặc mô tả kiểm tra |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input:
- Việc chưa hoàn thành hoặc trở ngại:
- Bước tiếp theo:

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, review và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau `APPROVED`, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
