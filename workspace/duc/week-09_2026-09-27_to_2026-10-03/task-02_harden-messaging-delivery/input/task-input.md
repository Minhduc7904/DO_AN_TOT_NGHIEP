# Input task

## Thông tin chung

| Trường               | Nội dung                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| Mã task              | `task-02_harden-messaging-delivery`                                         |
| Tên task             | Hardening messaging delivery                                                |
| Người phụ trách      | Đức                                                                         |
| Tuần thực hiện       | `week-09_2026-09-27_to_2026-10-03`                                          |
| Trạng thái           | Đang thực hiện                                                              |
| Ngày tạo             | 13/10/2026                                                                  |
| Thời gian dự kiến    | 13/10/2026–14/10/2026                                                       |
| Nhánh thực hiện      | `test/week-09/task-02-harden-messaging-delivery`                            |
| Pull request dự kiến | PR riêng vào `main`, tạo sau khi có substantive work và bằng chứng kiểm thử |

## Mục tiêu và phạm vi

### Task cần làm gì?

Hardening luồng RabbitMQ `grade.completed` giữa Grading và Notification để chứng minh semantics at-least-once trong phạm vi MVP: consumer tự reconnect bằng một vòng lặp duy nhất, startup không phụ thuộc broker sẵn sàng, ack/reject đúng thời điểm, deduplicate có TTL và giới hạn dung lượng, giữ correlation telemetry và có test RabbitMQ thật cho duplicate, broker down/up, redelivery, slowdown/backlog rồi drain.

### Phạm vi không thực hiện

- Không xây exactly-once hoặc persistence cho dedup qua process restart.
- Không thêm Notification database, Redis ownership, DLQ hay retry topology production-grade.
- Không đổi schema `grade.completed` v1 hoặc mở rộng sang nhà cung cấp notification thật.
- Không sửa hồ sơ thuộc `workspace/bach/`.

## Sản phẩm dự kiến

| Sản phẩm                                          | Loại      | Vị trí hoặc link dự kiến                                                          |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| Consumer reconnect, ack/reject và dedup hardening | Code      | `lms/services/notification/src/`                                                  |
| RabbitMQ integration và stability tests           | Code      | `lms/services/notification/test/`, `lms/package.json`, `.github/workflows/ci.yml` |
| Tài liệu semantics và giới hạn delivery MVP       | Docs      | `lms/services/notification/README.md`                                             |
| Cấu hình runtime/Compose                          | Code/Docs | `lms/services/notification/.env.example`, `docker-compose/`                       |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: W8 task-02 Notification consumer và W9 task-01 đã merge; contract `grade.completed` v1; RabbitMQ thật cho integration/stability test.
- Người cần phối hợp: reviewer agent độc lập sau khi PR ở trạng thái `Chờ review`.
- Rủi ro hoặc giả định: môi trường chạy stability test cần Docker; dedup in-memory không bền qua restart và chỉ cung cấp at-least-once có suppression trong một process.

## Definition of Done

- [ ] Publish/consume dùng cùng exchange, routing key, schema và trace headers; queue durable tồn tại trước khi publish.
- [ ] Consumer có đúng một reconnect loop, delay mặc định 1.000 ms, startup không fail khi broker unavailable và shutdown dừng sạch.
- [ ] Accepted/duplicate chỉ ack sau xử lý; message/header invalid bị reject không requeue; connection loss trước ack cho phép RabbitMQ redeliver.
- [ ] Dedup in-memory có TTL 24 giờ, tối đa 10.000 event ID và tài liệu ghi rõ không phải exactly-once, không bền qua process restart.
- [ ] Telemetry phân biệt `accepted`, `duplicate`, `rejected`, `unavailable`, giữ correlation publisher→consumer→process và metric label không chứa event ID/credential.
- [ ] `test:notification:rabbitmq` và `test:messaging:stability` kiểm tra RabbitMQ thật; stability chạy ba vòng gồm duplicate, broker down/up, reconnect, redelivery và slowdown tạo backlog rồi drain.
- [ ] `format:check`, build, lint, unit test, telemetry, `ci:verify`, `git diff --check` và Compose config pass.
- [ ] Sản phẩm đã được commit/push trên nhánh task và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc; review và finalization thực hiện ở giai đoạn riêng theo vòng đời canonical hoặc ngoại lệ được ghi nhận trung thực.
