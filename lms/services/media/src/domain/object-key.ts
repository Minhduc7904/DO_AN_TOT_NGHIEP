/** Phần mở rộng an toàn cho object key: chữ thường/số, tối đa 10 ký tự, rỗng thì `bin`. */
export function safeExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const raw = dot >= 0 ? fileName.slice(dot + 1) : '';
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/gu, '');
  return cleaned.length > 0 && cleaned.length <= 10 ? cleaned : 'bin';
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Key cuối cùng `yyyy/MM/dd/{uuid}.{ext}`; ngày theo UTC để key không phụ thuộc múi giờ máy. */
export function buildObjectKey(now: Date, mediaId: string, extension: string): string {
  return `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}/${mediaId}.${extension}`;
}

/** Key tạm của upload trực tiếp, nằm trong cùng bucket với key cuối cùng cho phép copy nội bộ. */
export function buildTmpObjectKey(mediaId: string, extension: string): string {
  return `tmp/${mediaId}.${extension}`;
}
