import { PollingLoop } from '../../src/adapters/runtime/polling-loop.js';

describe('PollingLoop', () => {
  it('còn việc thì chạy tiếp ngay, hết việc thì ngủ pollMs; stop() dừng được cả khi đang ngủ', async () => {
    const calls: number[] = [];
    let remaining = 3;
    const loop = new PollingLoop(
      () => {
        calls.push(Date.now());
        remaining -= 1;
        return Promise.resolve(remaining >= 0);
      },
      { pollMs: 60_000, onError: () => undefined },
    );

    loop.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await loop.stop(); // đang ngủ 60 giây nhưng phải dừng ngay

    // 3 lượt có việc + 1 lượt rỗng rồi ngủ.
    expect(calls).toHaveLength(4);
  });

  it('lỗi của một lượt được báo và vòng lặp vẫn tiếp tục', async () => {
    const errors: unknown[] = [];
    let attempts = 0;
    const loop = new PollingLoop(
      () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('lỗi tạm')) : Promise.resolve(false);
      },
      { pollMs: 10, onError: (error) => errors.push(error) },
    );

    loop.start();
    await new Promise((resolve) => setTimeout(resolve, 80));
    await loop.stop();

    expect(errors).toHaveLength(1);
    expect(attempts).toBeGreaterThan(2);
  });
});
