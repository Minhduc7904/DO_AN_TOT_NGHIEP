import type { IdGenerator, Principal } from '@aiops-lms/common/ports';

import type { StudentClient } from '../../src/application/ports/student-client.js';
import { GetMediaUsageUrlsUseCase } from '../../src/application/use-cases/usages/get-media-usage-urls.use-case.js';
import { ListOwnerUsagesUseCase } from '../../src/application/use-cases/usages/list-owner-usages.use-case.js';
import { ReorderMediaUsagesUseCase } from '../../src/application/use-cases/usages/reorder-media-usages.use-case.js';
import { DeleteMediaUsageUseCase } from '../../src/application/use-cases/usages/delete-media-usage.use-case.js';
import { UsageRules } from '../../src/application/use-cases/usages/usage-attacher.js';
import { DeleteUsagesByIdsUseCase } from '../../src/application/use-cases/worker/delete-usages-by-ids.use-case.js';
import {
  CompleteNotificationUsageJobUseCase,
  RegisterNotificationUsageUseCase,
  StartNotificationUsageJobUseCase,
} from '../../src/application/use-cases/worker/notification-usage.use-cases.js';
import {
  type SynchronizeMarkdownUsageInput,
  SynchronizeMarkdownUsageUseCase,
} from '../../src/application/use-cases/worker/synchronize-markdown-usage.use-case.js';
import type { MediaObject, MediaUsage } from '../../src/domain/media.js';
import { InMemoryUnitOfWork } from './fakes.js';

