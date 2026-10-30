import { classifyMedia } from '../../src/domain/media-type.js';
import { detectMime } from '../../src/domain/mime-detection.js';

const bytes = (...values: number[]): Buffer => Buffer.from(values);
const withTail = (head: Buffer): Buffer => Buffer.concat([head, Buffer.from('....noi dung....')]);

describe('detectMime', () => {
  it.each([
    ['PNG', withTail(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'a.bin', 'image/png'],
    ['JPEG', withTail(bytes(0xff, 0xd8, 0xff, 0xe0)), 'a.bin', 'image/jpeg'],
    ['GIF', Buffer.from('GIF89a....'), 'a.bin', 'image/gif'],
    ['WebP', Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '), 'a.bin', 'image/webp'],
    ['WAV', Buffer.from('RIFF\u0000\u0000\u0000\u0000WAVEfmt '), 'a.bin', 'audio/wav'],
    ['PDF', Buffer.from('%PDF-1.7\n...'), 'a.bin', 'application/pdf'],
    ['RTF', Buffer.from('{\\rtf1\\ansi'), 'a.bin', 'application/rtf'],
    ['MP4', Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftypisom')]), 'a.bin', 'video/mp4'],
    [
      'MOV',
      Buffer.concat([bytes(0, 0, 0, 0x14), Buffer.from('ftypqt  ')]),
      'a.bin',
      'video/quicktime',
    ],
    ['M4A', Buffer.concat([bytes(0, 0, 0, 0x14), Buffer.from('ftypM4A ')]), 'a.bin', 'audio/mp4'],
    ['WebM', withTail(bytes(0x1a, 0x45, 0xdf, 0xa3)), 'a.bin', 'video/webm'],
    ['Ogg', Buffer.from('OggS....'), 'a.bin', 'audio/ogg'],
    ['FLAC', Buffer.from('fLaC....'), 'a.bin', 'audio/flac'],
    ['MP3 (ID3)', Buffer.from('ID3....'), 'a.bin', 'audio/mpeg'],
    ['MP3 (frame)', withTail(bytes(0xff, 0xfb, 0x90, 0x00)), 'a.bin', 'audio/mpeg'],
  ])('nhận ra %s từ chữ ký byte, bất kể đuôi tệp', (_name, head, fileName, expected) => {
    expect(detectMime(head, fileName)).toBe(expected);
  });

  it('ZIP và OLE chỉ thành Office khi đuôi tệp khớp', () => {
    const zip = withTail(bytes(0x50, 0x4b, 0x03, 0x04));
    expect(detectMime(zip, 'bai.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(detectMime(zip, 'bang.xlsx')).toContain('spreadsheetml.sheet');
    expect(detectMime(zip, 'de.odt')).toBe('application/vnd.oasis.opendocument.text');
    expect(detectMime(zip, 'nen.zip')).toBe('application/zip');
    expect(detectMime(zip, 'khong-duoi')).toBe('application/zip');
    const ole = withTail(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1));
    expect(detectMime(ole, 'cu.doc')).toBe('application/msword');
    expect(detectMime(ole, 'cu.bin')).toBe('application/octet-stream');
  });

  it('văn bản UTF-8: text/plain, md và csv theo đuôi; không bao giờ HTML hay SVG', () => {
    expect(detectMime(Buffer.from('xin chào'), 'a.txt')).toBe('text/plain');
    expect(detectMime(Buffer.from('# Tiêu đề'), 'a.md')).toBe('text/markdown');
    expect(detectMime(Buffer.from('a,b\n1,2'), 'a.CSV')).toBe('text/csv');
    expect(detectMime(Buffer.from('<html><script>alert(1)</script></html>'), 'a.html')).toBe(
      'text/plain',
    );
    expect(detectMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'a.svg')).toBe(
      'text/plain',
    );
  });

  it('văn bản bị cắt giữa ký tự nhiều byte vẫn là văn bản', () => {
    const truncated = Buffer.from('à').subarray(0, 1);
    expect(detectMime(Buffer.concat([Buffer.from('abc'), truncated]), 'a.txt')).toBe('text/plain');
  });

  it('nhị phân lạ, có NUL hoặc rỗng là application/octet-stream', () => {
    expect(detectMime(bytes(0x00, 0x01, 0x02, 0xfe), 'a.png')).toBe('application/octet-stream');
    expect(detectMime(Buffer.from('abc\u0000def'), 'a.txt')).toBe('application/octet-stream');
    expect(detectMime(Buffer.alloc(0), 'a.txt')).toBe('application/octet-stream');
  });

  it('kết quả luôn phân loại được và không có loại ảnh/video giả từ tên tệp', () => {
    expect(classifyMedia(detectMime(Buffer.from('<svg/>'), 'a.svg'))).toBe('DOCUMENT');
    expect(classifyMedia(detectMime(bytes(0, 1, 2), 'a.mp4'))).toBe('OTHER');
  });
});
