import type { KeyObject } from 'node:crypto';

import { jwksSchema } from '@aiops-lms/contracts/http/common';

import { AppError } from '../errors/index.js';
import { observeDependency } from '../telemetry/observe-dependency.js';
import { publicKeyFromJwkX } from './jwt.js';
import type { KeyProvider } from './keys.js';

export interface HttpJwksKeyProviderOptions {
  /** Định danh dependency canonical, ví dụ `course-identity-jwks`. */
  dependency: string;
  url: string;
  timeoutMs: number;
  /** Sau thời gian này JWKS được coi là cũ và được tải lại ở lần dùng kế tiếp. */
  cacheTtlMs: number;
  /** Khoảng tối thiểu giữa hai lần tải, chặn việc `kid` lạ gây dồn request lên auth. */
  minRefetchIntervalMs: number;
  now?: () => number;
}

/**
 * Lấy khóa công khai của auth qua JWKS. Verify token luôn cục bộ; chỉ tải JWKS khi chưa có,
 * hết hạn cache hoặc gặp `kid` lạ (xoay khóa). Khi auth lỗi vẫn dùng khóa đã cache
 * (stale-while-error), nên auth chậm/chết không làm hỏng token còn hạn.
 */
export class HttpJwksKeyProvider implements KeyProvider {
  private keys = new Map<string, KeyObject>();
  private fetchedAt: number | undefined;
  private lastAttemptAt: number | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(private readonly options: HttpJwksKeyProviderOptions) {}

  async getKey(kid: string): Promise<KeyObject | undefined> {
    const known = this.keys.get(kid);
    if (known && !this.isStale()) return known;
    if (!this.canRefetch()) return known;

    try {
      await this.refresh();
    } catch (error) {
      // Stale-while-error: khóa đã biết vẫn dùng được; `kid` chưa biết thì báo lỗi dependency.
      if (known) return known;
      throw error;
    }
    return this.keys.get(kid);
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private isStale(): boolean {
    return this.fetchedAt === undefined || this.now() - this.fetchedAt >= this.options.cacheTtlMs;
  }

  private canRefetch(): boolean {
    if (this.inFlight) return true;
    return (
      this.lastAttemptAt === undefined ||
      this.now() - this.lastAttemptAt >= this.options.minRefetchIntervalMs
    );
  }

  private refresh(): Promise<void> {
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private load(): Promise<void> {
    this.lastAttemptAt = this.now();
    return observeDependency(this.options.dependency, 'GET jwks', async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await fetch(this.options.url, {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw AppError.dependencyUnavailable(this.options.dependency);
        const body = (await response.json()) as { data?: unknown };
        // JWKS trả theo chuẩn RFC 7517 nên không bọc envelope; vẫn chấp nhận envelope nếu có.
        const parsed = jwksSchema.safeParse(body.data ?? body);
        if (!parsed.success) throw AppError.dependencyUnavailable(this.options.dependency);
        this.keys = new Map(parsed.data.keys.map((jwk) => [jwk.kid, publicKeyFromJwkX(jwk.x)]));
        this.fetchedAt = this.now();
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (controller.signal.aborted) throw AppError.dependencyTimeout(this.options.dependency);
        throw AppError.dependencyUnavailable(this.options.dependency);
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
