import type { Role } from '@aiops-lms/common/ports';

export const UPSTREAMS = [
  'identity',
  'course',
  'media',
  'notification',
  'scheduler',
  'ai',
] as const;

export type UpstreamName = (typeof UPSTREAMS)[number];

export interface RouteRule {
  /** Tiền tố công khai; khớp đúng đoạn path (`/api/v1/student` không khớp `/api/v1/students`). */
  prefix: string;
  upstream: UpstreamName;
  /** Chỉ các role này được qua; bỏ trống = mọi role đã xác thực (service tự kiểm quyền chi tiết). */
  roles?: readonly Role[];
}

/** Route không cần JWT. Trình duyệt nhúng ảnh/video không gửi được token nên media content công khai. */
interface PublicRule {
  method: string;
  pattern: RegExp;
}

export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: '/api/v1/auth', upstream: 'identity' },
  { prefix: '/api/v1/students', upstream: 'identity' },
  { prefix: '/api/v1/courses', upstream: 'course' },
  { prefix: '/api/v1/student', upstream: 'course' },
  { prefix: '/api/v1/media', upstream: 'media' },
  { prefix: '/api/v1/notifications', upstream: 'notification' },
  { prefix: '/api/v1/notification-batches', upstream: 'notification', roles: ['admin'] },
  { prefix: '/api/v1/scheduler', upstream: 'scheduler', roles: ['admin'] },
  { prefix: '/api/v1/ai', upstream: 'ai', roles: ['admin'] },
];

export const PUBLIC_RULES: readonly PublicRule[] = [
  { method: 'POST', pattern: /^\/api\/v1\/auth\/register$/u },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/(student|instructor|admin)\/login$/u },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/refresh$/u },
  { method: 'GET', pattern: /^\/api\/v1\/media\/[^/]+\/(content|thumbnail)$/u },
  { method: 'GET', pattern: /^\/api\/v1\/media\/avatars\/[^/]+$/u },
  { method: 'GET', pattern: /^\/api\/v1\/media\/usages\/urls$/u },
  { method: 'GET', pattern: /^\/api\/v1\/media\/usages\/[^/]+\/url$/u },
  { method: 'GET', pattern: /^\/api\/v1\/media\/usage-jobs\/[^/]+\/status$/u },
];

export interface ResolvedRoute {
  upstream: UpstreamName;
  roles: readonly Role[] | undefined;
  isPublic: boolean;
}

/**
 * Chuẩn hóa path (gỡ `..`, `.`, `%2e%2e`) bằng chính bộ phân tích URL mà fetch sẽ dùng, để path đã
 * khớp route cũng là path được gửi đi. Trả `null` nếu không phải path hợp lệ.
 */
export function normalizeTarget(rawUrl: string): { path: string; search: string } | null {
  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) return null;
  try {
    const url = new URL(rawUrl, 'http://gateway.invalid');
    return { path: url.pathname, search: url.search };
  } catch {
    return null;
  }
}

/** Chọn route theo tiền tố dài nhất trong số upstream đang bật; `null` nếu không có route. */
export function resolveRoute(
  method: string,
  path: string,
  enabled: ReadonlySet<UpstreamName>,
): ResolvedRoute | null {
  let best: RouteRule | undefined;
  for (const rule of ROUTE_RULES) {
    if (!enabled.has(rule.upstream)) continue;
    const matches = path === rule.prefix || path.startsWith(`${rule.prefix}/`);
    if (matches && (!best || rule.prefix.length > best.prefix.length)) best = rule;
  }
  if (!best) return null;
  const isPublic = PUBLIC_RULES.some((rule) => rule.method === method && rule.pattern.test(path));
  return { upstream: best.upstream, roles: best.roles, isPublic };
}
