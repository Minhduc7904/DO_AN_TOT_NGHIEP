import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageClient } from '../../application/ports/storage-client.js';
import { requestDependency } from './dependency-http.js';

@Injectable()
export class StorageHttpClient extends StorageClient {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async store(objectKey: string, content: string): Promise<void> {
    await requestDependency({
      baseUrl: this.config.getOrThrow<string>('SUBMISSION_STORAGE_BASE_URL'),
      body: { content },
      dependency: 'submission-storage',
      method: 'PUT',
      operation: 'put',
      path: `/api/v1/objects/${encodeURIComponent(objectKey)}`,
      timeoutMs: this.config.getOrThrow<number>('SUBMISSION_DEPENDENCY_TIMEOUT_MS'),
    });
  }
}
