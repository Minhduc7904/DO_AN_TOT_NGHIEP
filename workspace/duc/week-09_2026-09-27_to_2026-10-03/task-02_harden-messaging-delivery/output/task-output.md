# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                                       |
| ------------------ | -------------------------------------------------------------- |
| Mã task            | `task-02_harden-messaging-delivery`                            |
| Người phụ trách    | Đức                                                            |
| Trạng thái         | Hoàn thành                                                     |
| Bắt đầu thực tế    | 13/10/2026 14:13 (UTC+7)                                       |
| Hoàn thành thực tế | 13/10/2026 15:05 (UTC+7)                                       |
| Tổng thời lượng    | 52 phút theo thời gian tường, từ 14:13 đến 15:05 (UTC+7)       |
| Pull request       | [#37](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/37) |
| Người review       | Reviewer agent độc lập                                         |
| Kết quả review     | `APPROVED` nội bộ; không phải GitHub `APPROVED`                |

## Báo cáo công việc đã làm

- Đã hardening Notification consumer bằng một reconnect loop duy nhất, startup không chờ broker và shutdown đánh thức/dừng reconnect delay.
- Đã phân loại delivery: message hợp lệ chỉ ack sau xử lý; invalid JSON/schema/header bị reject không requeue; lỗi xử lý tạm thời requeue; connection mất trước ack để RabbitMQ redeliver.
- Đã thay dedup `Set` không giới hạn bằng cache in-memory TTL 24 giờ, tối đa 10.000 event ID và eviction entry cũ nhất.
- Đã chuẩn hóa telemetry outcome `accepted`, `duplicate`, `rejected`, `unavailable` bằng label hữu hạn; giữ W3C correlation trên span, không đưa event ID/principal/credential vào metric label.
- Đã bổ sung cấu hình Compose, README giới hạn MVP, CI và hai entrypoint RabbitMQ; stability test chạy ba vòng thật qua TCP broker proxy để kiểm tra down/up, reconnect, redelivery, duplicate và backlog/drain.
- Full review tại SHA `cb5249d` phát hiện runtime DI của `ConfigService`; implementer sửa tại `ce8cc14` và thêm Nest app-level test chứng minh custom TTL/capacity được inject thật.
- Focused re-review diff `cb5249d..ce8cc14` kết luận không còn blocking finding (`APPROVED` nội bộ, không phải GitHub `APPROVED`).
- CI run [38366297418](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/38366297418) xanh toàn bộ trước finalization.
- Đã đối chiếu trực tiếp bốn hồ sơ Markdown canonical.

## Sản phẩm thực tế

| Sản phẩm                       | Loại   | Link hoặc đường dẫn                                                                                                 |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Hồ sơ input task               | Docs   | [task-input.md](../input/task-input.md)                                                                             |
| Consumer hardening             | Code   | `lms/services/notification/src/adapters/messaging/`                                                                 |
| RabbitMQ integration/stability | Test   | `lms/services/notification/test/rabbitmq-integration.mjs`, `lms/services/notification/test/messaging-stability.mjs` |
| Tài liệu semantics MVP         | Docs   | `lms/services/notification/README.md`, `docker-compose/README.md`                                                   |
| Compose/CI entrypoint          | Config | `docker-compose/compose.yaml`, `.github/workflows/ci.yml`, `lms/package.json`                                       |

## Đối chiếu Definition of Done

| Điều kiện từ input                                                           | Kết quả                   | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Publish/consume thống nhất binding/schema/trace; queue durable trước publish | Đạt                       | RabbitMQ integration và stability test thật đều pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Một reconnect loop, startup không fail, delay mặc định 1.000 ms và stop sạch | Đạt                       | Unit consumer pass; stability test startup broker unavailable và reconnect pass 3/3 vòng                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Ack/reject/redelivery đúng semantics                                         | Đạt                       | Unit test accepted/invalid/transient; stability test connection loss trước ack và redelivery pass                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Dedup TTL 24 giờ/tối đa 10.000 và giới hạn được tài liệu hóa                 | Đạt                       | Unit TTL/capacity pass; `lms/services/notification/README.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Telemetry đủ bốn outcome, giữ correlation và label an toàn                   | Đạt                       | Unit telemetry, RabbitMQ integration, stability và `test:telemetry` pass; stability kiểm tra metric không chứa principal/credential/event ID                                                                                                                                                                                                                                                                                                                                                                                   |
| Stability ba vòng duplicate/down-up/reconnect/redelivery/backlog-drain       | Đạt                       | `pnpm --dir lms run test:messaging:stability` — `3/3` vòng pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Test/gate bắt buộc pass                                                      | Đạt có ghi chú môi trường | Build PASS; lint PASS; Notification unit 16/16 PASS; `test:notification:rabbitmq` PASS; `test:messaging:stability` PASS; `test:telemetry` PASS; W5 PostgreSQL workflow 4 PASS/1 scenario slowdown skip theo cấu hình; Compose config và `git diff --check` PASS. Full `test` gặp một lần W1 504 flaky, rerun `test:w1` PASS 7/7. Local `ci:verify` dừng ở baseline Prettier trên checkout Windows; canonical CI Linux run `38366297418` sau đó xanh toàn bộ, gồm quality gates/telemetry, Compose, fresh smoke và GitGuardian. |
| PR head ghi URL và trạng thái `Chờ review`                                   | Đạt                       | PR #37; transition được commit/push trên chính PR head trước review                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Review và finalization theo vòng đời                                         | Đạt theo ngoại lệ         | Full review tại `cb5249d` yêu cầu sửa DI; focused re-review `cb5249d..ce8cc14` kết luận `APPROVED` nội bộ. GitHub không có `APPROVED`; Đức chỉ thị trực tiếp tiếp tục finalization theo ngoại lệ trước merge.                                                                                                                                                                                                                                                                                                                  |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không thêm Notification DB, Redis, DLQ hoặc retry topology.
- Việc chưa hoàn thành hoặc trở ngại: Không còn blocker kỹ thuật. GitHub không có `APPROVED`; ngoại lệ dùng nguồn xác nhận trực tiếp của Đức. PR chưa merge nên trạng thái `Hoàn thành` hiện chỉ nằm trên branch/PR.
- Bước tiếp theo: Commit/push finalization metadata, chờ check của commit này xanh rồi người phụ trách mới merge PR #37.
