import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';

export interface RabbitMqSessionOptions {
  url: string;
  /** Giới hạn cho kết nối, tạo channel và assert topology. */
  connectTimeoutMs: number;
  onWarning?: (message: string) => void;
}

interface Session {
  connection: ChannelModel;
  channel: ConfirmChannel;
}

const FORCE_CLOSE_GRACE_MS = 1_000;

/** Đóng êm; nếu broker không trả close-ok thì hủy socket để retry không tích lũy file descriptor. */
function forceClose(connection: ChannelModel): void {
  const timer = setTimeout(() => {
    const internal = connection.connection as unknown as {
      stream?: { destroy(error?: Error): void };
    };
    internal.stream?.destroy(new Error('Connection bị hủy sau khi đóng êm quá hạn'));
  }, FORCE_CLOSE_GRACE_MS);
  timer.unref();
  void connection
    .close()
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

/**
 * Một connection + confirm channel dùng chung, tự mở lại khi bị đóng. Dùng cho cả publisher và
 * consumer của một process.
 */
export class RabbitMqSession {
  private session: Session | undefined;
  private opening: Promise<Session> | undefined;
  private closed = false;

  constructor(private readonly options: RabbitMqSessionOptions) {}

  /** Channel hiện tại; mở lại nếu connection/channel đã đóng. Topology do bên gọi tự khai báo. */
  async channel(): Promise<ConfirmChannel> {
    if (this.session) return this.session.channel;
    this.opening ??= this.open().finally(() => {
      this.opening = undefined;
    });
    return (await this.opening).channel;
  }

  async close(): Promise<void> {
    this.closed = true;
    const session = this.session;
    this.session = undefined;
    if (!session) return;
    await Promise.race([
      session.channel
        .close()
        .catch(() => undefined)
        .then(() => session.connection.close())
        .catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, FORCE_CLOSE_GRACE_MS).unref()),
    ]);
    forceClose(session.connection);
  }

  private async open(): Promise<Session> {
    const connection = await this.withTimeout(connect(this.options.url));
    try {
      // Không có listener 'error' thì amqplib làm process crash khi broker ngắt kết nối.
      connection.on('error', (error: Error) =>
        this.options.onWarning?.(`connection: ${error.name}`),
      );
      const channel = await this.withTimeout(connection.createConfirmChannel());
      channel.on('error', (error: Error) => this.options.onWarning?.(`channel: ${error.name}`));
      const session = { connection, channel };
      const invalidate = (): void => {
        if (this.session === session) this.session = undefined;
      };
      connection.on('close', invalidate);
      channel.on('close', invalidate);
      if (this.closed) throw new Error('Session đã đóng');
      this.session = session;
      return session;
    } catch (error) {
      forceClose(connection);
      throw error;
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('RabbitMQ timeout')),
            this.options.connectTimeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
