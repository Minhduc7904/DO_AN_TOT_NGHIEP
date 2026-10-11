import { startTelemetry } from '@aiops-lms/observability';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@aiops-lms/observability/testing';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';

import { SubmissionHttpClient } from '../../src/adapters/clients/submission-http.client.js';
import { GradingDependencyError } from '../../src/application/grading-dependency-error.js';

function createConfig(timeoutMs = 20): { getOrThrow: (key: string) => unknown } {
  const values: Record<string, unknown> = {
    GRADING_DEPENDENCY_TIMEOUT_MS: timeoutMs,
    GRADING_SUBMISSION_BASE_URL: 'http://submission.test',
  };
  return { getOrThrow: (key: string) => values[key] };
}

describe('SubmissionHttpClient', () => {
  const originalFetch = globalThis.fetch;
  const spanExporter = new InMemorySpanExporter();
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'grading-clients-test-1',
      serviceName: 'grading',
      serviceVersion: '0.1.0-test',
    },
    { spanProcessor: new SimpleSpanProcessor(spanExporter) },
  );

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    await telemetry.shutdown();
  }, 20_000);

  function respondWith(response: () => Response): void {
    globalThis.fetch = (async () => response()) as typeof fetch;
  }

  it('reads the Submission contract without Bearer JWT or principal headers and keeps W3C context', async () => {
    let captured: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Request(input, init);
      return new Response(
        JSON.stringify({
          course_id: 'course-001',
          id: 'submission/001',
          principal_id: 'student-001',
          storage_object_key: 'submissions/submission-001',
          submitted_at: '2026-08-27T10:10:00.000Z',
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      );
    }) as typeof fetch;
    const client = new SubmissionHttpClient(createConfig() as never);
    const span = trace.getTracer('test').startSpan('incoming');

    const submission = await context.with(trace.setSpan(context.active(), span), () =>
      client.getById('submission/001'),
    );
    span.end();

    expect(submission).toEqual({
      course_id: 'course-001',
      id: 'submission/001',
      principal_id: 'student-001',
    });
    expect(captured?.method).toBe('GET');
    expect(captured?.url).toBe('http://submission.test/api/v1/submissions/submission%2F001');
    expect(captured?.headers.get('authorization')).toBeNull();
    expect(captured?.headers.get('x-principal-id')).toBeNull();
    expect(captured?.headers.get('x-principal-role')).toBeNull();
    expect(captured?.headers.get('traceparent')).toContain(span.spanContext().traceId);
  });

  it('returns null when Submission responds 404', async () => {
    respondWith(() => new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 }));
    const client = new SubmissionHttpClient(createConfig() as never);

    await expect(client.getById('missing')).resolves.toBeNull();
  });

  it('maps a malformed 200 response to unavailable inside the dependency boundary', async () => {
    respondWith(
      () =>
        new Response(JSON.stringify({ id: 'submission-001' }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
    );
    const spansBefore = spanExporter.getFinishedSpans().length;
    const client = new SubmissionHttpClient(createConfig() as never);

    const error = await client.getById('submission-001').catch((caught) => caught);

    expect(error).toBeInstanceOf(GradingDependencyError);
    expect((error as GradingDependencyError).kind).toBe('unavailable');
    await telemetry.forceFlush();
    const span = spanExporter
      .getFinishedSpans()
      .slice(spansBefore)
      .findLast((candidate) => candidate.attributes.dependency_identity === 'grading-submission');
    expect(span?.attributes['error.type']).toBe('unavailable');
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('maps non-JSON 200 bodies and Submission 5xx responses to unavailable', async () => {
    const client = new SubmissionHttpClient(createConfig() as never);
    respondWith(() => new Response('not-json', { status: 200 }));
    await expect(client.getById('submission-001')).rejects.toMatchObject({
      dependency: 'grading-submission',
      kind: 'unavailable',
    });
    respondWith(() => new Response(null, { status: 500 }));
    await expect(client.getById('submission-001')).rejects.toMatchObject({ kind: 'unavailable' });
    respondWith(() => new Response(null, { status: 503 }));
    await expect(client.getById('submission-001')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('preserves a Submission 504 response as timeout', async () => {
    respondWith(() => new Response(null, { status: 504 }));
    const client = new SubmissionHttpClient(createConfig() as never);

    await expect(client.getById('submission-001')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('maps a network failure to unavailable without retry', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const client = new SubmissionHttpClient(createConfig() as never);

    await expect(client.getById('submission-001')).rejects.toMatchObject({ kind: 'unavailable' });
    expect(calls).toBe(1);
  });

  it('maps an aborted request to timeout without retry', async () => {
    let calls = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof fetch;
    const client = new SubmissionHttpClient(createConfig(1) as never);

    await expect(client.getById('submission-001')).rejects.toMatchObject({ kind: 'timeout' });
    expect(calls).toBe(1);
  });
});
