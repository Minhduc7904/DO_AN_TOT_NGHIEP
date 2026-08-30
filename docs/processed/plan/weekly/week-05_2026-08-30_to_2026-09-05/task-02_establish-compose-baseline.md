# Task tuần: Dựng Docker Compose baseline và Quick Start

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_establish-compose-baseline` |
| Tuần | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách chạy fresh setup độc lập và phản hồi Quick Start |
| Ưu tiên | Cao |
| Hạn dự kiến | 03/09/2026 |
| Nhánh thực hiện | `feat/week-05/task-02-establish-compose-baseline` |

## Yêu cầu và phạm vi

### Cần thực hiện

Dựng Docker Compose skeleton cho service mẫu cùng PostgreSQL, Redis và RabbitMQ. Chuẩn hóa biến môi trường, network, volume và health check tối thiểu; viết Quick Start đủ để thành viên còn lại clone mới, khởi động stack và kiểm tra `/health` mà không cần hướng dẫn ngoài repository.

### Không thực hiện

- Không thêm Kubernetes, service mesh, MinIO hoặc observability stack đầy đủ.
- Không tạo database schema/seed nghiệp vụ hoặc RabbitMQ flow `grade.completed`.
- Không đưa secret thật vào repository và không yêu cầu thao tác cấu hình thủ công không được ghi trong Quick Start.
- Không triển khai OpenTelemetry bootstrap; task-03 chịu trách nhiệm phần application instrumentation.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01, backend blueprint và data ownership/dependency strategy tuần 4.
- Người hoặc phần việc cần phối hợp: Bách thực hiện fresh setup trên môi trường độc lập, ghi lại bước thiếu hoặc sai và xác nhận Quick Start sau khi sửa.
- Rủi ro/giả định: image/version phải được pin phù hợp; health check cần phân biệt container chạy với dependency thực sự sẵn sàng.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Docker Compose baseline và cấu hình hạ tầng | Code | `infrastructure/compose/` và các thư mục dependency liên quan trong `infrastructure/` |
| Hướng dẫn Quick Start | Docs | `README.md` hoặc tài liệu hướng dẫn canonical được liên kết từ README |

## Definition of Done

- [ ] `docker compose config` hợp lệ và `docker compose up` khởi động được service mẫu, PostgreSQL, Redis và RabbitMQ bằng cấu hình được commit.
- [ ] Health check chứng minh các dependency chính sẵn sàng và `GET /health` của service truy cập được từ host.
- [ ] Biến môi trường mẫu không chứa secret thật; image/runtime version cần thiết được pin hoặc ghi rõ để chạy lại ổn định.
- [ ] Quick Start mô tả từ clean clone đến start, verify và stop/reset stack; không cần bước thủ công ngoài tài liệu.
- [ ] Bách chạy fresh setup độc lập thành công và bằng chứng command/output được ghi trong PR hoặc output task.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 30/08/2026 — task được phân rã và giao theo plan tuần 5.
- Ghi chú/tồn đọng: phụ thuộc task-01; Bách cần giữ lại bằng chứng fresh setup để đóng gate M1.
