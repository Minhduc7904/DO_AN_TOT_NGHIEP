import {
  INTERNAL_PREFIX,
  serviceTokenResponseSchema,
  type ServiceTokenRequest,
} from '@aiops-lms/contracts/http';

import { HttpQueryClient, type HttpQueryClientOptions } from '../clients/http-query-client.js';
import { AppError } from '../errors/index.js';
import type { ServiceTokenGrant, ServiceTokenSource } from './service-token.provider.js';

export interface HttpServiceTokenSourceOptions {
  /** Định danh dependency canonical, ví dụ `course-identity-token`. */
  dependency: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
  breaker: HttpQueryClientOptions['breaker'];
}

/** Lấy service token từ `POST /internal/v1/auth/service-token` (client-credentials). */
export class HttpServiceTokenSource implements ServiceTokenSource {
  private readonly client: HttpQueryClient;

  constructor(private readonly options: HttpServiceTokenSourceOptions) {
    this.client = new HttpQueryClient({
      dependency: options.dependency,
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      breaker: options.breaker,
    });
  }

  async fetch(audience: string): Promise<ServiceTokenGrant> {
    const body: ServiceTokenRequest = {
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      audience,
    };
    const response = await this.client.request<{ data?: unknown }>({
      method: 'POST',
      path: `/${INTERNAL_PREFIX}/auth/service-token`,
      body,
    });
    // 4xx từ auth là cấu hình sai (client/secret/audience): báo lỗi rõ thay vì coi là auth chết.
    if (response.status === 401 || response.status === 403) throw AppError.serviceClientInvalid();
    const parsed = serviceTokenResponseSchema.safeParse(response.body?.data);
    if (response.status !== 200 || !parsed.success) {
      throw AppError.dependencyUnavailable(this.options.dependency);
    }
    return { accessToken: parsed.data.access_token, expiresInSeconds: parsed.data.expires_in };
  }
}
