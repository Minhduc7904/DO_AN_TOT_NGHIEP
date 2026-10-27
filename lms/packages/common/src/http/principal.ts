import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppError } from '../errors/index.js';
import { type Principal, ROLES, type Role } from '../ports/index.js';

export const PRINCIPAL_ID_HEADER = 'x-principal-id';
export const PRINCIPAL_ROLE_HEADER = 'x-principal-role';

const ROLES_KEY = 'lms:roles';
const PUBLIC_KEY = 'lms:public';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

interface RequestWithPrincipal {
  headers: Record<string, string | string[] | undefined>;
  principal?: Principal;
}

/** Route yêu cầu một trong các role; không khai báo thì chỉ cần đã xác thực. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Route công khai hoặc nội bộ (`/internal/v1/*`): không cần `x-principal-*`. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_KEY, true);

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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

/**
 * Guard toàn cục: Gateway đã verify JWT và đặt `x-principal-*`; service chỉ tin hai header này
 * (mạng nội bộ). Điều kiện sở hữu resource do use case kiểm tra.
 */
@Injectable()
export class PrincipalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = readPrincipal(request.headers);
    if (!principal) throw AppError.unauthorized();

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && roles.length > 0 && !roles.includes(principal.role)) throw AppError.forbidden();

    request.principal = principal;
    return true;
  }
}

/** Tham số controller: danh tính đã được guard xác thực. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    if (!request.principal) throw AppError.unauthorized();
    return request.principal;
  },
);