let counter = 0;
const ids: IdGenerator = {
  next: () => `aaaaaaaa-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
};

const instructor: Principal = { id: '11111111-1111-4111-8111-111111111111', role: 'instructor' };
const otherInstructor: Principal = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'instructor',
};
const student: Principal = { id: '33333333-3333-4333-8333-333333333333', role: 'student' };
const admin: Principal = { id: '44444444-4444-4444-8444-444444444444', role: 'admin' };
const courseId = '55555555-5555-4555-8555-555555555555';

async function seedMedia(
  uow: InMemoryUnitOfWork,
  overrides: Partial<MediaObject> & { id: string },
): Promise<MediaObject> {
  return uow.media.create({
    type: 'IMAGE',
    status: 'READY',
    thumbnailStatus: 'READY',
    originalName: 'a.png',
    mimeType: 'image/png',
    sizeBytes: 1,
    checksumSha256: 'a'.repeat(64),
    bucket: 'images',
    objectKey: `k/${overrides.id}`,
    uploadedBy: instructor.id,
    ...overrides,
  });
}

const uuid = (n: number): string => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`;

function setup(studentStatus: string | null = 'ACTIVE'): {
  uow: InMemoryUnitOfWork;
  rules: UsageRules;
} {
  const students: StudentClient = { findStatus: () => Promise.resolve(studentStatus) };
  return { uow: new InMemoryUnitOfWork(), rules: new UsageRules(students, ids) };
}

describe('UsageRules.attach', () => {
  it('thumbnail course chỉ nhận ảnh gốc READY và thay bản cũ', async () => {
    const { uow, rules } = setup();
    await seedMedia(uow, { id: uuid(1) });
    await seedMedia(uow, { id: uuid(2) });
    await seedMedia(uow, { id: uuid(3), type: 'DOCUMENT', mimeType: 'text/plain' });
    await seedMedia(uow, { id: uuid(4), sourceMediaId: uuid(1) });
    await seedMedia(uow, { id: uuid(5), status: 'PENDING' });
    const base = { ownerKind: 'COURSE', ownerId: courseId, usageType: 'COURSE_THUMBNAIL' } as const;

    const first = await rules.attach(uow.stores, instructor, { ...base, mediaId: uuid(1) });
    const second = await rules.attach(uow.stores, instructor, { ...base, mediaId: uuid(2) });

    const group = await uow.usages.listByGroup(base);
    expect(group.map((usage) => usage.id)).toEqual([second.id]);
    expect(first.id).not.toBe(second.id);
    await expect(
      rules.attach(uow.stores, instructor, { ...base, mediaId: uuid(3) }),
    ).rejects.toMatchObject({ code: 'MEDIA_USAGE_CONFLICT' });
    await expect(
      rules.attach(uow.stores, instructor, { ...base, mediaId: uuid(4) }),
    ).rejects.toMatchObject({ code: 'MEDIA_USAGE_CONFLICT' });
    await expect(
      rules.attach(uow.stores, instructor, { ...base, mediaId: uuid(5) }),
    ).rejects.toMatchObject({ code: 'MEDIA_NOT_READY' });
  });

  it('phân quyền theo owner_kind và chủ sở hữu media', async () => {
    const { uow, rules } = setup();
    await seedMedia(uow, { id: uuid(1) });
    const gallery = {
      mediaId: uuid(1),
      ownerKind: 'COURSE',
      ownerId: courseId,
      usageType: 'COURSE_GALLERY',
    } as const;

    await expect(rules.attach(uow.stores, student, gallery)).rejects.toMatchObject({ status: 403 });
    await expect(rules.attach(uow.stores, otherInstructor, gallery)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      rules.attach(uow.stores, instructor, {
        ...gallery,
        ownerKind: 'NOTIFICATION',
        usageType: 'NOTIFICATION_BODY',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      rules.attach(uow.stores, admin, {
        ...gallery,
        ownerKind: 'MEDIA',
        usageType: 'MEDIA_THUMBNAIL',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(rules.attach(uow.stores, admin, gallery)).resolves.toMatchObject({ position: 0 });
  });

  it('usage_type phải khớp owner_kind', async () => {
    const { uow, rules } = setup();
    await seedMedia(uow, { id: uuid(1) });
    await expect(
      rules.attach(uow.stores, instructor, {
        mediaId: uuid(1),
        ownerKind: 'COURSE',
        ownerId: courseId,
        usageType: 'USER_AVATAR',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('avatar: student đúng chủ, hồ sơ phải tồn tại và ACTIVE', async () => {
    const avatar = {
      mediaId: uuid(1),
      ownerKind: 'USER',
      ownerId: student.id,
      usageType: 'USER_AVATAR',
    } as const;
    for (const [status, expected] of [
      ['ACTIVE', undefined],
      [null, 404],
      ['INACTIVE', 403],
    ] as const) {
      const { uow, rules } = setup(status);
      await seedMedia(uow, { id: uuid(1), uploadedBy: student.id });
      const attempt = rules.attach(uow.stores, student, avatar);
      if (expected === undefined) await expect(attempt).resolves.toBeDefined();
      else await expect(attempt).rejects.toMatchObject({ status: expected });
    }
    const { uow, rules } = setup();
    await seedMedia(uow, { id: uuid(1), uploadedBy: student.id });
    await expect(
      rules.attach(uow.stores, student, { ...avatar, ownerId: courseId }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('avatar: instructor và admin tự đặt avatar của mình, không cần tra hồ sơ student', async () => {
    for (const principal of [instructor, admin]) {
      const { uow, rules } = setup(null); // `identity` không có hồ sơ student nào: không được gọi tới
      await seedMedia(uow, { id: uuid(1), uploadedBy: principal.id });
      await expect(
        rules.attach(uow.stores, principal, {
          mediaId: uuid(1),
          ownerKind: 'USER',
          ownerId: principal.id,
          usageType: 'USER_AVATAR',
        }),
      ).resolves.toMatchObject({ ownerKind: 'USER', ownerId: principal.id });
    }
  });

  it('avatar: không ai đặt hộ người khác (kể cả admin), admin vẫn gỡ được', async () => {
    const { uow, rules } = setup();
    await seedMedia(uow, { id: uuid(1), uploadedBy: student.id });
    const own = await rules.attach(uow.stores, student, {
      mediaId: uuid(1),
      ownerKind: 'USER',
      ownerId: student.id,
      usageType: 'USER_AVATAR',
    });
    await seedMedia(uow, { id: uuid(2), uploadedBy: admin.id });
    for (const principal of [admin, instructor]) {
      await expect(
        rules.attach(uow.stores, principal, {
          mediaId: uuid(2),
          ownerKind: 'USER',
          ownerId: student.id,
          usageType: 'USER_AVATAR',
        }),
      ).rejects.toMatchObject({ status: 403 });
    }
    const remove = new DeleteMediaUsageUseCase(uow, rules);
    await expect(remove.execute(instructor, own.id)).rejects.toMatchObject({ status: 403 });
    await remove.execute(admin, own.id);
    expect(await uow.usages.findById(own.id)).toBeNull();
  });
});

describe('reorder / delete usage', () => {
  async function gallery(): Promise<{
    uow: InMemoryUnitOfWork;
    rules: UsageRules;
    ids: string[];
  }> {
    const { uow, rules } = setup();
    const created: string[] = [];
    for (const n of [1, 2, 3]) {
      await seedMedia(uow, { id: uuid(n) });
      const usage = await rules.attach(uow.stores, instructor, {
        mediaId: uuid(n),
        ownerKind: 'COURSE',
        ownerId: courseId,
        usageType: 'COURSE_GALLERY',
      });
      created.push(usage.id);
    }
    return { uow, rules, ids: created };
  }
  const group = { ownerKind: 'COURSE', ownerId: courseId, usageType: 'COURSE_GALLERY' } as const;

  it('sắp xếp lại theo danh sách đầy đủ; thiếu, thừa hoặc trùng id bị từ chối', async () => {
    const { uow, rules, ids: usageIds } = await gallery();
    const reorder = new ReorderMediaUsagesUseCase(uow, rules);
    const [a, b, c] = usageIds as [string, string, string];

    const result = await reorder.execute(instructor, { ...group, usageIds: [c, a, b] });
    expect(result.map((usage) => usage.id)).toEqual([c, a, b]);
    await expect(reorder.execute(instructor, { ...group, usageIds: [a, b] })).rejects.toMatchObject(
      { status: 400 },
    );
    await expect(
      reorder.execute(instructor, { ...group, usageIds: [a, a, b] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      reorder.execute(otherInstructor, { ...group, usageIds: [a, b, c] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('chỉ người tạo usage hoặc admin được xóa', async () => {
    const { uow, rules, ids: usageIds } = await gallery();
    const remove = new DeleteMediaUsageUseCase(uow, rules);
    const [a, b] = usageIds as [string, string];

    await expect(remove.execute(otherInstructor, a)).rejects.toMatchObject({ status: 403 });
    await remove.execute(instructor, a);
    await remove.execute(admin, b);
    expect(uow.usages.rows.size).toBe(1);
    await expect(remove.execute(instructor, a)).rejects.toMatchObject({ status: 404 });
  });
});

describe('GetMediaUsageUrlsUseCase', () => {
  it('trả URL công khai, thumbnail chỉ khi READY, bỏ qua media chưa sẵn sàng', async () => {
    const { uow, rules } = setup();
    await seedMedia(uow, { id: uuid(1), thumbnailStatus: 'READY' });
    await seedMedia(uow, { id: uuid(2), thumbnailStatus: 'PENDING' });
    const urls = new GetMediaUsageUrlsUseCase(uow);
    const usages = [];
    for (const n of [1, 2]) {
      usages.push(
        await rules.attach(uow.stores, instructor, {
          mediaId: uuid(n),
          ownerKind: 'COURSE',
          ownerId: courseId,
          usageType: 'COURSE_GALLERY',
        }),
      );
    }

    const result = await urls.execute(usages.map((usage) => usage.id));
    expect(result).toEqual([
      {
        usageId: usages[0]!.id,
        mediaId: uuid(1),
        url: `/api/v1/media/${uuid(1)}/content`,
        thumbnailUrl: `/api/v1/media/${uuid(1)}/thumbnail`,
      },
      {
        usageId: usages[1]!.id,
        mediaId: uuid(2),
        url: `/api/v1/media/${uuid(2)}/content`,
        thumbnailUrl: null,
      },
    ]);
    await uow.media.update(uuid(2), { status: 'FAILED' });
    expect(await urls.execute([usages[1]!.id])).toEqual([]);
    await expect(urls.executeOne(usages[1]!.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('ListOwnerUsagesUseCase', () => {
  it('liệt kê usage của owner theo position kèm metadata, chỉ đúng usage_type và owner', async () => {
    const { uow, rules } = setup();
    await seedMedia(uow, {
      id: uuid(1),
      type: 'DOCUMENT',
      originalName: 'bai-1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
    });
    await seedMedia(uow, { id: uuid(2), type: 'DOCUMENT', originalName: 'bai-2.docx' });
    await seedMedia(uow, { id: uuid(3), type: 'DOCUMENT' });
    const lessonId = uuid(90);
    const attach = (
      mediaId: string,
      ownerId: string,
      usageType: 'LESSON_ATTACHMENT' | 'LESSON_CONTENT',
    ): Promise<MediaUsage> =>
      rules.attach(uow.stores, instructor, { mediaId, ownerKind: 'COURSE', ownerId, usageType });
    const first = await attach(uuid(1), lessonId, 'LESSON_ATTACHMENT');
    await attach(uuid(2), lessonId, 'LESSON_ATTACHMENT');
    await attach(uuid(3), lessonId, 'LESSON_CONTENT');
    await attach(uuid(3), uuid(91), 'LESSON_ATTACHMENT');
    const list = new ListOwnerUsagesUseCase(uow);

    const result = await list.execute('COURSE', lessonId, 'LESSON_ATTACHMENT');

    expect(result.map((item) => [item.usage.mediaId, item.usage.position])).toEqual([
      [uuid(1), 0],
      [uuid(2), 1],
    ]);
    expect(result[0]).toMatchObject({
      usage: { id: first.id },
      media: { originalName: 'bai-1.pdf', mimeType: 'application/pdf', sizeBytes: 1234 },
    });
    expect(await list.execute('COURSE', uuid(92), 'LESSON_ATTACHMENT')).toEqual([]);
  });
});

describe('worker: markdown usage sync', () => {
  const md = (...mediaIds: string[]): string =>
    mediaIds.map((id) => `![](/api/v1/media/${id}/content)`).join('\n');
  const input = (markdown: string | null): SynchronizeMarkdownUsageInput => ({
    ownerKind: 'COURSE' as const,
    ownerId: courseId,
    usageType: 'COURSE_DESCRIPTION' as const,
    markdown,
    actorId: instructor.id,
  });

  it('thêm usage còn thiếu, xóa usage không còn tham chiếu, đếm media không hợp lệ là lỗi', async () => {
    const { uow } = setup();
    await seedMedia(uow, { id: uuid(1) });
    await seedMedia(uow, { id: uuid(2) });
    await seedMedia(uow, { id: uuid(3), status: 'PENDING' });
    const sync = new SynchronizeMarkdownUsageUseCase(uow, ids);
    const group = {
      ownerKind: 'COURSE',
      ownerId: courseId,
      usageType: 'COURSE_DESCRIPTION',
    } as const;

    await sync.execute('m1', 'q', input(md(uuid(1), uuid(2), uuid(3), uuid(9))));
    expect((await uow.usages.listByGroup(group)).map((usage) => usage.mediaId)).toEqual([
      uuid(1),
      uuid(2),
    ]);
    const job = (await uow.jobs.findByKey('markdown-sync:m1'))!;
    expect(job).toMatchObject({ status: 'PARTIAL_FAILED', processedCount: 2, failedCount: 2 });

    await sync.execute('m2', 'q', input(md(uuid(2))));
    expect((await uow.usages.listByGroup(group)).map((usage) => usage.mediaId)).toEqual([uuid(2)]);
    expect(await uow.jobs.findByKey('markdown-sync:m2')).toMatchObject({ status: 'COMPLETED' });

    await sync.execute('m3', 'q', input(null));
    expect(await uow.usages.listByGroup(group)).toEqual([]);
  });

  it('giao lại cùng message_id là no-op (inbox)', async () => {
    const { uow } = setup();
    await seedMedia(uow, { id: uuid(1) });
    const sync = new SynchronizeMarkdownUsageUseCase(uow, ids);
    await sync.execute('dup', 'q', input(md(uuid(1))));
    await sync.execute('dup', 'q', input(null));
    expect(uow.usages.rows.size).toBe(1);
  });

  it('usage_type không khớp owner_kind bị từ chối', async () => {
    const { uow } = setup();
    const sync = new SynchronizeMarkdownUsageUseCase(uow, ids);
    await expect(
      sync.execute('x', 'q', { ...input('x'), usageType: 'USER_AVATAR' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('worker: xóa usage và usage thông báo', () => {
  it('delete-by-ids bỏ qua id không còn tồn tại', async () => {
    const { uow, rules } = setup();
    await seedMedia(uow, { id: uuid(1) });
    const usage = await rules.attach(uow.stores, instructor, {
      mediaId: uuid(1),
      ownerKind: 'COURSE',
      ownerId: courseId,
      usageType: 'COURSE_GALLERY',
    });
    await new DeleteUsagesByIdsUseCase(uow, ids).execute('d1', 'q', [usage.id, uuid(99)]);
    expect(uow.usages.rows.size).toBe(0);
    expect(await uow.jobs.findByKey('usage-delete:d1')).toMatchObject({
      status: 'COMPLETED',
      processedCount: 1,
    });
  });

  it('job notification chốt đúng dù complete đến trước register', async () => {
    const { uow } = setup();
    await seedMedia(uow, { id: uuid(1) });
    const jobId = uuid(50);
    const complete = new CompleteNotificationUsageJobUseCase(uow);
    const start = new StartNotificationUsageJobUseCase(uow);
    const register = new RegisterNotificationUsageUseCase(uow, ids);

    await complete.execute('c', 'q', { jobId, expectedUsageCount: 3 });
    expect(uow.jobs.rows.get(jobId)).toMatchObject({ status: 'PROCESSING', expectedCount: 3 });
    await start.execute('s', 'q', { jobId, batchId: uuid(60) });
    await register.execute('r', 'q', {
      jobId,
      actorId: admin.id,
      items: [
        { notificationId: uuid(70), mediaIds: [uuid(1)] },
        { notificationId: uuid(71), mediaIds: [uuid(1), uuid(404)] },
      ],
    });

    // 2 usage đăng ký được + 1 media không tồn tại = 3 mục → chốt PARTIAL_FAILED.
    expect(uow.jobs.rows.get(jobId)).toMatchObject({
      status: 'PARTIAL_FAILED',
      processedCount: 2,
      failedCount: 1,
    });
    expect(uow.usages.rows.size).toBe(2);
  });
});
