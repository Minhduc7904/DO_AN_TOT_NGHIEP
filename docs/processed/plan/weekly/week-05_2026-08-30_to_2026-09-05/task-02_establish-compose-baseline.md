# Task tuần: Dựng Docker Compose baseline và Quick Start

## Thông tin chung

| Trường          | Nội dung                                              |
| --------------- | ----------------------------------------------------- |
| Mã task         | `task-02_establish-compose-baseline`                  |
| Tuần            | `week-05_2026-08-30_to_2026-09-05`                    |
| Trạng thái      | Hoàn thành                                            |
| Người phụ trách | Đức                                                   |
| Collaborator    | Bách chạy fresh setup độc lập và phản hồi Quick Start |
| Ưu tiên         | Cao                                                   |
| Hạn dự kiến     | 03/09/2026                                            |
| Nhánh thực hiện | `feat/week-05/task-02-establish-compose-baseline`     |

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

| Sản phẩm                                    | Loại | Vị trí hoặc link dự kiến                                                                                     |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| Docker Compose baseline và cấu hình hạ tầng | Code | `docker-compose/` cùng cấp với `lms/`; cấu hình dependency riêng khi cần vẫn nằm trong `lms/infrastructure/` |
| Hướng dẫn Quick Start                       | Docs | `README.md` hoặc tài liệu hướng dẫn canonical được liên kết từ README                                        |

## Definition of Done

- [x] `docker compose config` hợp lệ và `docker compose up` khởi động được service mẫu, PostgreSQL, Redis và RabbitMQ bằng cấu hình được commit.
- [x] Health check chứng minh các dependency chính sẵn sàng và `GET /health` của service truy cập được từ host.
- [x] Biến môi trường mẫu không chứa secret thật; image/runtime version cần thiết được pin hoặc ghi rõ để chạy lại ổn định.
- [x] Quick Start mô tả từ clean clone đến start, verify và stop/reset stack; không cần bước thủ công ngoài tài liệu.
- [x] Bách chạy fresh setup độc lập thành công và bằng chứng command/output được ghi trong PR hoặc output task.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-05_2026-08-30_to_2026-09-05/task-02_establish-compose-baseline/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-05_2026-08-30_to_2026-09-05/task-02_establish-compose-baseline/output/task-output.md).
- Pull request: [#16](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/16).
- Kết quả review: Bách đã approval ngoài GitHub theo xác nhận trực tiếp của Đức ngày 10/09/2026; GitHub không ghi nhận verdict `APPROVED`.

> Ghi nhận hậu kiểm theo ngoại lệ do người phụ trách xác nhận: PR đã merge trước finalization và không có GitHub `APPROVED`. Trạng thái này dùng approval ngoài GitHub do Đức xác nhận, theo [quy tắc ưu tiên chỉ thị trực tiếp](../../../rules/git-and-pull-request-rules.md#ưu-tiên-chỉ-thị-trực-tiếp-và-ghi-nhận-ngoại-lệ).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — Đức xác nhận task đã hoàn thành và yêu cầu correction trạng thái trên `main` sau khi PR #16 đã merge.
- Cập nhật kỹ thuật: Compose config hợp lệ; Course, PostgreSQL, Redis và RabbitMQ đều healthy; `/health`, ba readiness probe và reset/restart đều đạt với port host cấu hình riêng.
- Ghi chú/tồn đọng: không còn tồn đọng theo xác nhận của Đức; phần fresh setup và approval của Bách được xác nhận ngoài GitHub, không có verdict `APPROVED` trên PR.
