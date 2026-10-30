import { AppError } from '@aiops-lms/common/errors';

import { CreateCourseUseCase } from '../../src/application/use-cases/courses/create-course.use-case.js';
import { DeleteCourseUseCase } from '../../src/application/use-cases/courses/delete-course.use-case.js';
import {
  EXPORT_CHUNK_SIZE,
  ExportCoursesCsvUseCase,
} from '../../src/application/use-cases/courses/export-courses-csv.use-case.js';
import { GetCourseSummaryUseCase } from '../../src/application/use-cases/courses/get-course-summary.use-case.js';
import { GetCourseUseCase } from '../../src/application/use-cases/courses/get-course.use-case.js';
import { ListCoursesUseCase } from '../../src/application/use-cases/courses/list-courses.use-case.js';
import { UpdateCourseUseCase } from '../../src/application/use-cases/courses/update-course.use-case.js';
import { createWorld, principals } from '../support/in-memory.js';
import { enroll, seedCourse } from '../support/seed.js';

async function collect(chunks: AsyncGenerator<string, void, undefined>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of chunks) out.push(chunk);
  return out;
}

describe('course use cases', () => {
  it('CreateCourse: khóa mới là DRAFT của người tạo, học viên bị chặn', async () => {
    const world = createWorld();
    const create = new CreateCourseUseCase(world.courses, world.ids);

    const course = await create.execute(principals.owner, {
      name: 'Nhập môn',
      descriptionMarkdown: null,
    });
    expect(course).toMatchObject({ status: 'DRAFT', instructorId: principals.owner.id });
    expect(() =>
      create.execute(principals.student, { name: 'x', descriptionMarkdown: null }),
    ).toThrow(AppError);
  });

  it('UpdateCourse: chủ khóa và admin sửa được, giảng viên khác bị 403, không có thì 404', async () => {
    const world = createWorld();
    const update = new UpdateCourseUseCase(world.courses);
    const course = seedCourse(world, 'DRAFT');

    expect(
      await update.execute(principals.owner, course.id, { status: 'PUBLISHED' }),
    ).toMatchObject({
      status: 'PUBLISHED',
    });
    expect(await update.execute(principals.admin, course.id, { name: 'Tên mới' })).toMatchObject({
      name: 'Tên mới',
    });
    await expect(
      update.execute(principals.otherInstructor, course.id, { name: 'x' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      update.execute(principals.student, course.id, { name: 'x' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      update.execute(principals.owner, '00000000-0000-4000-8000-0000000000ff', {}),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('DeleteCourse: chỉ người quản lý xóa được', async () => {
    const world = createWorld();
    const remove = new DeleteCourseUseCase(world.courses);
    const course = seedCourse(world);

    await expect(remove.execute(principals.otherInstructor, course.id)).rejects.toMatchObject({
      status: 403,
    });
    await remove.execute(principals.owner, course.id);
    expect(world.courses.rows.has(course.id)).toBe(false);
    await expect(remove.execute(principals.owner, course.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('ListCourses: admin thấy tất cả, giảng viên thấy khóa của mình, học viên chỉ thấy PUBLISHED', async () => {
    const world = createWorld();
    const list = new ListCoursesUseCase(world.courses);
    seedCourse(world, 'DRAFT');
    seedCourse(world, 'PUBLISHED');
    seedCourse(world, 'PUBLISHED', principals.otherInstructor.id);

    expect((await list.execute(principals.admin, {}, 1, 10)).total).toBe(3);
    expect((await list.execute(principals.owner, {}, 1, 10)).total).toBe(2);
    expect((await list.execute(principals.owner, { status: 'DRAFT' }, 1, 10)).total).toBe(1);
    // Học viên bỏ qua bộ lọc trạng thái khác PUBLISHED.
    expect((await list.execute(principals.student, { status: 'DRAFT' }, 1, 10)).total).toBe(2);
    expect((await list.execute(principals.admin, {}, 2, 2)).items).toHaveLength(1);
    expect((await list.execute(principals.admin, { search: 'KHÓA HỌC 2' }, 1, 10)).total).toBe(1);
  });

  it('GetCourse: học viên kèm trạng thái ghi danh, không thấy khóa chưa xuất bản; giảng viên khác bị 403', async () => {
    const world = createWorld();
    const get = new GetCourseUseCase(world.courses, world.enrollments);
    const published = seedCourse(world, 'PUBLISHED');
    const draft = seedCourse(world, 'DRAFT');

    expect(await get.execute(principals.student, published.id)).toMatchObject({
      enrollment: { status: 'NOT_ENROLLED', enrolledAt: null },
    });
    await enroll(world, published.id, principals.student.id);
    expect(await get.execute(principals.student, published.id)).toMatchObject({
      enrollment: { status: 'ENROLLED', enrolledAt: expect.any(Date) as Date },
    });
    // Ghi danh của học viên khác không ảnh hưởng.
    expect(await get.execute(principals.otherStudent, published.id)).toMatchObject({
      enrollment: { status: 'NOT_ENROLLED' },
    });
    await expect(get.execute(principals.student, draft.id)).rejects.toMatchObject({ status: 404 });
    // Đã ghi danh thì vẫn thấy khóa dù sau đó bị lưu trữ.
    const archived = seedCourse(world, 'ARCHIVED');
    await enroll(world, archived.id, principals.student.id);
    expect(await get.execute(principals.student, archived.id)).toMatchObject({
      course: { id: archived.id },
      enrollment: { status: 'ENROLLED' },
    });
    await expect(get.execute(principals.otherStudent, archived.id)).rejects.toMatchObject({
      status: 404,
    });
    // Admin và giảng viên không có trạng thái ghi danh.
    expect(await get.execute(principals.owner, draft.id)).toMatchObject({
      course: { id: draft.id },
      enrollment: null,
    });
    await expect(get.execute(principals.otherInstructor, draft.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      get.execute(principals.admin, '00000000-0000-4000-8000-0000000000ff'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('GetCourseSummary: đếm theo trạng thái trong phạm vi, học viên bị chặn', async () => {
    const world = createWorld();
    const summary = new GetCourseSummaryUseCase(world.courses);
    seedCourse(world, 'DRAFT');
    seedCourse(world, 'PUBLISHED');
    seedCourse(world, 'ARCHIVED', principals.otherInstructor.id);

    expect(await summary.execute(principals.admin)).toEqual({
      total: 3,
      draft: 1,
      published: 1,
      archived: 1,
    });
    expect(await summary.execute(principals.owner)).toEqual({
      total: 2,
      draft: 1,
      published: 1,
      archived: 0,
    });
    expect(() => summary.execute(principals.student)).toThrow(AppError);
  });

  it('ExportCoursesCsv: BOM + tiêu đề, escape RFC 4180, CRLF, đọc theo từng khối keyset', async () => {
    const world = createWorld();
    const exportCsv = new ExportCoursesCsvUseCase(world.courses);
    const total = EXPORT_CHUNK_SIZE + 5;
    for (let index = 0; index < total; index += 1) seedCourse(world, 'PUBLISHED');
    const tricky = seedCourse(world, 'DRAFT');
    world.courses.rows.set(tricky.id, { ...tricky, name: 'Có, dấu "phẩy"' });
    seedCourse(world, 'DRAFT', principals.otherInstructor.id);

    const chunks = await collect(exportCsv.execute(principals.owner));
    expect(chunks[0]).toBe('﻿id,name,status,createdAtUtc\r\n');
    expect(chunks).toHaveLength(3); // tiêu đề + 2 khối dữ liệu
    const rows = chunks.slice(1).join('').split('\r\n').filter(Boolean);
    expect(rows).toHaveLength(total + 1);
    expect(rows.join('\n')).toContain('"Có, dấu ""phẩy"""');
    expect(new Set(rows.map((row) => row.slice(0, 36))).size).toBe(total + 1);

    expect(
      (await collect(exportCsv.execute(principals.owner, 'DRAFT')))
        .join('')
        .split('\r\n')
        .filter(Boolean),
    ).toHaveLength(2);
    expect(await collect(exportCsv.execute(principals.admin, 'ARCHIVED'))).toEqual([
      '﻿id,name,status,createdAtUtc\r\n',
    ]);
    expect(() => exportCsv.execute(principals.student)).toThrow(AppError);
  });
});
