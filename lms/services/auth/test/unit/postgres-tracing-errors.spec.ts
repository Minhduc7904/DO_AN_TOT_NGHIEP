import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { context, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@aiops-lms/observability/testing';

import { startTelemetry } from '@aiops-lms/observability';
import { PostgresAuthRepository } from '../../src/adapters/persistence/postgres-auth.repository.js';

const exporter = new InMemorySpanExporter();
const telemetry = startTelemetry(
  {
    enabled: true,
    otlpTracesEndpoint: 'http://127.0.0.1:1/v1/traces',
    serviceName: 'auth',
    serviceVersion: '0.1.0',
    serviceInstanceId: 'auth-db-error-test',
  },
  { spanProcessor: new SimpleSpanProcessor(exporter) },
);

afterAll(async () => {
  await telemetry.shutdown();
  context.disable();
  propagation.disable();
  trace.disable();
});

it.each([
  ['57014', 'timeout'],
  ['ETIMEDOUT', 'timeout'],
  ['ECONNREFUSED', 'unavailable'],
])(
  'classifies database error %s without exporting its message or query parameters',
  async (code, expected) => {
    const failure = Object.assign(new Error('password=private-credential student@private.test'), {
      code,
    });
    const query = jest
      .spyOn(Pool.prototype, 'query')
      .mockImplementation(() => Promise.reject(failure));
    const repository = new PostgresAuthRepository(
      new ConfigService({ AUTH_DATABASE_URL: 'postgresql://127.0.0.1:1/auth_test' }),
    );
    exporter.reset();
    try {
      await expect(repository.findUserByEmail('student@private.test')).rejects.toBe(failure);
      await telemetry.forceFlush();
      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status.code).toBe(2);
      expect(spans[0]?.attributes['error.type']).toBe(expected);
      expect(spans[0]?.attributes['db.system.name']).toBe('postgresql');
      expect(JSON.stringify(spans.map((span) => [span.attributes, span.events]))).not.toMatch(
        /private-credential|student@private/u,
      );
    } finally {
      query.mockRestore();
      await repository.onModuleDestroy();
    }
  },
);
