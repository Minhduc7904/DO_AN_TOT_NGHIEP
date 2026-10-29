import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  backgroundJobDtoSchema,
  backgroundJobRunDtoSchema,
  mediaDtoSchema,
  mediaSummaryDtoSchema,
} from '../../contracts/dist/index.js';
import {
  PNG_1X1,
  call,
  createPublishedCourse,
  expectData,
  expectError,
  loginAdmin,
  loginInstructor,
  unique,
  uploadMedia,
  waitUntil,
} from './support/api.mjs';

test('media-cleanup-scheduler: scheduler gọi media dọn media không dùng, giữ media đang dùng, chạy lặp không trùng', async (t) => {
  const admin = await loginAdmin();
  const instructor = await loginInstructor();
  let unused;
  let used;
  let job;

  await t.test('chuẩn bị: một media không ai dùng và một media gắn làm ảnh khóa học', async () => {
    const { courseId } = await createPublishedCourse(instructor.token);
    unused = (await uploadMedia(instructor.token, PNG_1X1, 'khong-dung.png', 'image/png')).mediaId;
    used = (await uploadMedia(instructor.token, PNG_1X1, 'dang-dung.png', 'image/png')).mediaId;
    const usage = await call('POST', '/api/v1/media/usages', {
      token: instructor.token,
      body: {
        media_id: used,
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_THUMBNAIL',
      },
    });
    assert.equal(usage.status, 201, JSON.stringify(usage.body));
    // Thumbnail chạy xong rồi mới dọn để kết quả không phụ thuộc thứ tự worker.
    for (const mediaId of [unused, used]) {
      await waitUntil(`thumbnail của ${mediaId}`, async () => {
        const library = await call('GET', '/api/v1/media/library?page_size=100', {
          token: instructor.token,
        });
        return library.body.data.find((item) => item.id === mediaId)?.thumbnail_status === 'READY';
      });
    }
  });

  await t.test(
    'admin tạo job MEDIA_UNUSED_CLEANUP; student và instructor không được (403)',
    async () => {
      expectError(
        await call('POST', '/api/v1/scheduler/jobs', {
          token: instructor.token,
          body: { name: unique('job'), type: 'MEDIA_UNUSED_CLEANUP', schedule_type: 'MANUAL' },
        }),
        403,
      );
      const created = await call('POST', '/api/v1/scheduler/jobs', {
        token: admin.token,
        body: {
          name: unique('Dọn media'),
          type: 'MEDIA_UNUSED_CLEANUP',
          schedule_type: 'MANUAL',
          payload: { retention_hours: 0 },
        },
      });
      job = expectData(created, 201, backgroundJobDtoSchema, 'tạo job');
      assert.equal(job.status, 'ACTIVE');
    },
  );

  const key = unique('chay');
  let run;
  await t.test(
    'chạy job: scheduler-worker gọi media, run SUCCEEDED với tóm tắt an toàn',
    async () => {
      const triggered = await call('POST', `/api/v1/scheduler/jobs/${job.id}/runs`, {
        token: admin.token,
        body: { idempotency_key: key },
      });
      run = expectData(triggered, 201, backgroundJobRunDtoSchema, 'kích hoạt run');
      const finished = await waitUntil('run kết thúc', async () => {
        const current = expectData(
          await call('GET', `/api/v1/scheduler/jobs/${job.id}/runs`, { token: admin.token }),
          200,
        ).find((item) => item.id === run.id);
        return current && ['SUCCEEDED', 'FAILED'].includes(current.status) ? current : null;
      });
      assert.equal(
        finished.status,
        'SUCCEEDED',
        `${finished.error_code} ${finished.error_message}`,
      );
      assert.ok(finished.output.unused_deleted >= 1, JSON.stringify(finished.output));
      assert.equal(finished.output.failed, 0);
      const serialized = JSON.stringify(finished.output);
      assert.equal(
        /token|secret|object_key|bucket/iu.test(serialized),
        false,
        'tóm tắt không lộ credential hay object key',
      );
    },
  );

  await t.test('media không dùng bị xóa khỏi MinIO, media đang dùng còn nguyên', async () => {
    assert.equal((await call('GET', `/api/v1/media/${unused}/content`, { raw: true })).status, 404);
    const kept = await call('GET', `/api/v1/media/${used}/content`, { raw: true });
    assert.equal(kept.status, 200);
    assert.deepEqual(kept.bytes, PNG_1X1);
    const library = await call('GET', '/api/v1/media/library?page_size=100', {
      token: instructor.token,
    });
    const ids = library.body.data.map((item) => item.id);
    assert.equal(ids.includes(unused), false);
    assert.equal(
      mediaDtoSchema.parse(library.body.data.find((item) => item.id === used)).status,
      'READY',
    );
    expectData(
      await call('GET', '/api/v1/media/summary', { token: admin.token }),
      200,
      mediaSummaryDtoSchema,
    );
  });

  await t.test(
    'kích hoạt lại cùng idempotency_key trả đúng run cũ, chỉ có một run trong lịch sử',
    async () => {
      const again = await call('POST', `/api/v1/scheduler/jobs/${job.id}/runs`, {
        token: admin.token,
        body: { idempotency_key: key },
      });
      assert.equal(again.status, 200, 'cùng khóa phải trả run cũ (200), không tạo mới (201)');
      assert.equal(expectData(again, 200, backgroundJobRunDtoSchema).id, run.id);
      const runs = expectData(
        await call('GET', `/api/v1/scheduler/jobs/${job.id}/runs`, { token: admin.token }),
        200,
      );
      assert.equal(runs.length, 1);
    },
  );

  await t.test('job PAUSED không nhận run mới (409 SCHEDULER_JOB_NOT_ACTIVE)', async () => {
    const paused = await call('PATCH', `/api/v1/scheduler/jobs/${job.id}`, {
      token: admin.token,
      body: { status: 'PAUSED' },
    });
    assert.equal(paused.status, 200, JSON.stringify(paused.body));
    expectError(
      await call('POST', `/api/v1/scheduler/jobs/${job.id}/runs`, {
        token: admin.token,
        body: { idempotency_key: unique('khoa-moi') },
      }),
      409,
      'SCHEDULER_JOB_NOT_ACTIVE',
    );
  });
});
