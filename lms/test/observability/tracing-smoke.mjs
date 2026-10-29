import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { FLOWS, checkFlow, flowQuery } from './support/flow-matrix.mjs';
import { attachStack, attributeValue, poll, traceServices } from './support/telemetry.mjs';

// Tracing xuyên service (topology v2). Đọc traffic đã có trên stack (regression hoặc `test:observability`):
// (1) mỗi luồng trong ma trận phải có một trace chứa đủ service, span gốc đúng chủ, không đứt parent;
// (2) kịch bản lỗi nhiều bước: `auth` ngừng phản hồi → login lỗi tại cạnh gateway-auth, token dịch vụ
//     hết hạn không làm mới được → request qua gateway lỗi ngay tại cạnh `gateway-auth-token`, không
//     bao giờ tới course dù course và media vẫn khỏe (triệu chứng ở gateway, nguyên nhân ở auth).
const TAG = 'tracing';
const WINDOW_SECONDS = Number(process.env.OBSERVABILITY_WINDOW_SECONDS ?? 1800);
const MAX_CANDIDATES = 8;
const stack = await attachStack(process.argv.slice(2), TAG);
const startSeconds = Math.floor(Date.now() / 1_000) - WINDOW_SECONDS;
const results = [];

function errorSpans(spans) {
  return spans.filter((span) => span.status?.code === 'STATUS_CODE_ERROR');
}

function assertResourceIdentity(spans) {
  for (const service of traceServices(spans)) {
    const env = stack.configuration.services[service].environment;
    const span = spans.find((item) => item.service === service);
    assert.equal(
      attributeValue(span.resource, 'service.version'),
      env.OTEL_SERVICE_VERSION,
      service,
    );
    assert.equal(
      attributeValue(span.resource, 'service.instance.id'),
      env.OTEL_SERVICE_INSTANCE_ID,
      `${service}: service.instance.id không khớp compose`,
    );
  }
}

// --- (1) Ma trận luồng ---
for (const flow of FLOWS) {
  const { result, elapsedMs } = await poll(
    `luồng ${flow.id}`,
    async () => {
      const ids = await stack.tempo.search(flowQuery(flow), { startSeconds, limit: 30 });
      assert.ok(ids.length > 0, `Tempo chưa có trace chứa đủ ${flow.services.join(', ')}`);
      const rejected = [];
      for (const traceId of ids.slice(0, MAX_CANDIDATES)) {
        const spans = await stack.tempo.trace(traceId);
        const problems = checkFlow(spans, flow);
        if (errorSpans(spans).length > 0) problems.push('trace có span lỗi');
        if (problems.length === 0) return { traceId, spans };
        rejected.push(`${traceId}: ${problems.join('; ')}`);
      }
      throw new Error(`Không trace nào đạt:\n  ${rejected.join('\n  ')}`);
    },
    { tag: TAG, timeoutMs: 60_000, intervalMs: 3_000 },
  );
  assertResourceIdentity(result.spans);
  results.push({
    flow: flow.id,
    trace_id: result.traceId,
    services: traceServices(result.spans),
    spans: result.spans.length,
    elapsed_ms: elapsedMs,
  });
}

// --- (2) Kịch bản lỗi nhiều bước ---
// Đọc TTL từ container `auth` đang chạy (không phải từ `compose config`, vốn phụ thuộc env của tiến trình này).
// TTL thực của container đang chạy (compose config không thấy biến đặt lúc dựng stack).
const authTokenTtl = Number(
  (
    await stack.compose(['exec', '-T', 'auth', 'printenv', 'AUTH_SERVICE_TOKEN_TTL_SECONDS'])
  ).trim(),
);
let fault = {
  skipped: `AUTH_SERVICE_TOKEN_TTL_SECONDS=${authTokenTtl} > 120: đặt 60 để chạy kịch bản này`,
};

