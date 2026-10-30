import { JWKS_PATH } from '@aiops-lms/contracts/http/common';

import { HttpJwksKeyProvider } from './http-jwks-key-provider.js';
import { TokenVerifier } from './token-verifier.js';

/** Cấu hình xác thực của một service: tên (`aud` phải khớp) và bộ verify token. */
export interface ServiceAuthSettings {
  serviceName: string;
  verifier: TokenVerifier;
}

export const SERVICE_AUTH = Symbol('LMS_SERVICE_AUTH');

export interface HttpServiceAuthOptions {
  baseUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  minRefetchIntervalMs: number;
}

/** Service thường (không phải auth): verify token bằng JWKS tải từ auth. */
export function createHttpServiceAuth(
  serviceName: string,
  options: HttpServiceAuthOptions,
): ServiceAuthSettings {
  return {
    serviceName,
    verifier: new TokenVerifier(
      new HttpJwksKeyProvider({
        dependency: `${serviceName}-identity-jwks`,
        url: new URL(`/${JWKS_PATH}`, options.baseUrl).toString(),
        timeoutMs: options.timeoutMs,
        cacheTtlMs: options.cacheTtlMs,
        minRefetchIntervalMs: options.minRefetchIntervalMs,
      }),
    ),
  };
}
