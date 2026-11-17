import { api, login } from '../lib/api.js';
import { config } from '../lib/config.js';
import { adminSession, runIteration, think, uniqueName } from './session.js';

const J = 'w5';

/**
 * W5 — thông báo: admin gửi thông báo đơn (kèm email) cho một học viên chọn từ danh sách tài khoản,
 * rồi chính học viên đó mở inbox, đọc và đánh dấu đã đọc. Đợt gửi hàng loạt tới mọi học viên chỉ
 * xảy ra tối đa `W5_MAX_BATCHES_PER_VU` lần mỗi VU vì mỗi đợt sinh một email cho từng học viên.
 */
export function w5Notification() {
  runIteration(J, (current) => {
    const { rng } = current;
    const admin = adminSession(J);
    const accounts = api(
      'GET',
      `/api/v1/auth/accounts?role=student&page=${rng.int(1, 20)}&page_size=20`,
      {
        journey: J,
        name: 'GET /api/v1/auth/accounts',
        token: admin.token,
      },
    ).data;
    const seeded = (accounts ?? []).filter((account) => account.email.endsWith('@seed.test'));
    if (seeded.length === 0) return;
    const recipient = rng.pick(seeded);
    think(rng);

    api('POST', '/api/v1/notifications', {
      journey: J,
      token: admin.token,
      expected: [201],
      body: {
        student_id: recipient.id,
        title: uniqueName('Thông báo k6'),
        content_markdown: 'Thông báo do workload k6 gửi',
      },
    });
    think(rng);

    current.counters.batches = current.counters.batches ?? 0;
    if (current.counters.batches < config.w5MaxBatchesPerVu && rng.chance(0.2)) {
      current.counters.batches += 1;
      const batch = api('POST', '/api/v1/notification-batches', {
        journey: J,
        token: admin.token,
        expected: [201],
        body: { title: uniqueName('Đợt gửi k6'), content_markdown: 'Đợt gửi do workload k6 tạo' },
      }).data;
      api('GET', `/api/v1/notification-batches/${batch.id}`, {
        journey: J,
        name: 'GET /api/v1/notification-batches/:batch_id',
        token: admin.token,
      });
      think(rng);
    }

    const student = login(J, 'student', recipient.email, config.seedPassword);
    const inbox = api('GET', '/api/v1/notifications/me?status=UNREAD&page_size=20', {
      journey: J,
      name: 'GET /api/v1/notifications/me',
      token: student.token,
    }).data;
    think(rng);
    if (inbox && inbox.length > 0) {
      api('PATCH', `/api/v1/notifications/${inbox[0].id}/read`, {
        journey: J,
        name: 'PATCH /api/v1/notifications/:notification_id/read',
        token: student.token,
      });
    }
    api('POST', '/api/v1/notifications/read-all', { journey: J, token: student.token });
    think(rng);
  });
}
