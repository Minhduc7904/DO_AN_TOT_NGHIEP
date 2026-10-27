/**
 * Circuit breaker đơn giản cho lời gọi HTTP giữa service.
 *
 * Retry mặc định OFF (xem contract v2 §1) nên breaker là lựa chọn resilience thay thế: sau
 * `failureThreshold` lỗi liên tiếp, breaker mở trong `cooldownMs` và request tiếp theo bị
 * short-circuit thành lỗi dependency ngay (không gọi mạng). Sau cooldown, breaker half-open: đúng
 * một request được thử (probe); thành công thì đóng, thất bại thì mở lại cooldown.
 */
export interface CircuitBreakerOptions {
  cooldownMs: number;
  failureThreshold: number;
}

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private halfOpenProbeInFlight = false;

  constructor(private readonly options: CircuitBreakerOptions) {}

  /** true nếu request được phép đi ra network; false nếu phải short-circuit ngay. */
  allowRequest(now = Date.now()): boolean {
    if (this.openedAt === null) return true;
    if (now - this.openedAt < this.options.cooldownMs) return false;
    if (this.halfOpenProbeInFlight) return false;
    this.halfOpenProbeInFlight = true;
    return true;
  }

  onSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.halfOpenProbeInFlight = false;
  }

  onFailure(now = Date.now()): void {
    this.consecutiveFailures += 1;
    this.halfOpenProbeInFlight = false;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.openedAt = now;
    }
  }
}
