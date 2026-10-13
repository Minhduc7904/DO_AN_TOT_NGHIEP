# Notification service

Notification là consumer MVP cho event `grade.completed` v1. Service khai báo exchange topic và queue durable, bind routing key `grade.completed`, dùng manual acknowledgement và giữ W3C trace context từ publisher Grading qua span consume/process.

## Delivery semantics

- Startup HTTP không phụ thuộc RabbitMQ đang sẵn sàng. Consumer chạy đúng một reconnect loop; delay mặc định là 1.000 ms và loop dừng khi application shutdown.
- Message hợp lệ chỉ được ack sau khi xử lý trả về `accepted` hoặc `duplicate`.
- JSON, event schema hoặc trace header không hợp lệ bị reject và không requeue.
- Lỗi xử lý tạm thời được nack/requeue. Nếu connection mất trước ack/nack, message chưa ack được RabbitMQ redeliver khi consumer kết nối lại.
- Dedup dùng cache in-memory theo `event_id`, TTL mặc định 24 giờ và tối đa 10.000 ID. Khi đầy, entry cũ nhất bị loại.

Đây là semantics **at-least-once có suppression trong vòng đời process**, không phải exactly-once. Cache không bền qua process restart; restart có thể tạo lại notification mô phỏng cho event đã từng xử lý. MVP không sở hữu database/Redis cho Notification, không có DLQ và không có retry topology production-grade.

## Cấu hình

| Biến                                     | Mặc định | Ý nghĩa                                   |
| ---------------------------------------- | -------: | ----------------------------------------- |
| `NOTIFICATION_RECONNECT_DELAY_MS`        |   `1000` | Thời gian chờ giữa hai lần kết nối broker |
| `NOTIFICATION_DEDUP_TTL_SECONDS`         |  `86400` | TTL event ID trong cache in-memory        |
| `NOTIFICATION_DEDUP_MAX_EVENT_IDS`       |  `10000` | Giới hạn event ID trong cache             |
| `NOTIFICATION_CONSUMER_PREFETCH`         |      `1` | Số message chưa ack tối đa trên consumer  |
| `NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED` |  `false` | Bật fault hook làm chậm xử lý             |
| `NOTIFICATION_CONSUMER_SLOWDOWN_MS`      |      `0` | Độ trễ fault hook                         |

Metric connection/consume/process chỉ dùng label hữu hạn gồm dependency, operation và outcome `accepted`, `duplicate`, `rejected`, `unavailable`; không dùng event ID, principal, credential hay routing key động làm label.

## Kiểm thử RabbitMQ thật

```bash
pnpm --dir lms run test:notification:rabbitmq
pnpm --dir lms run test:messaging:stability
```

Test stability chạy ba vòng và kiểm tra startup khi broker chưa tới được, reconnect sau down/up, redelivery của message mất connection trước ack, duplicate suppression, invalid rejection và slowdown tạo backlog rồi drain.
