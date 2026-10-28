import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AppError } from '@aiops-lms/common/errors';
import sharp from 'sharp';

import type { ObjectStorage } from '../../application/ports/object-storage.js';
import type { ThumbnailRenderer } from '../../application/ports/thumbnail-renderer.js';
import type { MediaType } from '../../domain/media.js';

export interface ThumbnailOptions {
  maxEdgePx: number;
  quality: number;
  ffmpegPath: string;
  ffmpegTimeoutMs: number;
}

/** Ảnh: resize bằng sharp. Video: lấy một khung hình bằng ffmpeg rồi resize như ảnh. */
export class SharpThumbnailRenderer implements ThumbnailRenderer {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly options: ThumbnailOptions,
  ) {}

  async render(input: { type: MediaType; bucket: string; key: string }): Promise<Buffer> {
    const source =
      input.type === 'VIDEO'
        ? await this.firstFrame(input.bucket, input.key)
        : await this.readAll(input.bucket, input.key);
    return sharp(source, { failOn: 'error' })
      .rotate()
      .resize({
        width: this.options.maxEdgePx,
        height: this.options.maxEdgePx,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: this.options.quality })
      .toBuffer();
  }

  private async readAll(bucket: string, key: string): Promise<Buffer> {
    const { stream } = await this.storage.get(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  private async firstFrame(bucket: string, key: string): Promise<Buffer> {
    const directory = await mkdtemp(path.join(tmpdir(), 'media-thumb-'));
    try {
      const file = path.join(directory, 'source');
      await this.storage.download(bucket, key, file);
      return await this.runFfmpeg(file);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private runFfmpeg(file: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn(
        this.options.ffmpegPath,
        [
          '-v',
          'error',
          '-i',
          file,
          '-frames:v',
          '1',
          '-f',
          'image2pipe',
          '-vcodec',
          'png',
          'pipe:1',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => child.kill('SIGKILL'), this.options.ffmpegTimeoutMs);
      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        const output = Buffer.concat(chunks);
        if (code === 0 && output.length > 0) resolve(output);
        else reject(new AppError('THUMBNAIL_RENDER_FAILED', 500, `ffmpeg thoát với mã ${code}`));
      });
    });
  }
}
