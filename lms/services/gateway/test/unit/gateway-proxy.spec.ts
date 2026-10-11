import { jest } from '@jest/globals';

import {
  DependencyTimeoutError,
  DependencyUnavailableError,
  GatewayProxy,
  type FetchClient,
} from '../../src/application/gateway-proxy.js';

describe('GatewayProxy', () => {
  it('forwards only trusted principal headers and preserves W3C trace context', async () => {
    let forwardedRequest: Request | undefined;
    const fetchClient: FetchClient = async (input, init) => {
      forwardedRequest = new Request(input, init);
      return new Response(JSON.stringify({ id: 'course-001' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    };
    const proxy = new GatewayProxy(fetchClient);

    await proxy.forward(
      {
        body: undefined,
        dependency: 'gateway-course',
        headers: {
          authorization: 'Bearer client-token-must-not-reach-downstream',
          traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
          tracestate: 'vendor=value',
          'x-principal-id': 'spoofed-client',
          'x-principal-role': 'admin',
        },
        method: 'GET',
        path: '/api/v1/courses',
        principal: { id: 'student-001', role: 'student' },
        targetBaseUrl: 'http://course.test',
      },
      100,
    );

    expect(forwardedRequest?.headers.get('authorization')).toBeNull();
    expect(forwardedRequest?.headers.get('x-principal-id')).toBe('student-001');
    expect(forwardedRequest?.headers.get('x-principal-role')).toBe('student');
    expect(forwardedRequest?.headers.get('traceparent')).toBe(
      '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    );
    expect(forwardedRequest?.headers.get('tracestate')).toBe('vendor=value');
  });

  it('maps an aborted outbound call to the canonical timeout exception without retrying', async () => {
    let calls = 0;
    const fetchClient: FetchClient = async (_input, init) =>
      new Promise((_resolve, reject) => {
        calls++;
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const proxy = new GatewayProxy(fetchClient);

    await expect(
      proxy.forward(
        {
          body: undefined,
          dependency: 'gateway-course',
          headers: {},
          method: 'GET',
          path: '/api/v1/courses',
          targetBaseUrl: 'http://course.test',
        },
        1,
      ),
    ).rejects.toBeInstanceOf(DependencyTimeoutError);
    expect(calls).toBe(1);
  });

  it.each([
    [504, DependencyTimeoutError],
    [500, DependencyUnavailableError],
    [503, DependencyUnavailableError],
  ])(
    'maps upstream %i to the canonical dependency exception without retry',
    async (status, kind) => {
      const fetchClient = jest.fn<FetchClient>().mockResolvedValue(new Response(null, { status }));
      const proxy = new GatewayProxy(fetchClient);

      await expect(
        proxy.forward(
          {
            body: { score: 90 },
            dependency: 'gateway-grading',
            headers: {},
            method: 'POST',
            path: '/api/v1/grades',
            targetBaseUrl: 'http://grading.test',
          },
          100,
        ),
      ).rejects.toBeInstanceOf(kind);
      expect(fetchClient).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves a business 404 response without retrying', async () => {
    const fetchClient = jest.fn<FetchClient>().mockResolvedValue(
      new Response(JSON.stringify({ code: 'NOT_FOUND' }), {
        headers: { 'content-type': 'application/json' },
        status: 404,
      }),
    );
    const proxy = new GatewayProxy(fetchClient);

    const response = await proxy.forward(
      {
        body: undefined,
        dependency: 'gateway-course',
        headers: {},
        method: 'GET',
        path: '/api/v1/courses/missing',
        targetBaseUrl: 'http://course.test',
      },
      100,
    );

    expect(response).toMatchObject({ body: { code: 'NOT_FOUND' }, status: 404 });
    expect(fetchClient).toHaveBeenCalledTimes(1);
  });
});
