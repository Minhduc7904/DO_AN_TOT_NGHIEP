export const DOCX_TEXT_EXTRACTOR = Symbol('DOCX_TEXT_EXTRACTOR');

/** Đọc tệp DOCX thành Markdown ngay trong `ai-worker` (không tốn lượt gọi LLM). */
export interface DocxTextExtractor {
  /** Ném `Error` khi tệp không phải DOCX hợp lệ. */
  toMarkdown(bytes: Uint8Array): string;
}
