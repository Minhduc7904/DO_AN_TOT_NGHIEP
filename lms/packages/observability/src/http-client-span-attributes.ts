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
};

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
