import { startTelemetry } from '@aiops-lms/observability';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@aiops-lms/observability/testing';
import { context, trace } from '@opentelemetry/api';

import { CourseHttpClient } from '../../src/adapters/clients/course-http.client.js';
import { EnrollmentHttpClient } from '../../src/adapters/clients/enrollment-http.client.js';
import { StorageHttpClient } from '../../src/adapters/clients/storage-http.client.js';
import { SubmissionDependencyError } from '../../src/application/submission-dependency-error.js';

interface FakeConfigValues {
  SUBMISSION_COURSE_BASE_URL: string;
  SUBMISSION_DEPENDENCY_TIMEOUT_MS: number;
  SUBMISSION_ENROLLMENT_BASE_URL: string;
  SUBMISSION_STORAGE_BASE_URL: string;
}

function createConfig(overrides: Partial<FakeConfigValues> = {}): {
  getOrThrow: (key: string) => unknown;
} {
  const values: FakeConfigValues = {
    SUBMISSION_COURSE_BASE_URL: 'http://course.test',
    SUBMISSION_DEPENDENCY_TIMEOUT_MS: 20,
    SUBMISSION_ENROLLMENT_BASE_URL: 'http://enrollment.test',
    SUBMISSION_STORAGE_BASE_URL: 'http://storage.test',
    ...overrides,
  };
  return { getOrThrow: (key: string) => values[key as keyof FakeConfigValues] };
}

describe('Submission HTTP dependency clients', () => {
  const originalFetch = globalThis.fetch;
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'submission-clients-test-1',
      serviceName: 'submission',
      serviceVersion: '0.1.0-test',
    },
    { spanProcessor: new SimpleSpanProcessor(new InMemorySpanExporter()) },
  );

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    await telemetry.shutdown();
  }, 20_000);

  it('calls Course with trusted principal headers and active W3C context', async () => {
    let captured: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Request(input, init);
      return new Response(JSON.stringify({ id: 'course-001' }), { status: 200 });
    }) as typeof fetch;
    const client = new CourseHttpClient(createConfig() as never);
    const span = trace.getTracer('test').startSpan('incoming');
    await context.with(trace.setSpan(context.active(), span), () =>
      client.exists('course-001', { id: 'student-001', role: 'student' }),
    );
    span.end();

    expect(captured?.headers.get('x-principal-id')).toBe('student-001');
    expect(captured?.headers.get('x-principal-role')).toBe('student');
    expect(captured?.headers.get('traceparent')).toContain(span.spanContext().traceId);
    expect(captured?.url).toBe('http://course.test/api/v1/courses/course-001');
  });

  it('uses the internal Enrollment check contract and validates its response', async () => {
    let captured: URL | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      captured = new URL(input.toString());
      return new Response(JSON.stringify({ enrolled: true }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    }) as typeof fetch;
    const client = new EnrollmentHttpClient(createConfig() as never);
    await expect(client.isEnrolled('student-001', 'course-001')).resolves.toBe(true);
    expect(captured?.pathname).toBe('/api/v1/enrollments/check');
    expect(captured?.searchParams.get('principal_id')).toBe('student-001');
    expect(captured?.searchParams.get('course_id')).toBe('course-001');
  });

  it('stores content through the Storage Mock network contract', async () => {
    let captured: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Request(input, init);
      return new Response(JSON.stringify({ stored: true }), { status: 200 });
    }) as typeof fetch;
    const client = new StorageHttpClient(createConfig() as never);
    await client.store('submissions/submission-001', 'answer');
    expect(captured?.method).toBe('PUT');
    expect(new URL(captured!.url).pathname).toContain('submissions%2Fsubmission-001');
    await expect(captured?.json()).resolves.toEqual({ content: 'answer' });
  });

  it('maps a dependency 503 response to unavailable inside the dependency boundary', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
    const client = new StorageHttpClient(createConfig() as never);
    const error = await client.store('submissions/unavailable', 'answer').catch((caught) => caught);
    expect(error).toBeInstanceOf(SubmissionDependencyError);
    expect((error as SubmissionDependencyError).kind).toBe('unavailable');
  });

  it('maps an aborted dependency request to DEPENDENCY_TIMEOUT without retry', async () => {
    let calls = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof fetch;
    const client = new StorageHttpClient(
      createConfig({ SUBMISSION_DEPENDENCY_TIMEOUT_MS: 1 }) as never,
    );
    const error = await client.store('submissions/slow', 'answer').catch((caught) => caught);
    expect(error).toBeInstanceOf(SubmissionDependencyError);
    expect((error as SubmissionDependencyError).kind).toBe('timeout');
    expect(calls).toBe(1);
  });
});
