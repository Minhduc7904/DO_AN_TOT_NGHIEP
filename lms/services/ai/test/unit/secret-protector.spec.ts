import { randomBytes } from 'node:crypto';

import { SecretUnreadableError } from '../../src/application/ports/secret-protector.js';
import { AesGcmSecretProtector } from '../../src/adapters/security/aes-gcm-secret-protector.js';
import { apiKeyHint } from '../../src/domain/ai.js';

const API_KEY = 'sk-proj-abc123XYZ-secret-9876';

describe('AesGcmSecretProtector (mã hóa API key)', () => {
  const protector = new AesGcmSecretProtector(randomBytes(32));

  it('round-trip: giải mã ra đúng plaintext (kể cả ký tự Unicode)', () => {
    for (const secret of [API_KEY, 'khóa-tiếng-Việt-đặc-biệt-🔑', 'a']) {
      expect(protector.decrypt(protector.encrypt(secret))).toBe(secret);
    }
  });

  it('ciphertext không chứa plaintext và có định dạng nonce(12) | tag(16) | dữ liệu', () => {
    const ciphertext = protector.encrypt(API_KEY);

    const raw = Buffer.from(ciphertext, 'base64');
    expect(ciphertext).not.toContain(API_KEY);
    expect(raw.toString('utf8')).not.toContain(API_KEY);
    expect(raw.toString('latin1')).not.toContain('abc123');
    expect(raw.length).toBe(12 + 16 + Buffer.byteLength(API_KEY));
  });

  it('nonce ngẫu nhiên: cùng plaintext mã hóa 50 lần cho 50 ciphertext và 50 nonce khác nhau', () => {
    const ciphertexts = Array.from({ length: 50 }, () => protector.encrypt(API_KEY));
    const nonces = ciphertexts.map((value) =>
      Buffer.from(value, 'base64').subarray(0, 12).toString('hex'),
    );

    expect(new Set(ciphertexts).size).toBe(50);
    expect(new Set(nonces).size).toBe(50);
    for (const value of ciphertexts) expect(protector.decrypt(value)).toBe(API_KEY);
  });

  it('GCM tag sai hoặc ciphertext bị sửa thì giải mã thất bại', () => {
    const raw = Buffer.from(protector.encrypt(API_KEY), 'base64');

    const flip = (index: number): string => {
      const copy = Buffer.from(raw);
      copy[index] = (copy[index] ?? 0) ^ 0xff;
      return copy.toString('base64');
    };

    expect(() => protector.decrypt(flip(12))).toThrow(SecretUnreadableError); // tag
    expect(() => protector.decrypt(flip(12 + 16))).toThrow(SecretUnreadableError); // dữ liệu
    expect(() => protector.decrypt(flip(0))).toThrow(SecretUnreadableError); // nonce
  });

  it('khóa sai thì giải mã thất bại', () => {
    const ciphertext = protector.encrypt(API_KEY);

    expect(() => new AesGcmSecretProtector(randomBytes(32)).decrypt(ciphertext)).toThrow(
      SecretUnreadableError,
    );
  });

  it('ciphertext quá ngắn hoặc không phải base64 hợp lệ thì giải mã thất bại, lỗi không chứa dữ liệu', () => {
    for (const bad of ['', 'abc', 'không phải base64', Buffer.alloc(28).toString('base64')]) {
      expect(() => protector.decrypt(bad)).toThrow(SecretUnreadableError);
    }
    try {
      protector.decrypt(protector.encrypt(API_KEY).slice(0, -4));
    } catch (error) {
      expect(String(error)).not.toContain(API_KEY);
    }
  });

  it('chỉ nhận khóa đúng 32 byte; fromBase64 dùng cùng khóa', () => {
    expect(() => new AesGcmSecretProtector(randomBytes(31))).toThrow();
    const key = randomBytes(32);
    expect(
      AesGcmSecretProtector.fromBase64(key.toString('base64')).decrypt(
        new AesGcmSecretProtector(key).encrypt('x'),
      ),
    ).toBe('x');
  });
});

describe('apiKeyHint', () => {
  it('che đúng: "****" + 4 ký tự cuối, không lộ phần còn lại', () => {
    expect(apiKeyHint(API_KEY)).toBe('****9876');
    expect(apiKeyHint('12345678')).toBe('****5678');
    expect(apiKeyHint(API_KEY)).not.toContain('secret');
  });
});
