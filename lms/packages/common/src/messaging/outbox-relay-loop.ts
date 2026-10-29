import type { SqlClient } from '../prisma/sql-client.js';
import type { CommandEnvelope } from './command-envelope.js';
import { relayOutboxOnce, type OutboxRelayOptions } from './outbox.js';
import type { RabbitMqCommandPublisher } from './rabbitmq-command-publisher.js';

export interface OutboxRelayLoopOptions extends OutboxRelayOptions {
  /** Chờ giữa hai lượt khi outbox đã rỗng. */
  pollMs: number;
  onWarning?: (message: string) => void;
}

/**
 * Vòng lặp nền chuyển outbox sang RabbitMQ: claim một lô, publish, lặp lại ngay nếu còn việc,
 * ngược lại chờ `pollMs`. Lỗi một lượt (DB/broker) chỉ ghi cảnh báo rồi thử lại ở lượt sau, nên
 * broker chết không làm service chết: command nằm lại trong outbox.
 */
export class OutboxRelayLoop {
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;
  private stopped = true;

  constructor(
    private readonly sql: SqlClient,
    private readonly publisher: RabbitMqCommandPublisher,
    private readonly options: OutboxRelayLoopOptions,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  /** Dừng vòng lặp và chờ lượt đang chạy (nếu có) xong, tối đa `drainTimeoutMs`, để đóng DB an toàn. */
  async stop(drainTimeoutMs = 5_000): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    const running = this.inFlight;
    if (!running) return;
    let timeout: NodeJS.Timeout | undefined;
    await Promise.race([
      running,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, drainTimeoutMs);
        timeout.unref();
      }),
    ]);
    if (timeout) clearTimeout(timeout);
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      const run = this.tick().finally(() => {
        if (this.inFlight === run) this.inFlight = undefined;
      });
      this.inFlight = run;
    }, delayMs);
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    let published = 0;
    try {
      ({ published } = await relayOutboxOnce(
        this.sql,
        (message) =>
          this.publisher.publish(message.routing_key, message.envelope as CommandEnvelope),
        this.options,
      ));
    } catch (error) {
      this.options.onWarning?.(
        `Relay outbox lỗi: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    this.schedule(published > 0 ? 0 : this.options.pollMs);
  }
}
