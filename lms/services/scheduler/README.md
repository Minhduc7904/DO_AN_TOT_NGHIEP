# `@aiops-lms/scheduler` và `scheduler-worker`

## Trách nhiệm

Sở hữu `scheduler_db`: định nghĩa job nền (`background_jobs`) và lịch sử chạy (`background_job_runs`), lịch CRON và việc thực thi job. Job tích hợp sẵn duy nhất hiện nay là `MEDIA_UNUSED_CLEANUP` (dọn media không dùng). Một image, hai entrypoint: `scheduler` (API admin, `dist/main.js`, cổng 3008) và `scheduler-worker` (`dist/worker.js`, cổng 3010, chỉ `/health` và `/ready`).

Route và mã lỗi: [`http-and-event-contracts-v2.md` §4.6](../../../docs/processed/architecture/http-and-event-contracts-v2.md); job gọi cleanup của media: §4.4 và §5. Scheduler không biết MinIO và không đọc `media_db`.

## Cấu trúc

```text
src/domain/                      cron (parser + nextCronFire), job/run, mã lỗi của run, lỗi nghiệp vụ
src/application/ports/           repository, SchedulerUnitOfWork, JobHandler
src/application/use-cases/       jobs/ (create, update-status, trigger, queries) và worker/ (tick-cron, execute-next-run)
src/adapters/http/{public,shared}
src/adapters/{persistence,clients,runtime}
src/{main,bootstrap,app.module}.ts               API
src/{worker,worker-bootstrap,worker.module}.ts   worker (module chỉ có HealthController)
```

## Luồng đáng chú ý

- **Hàng đợi bằng lease, không dùng RabbitMQ**: `background_job_runs` vừa là lịch sử vừa là hàng đợi. Tạo run chỉ là một câu `INSERT`; worker nhận việc bằng `FOR UPDATE SKIP LOCKED` rồi đặt `RUNNING` kèm lease (`SCHEDULER_RUN_LEASE_MS`). Nhờ vậy không có ghi kép DB và broker, và worker chết chỉ làm lease hết hạn.
- **Lũy đẳng**: unique `(background_job_id, idempotency_key)` với `createMany skipDuplicates` / `ON CONFLICT DO NOTHING` (không bắt unique violation trong transaction). `POST /jobs/{id}/runs` trả 201 khi tạo run mới, 200 kèm run cũ khi khóa đã dùng.
- **CRON**: parser tự viết (5 trường, UTC, danh sách/khoảng/bước, tên tháng/thứ, macro; ngày-trong-tháng và ngày-trong-tuần cùng bị giới hạn thì khớp một trong hai). Worker khóa job đến hạn, tạo run với khóa `cron:<job_id>:<scheduled_at>` rồi dời `next_run_at` sang mốc kế tiếp sau bây giờ: nhiều instance không tạo run trùng, ngừng lâu chỉ chạy bù một lần.
- **Không chạy chồng**: job `allow_concurrent=false` chỉ có một run `RUNNING`; việc nhận run gồm hai câu trong một transaction (khóa dòng job rồi cập nhật run) nên các instance tuần tự hóa theo job.
- **Lease hết hạn**: run được nhận lại đến `SCHEDULER_RUN_MAX_ATTEMPTS`, sau đó `FAILED` với `RUN_LEASE_EXPIRED`; handler phải idempotent (cleanup của media thì đúng như vậy).
- **Trạng thái job**: `PAUSED` giữ run `PENDING` chờ; `DISABLED` đóng chúng bằng `FAILED`/`JOB_DISABLED`; `ACTIVE` lại tính `next_run_at` từ bây giờ.
- **Job `MEDIA_UNUSED_CLEANUP`**: `MediaCleanupHandler` gọi `POST /internal/v1/media/cleanup` bằng `HttpQueryClient` với service token (client `scheduler-worker`, audience `media`, scope `media:cleanup`), timeout `SCHEDULER_MEDIA_TIMEOUT_MS` (nhỏ hơn lease), circuit breaker, không retry HTTP. Media trả `failed > 0` thì run `FAILED`/`MEDIA_CLEANUP_INCOMPLETE` nhưng vẫn giữ `output`; không tự retry, người dùng tạo run mới.

## Cấu hình

Biến môi trường `SCHEDULER_*` ở [`env.schema.ts`](src/config/env.schema.ts): `SCHEDULER_WORKER_POLL_MS`, `SCHEDULER_WORKER_CONCURRENCY`, `SCHEDULER_CRON_TICK_MS`, `SCHEDULER_CRON_BATCH_SIZE`, `SCHEDULER_RUN_LEASE_MS`, `SCHEDULER_RUN_MAX_ATTEMPTS`, `SCHEDULER_MEDIA_BASE_URL`, `SCHEDULER_MEDIA_TIMEOUT_MS`, `SCHEDULER_MEDIA_BREAKER_*`; worker cần thêm `SERVICE_CLIENT_ID`/`SERVICE_CLIENT_SECRET` của client `scheduler-worker`. `SCHEDULER_RUN_LEASE_MS` phải lớn hơn `SCHEDULER_MEDIA_TIMEOUT_MS`.

## Chạy

```bash
export SCHEDULER_DATABASE_URL=postgresql://user:pw@localhost:5432/scheduler_db
pnpm prisma:migrate:dev --name init   # lần đầu
pnpm build && pnpm start              # API
node dist/worker.js                   # worker (cùng image)
```

Container tự chạy `prisma migrate deploy` trước khi khởi động.

## Chạy test

```bash
pnpm --filter @aiops-lms/scheduler build
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/scheduler/jest.config.ts   # unit
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/scheduler/jest-e2e.config.ts   # e2e
```

E2E cần `SCHEDULER_DATABASE_URL` đã migrate và **trỏ vào DB dành riêng** (test xóa toàn bộ `background_jobs`); media được giả bằng HTTP stub dùng chung schema zod với contract, còn luồng thật với MinIO được kiểm trong `test:media:e2e`.
