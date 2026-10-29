import type { Span } from '@opentelemetry/api';

/** Cạnh HTTP đồng bộ của topology v2: `<service.name bên gọi>-<service.name bên nhận>`. */
const HTTP_DEPENDENCY_PEERS: Readonly<Record<string, string>> = {
  'gateway-auth': 'auth',
  'gateway-student': 'student',
  'gateway-course': 'course',
  'gateway-media': 'media',
  'gateway-notification': 'notification',
  'gateway-scheduler': 'scheduler',
  'gateway-ai': 'ai',
  'auth-student': 'student',
  'course-media': 'media',
  'course-ai': 'ai',
  'media-student': 'student',
  'notification-worker-student': 'student',
  'scheduler-worker-media': 'media',
  'ai-worker-course': 'course',
  'ai-worker-media': 'media',
};

export function normalizeHttpMethod(rawMethod: string | undefined): string {
  const method = rawMethod?.toUpperCase() ?? '';
  return ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE'].includes(
    method,
  )
    ? method
    : '_OTHER';
}

/** Chỉ ghi metadata HTTP đã xác định; không nhận raw URL, header hoặc payload. */
export function setHttpClientSpanAttributes(
  span: Span | undefined,
  dependency: string,
  method: string,
  responseStatus?: number,
): void {
  span?.setAttribute('http.request.method', method);
  const peer = HTTP_DEPENDENCY_PEERS[dependency];
  if (peer) span?.setAttribute('peer.service', peer);
  if (responseStatus !== undefined) {
    span?.setAttribute('http.response.status_code', responseStatus);
  }
}
