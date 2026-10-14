# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                   |
| ------------------ | ------------------------------------------ |
| Mã task            | `task-05_validate-fresh-setup-and-m2-gate` |
| Người phụ trách    | Bách                                       |
| Trạng thái         | Đang thực hiện                             |
| Bắt đầu thực tế    | 14/10/2026                                 |
| Hoàn thành thực tế | Chưa hoàn thành                            |
| Tổng thời lượng    | Chưa xác định                              |
| Pull request       | Chưa tạo                                   |
| Người review       | Chưa có                                    |
| Kết quả review     | Chưa review                                |

## Báo cáo công việc đã làm

- 14/10/2026: Khởi tạo branch, input/output và chuyển task sang `Đang thực hiện`; chưa chạy fresh setup.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn                                                     |
| -------- | ---- | ----------------------------------------------------------------------- |
| Chưa có  | Docs | Sẽ cập nhật báo cáo fresh setup/Gate M2 và tài liệu setup khi thực hiện |

## Đối chiếu Definition of Done

| Điều kiện từ input                                                    | Kết quả  | Bằng chứng                  |
| --------------------------------------------------------------------- | -------- | --------------------------- |
| Checkout sạch, version được tài liệu hóa; Compose đủ service healthy  | Chưa đạt | Chưa thực hiện              |
| Reset/seed và regression suite pass, có log/thời lượng/commit         | Chưa đạt | Chưa thực hiện              |
| Vận hành và giải thích ít nhất hai workflow, gồm một luồng async      | Chưa đạt | Chưa thực hiện              |
| Người thứ hai kiểm chứng độc lập; nếu chưa có thì Gate M2 `Chờ xử lý` | Chưa đạt | Chưa liên hệ Đức kiểm chứng |
| Lỗi tài liệu setup được sửa và kiểm tra lại từ trạng thái sạch        | Chưa đạt | Chưa thực hiện              |
| URL/số PR và `Chờ review` được commit/push vào PR head trước review   | Chưa đạt | Chưa tạo PR                 |
| `APPROVED` hợp lệ và finalization trước merge                         | Chưa đạt | Chưa review                 |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có.
- Việc chưa hoàn thành hoặc trở ngại: Cần hẹn Đức kiểm chứng độc lập trước khi chuyển `Chờ review` để Gate M2 có thể được đánh giá trong task.
- Bước tiếp theo: Clone sạch repository, dựng Testbed chỉ theo `README.md`/`docker-compose/README.md` với build không dùng cache, ghi lại mọi chỗ tài liệu thiếu hoặc sai.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
