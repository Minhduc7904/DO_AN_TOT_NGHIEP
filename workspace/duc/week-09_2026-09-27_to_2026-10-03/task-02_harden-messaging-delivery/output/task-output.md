# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                            |
| ------------------ | ----------------------------------- |
| Mã task            | `task-02_harden-messaging-delivery` |
| Người phụ trách    | Đức                                 |
| Trạng thái         | Đang thực hiện                      |
| Bắt đầu thực tế    | 13/10/2026 14:13 (UTC+7)            |
| Hoàn thành thực tế | Chưa hoàn thành                     |
| Tổng thời lượng    | Đang ghi nhận                       |
| Pull request       | Chưa tạo                            |
| Người review       | Chưa review                         |
| Kết quả review     | Chưa review                         |

## Báo cáo công việc đã làm

- Đã hardening Notification consumer bằng một reconnect loop duy nhất, startup không chờ broker và shutdown đánh thức/dừng reconnect delay.
- Đã phân loại delivery: message hợp lệ chỉ ack sau xử lý; invalid JSON/schema/header bị reject không requeue; lỗi xử lý tạm thời requeue; connection mất trước ack để RabbitMQ redeliver.
- Đã thay dedup `Set` không giới hạn bằng cache in-memory TTL 24 giờ, tối đa 10.000 event ID và eviction entry cũ nhất.
- Đã chuẩn hóa telemetry outcome `accepted`, `duplicate`, `rejected`, `unavailable` bằng label hữu hạn; giữ W3C correlation trên span, không đưa event ID/principal/credential vào metric label.
- Đã bổ sung cấu hình Compose, README giới hạn MVP, CI và hai entrypoint RabbitMQ; stability test chạy ba vòng thật qua TCP broker proxy để kiểm tra down/up, reconnect, redelivery, duplicate và backlog/drain.

## Sản phẩm thực tế

| Sản phẩm                       | Loại   | Link hoặc đường dẫn                                                                                                 |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Hồ sơ input task               | Docs   | [task-input.md](../input/task-input.md)                                                                             |
| Consumer hardening             | Code   | `lms/services/notification/src/adapters/messaging/`                                                                 |
| RabbitMQ integration/stability | Test   | `lms/services/notification/test/rabbitmq-integration.mjs`, `lms/services/notification/test/messaging-stability.mjs` |
| Tài liệu semantics MVP         | Docs   | `lms/services/notification/README.md`, `docker-compose/README.md`                                                   |
| Compose/CI entrypoint          | Config | `docker-compose/compose.yaml`, `.github/workflows/ci.yml`, `lms/package.json`                                       |

## Đối chiếu Definition of Done

| Điều kiện từ input                                                           | Kết quả                   | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish/consume thống nhất binding/schema/trace; queue durable trước publish | Đạt                       | RabbitMQ integration và stability test thật đều pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Một reconnect loop, startup không fail, delay mặc định 1.000 ms và stop sạch | Đạt                       | Unit consumer pass; stability test startup broker unavailable và reconnect pass 3/3 vòng                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Ack/reject/redelivery đúng semantics                                         | Đạt                       | Unit test accepted/invalid/transient; stability test connection loss trước ack và redelivery pass                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dedup TTL 24 giờ/tối đa 10.000 và giới hạn được tài liệu hóa                 | Đạt                       | Unit TTL/capacity pass; `lms/services/notification/README.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Telemetry đủ bốn outcome, giữ correlation và label an toàn                   | Đạt                       | Unit telemetry, RabbitMQ integration, stability và `test:telemetry` pass; stability kiểm tra metric không chứa principal/credential/event ID                                                                                                                                                                                                                                                                                                                                                                              |
| Stability ba vòng duplicate/down-up/reconnect/redelivery/backlog-drain       | Đạt                       | `pnpm --dir lms run test:messaging:stability` — `3/3` vòng pass                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Test/gate bắt buộc pass                                                      | Đạt có ghi chú môi trường | Build PASS; lint PASS; Notification unit 16/16 PASS; `test:notification:rabbitmq` PASS; `test:messaging:stability` PASS; `test:telemetry` PASS; W5 PostgreSQL workflow 4 PASS/1 scenario slowdown skip theo cấu hình; Compose config và `git diff --check` PASS. Full `test` gặp một lần W1 504 flaky, rerun `test:w1` PASS 7/7. Local `ci:verify` dừng ở `format:check` vì Prettier báo 34 file baseline ngoài diff trên checkout Windows; format check toàn bộ file thay đổi PASS, CI Linux chờ xác nhận sau khi mở PR. |
| PR head ghi URL và trạng thái `Chờ review`                                   | Chưa đạt                  | PR chưa tạo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không thêm Notification DB, Redis, DLQ hoặc retry topology.
- Việc chưa hoàn thành hoặc trở ngại: Cần tạo PR, chờ CI Linux và review độc lập. `ci:verify` local không vượt qua baseline format do line-ending/file ngoài diff; không sửa lan sang file ngoài phạm vi.
- Bước tiếp theo: Commit/push substantive work, tạo PR bằng template rồi commit/push URL và trạng thái `Chờ review` vào PR head.
