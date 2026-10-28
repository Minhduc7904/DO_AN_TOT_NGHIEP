import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import {
  type SecretProtector,
  SecretUnreadableError,
} from '../../application/ports/secret-protector.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Mã hóa API key bằng AES-256-GCM. Định dạng lưu: base64 của `nonce(12) | tag(16) | ciphertext`.
 * Nonce ngẫu nhiên mỗi lần mã hóa nên cùng một plaintext cho hai ciphertext khác nhau; sửa
 * ciphertext/tag hoặc dùng sai khóa đều làm giải mã thất bại (`SecretUnreadableError`).
 */
export class AesGcmSecretProtector implements SecretProtector {
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== KEY_BYTES) {
      throw new Error(`Khóa mã hóa phải dài đúng ${KEY_BYTES} byte`);
    }
    this.key = Buffer.from(key);
  }

  /** Khóa dạng base64 (32 byte) lấy từ `AI_ENCRYPTION_KEY`. */
  static fromBase64(key: string): AesGcmSecretProtector {
    return new AesGcmSecretProtector(Buffer.from(key, 'base64'));
  }

  encrypt(plaintext: string): string {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, nonce, { authTagLength: TAG_BYTES });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const payload = Buffer.from(ciphertext, 'base64');
    if (payload.length < NONCE_BYTES + TAG_BYTES + 1) throw new SecretUnreadableError();
    const nonce = payload.subarray(0, NONCE_BYTES);
    const tag = payload.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
    const encrypted = payload.subarray(NONCE_BYTES + TAG_BYTES);
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, nonce, { authTagLength: TAG_BYTES });
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      // Không đưa lỗi gốc ra ngoài: thông điệp của OpenSSL không có ích và không được lẫn dữ liệu bí mật.
      throw new SecretUnreadableError();
    }
  }
}
