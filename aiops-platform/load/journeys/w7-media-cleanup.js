import { sleep } from 'k6';
import exec from 'k6/execution';

import { api, waitFor } from '../lib/api.js';
import { config } from '../lib/config.js';
import { adminSession, runIteration } from './session.js';

const J = 'w7';

/**
 * W7 — dọn media theo lịch: admin kích hoạt job `MEDIA_UNUSED_CLEANUP` (tạo ở `setup()`), chờ run
 * kết thúc, xem tổng hợp media. Việc định kỳ nên giữa hai lượt nghỉ `W7_PAUSE_S` (mặc định 30 s).
 */
export function w7MediaCleanup(shared) {
  runIteration(J, () => {
    const admin = adminSession(J);
    const jobId = shared.w7JobId;
    const run = api('POST', `/api/v1/scheduler/jobs/${jobId}/runs`, {
      journey: J,
      name: 'POST /api/v1/scheduler/jobs/:job_id/runs',
      token: admin.token,
      expected: [201],
      body: {
        idempotency_key: `${config.runId}-${exec.vu.idInTest}-${exec.vu.iterationInScenario}`,
      },
    }).data;
    waitFor(J, 'run dọn media kết thúc', () => {
      const runs = api('GET', `/api/v1/scheduler/jobs/${jobId}/runs?page_size=20`, {
        journey: J,
        name: 'GET /api/v1/scheduler/jobs/:job_id/runs',
        token: admin.token,
      }).data;
      const found = (runs ?? []).find((item) => item.id === run.id);
      return found && (found.status === 'SUCCEEDED' || found.status === 'FAILED')
        ? found.status
        : null;
    });
    api('GET', '/api/v1/media/summary', { journey: J, token: admin.token });
    sleep(config.w7PauseSeconds);
  });
}
