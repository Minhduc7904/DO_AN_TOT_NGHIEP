import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import {
  accountDtoSchema,
  mediaDtoSchema,
  mediaSummaryDtoSchema,
  mediaUsageDtoSchema,
} from '../../contracts/dist/index.js';
import {
  PNG_1X1,
  call,
  createPublishedCourse,
  expectData,
  expectError,
  expectList,
  loginAdmin,
  loginInstructor,
  registerStudent,
  uploadMedia,
  waitUntil,
} from './support/api.mjs';

async function libraryEntry(token, mediaId) {
  const library = await call('GET', '/api/v1/media/library?page_size=100', { token });
  return expectList(library, mediaDtoSchema).items.find((item) => item.id === mediaId);
}

test('media-upload: upload trực tiếp lên MinIO, thumbnail, tải nội dung và usage', async (t) => {
  const instructor = await loginInstructor();
  const admin = await loginAdmin();
  let mediaId;

  await t.test(
    'upload-intent → POST thẳng MinIO → upload-complete đưa media sang READY',
    async () => {
      const upload = await uploadMedia(instructor.token, PNG_1X1, 'anh.png', 'image/png');
      mediaId = upload.mediaId;
      const media = expectData(upload.complete, 200, mediaDtoSchema, 'upload-complete');
      assert.equal(media.status, 'READY');
      assert.equal(media.type, 'IMAGE');
      assert.equal(media.checksum_sha256, createHash('sha256').update(PNG_1X1).digest('hex'));
      assert.equal(JSON.stringify(media).includes('tmp/'), false, 'không lộ object key');
    },
  );

  await t.test('nội dung công khai qua Gateway đúng byte và hỗ trợ Range', async () => {
    const full = await call('GET', `/api/v1/media/${mediaId}/content`, { raw: true });
    assert.equal(full.status, 200);
    assert.match(full.headers.get('content-type') ?? '', /image\/png/u);
    assert.deepEqual(full.bytes, PNG_1X1);

    const range = await call('GET', `/api/v1/media/${mediaId}/content`, {
      raw: true,
      headers: { range: 'bytes=0-7' },
    });
    assert.equal(range.status, 206);
    assert.deepEqual(range.bytes, PNG_1X1.subarray(0, 8));

    const beyond = await call('GET', `/api/v1/media/${mediaId}/content`, {
      raw: true,
      headers: { range: 'bytes=999999-' },
    });
    assert.equal(beyond.status, 416);
  });

  await t.test('media-worker sinh thumbnail WebP rồi trạng thái chuyển READY', async () => {
    await waitUntil('thumbnail READY', async () => {
      const entry = await libraryEntry(instructor.token, mediaId);
      if (entry?.thumbnail_status === 'FAILED') throw new Error('thumbnail FAILED');
      return entry?.thumbnail_status === 'READY';
    });
    const thumbnail = await call('GET', `/api/v1/media/${mediaId}/thumbnail`, { raw: true });
    assert.equal(thumbnail.status, 200);
    assert.match(thumbnail.headers.get('content-type') ?? '', /image\/webp/u);
    assert.equal(thumbnail.bytes.subarray(0, 4).toString('ascii'), 'RIFF');
  });

  await t.test(
    'checksum sai bị từ chối; chưa upload thì upload-complete không đưa READY',
    async () => {
      const wrong = await uploadMedia(instructor.token, PNG_1X1, 'sai.png', 'image/png', {
        checksum: 'a'.repeat(64),
      });
      assert.ok(
        wrong.complete.status >= 400,
        `checksum sai phải lỗi, nhận ${wrong.complete.status}`,
      );

      const intent = await call('POST', '/api/v1/media/upload-intents', {
        token: instructor.token,
        body: {
          file_name: 'chua-upload.png',
          mime_type: 'image/png',
          size_bytes: PNG_1X1.length,
          checksum_sha256: createHash('sha256').update(PNG_1X1).digest('hex'),
        },
      });
      const pendingId = expectData(intent, 201).media_id;
      const complete = await call('POST', `/api/v1/media/${pendingId}/upload-complete`, {
        token: instructor.token,
      });
      expectError(complete, complete.status, 'MEDIA_UPLOAD_NOT_COMPLETED');
    },
  );

  await t.test(
    'usage: gắn làm ảnh đại diện khóa học, đọc url, xóa; markdown tự đồng bộ usage',
    async () => {
      const { courseId } = await createPublishedCourse(instructor.token);
      const usage = expectData(
        await call('POST', '/api/v1/media/usages', {
          token: instructor.token,
          body: {
            media_id: mediaId,
            owner_kind: 'COURSE',
            owner_id: courseId,
            usage_type: 'COURSE_THUMBNAIL',
          },
        }),
        201,
        mediaUsageDtoSchema,
        'tạo usage',
      );
      assert.equal(usage.media_id, mediaId);

      const urls = await call('GET', `/api/v1/media/usages/urls?usage_ids=${usage.id}`);
      assert.equal(expectData(urls, 200)[0].media_id, mediaId);

      const deleted = await call('DELETE', `/api/v1/media/usages/${usage.id}`, {
        token: instructor.token,
      });
      assert.ok([200, 204].includes(deleted.status), `xóa usage trả ${deleted.status}`);

      const summaryOf = async () =>
        expectData(
          await call('GET', '/api/v1/media/summary', { token: admin.token }),
          200,
          mediaSummaryDtoSchema,
        );
      const before = (await summaryOf()).active_usages;
      const described = await call('PATCH', `/api/v1/courses/${courseId}`, {
        token: instructor.token,
        body: { description_markdown: `![ảnh](/api/v1/media/${mediaId}/content)` },
      });
      assert.equal(described.status, 200, JSON.stringify(described.body));
      await waitUntil(
        'usage COURSE_DESCRIPTION xuất hiện',
        async () => (await summaryOf()).active_usages > before,
      );

      const removed = await call('DELETE', `/api/v1/courses/${courseId}`, {
        token: instructor.token,
      });
      assert.ok([200, 204].includes(removed.status));
      await waitUntil(
        'usage về lại sau khi xóa khóa học',
        async () => (await summaryOf()).active_usages <= before,
      );
    },
  );
});

