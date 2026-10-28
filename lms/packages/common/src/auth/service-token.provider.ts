export interface ServiceTokenGrant {
  accessToken: string;
  expiresInSeconds: number;
}

/** Nơi lấy service token: HTTP tới auth (mọi service khác) hoặc gọi thẳng use case (chính auth). */
export interface ServiceTokenSource {
  fetch(audience: string): Promise<ServiceTokenGrant>;
}

export interface TokenProvider {
  getToken(audience: string): Promise<string>;
}

export interface ServiceTokenProviderOptions {
  /** Làm mới chủ động khi đã qua tỉ lệ này của TTL (mặc định 0.5). */
  refreshRatio?: number;
  /** Sau một lần làm mới nền thất bại, chờ khoảng này mới thử lại. */
  retryDelayMs?: number;
  now?: () => number;
}

interface CachedToken {
  token: string;
  refreshAt: number;
  expiresAt: number;
}

/**
 * Cache service token theo audience. Làm mới chủ động ở ~50% TTL, single-flight, và **làm mới
 * nền**: request thường không bao giờ chờ auth. Nếu auth lỗi, token cũ vẫn được dùng đến khi hết
 * hạn (stale-while-error); chỉ khi hết hạn hẳn mới ném lỗi của source.
 */
export class ServiceTokenProvider implements TokenProvider {
  private readonly cache = new Map<string, CachedToken>();
  private readonly inFlight = new Map<string, Promise<CachedToken>>();
  private readonly nextBackgroundAttempt = new Map<string, number>();

  constructor(
    private readonly source: ServiceTokenSource,
    private readonly options: ServiceTokenProviderOptions = {},
  ) {}

  async getToken(audience: string): Promise<string> {
    const now = this.now();
    const cached = this.cache.get(audience);
    if (cached && now < cached.expiresAt) {
      if (now >= cached.refreshAt && now >= (this.nextBackgroundAttempt.get(audience) ?? 0)) {
        this.refreshInBackground(audience);
      }
      return cached.token;
    }
    return (await this.load(audience)).token;
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private refreshInBackground(audience: string): void {
    this.load(audience).catch(() => {
      this.nextBackgroundAttempt.set(audience, this.now() + (this.options.retryDelayMs ?? 5_000));
    });
  }

  private load(audience: string): Promise<CachedToken> {
    const existing = this.inFlight.get(audience);
    if (existing) return existing;
    const request = this.source
      .fetch(audience)
      .then((grant) => {
        const issuedAt = this.now();
        const ttlMs = grant.expiresInSeconds * 1_000;
        const entry: CachedToken = {
          token: grant.accessToken,
          refreshAt: issuedAt + ttlMs * (this.options.refreshRatio ?? 0.5),
          expiresAt: issuedAt + ttlMs,
        };
        this.cache.set(audience, entry);
        this.nextBackgroundAttempt.delete(audience);
        return entry;
      })
      .finally(() => {
        this.inFlight.delete(audience);
      });
    this.inFlight.set(audience, request);
    return request;
  }
}

/** Token DI để service tiêm `TokenProvider` vào client gọi service khác. */
export const SERVICE_TOKEN_PROVIDER = Symbol('LMS_SERVICE_TOKEN_PROVIDER');