if (authTokenTtl <= 120) {
  process.env.REGRESSION_GATEWAY_URL = stack.urls.gateway;
  const { call, config, createPublishedCourse, login } =
    await import('../regression/support/api.mjs');
  const traced = (traceId) => ({
    traceparent: `00-${traceId}-${randomBytes(8).toString('hex')}-01`,
  });
  const instructor = await login('instructor', config.instructor);
  // Làm ấm token dịch vụ (gateway → upstream) khi auth còn khỏe, để kiểm đúng cơ chế hết hạn chứ
  // không phải "chưa từng có token"; xóa khóa học còn làm ấm luôn cạnh course → media.
  const warm = await createPublishedCourse(instructor.token);
  const warmed = await call('DELETE', `/api/v1/courses/${warm.courseId}`, {
    token: instructor.token,
  });
  assert.ok(
    warmed.status < 300,
    `xóa khóa học khi auth khỏe phải thành công, nhận ${warmed.status}`,
  );
  const { courseId } = await createPublishedCourse(instructor.token);
  const loginTrace = randomBytes(16).toString('hex');
  const deleteTrace = randomBytes(16).toString('hex');
  const recoverTrace = randomBytes(16).toString('hex');
  const outcome = {};
  const pausedAt = Date.now();
  await stack.compose(['pause', 'auth']);
  try {
    // (a) auth không phản hồi: login lỗi ngay tại cạnh gateway-auth, trace không có span của auth.
    const loginResponse = await call('POST', '/api/v1/auth/student/login', {
      body: { email: config.student.email, password: config.student.password },
      headers: traced(loginTrace),
    });
    assert.ok(
      loginResponse.status >= 500,
      `login khi auth treo phải 5xx, nhận ${loginResponse.status}`,
    );
    const { result: loginSpans } = await poll(
      'trace login lỗi tại gateway-auth',
      async () => {
        const spans = await stack.tempo.trace(loginTrace);
        const failed = errorSpans(spans).find((span) => /^gateway-auth /.test(span.name));
        assert.ok(failed, 'chưa có span lỗi gateway-auth');
        assert.ok(
          !spans.some((span) => span.service === 'auth'),
          'auth treo nhưng vẫn có span auth',
        );
        return spans;
      },
      { tag: TAG, timeoutMs: 60_000, intervalMs: 2_000 },
    );
    outcome.login = {
      trace_id: loginTrace,
      services: traceServices(loginSpans),
      http_status: loginResponse.status,
    };

    // (b) stale-while-error: token người dùng còn hạn và khóa JWKS đã cache nên request có token vẫn qua.
    const stillWorks = await call('GET', '/api/v1/courses', { token: instructor.token });
    assert.equal(stillWorks.status, 200, 'token còn hạn phải dùng được khi auth treo');
    outcome.stale_while_error_ok = true;

    // (c) token dịch vụ của gateway hết hạn mà không làm mới được: mọi request qua gateway lỗi.
    const waitMs = authTokenTtl * 1_000 + 5_000 - (Date.now() - pausedAt);
    if (waitMs > 0) await delay(waitMs);
    const deleted = await call('DELETE', `/api/v1/courses/${courseId}`, {
      token: instructor.token,
      headers: traced(deleteTrace),
    });
    assert.ok(
      deleted.status >= 500,
      `xóa khóa học khi token dịch vụ hết hạn phải 5xx, nhận ${deleted.status}`,
    );
    const { result: deleteSpans } = await poll(
      'trace lỗi tại gateway-auth-token, request không tới course',
      async () => {
        const spans = await stack.tempo.trace(deleteTrace);
        const failed = errorSpans(spans).find((span) => /^gateway-auth-token /.test(span.name));
        assert.ok(failed, 'chưa có span lỗi gateway-auth-token');
        assert.ok(!spans.some((span) => span.service === 'course'), 'request vẫn tới course');
        return spans;
      },
      { tag: TAG, timeoutMs: 60_000, intervalMs: 2_000 },
    );
    outcome.token_expiry = {
      trace_id: deleteTrace,
      services: traceServices(deleteSpans),
      error_spans: errorSpans(deleteSpans).map((span) => `${span.service}: ${span.name}`),
      seconds_from_fault_to_symptom: Math.round((Date.now() - pausedAt) / 1_000),
      http_status: deleted.status,
    };
  } finally {
    await stack.compose(['unpause', 'auth']);
  }
  await poll(
    'auth healthy trở lại',
    async () => {
      const health = JSON.parse((await stack.compose(['ps', 'auth', '--format', 'json'])).trim());
      assert.equal(health.Health, 'healthy');
    },
    { tag: TAG, timeoutMs: 60_000, intervalMs: 2_000 },
  );
  // (d) phục hồi: auth trở lại thì cạnh gateway-auth-token hết lỗi.
  await poll(
    'phục hồi sau khi auth trở lại',
    async () => {
      const retry = await call('DELETE', `/api/v1/courses/${courseId}`, {
        token: instructor.token,
        headers: traced(recoverTrace),
      });
      assert.ok(retry.status < 500, `vẫn lỗi ${retry.status}`);
    },
    { tag: TAG, timeoutMs: 60_000, intervalMs: 3_000 },
  );
  fault = outcome;
}

console.info(`[${TAG}] RESULT ${JSON.stringify({ flows: results, fault }, null, 2)}`);
console.info(`[${TAG}] Tracing smoke đạt.`);
