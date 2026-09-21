import { CourseService } from '../../src/application/course.service.js';
import type { CourseCache } from '../../src/application/ports/course-cache.js';
import type { CourseRepository } from '../../src/application/ports/course-repository.js';
import type { Course } from '../../src/domain/course.js';

describe('Course cache-aside policy', () => {
  const seed: Course = { id: 'course-001', title: 'Seed', created_at: '2026-08-27T10:00:00Z' };
  let stored: Course[];
  let itemCache: Map<string, Course>;
  let listCache: Map<string, Course[]>;
  let version: number;
  let readCount: number;
  let cacheBroken: boolean;
  let service: CourseService;

  beforeEach(() => {
    stored = [seed];
    itemCache = new Map();
    listCache = new Map();
    version = 0;
    readCount = 0;
    cacheBroken = false;
    const repository: CourseRepository = {
      create: async (title) => {
        const course = { id: 'course-002', title, created_at: '2026-08-27T11:00:00Z' };
        stored.push(course);
        return course;
      },
      findById: async (id) => {
        readCount++;
        return stored.find((course) => course.id === id) ?? null;
      },
      list: async (limit) => {
        readCount++;
        return stored.slice(0, limit);
      },
    };
    const assertCache = (): void => {
      if (cacheBroken) throw new Error('redis unavailable or timeout');
    };
    const cache: CourseCache = {
      getItem: async (id) => {
        assertCache();
        return itemCache.get(id) ?? null;
      },
      setItem: async (course) => {
        assertCache();
        itemCache.set(course.id, course);
      },
      getList: async (limit) => {
        assertCache();
        return { items: listCache.get(`${version}:${limit}`) ?? null, version: String(version) };
      },
      setList: async (limit, items, expectedVersion) => {
        assertCache();
        if (String(version) === expectedVersion) listCache.set(`${version}:${limit}`, items);
      },
      invalidateLists: async () => {
        assertCache();
        version++;
      },
    };
    service = new CourseService(repository, cache);
  });

  it('reads PostgreSQL once then serves item and list hits from cache', async () => {
    expect(await service.findById(seed.id)).toEqual(seed);
    expect(await service.findById(seed.id)).toEqual(seed);
    expect(await service.list(20)).toEqual({ items: [seed] });
    expect(await service.list(20)).toEqual({ items: [seed] });
    expect(readCount).toBe(2);
  });

  it('invalidates list variants after create and keeps PostgreSQL as source of truth', async () => {
    await service.list(1);
    await service.list(20);
    await service.create('New');
    expect(await service.list(20)).toMatchObject({ items: [seed, { id: 'course-002' }] });
    expect(await service.findById('course-002')).toMatchObject({ title: 'New' });
  });

  it('falls back to PostgreSQL when Redis is unavailable or times out', async () => {
    cacheBroken = true;
    expect(await service.findById(seed.id)).toEqual(seed);
    expect(await service.list(20)).toEqual({ items: [seed] });
    await expect(service.create('New')).resolves.toMatchObject({ title: 'New' });
    expect(readCount).toBe(2);
  });
});
