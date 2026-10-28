export const SECRET_PROTECTOR = Symbol('SECRET_PROTECTOR');

/** Giải mã thất bại: sai khóa, ciphertext bị sửa hoặc sai định dạng. Không mang plaintext hay ciphertext. */
export class SecretUnreadableError extends Error {
  constructor() {
    super('Không giải mã được secret đã lưu');
    this.name = 'SecretUnreadableError';
  }
}

/** Mã hóa đối xứng có xác thực cho API key của provider. */
export interface SecretProtector {
  encrypt(plaintext: string): string;
  /** @throws SecretUnreadableError khi không giải mã/xác thực được. */
  decrypt(ciphertext: string): string;
}
