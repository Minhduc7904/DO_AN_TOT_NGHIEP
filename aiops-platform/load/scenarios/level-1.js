import { fail } from 'k6';

import { w1Auth } from '../journeys/w1-auth.js';
import { w2CourseAuthoring } from '../journeys/w2-course-authoring.js';
import { w3EnrollAndLearn } from '../journeys/w3-enroll-and-learn.js';
import { w4MediaUpload } from '../journeys/w4-media-upload.js';
import { w5Notification } from '../journeys/w5-notification.js';
import { w6AiLesson } from '../journeys/w6-ai-lesson.js';
import { w7MediaCleanup } from '../journeys/w7-media-cleanup.js';
import { api, login } from '../lib/api.js';
import { config } from '../lib/config.js';

/**
 * Workload mức 1: mỗi hành trình W1–W7 là một scenario `constant-vus` riêng chạy thao tác cơ bản
 * trên dữ liệu seed. Không có profile, mục tiêu hay máy trạng thái (mức 2, tuần 14).
 *
 * Ngưỡng (threshold) của run trên stack khỏe: mỗi hành trình có request và lượt chạy, không có mã HTTP
 * ngoài danh sách mong đợi, các bước chờ bất đồng bộ đều đạt.
 */

const JOURNEYS = {
  w1: { scenario: 'w1_auth', exec: 'w1' },
  w2: { scenario: 'w2_course_authoring', exec: 'w2' },
  w3: { scenario: 'w3_enroll_and_learn', exec: 'w3' },
  w4: { scenario: 'w4_media_upload', exec: 'w4', hasChecks: true },
  w5: { scenario: 'w5_notification', exec: 'w5' },
  w6: { scenario: 'w6_ai_lesson', exec: 'w6', hasChecks: true },
  w7: { scenario: 'w7_media_cleanup', exec: 'w7', hasChecks: true },
};

function buildOptions() {
  const scenarios = {};
  const thresholds = {};
  for (const id of config.journeys) {
    const journey = JOURNEYS[id];
    scenarios[journey.scenario] = {
      executor: 'constant-vus',
      exec: journey.exec,
      vus: config.vus(id),
      duration: config.duration,
      gracefulStop: '90s',
      tags: { journey: id },
    };
    thresholds[`iterations{journey:${id}}`] = ['count>0'];
    thresholds[`http_reqs{journey:${id}}`] = ['count>0'];
    thresholds[`http_req_failed{journey:${id}}`] = ['rate==0'];
    thresholds[`http_req_duration{journey:${id}}`] = ['p(95)<10000'];
    if (journey.hasChecks) thresholds[`checks{journey:${id}}`] = ['rate==1'];
  }
  return {
    scenarios,
    thresholds,
    tags: { run_id: config.runId },
    setupTimeout: '120s',
    summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
  };
}

export const options = buildOptions();

export const w1 = () => w1Auth();
export const w2 = () => w2CourseAuthoring();
export const w3 = () => w3EnrollAndLearn();
export const w4 = () => w4MediaUpload();
export const w5 = () => w5Notification();
export const w6 = () => w6AiLesson();
export const w7 = (shared) => w7MediaCleanup(shared);

const J = 'setup';

