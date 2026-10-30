import type { Clock, IdGenerator, Principal } from '@aiops-lms/common/ports';

import { mediaErrors } from '../../../domain/errors.js';
import type { MediaType } from '../../../domain/media.js';
import { BUCKET_BY_TYPE, classifyMedia, MEDIA_SIZE_LIMITS } from '../../../domain/media-type.js';
import { assertExtractTextAllowed } from '../../extract-text.js';
import { buildObjectKey, buildTmpObjectKey, safeExtension } from '../../../domain/object-key.js';
import type { ObjectStorage, PresignedUpload } from '../../ports/object-storage.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface CreateUploadIntentInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  /** Mặc định `false`. */
  extractText?: boolean;
}

export interface UploadIntent {
  mediaId: string;
  type: MediaType;
  upload: PresignedUpload;
}

/**
 * Tạo media `PENDING` và presigned POST để client upload thẳng lên MinIO (key tạm, ghim size/type).
 * `mimeType` chỉ là gợi ý để chọn bucket và mức dung lượng tối đa; MIME thật do server quyết định từ nội dung
 * khi `upload-complete` (xem CompleteDirectUpload).
 * `extractText` được lưu lại; lệnh trích văn bản chỉ phát khi tệp READY (xem CompleteDirectUpload).
 */
export class CreateUploadIntentUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly storage: ObjectStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly expiresInSeconds: number,
  ) {}

  async execute(principal: Principal, input: CreateUploadIntentInput): Promise<UploadIntent> {
    const type = classifyMedia(input.mimeType);
    const limit = MEDIA_SIZE_LIMITS[type];
    if (input.sizeBytes > limit) throw mediaErrors.tooLarge(limit);
    if (input.extractText)
      assertExtractTextAllowed(input.fileName, input.mimeType, input.sizeBytes);

    const id = this.ids.next();
    const now = this.clock.now();
    const extension = safeExtension(input.fileName);
    const bucket = BUCKET_BY_TYPE[type];
    const tmpKey = buildTmpObjectKey(id, extension);
    const upload = await this.storage.presignUpload({
      bucket,
      key: tmpKey,
      contentType: input.mimeType,
      sizeBytes: input.sizeBytes,
      expiresInSeconds: this.expiresInSeconds,
    });
    await this.uow.stores.media.create({
      id,
      type,
      status: 'PENDING',
      thumbnailStatus: 'NOT_APPLICABLE',
      originalName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      extractText: input.extractText === true,
      bucket,
      objectKey: buildObjectKey(now, id, extension),
      tmpObjectKey: tmpKey,
      uploadExpiresAt: upload.expiresAt,
      uploadedBy: principal.id,
    });
    return { mediaId: id, type, upload };
  }
}
