import { deflateRawSync } from 'node:zlib';

/** Dựng zip tối thiểu (một entry nén deflate) để thử parser DOCX không cần thư viện. */
export function zipWithDocument(
  documentXml: string,
  method: 0 | 8 = 8,
  entryName = 'word/document.xml',
): Buffer {
  const name = Buffer.from(entryName);
  const raw = Buffer.from(documentXml);
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  const localPart = Buffer.concat([local, name, data]);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, central, name, end]);
}
