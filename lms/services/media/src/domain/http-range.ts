export interface ByteRange {
  start: number;
  /** Chỉ số byte cuối (bao gồm). */
  end: number;
}

/**
 * Phân tích header `Range: bytes=a-b` cho một khoảng đơn. Trả `null` khi không có header (gửi cả
 * file), `'invalid'` khi không thỏa mãn được (416). Nhiều khoảng không được hỗ trợ và coi là không có.
 */
export function parseRange(header: string | undefined, size: number): ByteRange | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return 'invalid';
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (suffix === 0) return 'invalid';
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}
