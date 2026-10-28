import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import {
  Anonymous,
  CurrentPrincipal,
  type Page,
  parseInput,
  RawResponse,
  toPage,
} from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import { AppError } from '@aiops-lms/common/errors';
import {
  createUploadIntentRequestSchema,
  idSchema,
  listMediaLibraryQuerySchema,
  type MediaDto,
  type UploadIntentDto,
} from '@aiops-lms/contracts';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import multer from 'multer';

import { CompleteDirectUploadUseCase } from '../../../application/use-cases/media/complete-direct-upload.use-case.js';
import { CreateUploadIntentUseCase } from '../../../application/use-cases/media/create-upload-intent.use-case.js';
import { GetMediaContentUseCase } from '../../../application/use-cases/media/get-media-content.use-case.js';
import { GetMediaLibraryUseCase } from '../../../application/use-cases/media/get-media-library.use-case.js';
import { GetMediaThumbnailUseCase } from '../../../application/use-cases/media/get-media-thumbnail.use-case.js';
import { RetryMediaThumbnailUseCase } from '../../../application/use-cases/media/retry-media-thumbnail.use-case.js';
import { UploadMediaUseCase } from '../../../application/use-cases/media/upload-media.use-case.js';
import { MEDIA_MULTIPART_MAX_BYTES } from '../../multipart-limit.js';
import { presentMedia } from '../shared/media.presenter.js';
import { streamMedia } from '../shared/stream-media.js';

interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Controller(`${PUBLIC_PREFIX}/media`)
export class MediaController {
  constructor(
    @Inject(UploadMediaUseCase) private readonly uploadMedia: UploadMediaUseCase,
    @Inject(CreateUploadIntentUseCase) private readonly createIntent: CreateUploadIntentUseCase,
    @Inject(CompleteDirectUploadUseCase)
    private readonly completeUpload: CompleteDirectUploadUseCase,
    @Inject(GetMediaLibraryUseCase) private readonly library: GetMediaLibraryUseCase,
    @Inject(GetMediaContentUseCase) private readonly content: GetMediaContentUseCase,
    @Inject(GetMediaThumbnailUseCase) private readonly thumbnail: GetMediaThumbnailUseCase,
    @Inject(RetryMediaThumbnailUseCase) private readonly retryThumbnail: RetryMediaThumbnailUseCase,
  ) {}

  /** Upload multipart (field `file`) qua `media`; file lớn dùng `upload-intents`. */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: MEDIA_MULTIPART_MAX_BYTES.value, files: 1 },
    }),
  )
  async upload(
    @CurrentPrincipal() principal: Principal,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<MediaDto> {
    if (!file) throw AppError.validation('Thiếu file trong field "file"');
    return presentMedia(
      await this.uploadMedia.execute(principal, {
        content: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      }),
    );
  }

  @Post('upload-intents')
  async createUploadIntent(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<UploadIntentDto> {
    const input = parseInput(createUploadIntentRequestSchema, body);
    const intent = await this.createIntent.execute(principal, {
      fileName: input.file_name,
      mimeType: input.mime_type,
      sizeBytes: input.size_bytes,
      checksumSha256: input.checksum_sha256,
    });
    return {
      media_id: intent.mediaId,
      upload: { method: 'POST', url: intent.upload.url, fields: intent.upload.fields },
      expires_at: intent.upload.expiresAt.toISOString(),
    };
  }

  @Post(':media_id/upload-complete')
  @HttpCode(200)
  async uploadComplete(
    @CurrentPrincipal() principal: Principal,
    @Param('media_id') mediaId: string,
  ): Promise<MediaDto> {
    return presentMedia(
      await this.completeUpload.execute(principal, parseInput(idSchema, mediaId)),
    );
  }

  @Get('library')
  async getLibrary(
    @CurrentPrincipal() principal: Principal,
    @Query() query: unknown,
  ): Promise<Page<MediaDto>> {
    const input = parseInput(listMediaLibraryQuerySchema, query);
    const result = await this.library.execute(
      principal,
      { type: input.type, status: input.status, search: input.search },
      input.page,
      input.page_size,
    );
    return toPage(result, input, presentMedia);
  }

  /** Công khai: thẻ `<img>`/`<video>` không gửi được token. Vẫn cần service token của Gateway. */
  @Anonymous()
  @RawResponse()
  @Get(':media_id/content')
  async getContent(
    @Param('media_id') mediaId: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return streamMedia(await this.content.execute(parseInput(idSchema, mediaId), range), response);
  }

  @Anonymous()
  @RawResponse()
  @Get(':media_id/thumbnail')
  async getThumbnail(
    @Param('media_id') mediaId: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return streamMedia(
      await this.thumbnail.execute(parseInput(idSchema, mediaId), range),
      response,
    );
  }

  @Post(':media_id/thumbnail/retry')
  @HttpCode(200)
  async retry(
    @CurrentPrincipal() principal: Principal,
    @Param('media_id') mediaId: string,
  ): Promise<MediaDto> {
    return presentMedia(
      await this.retryThumbnail.execute(principal, parseInput(idSchema, mediaId)),
    );
  }
}
