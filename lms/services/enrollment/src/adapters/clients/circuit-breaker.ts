/**
 * Circuit breaker đơn giản cho lời gọi Enrollment→Course.
 *
 * Policy canonical (`data-ownership-and-fault-matrix-v1.md` §4.2) quy định retry OFF mặc định
 * trong MVP, nên đây là lựa chọn resilience thay cho retry: sau `failureThreshold` lỗi liên tiếp,
 * breaker mở trong `cooldownMs` và request tiếp theo được short-circuit thành lỗi dependency ngay
 * lập tức (không gọi mạng), tránh dồn timeout khi Course đang gặp sự cố. Sau cooldown, breaker vào
 * trạng thái half-open: request kế tiếp được thử lại bình thường và tự đóng nếu thành công.
 */
export interface CircuitBreakerOptions {
  cooldownMs: number;
  failureThreshold: number;
}

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private readonly options: CircuitBreakerOptions) {}

  isOpen(now = Date.now()): boolean {
    if (this.openedAt === null) return false;
    if (now - this.openedAt >= this.options.cooldownMs) return false;
    return true;
  }

  onSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  onFailure(now = Date.now()): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.openedAt = now;
    }
  }
}
