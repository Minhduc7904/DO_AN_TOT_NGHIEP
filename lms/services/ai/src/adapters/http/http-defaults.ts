import type { NestExpressApplication } from '@nestjs/platform-express';

/** Request completion mang ảnh/PDF dạng base64 (tối đa 24 triệu ký tự) nên cần giới hạn body lớn hơn mặc định. */
export const JSON_BODY_LIMIT = '32mb';

/** Tạo app với `bodyParser: false` rồi gọi hàm này để dùng JSON parser có giới hạn lớn. */
export function applyBodyParsers(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
}
