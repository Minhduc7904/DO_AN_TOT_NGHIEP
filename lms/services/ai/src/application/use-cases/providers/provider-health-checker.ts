import type {
  AiStatus,
  HealthStatus,
  ProviderCredential,
  ProviderKind,
} from '../../../domain/ai.js';
import type { Clock } from '@aiops-lms/common/ports';
import type { ProviderProbe } from '../../ports/provider-client.js';
import type { SecretProtector } from '../../ports/secret-protector.js';
import { SecretUnreadableError } from '../../ports/secret-protector.js';

export interface ProviderHealth {
  providerId: string;
  name: string;
  providerType: ProviderKind;
  baseUrl: string;
  providerStatus: AiStatus;
  healthStatus: HealthStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  /** Mô tả ngắn, không chứa API key, host nội bộ hay nội dung response của provider. */
  message: string;
  checkedAt: Date;
}

const MESSAGES: Record<HealthStatus, string> = {
  ONLINE: 'Provider phản hồi bình thường',
  AUTH_FAILED: 'Provider từ chối API key',
  UNREACHABLE: 'Không kết nối được hoặc provider không phản hồi kịp',
  ERROR: 'Provider trả lỗi không mong đợi',
  DISABLED: 'Provider đang INACTIVE nên không được kiểm tra',
};

/** Kiểm tra kết nối một provider; provider `INACTIVE` không bị gọi ra ngoài. Không ghi database. */
export class ProviderHealthChecker {
  constructor(
    private readonly secrets: SecretProtector,
    private readonly probe: ProviderProbe,
    private readonly clock: Clock,
  ) {}

  async check(provider: ProviderCredential): Promise<ProviderHealth> {
    const base = {
      providerId: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      providerStatus: provider.status,
    };
    if (provider.status === 'INACTIVE') {
      return this.result(base, 'DISABLED', null, null);
    }

    let apiKey: string;
    try {
      apiKey = this.secrets.decrypt(provider.apiKeyEncrypted);
    } catch (error) {
      if (!(error instanceof SecretUnreadableError)) throw error;
      return this.result(base, 'ERROR', null, null, 'Không giải mã được API key đã lưu');
    }

    const probed = await this.probe.check({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey,
    });
    const status: HealthStatus =
      probed.outcome === 'ok'
        ? 'ONLINE'
        : probed.outcome === 'auth-failed'
          ? 'AUTH_FAILED'
          : probed.outcome === 'unreachable'
            ? 'UNREACHABLE'
            : 'ERROR';
    return this.result(base, status, probed.httpStatus, probed.latencyMs);
  }

  private result(
    base: Pick<
      ProviderHealth,
      'providerId' | 'name' | 'providerType' | 'baseUrl' | 'providerStatus'
    >,
    healthStatus: HealthStatus,
    httpStatus: number | null,
    latencyMs: number | null,
    message: string = MESSAGES[healthStatus],
  ): ProviderHealth {
    return {
      ...base,
      healthStatus,
      httpStatus,
      latencyMs,
      message,
      checkedAt: this.clock.now(),
    };
  }
}
