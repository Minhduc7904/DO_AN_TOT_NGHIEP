import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

import { AppError } from '../errors/index.js';
import { type Principal, ROLES, type Role } from '../ports/index.js';

export const PRINCIPAL_ID_HEADER = 'x-principal-id';
export const PRINCIPAL_ROLE_HEADER = 'x-principal-role';

export const ROLES_KEY = 'lms:roles';
export const ANONYMOUS_KEY = 'lms:anonymous';
export const SKIP_AUTH_KEY = 'lms:skip-auth';
export const INTERNAL_API_KEY = 'lms:internal-api';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export interface RequestWithPrincipal {
  headers: Record<string, string | string[] | undefined>;
  principal?: Principal;
}

export interface InternalApiOptions {
  /** Scope service token phải có (ví dụ `student:profile:write`); thiếu thì 403. */
  scopes: readonly string[];
}

/** Route public yêu cầu một trong các role; không khai báo thì chỉ cần đã có danh tính user. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/**
 * Route public (`/api/v1`) không cần danh tính user (đăng ký, đăng nhập, refresh). Vẫn chỉ
 * Gateway mới gọi được: yêu cầu service token của gateway.
 */
export const Anonymous = (): MethodDecorator & ClassDecorator => SetMetadata(ANONYMOUS_KEY, true);

/** Route không cần token nào: health/ready và JWKS. */
export const SkipAuth = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_AUTH_KEY, true);

/** Route nội bộ (`/internal/v1`): chỉ service token có đủ scope, không có danh tính user. */
export const InternalApi = (options: InternalApiOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(INTERNAL_API_KEY, options);

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readBearerToken(headers: RequestWithPrincipal['headers']): string | undefined {
  return firstHeader(headers.authorization)?.match(/^Bearer\s+(.+)$/iu)?.[1];
}

/** Đọc danh tính do Gateway đặt; trả undefined nếu thiếu hoặc sai định dạng. */
export function readPrincipal(headers: RequestWithPrincipal['headers']): Principal | undefined {
  const id = firstHeader(headers[PRINCIPAL_ID_HEADER]);
  const role = firstHeader(headers[PRINCIPAL_ROLE_HEADER]);
  if (!id || !UUID.test(id) || !role || !(ROLES as readonly string[]).includes(role)) {
    return undefined;
  }
  return { id, role: role as Role };
}

/** Tham số controller: danh tính đã được guard xác thực. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    if (!request.principal) throw AppError.unauthorized();
    return request.principal;
  },
);
