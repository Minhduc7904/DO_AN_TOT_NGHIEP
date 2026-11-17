/**
 * Dựng body multipart/form-data cho upload trực tiếp lên MinIO (presigned POST) bằng byte thô.
 *
 * Không dùng object body của k6 vì S3/MinIO yêu cầu trường `file` đứng **cuối cùng**, còn thứ tự
 * trường của k6 khi tự dựng multipart không được bảo đảm. Không import module k6 nên test được bằng Node.
 */

/** Mã hóa chuỗi thành byte UTF-8 (goja của k6 không bảo đảm có TextEncoder). */
export function utf8(text) {
  const bytes = [];
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

export function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Trả `{ body: ArrayBuffer, contentType }`. `fields` giữ đúng thứ tự khai báo; tệp luôn ở cuối.
 * `file.content` là Uint8Array.
 */
export function buildMultipart(fields, file, boundary) {
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      utf8(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
    );
  }
  parts.push(
    utf8(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
        `Content-Type: ${file.type}\r\n\r\n`,
    ),
  );
  parts.push(file.content);
  parts.push(utf8(`\r\n--${boundary}--\r\n`));
  const bytes = concatBytes(parts);
  return {
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/** Giải mã base64 chuẩn thành Uint8Array (dùng cho ảnh PNG mẫu, không phụ thuộc k6/encoding). */
export function fromBase64(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = text.replace(/=+$/u, '');
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new RangeError(`Ký tự base64 không hợp lệ: ${char}`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** PNG 1x1 hợp lệ, đủ để `media-worker` sinh thumbnail WebP (cùng mẫu với regression). */
export const PNG_1X1 = fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);
