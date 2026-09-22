import { startTelemetry } from '@aiops-lms/observability';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@aiops-lms/observability/testing';
import { context, trace } from '@opentelemetry/api';

import { CourseHttpClient } from '../../src/adapters/clients/course-http.client.js';
import { EnrollmentDependencyError } from '../../src/application/enrollment-dependency-error.js';
import type { CoursePrincipal } from '../../src/application/ports/course-client.js';

interface FakeConfigValues {
  ENROLLMENT_COURSE_BASE_URL: string;
  ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS: number;
  ENROLLMENT_COURSE_BREAKER_THRESHOLD: number;
  ENROLLMENT_COURSE_TIMEOUT_MS: number;
}

function createConfig(overrides: Partial<FakeConfigValues> = {}): {
  getOrThrow: (key: string) => unknown;
} {
  const values: FakeConfigValues = {
    ENROLLMENT_COURSE_BASE_URL: 'http://course.test',
    ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS: 50,
    ENROLLMENT_COURSE_BREAKER_THRESHOLD: 2,
    ENROLLMENT_COURSE_TIMEOUT_MS: 20,
    ...overrides,
  };
  return { getOrThrow: (key: string) => values[key as keyof FakeConfigValues] };
}

const principal: CoursePrincipal = { id: 'student-001', role: 'student' };

describe('CourseHttpClient', () => {
  const originalFetch = globalThis.fetch;
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'enrollment-course-client-test-1',
      serviceName: 'enrollment',
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

  it('returns true when Course responds ok and false on 404', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      return url.pathname.endsWith('missing')
        ? new Response(null, { status: 404 })
        : new Response(JSON.stringify({ id: 'course-001' }), {
            headers: { 'content-type': 'application/json' },
            status: 200,
          });
    }) as typeof fetch;
    const client = new CourseHttpClient(createConfig() as never);

    await expect(client.exists('course-001', principal)).resolves.toBe(true);
    await expect(client.exists('missing', principal)).resolves.toBe(false);
  });

  it('forwards the trusted principal headers and the active W3C trace context', async () => {
    let forwardedRequest: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      forwardedRequest = new Request(input, init);
      return new Response(JSON.stringify({ id: 'course-001' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    }) as typeof fetch;
    const client = new CourseHttpClient(createConfig() as never);
    const tracer = trace.getTracer('test');
    const span = tracer.startSpan('incoming-request');

    await context.with(trace.setSpan(context.active(), span), () =>
      client.exists('course-001', principal),
    );
    span.end();

    expect(forwardedRequest?.headers.get('x-principal-id')).toBe('student-001');
    expect(forwardedRequest?.headers.get('x-principal-role')).toBe('student');
    const traceparent = forwardedRequest?.headers.get('traceparent');
    expect(traceparent).toContain(span.spanContext().traceId);
  });

  it('maps an aborted call to a timeout dependency error without retrying', async () => {
    let calls = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof fetch;
    const client = new CourseHttpClient(createConfig({ ENROLLMENT_COURSE_TIMEOUT_MS: 1 }) as never);

    const error = await client.exists('course-001', principal).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EnrollmentDependencyError);
    expect((error as EnrollmentDependencyError).kind).toBe('timeout');
    expect(calls).toBe(1);
  });

  it('maps a network failure to an unavailable dependency error', async () => {
    globalThis.fetch = (async () => {
      throw new Error('connection refused');
    }) as typeof fetch;
    const client = new CourseHttpClient(createConfig() as never);

    const error = await client.exists('course-001', principal).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EnrollmentDependencyError);
    expect((error as EnrollmentDependencyError).kind).toBe('unavailable');
  });

  it('opens the circuit after consecutive failures and short-circuits without calling the network', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error('connection refused');
    }) as typeof fetch;
    const client = new CourseHttpClient(
      createConfig({ ENROLLMENT_COURSE_BREAKER_THRESHOLD: 2 }) as never,
    );

    await expect(client.exists('course-001', principal)).rejects.toBeInstanceOf(
      EnrollmentDependencyError,
    );
    await expect(client.exists('course-001', principal)).rejects.toBeInstanceOf(
      EnrollmentDependencyError,
    );
    expect(calls).toBe(2);

    await expect(client.exists('course-001', principal)).rejects.toBeInstanceOf(
      EnrollmentDependencyError,
    );
    expect(calls).toBe(2);
  });

  it('closes the circuit again after the cooldown once a call succeeds', async () => {
    let shouldFail = true;
    globalThis.fetch = (async () => {
      if (shouldFail) throw new Error('connection refused');
      return new Response(JSON.stringify({ id: 'course-001' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    }) as typeof fetch;
    const client = new CourseHttpClient(
      createConfig({
        ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS: 20,
        ENROLLMENT_COURSE_BREAKER_THRESHOLD: 1,
      }) as never,
    );

    await expect(client.exists('course-001', principal)).rejects.toBeInstanceOf(
      EnrollmentDependencyError,
    );
    await expect(client.exists('course-001', principal)).rejects.toBeInstanceOf(
      EnrollmentDependencyError,
    );

    shouldFail = false;
    await new Promise((resolve) => setTimeout(resolve, 25));
    await expect(client.exists('course-001', principal)).resolves.toBe(true);
  });
});
