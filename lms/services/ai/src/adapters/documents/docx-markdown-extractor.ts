import { inflateRawSync } from 'node:zlib';

import { Injectable } from '@nestjs/common';

import type { DocxTextExtractor } from '../../application/ports/docx-text-extractor.js';

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
/** Chặn zip bomb: `word/document.xml` giải nén tối đa 50 MB. */
const MAX_DOCUMENT_XML_BYTES = 50 * 1024 * 1024;

/** Tìm entry trong zip (đọc central directory) rồi giải nén; `null` nếu không có. */
function readZipEntry(bytes: Buffer, wanted: string): Buffer | null {
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('Không phải tệp zip');

  const entryCount = bytes.readUInt16LE(eocd + 10);
  let cursor = bytes.readUInt32LE(eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_ENTRY) throw new Error('Zip hỏng');
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name !== wanted) continue;

    if (bytes.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) throw new Error('Zip hỏng');
    const dataStart =
      localOffset +
      30 +
      bytes.readUInt16LE(localOffset + 26) +
      bytes.readUInt16LE(localOffset + 28);
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_DOCUMENT_XML_BYTES });
    throw new Error('Phương thức nén không hỗ trợ');
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Văn bản của một đoạn: nối `w:t`, `w:tab` thành khoảng trắng, `w:br` thành xuống dòng. */
function paragraphText(paragraphXml: string): string {
  let text = '';
  for (const token of paragraphXml.matchAll(
    /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/?>/gu,
  )) {
    if (token[1] !== undefined) text += decodeEntities(token[1]);
    else text += token[0].startsWith('<w:tab') ? '\t' : '\n';
  }
  return text;
}

function headingLevel(paragraphXml: string): number | null {
  const style = /<w:pStyle\s+w:val="([^"]*)"/u.exec(paragraphXml)?.[1];
  const match = style ? /^(?:heading|Heading|Tiêu đề)\s*(\d)$/u.exec(style) : null;
  if (match?.[1]) return Math.min(6, Math.max(1, Number(match[1])));
  return style === 'Title' ? 1 : null;
}

function paragraphToMarkdown(paragraphXml: string): string {
  const text = paragraphText(paragraphXml).trim();
  if (text.length === 0) return '';
  const level = headingLevel(paragraphXml);
  if (level !== null) return `${'#'.repeat(level)} ${text}`;
  if (/<w:numPr>/u.test(paragraphXml)) return `- ${text}`;
  return text;
}

function tableToMarkdown(tableXml: string): string {
  const rows = [...tableXml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/gu)].map((row) =>
    [...row[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/gu)].map((cell) =>
      [...cell[0].matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/gu)]
        .map((paragraph) => paragraphText(paragraph[0]).trim())
        .filter((value) => value.length > 0)
        .join(' ')
        .replaceAll('|', '\\|'),
    ),
  );
  const [header, ...body] = rows;
  if (!header) return '';
  const width = header.length;
  return [
    `| ${header.join(' | ')} |`,
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

/**
 * Đọc `word/document.xml` của DOCX thành Markdown: tiêu đề (`Heading n`), danh sách (`w:numPr`), bảng
 * và đoạn văn. Không phụ thuộc thư viện ngoài; ảnh nhúng bị bỏ qua.
 */
@Injectable()
export class DocxMarkdownExtractor implements DocxTextExtractor {
  toMarkdown(input: Uint8Array): string {
    const xmlBytes = readZipEntry(Buffer.from(input), 'word/document.xml');
    if (!xmlBytes) throw new Error('Thiếu word/document.xml');
    const xml = xmlBytes.toString('utf8');
    const body = /<w:body>([\s\S]*)<\/w:body>/u.exec(xml)?.[1] ?? xml;

    const blocks: string[] = [];
    for (const block of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>/gu)) {
      const markdown = block[0].startsWith('<w:tbl>')
        ? tableToMarkdown(block[0])
        : paragraphToMarkdown(block[0]);
      if (markdown.length > 0) blocks.push(markdown);
    }
    // Các dòng danh sách liền nhau không cách dòng trống; phần còn lại ngăn cách bằng dòng trống.
    return blocks
      .reduce<string>(
        (output, block, index) =>
          index === 0
            ? block
            : `${output}${block.startsWith('- ') && blocks[index - 1]?.startsWith('- ') ? '\n' : '\n\n'}${block}`,
        '',
      )
      .trim();
  }
}
