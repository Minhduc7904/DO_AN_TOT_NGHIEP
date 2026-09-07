# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                             |
| ------------------ | ------------------------------------ |
| Mã task            | `task-02_establish-compose-baseline` |
| Người phụ trách    | Đức                                  |
| Trạng thái         | Đang thực hiện                       |
| Bắt đầu thực tế    | 07/09/2026                           |
| Hoàn thành thực tế | Chưa hoàn thành                      |
| Tổng thời lượng    | Chưa tổng hợp                        |
| Pull request       | Chưa tạo                             |
| Người review       | Bách — chưa review                   |
| Kết quả review     | Chưa review                          |

## Báo cáo công việc đã làm

- Đã tạo nhánh task-02 từ HEAD task-01 theo yêu cầu và hoàn tất kế hoạch triển khai.
- Tạo manifest root tại `docker-compose/` để build Course và khởi động PostgreSQL, Redis cùng RabbitMQ.
- Pin image PostgreSQL `17.6-alpine`, Redis `8.2.1-alpine` và RabbitMQ `4.1.4-management-alpine`.
- Thêm environment mẫu local-only, port host có thể cấu hình, named volume, network và health check riêng cho bốn service.
- Viết Quick Start cho validate, start, verify, logs, stop, reset và restart; cập nhật README và backend blueprint theo vị trí Compose mới.

## Sản phẩm thực tế

| Sản phẩm                | Loại        | Link hoặc đường dẫn                                                         |
| ----------------------- | ----------- | --------------------------------------------------------------------------- |
| Docker Compose baseline | Code/config | [`docker-compose/compose.yaml`](../../../../../docker-compose/compose.yaml) |
| Cấu hình local mẫu      | Config      | [`docker-compose/.env.example`](../../../../../docker-compose/.env.example) |
| Quick Start             | Docs        | [`docker-compose/README.md`](../../../../../docker-compose/README.md)       |

## Đối chiếu Definition of Done

| Điều kiện từ input                            | Kết quả    | Bằng chứng                                                                                                                  |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Compose config và stack healthy               | Đạt cục bộ | `docker compose config --quiet` exit `0`; Course, PostgreSQL, Redis và RabbitMQ đều đạt `healthy` ngày 07/09/2026           |
| Course `/health` truy cập được qua Compose    | Đạt cục bộ | `GET /health` trả `status=ok`, timestamp `2026-09-07T09:11:11.632Z`; Course chỉ start sau ba dependency healthy             |
| Image, environment, network và volume tái lập | Đạt cục bộ | Ba image dependency dùng tag cố định; stack dùng environment mẫu, network riêng, ba named volume và port host cấu hình được |
| Quick Start và reset/restart                  | Đạt cục bộ | Lượt restart sau `down --volumes --remove-orphans` đạt healthy; cleanup không còn container hoặc volume của project test    |
| Sản phẩm được lưu và đẩy lên nhánh task       | Đạt        | Compose manifest, environment mẫu, Quick Start và tài liệu liên quan được commit/push trên nhánh task-02                    |
| Fresh setup độc lập của Bách                  | Chưa đạt   | Chưa review                                                                                                                 |
| PR, approval và finalization                  | Chưa đạt   | Chưa tạo PR                                                                                                                 |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: theo yêu cầu của Đức, Compose root đặt tại `docker-compose/` cùng cấp với `lms/`; input và blueprint đã được cập nhật theo quyết định này.
- Việc chưa hoàn thành hoặc trở ngại: Bách chưa chạy fresh setup độc lập; PR #15 của task-01 chưa merge và nhánh task-02 hiện xếp chồng trên task-01.
- Bước tiếp theo: sau khi PR #15 merge, đồng bộ nhánh task-02 với `main`; Bách chạy Quick Start trên checkout sạch trước khi mở PR task-02.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
