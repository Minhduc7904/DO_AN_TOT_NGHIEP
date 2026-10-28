import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GATEWAY_PROXY_SCOPE, GATEWAY_SERVICE_NAME } from '@aiops-lms/contracts/http/common';

import { SERVICE_AUTH, type ServiceAuthSettings } from '../auth/service-auth.js';
import { AppError } from '../errors/index.js';
import type { Role } from '../ports/index.js';
import {
  ANONYMOUS_KEY,
  INTERNAL_API_KEY,
  type InternalApiOptions,
  readBearerToken,
  readPrincipal,
  type RequestWithPrincipal,
  ROLES_KEY,
  SKIP_AUTH_KEY,
} from './principal.js';

/**
 * Guard toàn cục của mọi service (trừ Gateway): **mọi** request, kể cả route public, phải mang
 * service access token (`typ=service`, `aud` = tên service). Route `@InternalApi` kiểm scope;
 * route public chỉ nhận token của gateway (scope `gateway:proxy`) và chỉ khi đó mới tin
 * `x-principal-*`. Điều kiện sở hữu resource do use case kiểm tra.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SERVICE_AUTH) private readonly auth: ServiceAuthSettings,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(SKIP_AUTH_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const token = readBearerToken(request.headers);
    if (!token) throw AppError.serviceTokenMissing();
    const verified = await this.auth.verifier.verify(token, {
      type: 'service',
      audience: this.auth.serviceName,
    });

    const internal = this.reflector.getAllAndOverride<InternalApiOptions | undefined>(
      INTERNAL_API_KEY,
      targets,
    );
    if (internal) {
      if (!internal.scopes.every((scope) => verified.scopes.includes(scope))) {
        throw AppError.serviceScopeForbidden(internal.scopes);
      }
      return true;
    }

    if (
      verified.subject !== GATEWAY_SERVICE_NAME ||
      !verified.scopes.includes(GATEWAY_PROXY_SCOPE)
    ) {
      throw AppError.serviceScopeForbidden([GATEWAY_PROXY_SCOPE]);
    }
    if (this.reflector.getAllAndOverride<boolean | undefined>(ANONYMOUS_KEY, targets)) return true;

    const principal = readPrincipal(request.headers);
    if (!principal) throw AppError.unauthorized();
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && roles.length > 0 && !roles.includes(principal.role)) throw AppError.forbidden();

    request.principal = principal;
    return true;
  }
}
