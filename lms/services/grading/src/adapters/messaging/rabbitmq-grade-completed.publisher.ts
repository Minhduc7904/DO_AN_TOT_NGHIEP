import type { GradeCompletedRabbitMqHeaders } from '@aiops-lms/contracts';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';

import { GradeEventPublishError } from '../../application/grade-event-publish-error.js';
import { GradeCompletedPublisher } from '../../application/ports/grade-completed-publisher.js';
import { GRADE_COMPLETED_ROUTING_KEY } from '../../config/app-config.js';
import type { GradeCompletedSnapshot } from '../../domain/grade-completed-snapshot.js';
import { observePublish } from '../telemetry/messaging-telemetry.js';
import { buildGradeCompletedMessage } from './grade-completed-event.factory.js';

interface BrokerSession {
  connection: ChannelModel;
  channel: ConfirmChannel;
}

const FORCE_CLOSE_GRACE_MS = 1_000;

/**
 * Đóng connection êm; nếu broker không trả close-ok (mạng treo) thì hủy socket sau thời gian chờ
 * ngắn để các lần retry liên tiếp không tích lũy socket/file descriptor.
 */
function forceClose(connection: ChannelModel): void {
  const timer = setTimeout(() => {
    const internal = connection.connection as unknown as {
      stream?: { destroy(error?: Error): void };
    };
    // Hủy kèm lỗi để amqplib chạy toClosed (dừng heartbeat, báo close) thay vì để timer heartbeat sống tiếp.
    internal.stream?.destroy(new Error('Connection bị hủy sau khi đóng êm quá hạn'));
  }, FORCE_CLOSE_GRACE_MS);
  timer.unref();
  void connection
    .close()
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

@Injectable()
export class RabbitMqGradeCompletedPublisher
  extends GradeCompletedPublisher
  implements OnApplicationShutdown
{
  private readonly logger = new Logger(RabbitMqGradeCompletedPublisher.name);
  private readonly url: string;
  private readonly exchange: string;
  private readonly confirmTimeoutMs: number;
  private readonly serviceVersion: string;
  private session: BrokerSession | undefined;
  private opening: Promise<BrokerSession> | undefined;
  private closed = false;

  constructor(config: ConfigService) {
    super();
    this.url = config.getOrThrow<string>('GRADING_RABBITMQ_URL');
    this.exchange = config.getOrThrow<string>('GRADING_GRADE_COMPLETED_EXCHANGE');
    this.confirmTimeoutMs = config.getOrThrow<number>('GRADING_PUBLISH_CONFIRM_TIMEOUT_MS');
    this.serviceVersion = config.getOrThrow<string>('OTEL_SERVICE_VERSION');
  }

  async publish(snapshot: GradeCompletedSnapshot): Promise<void> {
    await observePublish(
      {
        eventId: snapshot.eventId,
        exchange: this.exchange,
        routingKey: GRADE_COMPLETED_ROUTING_KEY,
      },
      async () => {
        // Dựng trong span PRODUCER để trace context inject vào headers cũng là correlation của envelope.
        const { event, headers } = buildGradeCompletedMessage(snapshot, this.serviceVersion);
        const { channel } = await this.ensureSession();
        await this.publishAndConfirm(channel, Buffer.from(JSON.stringify(event)), {
          headers,
          messageId: event.event_id,
        });
      },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.closed = true;
    const session = this.session;
    this.session = undefined;
    // Một lần mở đang dở sẽ tự đóng khi hoàn tất (xem `open`).
    if (!session) return;
    // Chờ đóng êm nhưng có giới hạn: broker treo không được giữ shutdown vô hạn.
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      session.channel
        .close()
        .catch(() => undefined)
        .then(() => session.connection.close())
        .catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, FORCE_CLOSE_GRACE_MS);
      }),
    ]);
    clearTimeout(timer);
    forceClose(session.connection);
  }

  private ensureSession(): Promise<BrokerSession> {
    if (this.session) return Promise.resolve(this.session);
    this.opening ??= this.open().finally(() => {
      this.opening = undefined;
    });
    return this.opening;
  }

  private async open(): Promise<BrokerSession> {
    const connection = await this.connectWithTimeout();
    let timer: NodeJS.Timeout | undefined;
    try {
      // Broker nhận kết nối nhưng không trả lời tạo channel/assertExchange sẽ làm treo mọi publish,
      // worker và shutdown, nên toàn bộ bước dựng session cũng bị chặn bởi cùng ngưỡng timeout.
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new GradeEventPublishError('PUBLISH_TIMEOUT')),
          this.confirmTimeoutMs,
        );
      });
      return await Promise.race([this.setUp(connection), timeout]);
    } catch (error) {
      forceClose(connection);
      throw this.classify(error);
    } finally {
      clearTimeout(timer);
    }
  }

  private async setUp(connection: ChannelModel): Promise<BrokerSession> {
    // Không có listener 'error' thì amqplib làm process crash khi broker ngắt kết nối.
    connection.on('error', (error: Error) => this.logger.warn(this.describe('connection', error)));
    const channel = await connection.createConfirmChannel();
    channel.on('error', (error: Error) => this.logger.warn(this.describe('channel', error)));
    const session = { channel, connection };
    connection.on('close', () => this.invalidate(session));
    channel.on('close', () => this.invalidate(session));
    // Chỉ assert exchange; queue của consumer do Notification sở hữu.
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    if (this.closed) throw new GradeEventPublishError('BROKER_UNAVAILABLE');
    this.session = session;
    return session;
  }

  private async connectWithTimeout(): Promise<ChannelModel> {
    const attempt = connect(this.url);
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        attempt,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new GradeEventPublishError('PUBLISH_TIMEOUT')),
            this.confirmTimeoutMs,
          );
        }),
      ]);
    } catch (error) {
      // Kết nối về muộn sau khi đã timeout phải được đóng để không rò connection.
      attempt.then(forceClose).catch(() => undefined);
      throw this.classify(error);
    } finally {
      clearTimeout(timer);
    }
  }

  private publishAndConfirm(
    channel: ConfirmChannel,
    body: Buffer,
    extra: { headers: GradeCompletedRabbitMqHeaders; messageId: string },
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (error?: GradeEventPublishError): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        // Broker không phản hồi: bỏ session để lần sau tạo kết nối mới.
        this.discard(channel);
        settle(new GradeEventPublishError('PUBLISH_TIMEOUT'));
      }, this.confirmTimeoutMs);
      try {
        // `publish()` trả false chỉ báo backpressure; message đã nằm trong buffer nên chỉ cần chờ confirm.
        channel.publish(
          this.exchange,
          GRADE_COMPLETED_ROUTING_KEY,
          body,
          {
            appId: 'grading',
            contentEncoding: 'utf-8',
            contentType: 'application/json',
            headers: extra.headers,
            messageId: extra.messageId,
            persistent: true,
            type: GRADE_COMPLETED_ROUTING_KEY,
          },
          (error) => {
            if (!error) settle();
            else {
              this.discard(channel);
              settle(
                new GradeEventPublishError(
                  /nack/iu.test(String(error?.message)) ? 'PUBLISH_NACKED' : 'BROKER_UNAVAILABLE',
                ),
              );
            }
          },
        );
      } catch {
        this.discard(channel);
        settle(new GradeEventPublishError('BROKER_UNAVAILABLE'));
      }
    });
  }

  private discard(channel: ConfirmChannel): void {
    if (this.session?.channel === channel) this.invalidate(this.session);
  }

  // Bỏ session hỏng và đóng nốt connection (nếu còn) để không rò socket.
  private invalidate(session: BrokerSession): void {
    if (this.session === session) this.session = undefined;
    void session.channel.close().catch(() => undefined);
    forceClose(session.connection);
  }

  private classify(error: unknown): GradeEventPublishError {
    return error instanceof GradeEventPublishError
      ? error
      : new GradeEventPublishError('BROKER_UNAVAILABLE');
  }

  // Chỉ log tên loại và mã lỗi, không log message vì có thể chứa địa chỉ/credential của broker.
  private describe(source: 'connection' | 'channel', error: Error & { code?: string }): string {
    return `RabbitMQ ${source} lỗi (code=${error.code ?? 'unknown'})`;
  }
}