/** Cấu hình provider AI trỏ tới LLM stub (W6) và tạo job dọn media thủ công (W7). */
export function setup() {
  const startedAt = new Date().toISOString();
  const admin = login(J, 'admin', config.admin.email, config.admin.password);
  const shared = { runId: config.runId, seed: config.seed, startedAt, w7JobId: null };

  if (config.journeys.includes('w6')) {
    if (!config.llmProviderUrl) fail('W6 cần LLM_PROVIDER_URL (ví dụ http://llm-stub:8080/v1)');
    const provider = api('POST', '/api/v1/ai/providers', {
      journey: J,
      token: admin.token,
      expected: [201],
      body: {
        name: `LLM stub ${config.runId}`,
        provider_type: 'CUSTOM',
        base_url: config.llmProviderUrl,
        api_key: `sk-k6-${config.runId}`,
      },
    }).data;
    const model = api('POST', '/api/v1/ai/models', {
      journey: J,
      token: admin.token,
      expected: [201],
      body: {
        provider_id: provider.id,
        model_name: `llm-stub-${config.runId}`,
        display_name: 'LLM stub',
      },
    }).data;
    for (const task of ['document-extraction', 'lesson-synthesis', 'quiz-authoring']) {
      api('PUT', `/api/v1/ai/service-bindings/${task}`, {
        journey: J,
        name: 'PUT /api/v1/ai/service-bindings/:task',
        token: admin.token,
        expected: [200, 201],
        body: { model_id: model.id },
      });
    }
    const health = api('POST', `/api/v1/ai/providers/${provider.id}/health-check`, {
      journey: J,
      name: 'POST /api/v1/ai/providers/:provider_id/health-check',
      token: admin.token,
    }).data;
    if (health.health_status !== 'ONLINE') {
      fail(`Provider ${config.llmProviderUrl} không ONLINE: ${JSON.stringify(health)}`);
    }
    shared.providerId = provider.id;
  }

  if (config.journeys.includes('w7')) {
    shared.w7JobId = api('POST', '/api/v1/scheduler/jobs', {
      journey: J,
      token: admin.token,
      expected: [201],
      body: {
        name: `Dọn media k6 ${config.runId}`,
        type: 'MEDIA_UNUSED_CLEANUP',
        schedule_type: 'MANUAL',
        payload: { retention_hours: config.w7RetentionHours },
      },
    }).data.id;
  }
  return shared;
}

function metricValue(data, name, field) {
  const metric = data.metrics[name];
  return metric ? (metric.values[field] ?? null) : null;
}

/** Tóm tắt run cho task export: `run_id`, cửa sổ thời gian UTC, số liệu theo hành trình. */
export function handleSummary(data) {
  const finishedAt = new Date().toISOString();
  const shared = data.setup_data ?? {};
  const journeys = {};
  for (const id of config.journeys) {
    journeys[id] = {
      scenario: JOURNEYS[id].scenario,
      vus: config.vus(id),
      iterations: metricValue(data, `iterations{journey:${id}}`, 'count'),
      http_reqs: metricValue(data, `http_reqs{journey:${id}}`, 'count'),
      http_req_failed_rate: metricValue(data, `http_req_failed{journey:${id}}`, 'rate'),
      http_req_duration_p95_ms: metricValue(data, `http_req_duration{journey:${id}}`, 'p(95)'),
      checks_rate: metricValue(data, `checks{journey:${id}}`, 'rate'),
    };
  }
  const thresholds = {};
  for (const [name, metric] of Object.entries(data.metrics)) {
    if (!metric.thresholds) continue;
    thresholds[name] = Object.values(metric.thresholds).every((result) => result.ok);
  }
  const summary = {
    run_id: config.runId,
    workload_level: 1,
    seed: config.seed,
    base_url: config.baseUrl,
    started_at: shared.startedAt ?? null,
    finished_at: finishedAt,
    duration_config: config.duration,
    journeys,
    http_reqs_total: metricValue(data, 'http_reqs', 'count'),
    http_req_failed_rate: metricValue(data, 'http_req_failed', 'rate'),
    thresholds_ok: Object.values(thresholds).every(Boolean),
    thresholds,
  };
  const lines = [
    `run_id=${summary.run_id} ${summary.started_at} → ${summary.finished_at}`,
    ...Object.entries(journeys).map(
      ([id, value]) =>
        `${id}: ${value.iterations ?? 0} lượt, ${value.http_reqs ?? 0} request, ` +
        `lỗi ${value.http_req_failed_rate ?? 'n/a'}, p95 ${Math.round(value.http_req_duration_p95_ms ?? 0)} ms, ` +
        `checks ${value.checks_rate ?? 'n/a'}`,
    ),
    `thresholds_ok=${summary.thresholds_ok}`,
  ];
  return {
    stdout: `${lines.join('\n')}\n`,
    [`${config.resultsDir}/${config.runId}/k6-summary.json`]: JSON.stringify(summary, null, 2),
  };
}
