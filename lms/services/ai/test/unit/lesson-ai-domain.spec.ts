import { DocxMarkdownExtractor } from '../../src/adapters/documents/docx-markdown-extractor.js';
import {
  classifyDocument,
  EXTRACTION_TRUNCATED_NOTE,
  AI_LIMITS,
  limitExtractedText,
  truncateErrorMessage,
} from '../../src/domain/lesson-ai.js';
import { zipWithDocument } from '../support/docx.js';

describe('classifyDocument', () => {
  it('ưu tiên MIME, sau đó đuôi tệp; định dạng lạ trả null', () => {
    expect(classifyDocument('a.bin', 'application/pdf')).toBe('PDF');
    expect(classifyDocument('Bai.MD', 'application/octet-stream')).toBe('TEXT');
    expect(classifyDocument('a', 'text/plain; charset=utf-8')).toBe('TEXT');
    expect(classifyDocument('a.docx', 'application/octet-stream')).toBe('DOCX');
    expect(classifyDocument('anh.JPG', 'application/octet-stream')).toBe('IMAGE');
    expect(classifyDocument('a.png', 'image/png')).toBe('IMAGE');
    expect(classifyDocument('phim.mp4', 'video/mp4')).toBeNull();
    expect(classifyDocument('khong-duoi', 'application/zip')).toBeNull();
  });
});

describe('giới hạn văn bản', () => {
  it('cắt văn bản dài hơn giới hạn và ghi chú, giữ nguyên văn bản ngắn', () => {
    expect(limitExtractedText('ngắn')).toBe('ngắn');
    const cut = limitExtractedText('a'.repeat(AI_LIMITS.maxExtractedChars + 1));
    expect(cut).toBe('a'.repeat(AI_LIMITS.maxExtractedChars) + EXTRACTION_TRUNCATED_NOTE);
    expect(truncateErrorMessage('x'.repeat(600))).toHaveLength(500);
  });
});

describe('DocxMarkdownExtractor', () => {
  const p = (text: string, props = ''): string =>
    `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const xml = `<?xml version="1.0"?><w:document><w:body>
    ${p('Giới thiệu', '<w:pStyle w:val="Heading1"/>')}
    ${p('Đoạn &amp; văn bản &lt;tag&gt;')}
    ${p('Mục một', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}
    ${p('Mục hai', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}
    <w:tbl>
      <w:tr><w:tc>${p('Cột A')}</w:tc><w:tc>${p('Cột B')}</w:tc></w:tr>
      <w:tr><w:tc>${p('1')}</w:tc><w:tc>${p('x | y')}</w:tc></w:tr>
    </w:tbl>
    <w:p></w:p>
    ${p('Kết luận', '<w:pStyle w:val="Heading2"/>')}
  </w:body></w:document>`;

  it('chuyển tiêu đề, danh sách, bảng và đoạn văn thành Markdown (cả entry nén và không nén)', () => {
    const extractor = new DocxMarkdownExtractor();
    const expected = [
      '# Giới thiệu',
      'Đoạn & văn bản <tag>',
      '- Mục một\n- Mục hai',
      '| Cột A | Cột B |\n| --- | --- |\n| 1 | x \\| y |',
      '## Kết luận',
    ].join('\n\n');

    expect(extractor.toMarkdown(zipWithDocument(xml, 8))).toBe(expected);
    expect(extractor.toMarkdown(zipWithDocument(xml, 0))).toBe(expected);
  });

  it('tệp không phải zip hoặc thiếu word/document.xml thì ném lỗi', () => {
    const extractor = new DocxMarkdownExtractor();

    expect(() => extractor.toMarkdown(new TextEncoder().encode('không phải docx'))).toThrow();
    const wrongName = zipWithDocument(xml2(), 8, 'word/other.xml');
    expect(() => extractor.toMarkdown(wrongName)).toThrow('word/document.xml');
  });
});

function xml2(): string {
  return '<w:document><w:body></w:body></w:document>';
}
