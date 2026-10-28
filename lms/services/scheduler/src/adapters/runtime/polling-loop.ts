export interface PollingLoopOptions {
  /** Chờ giữa hai lượt khi không còn việc. */
  pollMs: number;
  onError: (error: unknown) => void;
}

/**
 * Vòng lặp nền: gọi `step` liên tục; `step` trả `true` (vừa làm được việc) thì gọi lại ngay, `false`
 * thì ngủ `pollMs`. Lỗi của một lượt chỉ được báo, vòng lặp vẫn tiếp tục. `stop()` chờ lượt đang
 * chạy dở xong.
 */
export class PollingLoop {
  private running = false;
  private loop: Promise<void> | null = null;
  private wake: (() => void) | null = null;

  constructor(
    private readonly step: () => Promise<boolean>,
    private readonly options: PollingLoopOptions,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.run();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wake?.();
    await this.loop;
    this.loop = null;
  }

  private async run(): Promise<void> {
    while (this.running) {
      let worked = false;
      try {
        worked = await this.step();
      } catch (error) {
        this.options.onError(error);
      }
      if (this.running && !worked) await this.sleep();
    }
  }

  private sleep(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, this.options.pollMs);
      this.wake = done;
      function done(): void {
        clearTimeout(timer);
        resolve();
      }
    });
  }
}
