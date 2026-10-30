/** Số byte đầu của tệp mà `detectMime` cần đọc. */
export const MIME_SNIFF_BYTES = 64 * 1024;

const OPENXML = 'application/vnd.openxmlformats-officedocument.';
const OPENDOCUMENT = 'application/vnd.oasis.opendocument.';

/** Tệp ZIP chỉ được gọi là Office/OpenDocument khi đuôi tệp khớp (ZIP không có chữ ký riêng cho từng loại). */
const ZIP_FAMILY_BY_EXTENSION: Record<string, string> = {
  docx: `${OPENXML}wordprocessingml.document`,
  xlsx: `${OPENXML}spreadsheetml.sheet`,
  pptx: `${OPENXML}presentationml.presentation`,
  odt: `${OPENDOCUMENT}text`,
  ods: `${OPENDOCUMENT}spreadsheet`,
  odp: `${OPENDOCUMENT}presentation`,
};

/** Tệp Office cũ (OLE2) cũng chỉ phân biệt được bằng đuôi tệp. */
const OLE_BY_EXTENSION: Record<string, string> = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
};

const TEXT_BY_EXTENSION: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
};

const startsWith = (head: Buffer, bytes: readonly number[], offset = 0): boolean =>
  head.length >= offset + bytes.length &&
  bytes.every((byte, index) => head[offset + index] === byte);

const ascii = (head: Buffer, start: number, end: number): string =>
  head.toString('latin1', start, end);

const extensionOf = (fileName: string): string =>
  fileName.includes('.') ? (fileName.split('.').pop()?.toLowerCase() ?? '') : '';

/** Văn bản UTF-8 hợp lệ không chứa NUL; cho phép cắt giữa một ký tự nhiều byte ở cuối đoạn đọc. */
function isUtf8Text(head: Buffer): boolean {
  if (head.includes(0)) return false;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let trim = 0; trim <= 3 && trim < head.length; trim += 1) {
    try {
      decoder.decode(head.subarray(0, head.length - trim));
      return true;
    } catch {
      // thử lại với ít byte hơn: ký tự cuối có thể bị cắt
    }
  }
  return false;
}

/**
 * MIME do server quyết định từ nội dung (chữ ký byte), không tin giá trị client khai báo. Đuôi tệp chỉ dùng để
 * phân biệt các định dạng cùng chữ ký (ZIP/OLE → Office, văn bản → md/csv). Văn bản luôn là `text/*` thuần
 * (không bao giờ `text/html` hay `image/svg+xml`), mọi thứ không nhận ra là `application/octet-stream`.
 */
export function detectMime(head: Buffer, fileName: string): string {
  const extension = extensionOf(fileName);

  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(head, 0, 6) === 'GIF87a' || ascii(head, 0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(head, 0, 1024).includes('%PDF-')) return 'application/pdf';
  if (ascii(head, 0, 5) === '{\\rtf') return 'application/rtf';
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    return ZIP_FAMILY_BY_EXTENSION[extension] ?? 'application/zip';
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return OLE_BY_EXTENSION[extension] ?? 'application/octet-stream';
  }
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12);
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'M4A ' || brand === 'M4B ') return 'audio/mp4';
    return 'video/mp4';
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (ascii(head, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(head, 0, 4) === 'fLaC') return 'audio/flac';
  if (ascii(head, 0, 3) === 'ID3' || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0)) {
    return 'audio/mpeg';
  }
  if (head.length > 0 && isUtf8Text(head)) return TEXT_BY_EXTENSION[extension] ?? 'text/plain';
  return 'application/octet-stream';
}
