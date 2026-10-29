import { RabbitMqCommandPublisher, RabbitMqSession } from '@aiops-lms/common/messaging';
import { Logger } from '@nestjs/common';

export interface RabbitMqSettings {
  url: string;
  connectTimeoutMs: number;
  confirmTimeoutMs: number;
  /** Định danh dependency canonical của process, ví dụ `media-worker-rabbitmq`. */
  dependencyIdentity: string;
}

/** Một session + publisher cho process; consumer của worker dùng lại cùng session. */
export function createRabbitMq(
  settings: RabbitMqSettings,
  context: string,
): { session: RabbitMqSession; publisher: RabbitMqCommandPublisher } {
  const logger = new Logger(context);
  const session = new RabbitMqSession({
    url: settings.url,
    connectTimeoutMs: settings.connectTimeoutMs,
    onWarning: (message) => logger.warn(message),
  });
  return {
    session,
    publisher: new RabbitMqCommandPublisher(session, {
      confirmTimeoutMs: settings.confirmTimeoutMs,
      dependencyIdentity: settings.dependencyIdentity,
    }),
  };
}
