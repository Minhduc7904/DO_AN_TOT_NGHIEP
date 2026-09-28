import { Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export interface NotificationConsumerFaultConfig {
  enabled: boolean;
  processingDelayMs: number;
}

export function createNotificationConsumerFaultConfig(
  config: Pick<ConfigService, 'getOrThrow'>,
): NotificationConsumerFaultConfig {
  return {
    enabled: config.getOrThrow<boolean>('NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED'),
    processingDelayMs: config.getOrThrow<number>('NOTIFICATION_CONSUMER_SLOWDOWN_MS'),
  };
}

@Injectable()
export class NotificationConsumerFault {
  private readonly config: NotificationConsumerFaultConfig;

  constructor(configService: ConfigService) {
    this.config = createNotificationConsumerFaultConfig(configService);
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.processingDelayMs > 0;
  }

  async beforeProcess(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, this.config.processingDelayMs);
    });
  }
}
