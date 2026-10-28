import type { Readable } from 'node:stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectStat {
  sizeBytes: number;
  contentType: string | null;
}

export interface ObjectRange {
  start: number;
  /** Chỉ số byte cuối (bao gồm). */
  end: number;
}

export interface ObjectContent {
  stream: Readable;
  sizeBytes: number;
  contentType: string | null;
}

/** MinIO do `media` sở hữu; không service khác truy cập. */
export interface ObjectStorage {
  presignUpload(input: {
    bucket: string;
    key: string;
    contentType: string;
    sizeBytes: number;
    expiresInSeconds: number;
  }): Promise<PresignedUpload>;
  stat(bucket: string, key: string): Promise<ObjectStat | null>;
  /** SHA-256 hex của object, tính theo stream. */
  sha256(bucket: string, key: string): Promise<string>;
  put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
  copy(bucket: string, fromKey: string, toKey: string): Promise<void>;
  remove(bucket: string, key: string): Promise<void>;
  get(bucket: string, key: string, range?: ObjectRange): Promise<ObjectContent>;
  /** Tải object về file cục bộ (video cho ffmpeg). */
  download(bucket: string, key: string, filePath: string): Promise<void>;
  ping(): Promise<void>;
}
