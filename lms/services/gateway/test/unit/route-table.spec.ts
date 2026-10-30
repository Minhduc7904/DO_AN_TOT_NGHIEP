import { normalizeTarget, resolveRoute, type UpstreamName } from '../../src/domain/route-table.js';

const V2: ReadonlySet<UpstreamName> = new Set([
  'identity',
  'course',
  'media',
  'notification',
  'scheduler',
  'ai',
]);

describe('resolveRoute', () => {
  it('chọn upstream theo tiền tố đúng đoạn path, student khác students', () => {
    expect(resolveRoute('GET', '/api/v1/students/me', V2)?.upstream).toBe('identity');
    expect(resolveRoute('GET', '/api/v1/student/courses', V2)?.upstream).toBe('course');
    expect(resolveRoute('GET', '/api/v1/courses', V2)?.upstream).toBe('course');
    expect(resolveRoute('GET', '/api/v1/studentsx', V2)).toBeNull();
    expect(resolveRoute('GET', '/api/v1/unknown', V2)).toBeNull();
    expect(resolveRoute('GET', '/internal/v1/students', V2)).toBeNull();
  });

  it('notification-batches, scheduler và ai chỉ cho admin; còn lại mọi role đã xác thực', () => {
    expect(resolveRoute('GET', '/api/v1/notification-batches', V2)?.roles).toEqual(['admin']);
    expect(resolveRoute('GET', '/api/v1/scheduler/jobs', V2)?.roles).toEqual(['admin']);
    expect(resolveRoute('GET', '/api/v1/ai/providers', V2)?.roles).toEqual(['admin']);
    expect(resolveRoute('GET', '/api/v1/notifications/me', V2)?.roles).toBeUndefined();
    expect(resolveRoute('GET', '/api/v1/courses', V2)?.roles).toBeUndefined();
  });

  it('route công khai theo method và path chính xác', () => {
    const isPublic = (method: string, path: string): boolean | undefined =>
      resolveRoute(method, path, V2)?.isPublic;

    expect(isPublic('POST', '/api/v1/auth/register')).toBe(true);
    expect(isPublic('POST', '/api/v1/auth/student/login')).toBe(true);
    expect(isPublic('POST', '/api/v1/auth/instructor/login')).toBe(true);
    expect(isPublic('POST', '/api/v1/auth/admin/login')).toBe(true);
    expect(isPublic('POST', '/api/v1/auth/refresh')).toBe(true);
    expect(isPublic('GET', '/api/v1/auth/student/login')).toBe(false);
    expect(isPublic('POST', '/api/v1/auth/login')).toBe(false);
    expect(isPublic('GET', '/api/v1/auth/me')).toBe(false);
    expect(isPublic('POST', '/api/v1/auth/accounts')).toBe(false);

    expect(isPublic('GET', '/api/v1/media/abc/content')).toBe(true);
    expect(isPublic('GET', '/api/v1/media/abc/thumbnail')).toBe(true);
    expect(isPublic('GET', '/api/v1/media/usages/urls')).toBe(true);
    expect(isPublic('GET', '/api/v1/media/usages/abc/url')).toBe(true);
    expect(isPublic('GET', '/api/v1/media/usage-jobs/abc/status')).toBe(true);
    expect(isPublic('POST', '/api/v1/media/abc/content')).toBe(false);
    expect(isPublic('POST', '/api/v1/media/abc/thumbnail/retry')).toBe(false);
    expect(isPublic('GET', '/api/v1/media/library')).toBe(false);
    expect(isPublic('GET', '/api/v1/media/summary')).toBe(false);
  });

  it('route v1 (enrollments, submissions, grades) đã bị gỡ vì enrollment và quiz attempt thuộc course', () => {
    for (const path of ['/api/v1/enrollments', '/api/v1/submissions/x', '/api/v1/grades']) {
      expect(resolveRoute('GET', path, V2)).toBeNull();
    }
    expect(resolveRoute('GET', '/api/v1/student/enrollments', V2)).toMatchObject({
      upstream: 'course',
    });
  });
});

describe('normalizeTarget', () => {
  it('gỡ dot-segment kể cả dạng mã hóa để path khớp route cũng là path được gửi đi', () => {
    expect(normalizeTarget('/api/v1/auth/../../../internal/v1/students')).toEqual({
      path: '/internal/v1/students',
      search: '',
    });
    expect(normalizeTarget('/api/v1/auth/%2e%2e/%2E%2e/%2e%2e/internal/v1/students?x=1')).toEqual({
      path: '/internal/v1/students',
      search: '?x=1',
    });
    expect(normalizeTarget('/api/v1/courses?page=2&page_size=5')).toEqual({
      path: '/api/v1/courses',
      search: '?page=2&page_size=5',
    });
  });

  it('từ chối URL không bắt đầu bằng một dấu gạch chéo', () => {
    expect(normalizeTarget('//evil.example/api/v1/courses')).toBeNull();
    expect(normalizeTarget('http://evil.example/api/v1/courses')).toBeNull();
    expect(normalizeTarget('api/v1/courses')).toBeNull();
  });
});
