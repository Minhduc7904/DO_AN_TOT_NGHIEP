import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

import { CourseCache } from '../../application/ports/course-cache.js';
import { CourseDependencyError } from '../../application/course-dependency-error.js';
import type { Course } from '../../domain/course.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

@Injectable()
export class RedisCourseCache extends CourseCache implements OnModuleDestroy {
  private readonly client;
  private readonly ttl: number;
  private readonly timeout: number;

  constructor(config: ConfigService) {
    super();
    this.ttl = config.getOrThrow<number>('COURSE_CACHE_TTL_SECONDS');
    this.timeout = config.getOrThrow<number>('COURSE_CACHE_TIMEOUT_MS');
    this.client = createClient({
      url: config.getOrThrow<string>('COURSE_REDIS_URL'),
      socket: { connectTimeout: this.timeout, reconnectStrategy: false },
    });
    this.client.on('error', () => undefined);
  }

  getItem(id: string): Promise<Course | null> {
    return this.execute('get', async () => {
      const value = await this.client.get(`course:v1:item:${id}`);
      return value ? (JSON.parse(value) as Course) : null;
    });
  }

  setItem(course: Course): Promise<void> {
    return this.execute('set', async () => {
      await this.client.set(`course:v1:item:${course.id}`, JSON.stringify(course), {
        EX: this.ttl,
      });
    });
  }

  getList(limit: number): Promise<{ items: Course[] | null; version: string }> {
    return this.execute('get', async () => {
      const version = await this.currentVersion();
      const value = await this.client.get(this.listKey(limit, version));
      return { items: value ? (JSON.parse(value) as Course[]) : null, version };
    });
  }

  setList(limit: number, items: Course[], version: string): Promise<void> {
    return this.execute('set', async () => {
      await this.client.eval(
        `if (redis.call('GET', KEYS[1]) or '0') == ARGV[1] then
           return redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
         end
         return nil`,
        {
          keys: ['course:v1:list:version', this.listKey(limit, version)],
          arguments: [version, JSON.stringify(items), String(this.ttl)],
        },
      );
    });
  }

  invalidateLists(): Promise<void> {
    return this.execute('invalidate', async () => {
      await this.client.incr('course:v1:list:version');
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  private async currentVersion(): Promise<string> {
    return (await this.client.get('course:v1:list:version')) ?? '0';
  }

  private listKey(limit: number, version: string): string {
    return `course:v1:list:${version}:${limit}`;
  }

  private execute<T>(operation: 'get' | 'set' | 'invalidate', run: () => Promise<T>): Promise<T> {
    return observeDependency('course-redis', operation, async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          (async () => {
            if (!this.client.isOpen) await this.client.connect();
            return run();
          })(),
          new Promise<T>((_, reject) => {
            timer = setTimeout(
              () => reject(new CourseDependencyError('course-redis', 'timeout')),
              this.timeout,
            );
          }),
        ]);
      } catch (error) {
        if (error instanceof CourseDependencyError) throw error;
        throw new CourseDependencyError('course-redis', 'unavailable');
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
  }
}
