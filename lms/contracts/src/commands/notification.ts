import { z } from 'zod';

const id = z.uuid();

/** Đích của command: service.name của worker và queue canonical `<worker>--<command-kebab>-v<n>`. */
export const NOTIFICATION_WORKER = 'notification-worker';

/** Tên command và queue của `notification-worker` (nguồn duy nhất cho producer và consumer). */
export const NOTIFICATION_COMMANDS = {
  batchSnapshot: {
    name: 'notification.batch.snapshot',
    version: 1,
    queue: 'notification-worker--snapshot-notification-batch-v1',
  },
  batchDispatch: {
    name: 'notification.batch.dispatch',
    version: 1,
    queue: 'notification-worker--dispatch-notification-batch-v1',
  },
  singleDispatch: {
    name: 'notification.single.dispatch',
    version: 1,
    queue: 'notification-worker--dispatch-single-notification-v1',
  },
} as const;

/** `notification` → `notification-worker`: chụp recipient của batch theo trang, chèn item idempotent. */
export const batchSnapshotPayloadSchema = z.object({ batch_id: id });
export type BatchSnapshotPayload = z.infer<typeof batchSnapshotPayloadSchema>;

/** Nhận một lô item bằng lease, gửi email; worker tự enqueue lại tới khi hết item. */
export const batchDispatchPayloadSchema = z.object({ batch_id: id });
export type BatchDispatchPayload = z.infer<typeof batchDispatchPayloadSchema>;

/** `notification` → `notification-worker`: gửi email cho một thông báo đơn đã nằm trong inbox. */
export const singleDispatchPayloadSchema = z.object({ notification_id: id });
export type SingleDispatchPayload = z.infer<typeof singleDispatchPayloadSchema>;

/** Fixture ổn định cho contract test của từng command. */
export const notificationCommandFixtures = {
  batchSnapshot: { batch_id: '4b8f2d1c-6a3e-4f70-9c15-7d2e8a1b3c40' },
  batchDispatch: { batch_id: '4b8f2d1c-6a3e-4f70-9c15-7d2e8a1b3c40' },
  singleDispatch: { notification_id: '5c9a3e2d-7b4f-4081-8d26-8e3f9b2c4d51' },
} as const;
