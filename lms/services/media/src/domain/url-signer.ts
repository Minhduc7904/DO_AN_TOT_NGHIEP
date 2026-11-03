import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignedUrlVariant = 'content' | 'thumbnail';

interface UrlSignerOptions {
  /** Khóa HMAC (`MEDIA_URL_SIGNING_KEY`); chỉ `media` giữ. */
  key: string;
  /** Thời gian sống tối thiểu của URL vừa ký. */
  ttlSeconds: number;
}

interface UrlSignature {
  exp: number;
  sig: string;
}

/**
 * Ký và xác minh URL media bằng HMAC-SHA256 trên `media_id|variant|exp`. `exp` làm tròn lên mốc `ttlSeconds` để
 * mọi URL ký trong cùng một cửa sổ giống hệt nhau (trình duyệt cache được); URL sống trong khoảng `[ttl, 2 × ttl)`.
 */
export class MediaUrlSigner {
  constructor(private readonly options: UrlSignerOptions) {}

  sign(mediaId: string, variant: SignedUrlVariant, now: Date): UrlSignature {
    const { ttlSeconds } = this.options;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const exp = Math.ceil((nowSeconds + ttlSeconds) / ttlSeconds) * ttlSeconds;
    return { exp, sig: this.mac(mediaId, variant, exp) };
  }

  /**
   * `true` khi chữ ký khớp và `exp` chưa qua. Giá trị thiếu, không phải chuỗi (query lặp tham số thành mảng),
   * `exp` không ở dạng chuẩn hoặc xa hơn `2 × ttl` đều là `false`.
   */
  verify(
    mediaId: string,
    variant: SignedUrlVariant,
    exp: unknown,
    sig: unknown,
    now: Date,
  ): boolean {
    if (typeof exp !== 'string' || typeof sig !== 'string' || !/^[1-9]\d{0,11}$/u.test(exp)) {
      return false;
    }
    const expSeconds = Number(exp);
    const nowMs = now.getTime();
    if (expSeconds * 1000 <= nowMs) return false;
    if (expSeconds * 1000 > nowMs + 2 * this.options.ttlSeconds * 1000) return false;
    const expected = Buffer.from(this.mac(mediaId, variant, expSeconds));
    const actual = Buffer.from(sig);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /** Query string đã ký, nối vào URL trần: `<url>?<query>`. */
  query(mediaId: string, variant: SignedUrlVariant, now: Date): string {
    const { exp, sig } = this.sign(mediaId, variant, now);
    return `exp=${exp}&sig=${sig}`;
  }

  private mac(mediaId: string, variant: SignedUrlVariant, exp: number): string {
    return createHmac('sha256', this.options.key)
      .update(`${mediaId}|${variant}|${exp}`)
      .digest('base64url');
  }
}
