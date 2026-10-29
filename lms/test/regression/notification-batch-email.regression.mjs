import assert from 'node:assert/strict';
import { test } from 'node:test';

import { notificationBatchDtoSchema, notificationDtoSchema } from '../../contracts/dist/index.js';
import {
  call,
  expectData,
  expectError,
  expectList,
  loginAdmin,
  mailpitMessagesTo,
  registerStudent,
  unique,
  waitUntil,
} from './support/api.mjs';

test('notification-batch-email: thông báo đơn, đợt gửi hàng loạt, email thật qua Mailpit và inbox', async (t) => {
  const admin = await loginAdmin();
  const student = await registerStudent('nhan-tin');
  const other = await registerStudent('khong-nhan');
  let singleId;

  await t.test('thông báo đơn: vào inbox UNREAD, email tới Mailpit, đánh dấu đã đọc', async () => {
    const title = unique('Thông báo đơn');
    const created = await call('POST', '/api/v1/notifications', {
      token: admin.token,
      body: { student_id: student.id, title, content_markdown: 'Nội dung **quan trọng**' },
    });
    const notification = expectData(created, 201, notificationDtoSchema, 'tạo thông báo');
    assert.equal(notification.source_type, 'SINGLE');
    singleId = notification.id;

    const mail = await waitUntil('email đến Mailpit', async () =>
      (await mailpitMessagesTo(student.email)).find((message) => message.Subject?.includes(title)),
    );
    assert.ok(mail.ID);

    const inbox = await call('GET', '/api/v1/notifications/me?status=UNREAD', {
      token: student.token,
    });
    assert.ok(expectList(inbox, notificationDtoSchema).items.some((item) => item.id === singleId));
    const otherInbox = await call('GET', '/api/v1/notifications/me', { token: other.token });
    assert.equal(
      expectList(otherInbox, notificationDtoSchema).items.some((item) => item.id === singleId),
      false,
    );

    const read = await call('PATCH', `/api/v1/notifications/${singleId}/read`, {
      token: student.token,
    });
    assert.equal(expectData(read, 200, notificationDtoSchema).status, 'READ');
    const emailStatus = await waitUntil('email_status = SENT', async () => {
      const current = await call('GET', `/api/v1/notifications/${singleId}`, {
        token: admin.token,
      });
      const data = expectData(current, 200, notificationDtoSchema);
      return data.email_status === 'SENT' ? data : null;
    });
    assert.equal(emailStatus.status, 'READ');
  });

  await t.test('student không được tạo thông báo hay đợt gửi (403)', async () => {
    expectError(
      await call('POST', '/api/v1/notifications', {
        token: student.token,
        body: { student_id: student.id, title: 'x', content_markdown: 'y' },
      }),
      403,
    );
    expectError(
      await call('POST', '/api/v1/notification-batches', {
        token: student.token,
        body: { title: 'x', content_markdown: 'y' },
      }),
      403,
    );
  });

  await t.test(
    'đợt gửi tới mọi student: snapshot → dispatch → COMPLETED, email và inbox từng người',
    async () => {
      const title = unique('Đợt gửi');
      const created = await call('POST', '/api/v1/notification-batches', {
        token: admin.token,
        body: { title, content_markdown: 'Thông báo cho mọi học viên', batch_size: 50 },
      });
      const batch = expectData(created, 201, notificationBatchDtoSchema, 'tạo đợt gửi');
      assert.equal(batch.target_scope, 'ALL_STUDENTS');

      const done = await waitUntil(
        'đợt gửi kết thúc',
        async () => {
          const current = expectData(
            await call('GET', `/api/v1/notification-batches/${batch.id}`, { token: admin.token }),
            200,
            notificationBatchDtoSchema,
          );
          if (['PARTIAL_FAILED', 'FAILED'].includes(current.status)) {
            throw new Error(`đợt gửi kết thúc ${current.status}`);
          }
          return current.status === 'COMPLETED' ? current : null;
        },
        { timeoutMs: 120_000 },
      );
      assert.equal(done.status, 'COMPLETED');

      for (const recipient of [student, other]) {
        await waitUntil(`email đợt gửi tới ${recipient.email}`, async () =>
          (await mailpitMessagesTo(recipient.email)).some((message) =>
            message.Subject?.includes(title),
          ),
        );
        const inbox = await call('GET', '/api/v1/notifications/me?page_size=100', {
          token: recipient.token,
        });
        const bulk = expectList(inbox, notificationDtoSchema).items.find(
          (item) => item.batch_id === batch.id,
        );
        assert.ok(bulk, 'inbox phải có thông báo của đợt gửi');
        assert.equal(bulk.source_type, 'BULK');
      }

      const status = await call('GET', `/api/v1/notification-batches/${batch.id}/delivery-status`, {
        token: admin.token,
      });
      assert.equal(status.status, 200, JSON.stringify(status.body));
      const failed = await call('GET', `/api/v1/notification-batches/${batch.id}/failed-items`, {
        token: admin.token,
      });
      assert.equal(expectList(failed, notificationDtoSchema.partial()).pagination.total, 0);
      expectError(
        await call('POST', `/api/v1/notification-batches/${batch.id}/retry-failed`, {
          token: admin.token,
        }),
        409,
        'NOTIFICATION_BATCH_NOT_RETRYABLE',
      );
    },
  );

  await t.test('đánh dấu đã đọc tất cả', async () => {
    const response = await call('POST', '/api/v1/notifications/read-all', { token: student.token });
    assert.ok(expectData(response, 200).updated_count >= 1);
    const unread = await call('GET', '/api/v1/notifications/me?status=UNREAD', {
      token: student.token,
    });
    assert.equal(expectList(unread, notificationDtoSchema).pagination.total, 0);
  });
});
