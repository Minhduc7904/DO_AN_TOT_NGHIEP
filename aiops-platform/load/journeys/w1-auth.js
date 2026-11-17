import exec from 'k6/execution';

import { api, login } from '../lib/api.js';
import { config, seedStudentEmail } from '../lib/config.js';
import { runIteration, think, uniqueName } from './session.js';

const J = 'w1';

/**
 * W1 — đăng ký/đăng nhập: thỉnh thoảng một học viên mới đăng ký, còn lại học viên seed đăng nhập,
 * đọc hồ sơ và làm mới token. Mỗi lượt là một phiên mới (không giữ token qua lượt).
 */
export function w1Auth() {
  runIteration(J, ({ rng }) => {
    let user;
    if (rng.chance(0.2)) {
      const email = `${uniqueName('k6')}@load.test`;
      const password = 'load-password-1';
      api('POST', '/api/v1/auth/register', {
        journey: J,
        expected: [201],
        body: { email, password, full_name: `Học viên k6 ${exec.vu.idInTest}` },
      });
      think(rng);
      user = login(J, 'student', email, password);
    } else {
      user = login(
        J,
        'student',
        seedStudentEmail(rng.int(1, config.seedStudents)),
        config.seedPassword,
      );
    }
    think(rng);
    api('GET', '/api/v1/auth/me', { journey: J, token: user.token });
    api('GET', '/api/v1/students/me', { journey: J, token: user.token });
    think(rng);
    api('POST', '/api/v1/auth/refresh', {
      journey: J,
      body: { refresh_token: user.refreshToken },
    });
    think(rng);
  });
}
