import { AppError } from '@aiops-lms/common/errors';
import { ROLES, type Principal, type Role } from '@aiops-lms/common/ports';

import { verifyAccessToken } from '../../domain/access-token.js';
import { normalizeTarget, resolveRoute, type UpstreamName } from '../../domain/route-table.js';
import type {
  UpstreamClient,
  UpstreamResponse,
  UpstreamRequest,
} from '../ports/upstream-client.js';

export interface ProxyInput {
  method: string;
  /** URL gốc client gửi (path + query). */
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: UpstreamRequest['body'];
  signal: AbortSignal;
}

// Header theo từng chặng (RFC 9110) và header danh tính/xác thực không được chuyển tiếp nguyên.
const DROPPED_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'authorization',
  'cookie',
  // fetch tự giải nén; ép identity để content-length/content-encoding của upstream còn đúng.
  'accept-encoding',
  'x-principal-id',
  'x-principal-role',
]);

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Gateway: xác thực JWT, kiểm role theo bảng route rồi chuyển tiếp. Xóa mọi `x-principal-*` do
 * client gửi và đặt lại từ claim JWT; không đọc hay sửa body.
 */
export class ProxyRequestUseCase {
  constructor(
    private readonly upstream: UpstreamClient,
    private readonly enabled: ReadonlySet<UpstreamName>,
    private readonly jwtSecret: string,
  ) {}

  async execute(input: ProxyInput): Promise<UpstreamResponse> {
    const method = input.method.toUpperCase();
    const target = normalizeTarget(input.url);
    const route = target ? resolveRoute(method, target.path, this.enabled) : null;
    if (!target || !route) throw AppError.notFound('Không tìm thấy route');

    const principal = route.isPublic ? undefined : this.authenticate(input.headers);
    if (principal && route.roles && !route.roles.includes(principal.role)) {
      throw AppError.forbidden();
    }

    return this.upstream.forward(route.upstream, {
      method,
      target: `${target.path}${target.search}`,
      headers: this.forwardedHeaders(input.headers, principal),
      body: method === 'GET' || method === 'HEAD' ? null : input.body,
      signal: input.signal,
    });
  }

  private authenticate(headers: ProxyInput['headers']): Principal {
    const token = firstHeader(headers.authorization)?.match(/^Bearer\s+(.+)$/iu)?.[1];
    const verified = token ? verifyAccessToken(token, this.jwtSecret) : null;
    if (!verified || !(ROLES as readonly string[]).includes(verified.role)) {
      throw AppError.unauthorized('Bearer JWT không hợp lệ hoặc đã hết hạn');
    }
    return { id: verified.id, role: verified.role as Role };
  }

  private forwardedHeaders(
    headers: ProxyInput['headers'],
    principal: Principal | undefined,
  ): Record<string, string> {
    const forwarded: Record<string, string> = { 'accept-encoding': 'identity' };
    for (const [name, value] of Object.entries(headers)) {
      const single = firstHeader(value);
      if (single !== undefined && !DROPPED_REQUEST_HEADERS.has(name)) forwarded[name] = single;
    }
    if (principal) {
      forwarded['x-principal-id'] = principal.id;
      forwarded['x-principal-role'] = principal.role;
    }
    return forwarded;
  }
}