test('avatar: mỗi role tự đặt avatar, /auth/me trả avatar_url, URL đọc được công khai qua Gateway', async (t) => {
  const student = await registerStudent('avatar');
  const instructor = await loginInstructor();
  const admin = await loginAdmin();
  const avatarUrl = (user) => `/api/v1/media/avatars/${user.id}`;

  for (const [role, user] of [
    ['student', student],
    ['instructor', instructor],
    ['admin', admin],
  ]) {
    await t.test(`${role}: chưa đặt avatar thì avatar_url có sẵn nhưng GET trả 404`, async () => {
      const me = await call('GET', '/api/v1/auth/me', { token: user.token });
      assert.equal(expectData(me, 200, accountDtoSchema).avatar_url, avatarUrl(user));
      const missing = await call('GET', avatarUrl(user), { raw: true });
      assert.equal(missing.status, 404);
    });
  }

  await t.test('đặt avatar rồi đọc đúng byte qua avatar_url, không cần token', async () => {
    for (const user of [student, instructor, admin]) {
      const { mediaId } = await uploadMedia(user.token, PNG_1X1, 'avatar.png', 'image/png');
      const attached = await call('POST', '/api/v1/media/usages', {
        token: user.token,
        body: {
          media_id: mediaId,
          owner_kind: 'USER',
          owner_id: user.id,
          usage_type: 'USER_AVATAR',
        },
      });
      expectData(attached, 201, mediaUsageDtoSchema, 'đặt avatar');
      const me = await call('GET', '/api/v1/auth/me', { token: user.token });
      const image = await call('GET', expectData(me, 200, accountDtoSchema).avatar_url, {
        raw: true,
      });
      assert.equal(image.status, 200);
      assert.match(image.headers.get('content-type') ?? '', /image\/png/u);
      assert.deepEqual(image.bytes, PNG_1X1);
    }
  });

  await t.test('không đặt hộ người khác, kể cả admin', async () => {
    const { mediaId } = await uploadMedia(admin.token, PNG_1X1, 'hoo.png', 'image/png');
    const attempt = await call('POST', '/api/v1/media/usages', {
      token: admin.token,
      body: {
        media_id: mediaId,
        owner_kind: 'USER',
        owner_id: student.id,
        usage_type: 'USER_AVATAR',
      },
    });
    expectError(attempt, 403, 'FORBIDDEN');
  });
});
