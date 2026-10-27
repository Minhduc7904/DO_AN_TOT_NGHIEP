import type { Span } from '@opentelemetry/api';

const HTTP_DEPENDENCY_PEERS: Readonly<Record<string, string>> = {
  'gateway-auth': 'auth',
  'gateway-course': 'course',
  'gateway-enrollment': 'enrollment',
  'gateway-submission': 'submission',
  'gateway-grading': 'grading',
  'enrollment-course': 'course',
  'submission-course': 'course',
  'submission-enrollment': 'enrollment',
  'submission-storage': 'submission-storage',
  'grading-submission': 'submission',
  // Topology v2: `<service.name bên gọi>-<service.name bên nhận>`.
  'gateway-student': 'student',
  'gateway-admin': 'admin',
  'gateway-media': 'media',
  'gateway-notification': 'notification',
  'gateway-scheduler': 'scheduler',
  'gateway-ai': 'ai',
  'auth-student': 'student',
  'course-media': 'media',
  'course-ai': 'ai',
  'media-student': 'student',
  'media-admin': 'admin',
  'notification-worker-student': 'student',
  'scheduler-worker-media': 'media',
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
