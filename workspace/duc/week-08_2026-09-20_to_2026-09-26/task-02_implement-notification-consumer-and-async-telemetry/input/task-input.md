# Input task

## Thông tin chung

| Trường               | Nội dung                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| Mã task              | `task-02_implement-notification-consumer-and-async-telemetry`              |
| Tên task             | Triển khai consumer Notification và async telemetry                        |
| Người phụ trách      | Đức                                                                        |
| Tuần thực hiện       | `week-08_2026-09-20_to_2026-09-26`                                         |
| Trạng thái           | Chờ review                                                                 |
| Ngày tạo             | 11/10/2026                                                                 |
| Thời gian dự kiến    | 11/10/2026                                                                 |
| Nhánh thực hiện      | `feat/week-08/task-02-implement-notification-consumer-and-async-telemetry` |
| Pull request dự kiến | [#34](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/34)             |

## Mục tiêu và phạm vi

### Task cần làm gì?

Đức tiếp quản task đang dở của Bách trên đúng branch task: hoàn thiện Notification consumer cho `grade.completed`, duplicate handling theo `event_id`, trace context RabbitMQ, consume/process telemetry, fault hook slowdown mặc định tắt, Compose runtime và integration test với broker thật.

Substantive commits trước khi tiếp quản là `9043ee1` và `3d574ec`; hồ sơ trong `workspace/bach/` được giữ nguyên, không dùng làm hồ sơ completion của Đức.

### Phạm vi không thực hiện

- Không sửa, di chuyển hoặc xóa `workspace/bach/`.
- Không thêm Notification database, nhà cung cấp gửi thông báo thật, exactly-once hay DLQ production-grade.
- Không triển khai full W5 E2E qua Gateway; thuộc task-03.
- Không hardening reconnect/recovery nâng cao; thuộc W9 task-02.

## Sản phẩm dự kiến

| Sản phẩm                                                           | Loại          | Vị trí hoặc link dự kiến                                  |
| ------------------------------------------------------------------ | ------------- | --------------------------------------------------------- |
| Notification consumer, duplicate handling, telemetry và fault hook | Code          | `lms/services/notification/`                              |
| RabbitMQ integration test                                          | Test          | `lms/services/notification/test/rabbitmq-integration.mjs` |
| Notification trong Compose baseline                                | Config / Docs | `docker-compose/compose.yaml`, `docker-compose/README.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: event contract/skeleton W8 task-01 và publisher W8 task-05 đã merge.
- Người cần phối hợp: Không có; review dùng agent độc lập theo ngoại lệ Đức đã xác nhận.
- Rủi ro hoặc giả định: Dedup MVP lưu trong bộ nhớ process; process restart không cam kết exactly-once.

## Definition of Done

- [ ] Consumer xử lý publisher/fixture `grade.completed`, ack sau success và không tạo logical notification thứ hai cho cùng `event_id` trong process.
- [ ] RabbitMQ headers giữ trace context; consume/process spans, log và metrics có dependency identity/operation/error semantics và không lộ secret/PII.
- [ ] Fault slowdown mặc định tắt, bật có chủ đích và integration test chứng minh processing delay/backlog tối thiểu.
- [ ] Notification chạy trong Compose cùng RabbitMQ; unit/integration test, `pnpm run ci:verify` và Compose config pass.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review.
- [ ] Finalization ghi trung thực review AI và xác nhận ngoại lệ của Đức; không giả verdict GitHub.
