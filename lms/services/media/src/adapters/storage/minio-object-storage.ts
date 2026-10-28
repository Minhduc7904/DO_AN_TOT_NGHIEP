import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import { AppError } from '@aiops-lms/common/errors';
import { observeDependency } from '@aiops-lms/common/telemetry';
import { Client, PostPolicy } from 'minio';

import type {
  ObjectContent,
  ObjectRange,
  ObjectStat,
  ObjectStorage,
  PresignedUpload,
} from '../../application/ports/object-storage.js';

const DEPENDENCY = 'media-minio';
const REGION = 'us-east-1';

export interface MinioEndpoint {
  endPoint: string;
  port: number;
  useSSL: boolean;
}

export interface MinioObjectStorageOptions {
  internal: MinioEndpoint;
  /** Endpoint client trình duyệt truy cập được; chỉ dùng để ký presigned POST. */
  public: MinioEndpoint;
  accessKey: string;
  secretKey: string;
}

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'NotFound' || error.code === 'NoSuchKey');

/** Mọi lỗi MinIO thành `DEPENDENCY_UNAVAILABLE`; riêng "không có object" do bên gọi quyết định. */
function observe<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return observeDependency(DEPENDENCY, operation, async () => {
    try {
      return await run();
    } catch (error) {
      if (isNotFound(error) || error instanceof AppError) throw error;
      throw AppError.dependencyUnavailable(DEPENDENCY);
    }
  });
}

export class MinioObjectStorage implements ObjectStorage {
  private readonly client: Client;
  /** Client chỉ để ký URL cho trình duyệt: `region` cố định nên không gọi mạng khi ký. */
  private readonly signer: Client;

  constructor(options: MinioObjectStorageOptions) {
    const credentials = { accessKey: options.accessKey, secretKey: options.secretKey };
    this.client = new Client({ ...options.internal, ...credentials, region: REGION });
    this.signer = new Client({ ...options.public, ...credentials, region: REGION });
  }

  presignUpload(input: {
    bucket: string;
    key: string;
    contentType: string;
    sizeBytes: number;
    expiresInSeconds: number;
  }): Promise<PresignedUpload> {
    return observe('presign-upload', async () => {
      const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1_000);
      const policy = new PostPolicy();
      policy.setBucket(input.bucket);
      policy.setKey(input.key);
      policy.setExpires(expiresAt);
      policy.setContentType(input.contentType);
      policy.setContentLengthRange(input.sizeBytes, input.sizeBytes);
      const { postURL, formData } = await this.signer.presignedPostPolicy(policy);
      return { url: postURL, fields: formData, expiresAt };
    });
  }

  async stat(bucket: string, key: string): Promise<ObjectStat | null> {
    try {
      return await observe('stat-object', async () => {
        const stat = await this.client.statObject(bucket, key);
        const contentType = stat.metaData?.['content-type'];
        return {
          sizeBytes: stat.size,
          contentType: typeof contentType === 'string' ? contentType : null,
        };
      });
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  sha256(bucket: string, key: string): Promise<string> {
    return observe('hash-object', async () => {
      const stream = await this.client.getObject(bucket, key);
      const hash = createHash('sha256');
      for await (const chunk of stream as AsyncIterable<Buffer>) hash.update(chunk);
      return hash.digest('hex');
    });
  }

  put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    return observe('put-object', async () => {
      await this.client.putObject(bucket, key, body, body.length, { 'Content-Type': contentType });
    });
  }

  copy(bucket: string, fromKey: string, toKey: string): Promise<void> {
    return observe('copy-object', async () => {
      await this.client.copyObject(bucket, toKey, `/${bucket}/${fromKey}`);
    });
  }

  remove(bucket: string, key: string): Promise<void> {
    return observe('remove-object', () => this.client.removeObject(bucket, key));
  }

  get(bucket: string, key: string, range?: ObjectRange): Promise<ObjectContent> {
    return observe('get-object', async () => {
      const stat = await this.client.statObject(bucket, key);
      const contentType = stat.metaData?.['content-type'];
      const stream: Readable = range
        ? await this.client.getPartialObject(bucket, key, range.start, range.end - range.start + 1)
        : await this.client.getObject(bucket, key);
      return {
        stream,
        sizeBytes: stat.size,
        contentType: typeof contentType === 'string' ? contentType : null,
      };
    });
  }

  download(bucket: string, key: string, filePath: string): Promise<void> {
    return observe('download-object', () => this.client.fGetObject(bucket, key, filePath));
  }

  ping(): Promise<void> {
    return observe('ping', async () => {
      await this.client.bucketExists('images');
    });
  }
}
