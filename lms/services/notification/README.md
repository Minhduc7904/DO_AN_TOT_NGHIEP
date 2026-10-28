# `@aiops-lms/notification` và `notification-worker`

## Trách nhiệm

Sở hữu `notification_db`: thông báo đơn của admin, batch gửi cho mọi student `ACTIVE`, hộp thư (inbox) của student và email thật qua SMTP. Một image, hai entrypoint: `notification` (API, `dist/main.js`, cổng 3006, relay outbox) và `notification-worker` (consumer RabbitMQ, `dist/worker.js`, cổng 3007 chỉ cho `/health` và `/ready`).

Route và mã lỗi: [`http-and-event-contracts-v2.md` §4.5](../../../docs/processed/architecture/http-and-event-contracts-v2.md); sở hữu dữ liệu: [`data-ownership-and-fault-matrix-v2.md` §2.5](../../../docs/processed/architecture/data-ownership-and-fault-matrix-v2.md).

## Cấu trúc

```text
src/domain/                      trạng thái, trạng thái cuối của batch, backoff, trích id media từ markdown, lỗi
src/application/ports/           repository, NotificationUnitOfWork, StudentDirectory, EmailSender
src/application/use-cases/       notifications/ batches/ worker/ — mỗi use case một class
src/adapters/http/{public,shared}
src/adapters/{persistence,clients,mail,messaging}
src/{main,bootstrap,app.module}.ts               API
src/{worker,worker-bootstrap,worker.module}.ts   worker
```

## Luồng đáng chú ý

- **Thông báo đơn**: ghi inbox và command `notification.single.dispatch` (cùng transaction, qua outbox); worker lấy email hiện tại của student qua HTTP nội bộ rồi gửi. Student không còn `ACTIVE` thì `email_status=FAILED` ngay.
- **Batch**: `notification.batch.snapshot` duyệt `GET /internal/v1/students` theo trang và chèn item idempotent (email được lưu vào item); xong thì `SNAPSHOT_READY` và phát `notification.batch.dispatch`. Mỗi lượt dispatch nhận tối đa `batch_size` item bằng lease (`FOR UPDATE SKIP LOCKED`), gửi email với `NOTIFICATION_DISPATCH_CONCURRENCY` luồng, ghi inbox cho người nhận thành công, ghi kết quả và tự enqueue lượt kế tiếp trong cùng một transaction. Crash giữa chừng chỉ làm lease hết hạn và item được nhận lại (at-least-once, inbox không trùng nhờ unique `(batch_id, student_id)`).
- **Retry**: item lỗi `RETRY` với backoff nhân đôi rồi `FAILED` sau `NOTIFICATION_ITEM_MAX_ATTEMPTS`; `retry-failed` tạo batch `FAILED_RECIPIENTS` sao chép các item `FAILED`, mỗi batch nguồn chỉ có một batch retry (unique `source_batch_id`).
- **Usage media**: markdown có `/media/{uuid}/(content|thumbnail)` phát `media.notification-usage.*`; xem contract §4.5. Không bắt unique violation trong transaction PostgreSQL; dùng `createMany skipDuplicates` / `ON CONFLICT DO NOTHING`.
- **Outbox**: cả API và worker đều ghi outbox nên cả hai chạy `OutboxRelayLoop`.

## Cấu hình

Biến môi trường `NOTIFICATION_*` ở [`env.schema.ts`](src/config/env.schema.ts). SMTP: dev/CI dùng Mailpit (`NOTIFICATION_SMTP_HOST=mailpit`, cổng 1025, UI `http://localhost:8025`); đổi `NOTIFICATION_SMTP_*` cho SMTP thật.

## Chạy test

```bash
pnpm --filter @aiops-lms/notification build
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/notification/jest.config.ts   # unit
pnpm run test:notification:e2e   # cần NOTIFICATION_DATABASE_URL (đã migrate), RabbitMQ và Mailpit thật
```

E2E đọc Mailpit qua `MAILPIT_API_PORT` (mặc định 58025) và gửi qua `NOTIFICATION_SMTP_HOST`/`NOTIFICATION_SMTP_PORT` (mặc định `127.0.0.1:51025`).
