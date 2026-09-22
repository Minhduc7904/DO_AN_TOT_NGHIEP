/**
 * Circuit breaker đơn giản cho lời gọi Enrollment→Course.
 *
 * Policy canonical (`data-ownership-and-fault-matrix-v1.md` §4.2) quy định retry OFF mặc định
 * trong MVP, nên đây là lựa chọn resilience thay cho retry: sau `failureThreshold` lỗi liên tiếp,
 * breaker mở trong `cooldownMs` và request tiếp theo được short-circuit thành lỗi dependency ngay
 * lập tức (không gọi mạng), tránh dồn timeout khi Course đang gặp sự cố. Sau cooldown, breaker vào
 * trạng thái half-open: đúng một request được phép đi thử (probe); các request khác vẫn bị
 * short-circuit cho đến khi probe đó thành công (đóng breaker) hoặc thất bại (mở lại cooldown).
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

  /** Trả về true nếu request được phép đi ra network; false nếu phải short-circuit ngay. */
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
