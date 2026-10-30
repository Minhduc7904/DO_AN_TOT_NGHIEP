# `@aiops-lms/media` và `media-worker`

## Trách nhiệm

Sở hữu `media_db` và các bucket MinIO (`images`, `videos`, `documents`, `audios`, `other`): upload multipart và upload trực tiếp (presigned POST), thư viện media, stream nội dung (Range), thumbnail, usage (media gắn vào course/lesson/quiz/thông báo/avatar), job nền và thống kê. Một image, hai entrypoint: `media` (API, `dist/main.js`, cổng 3004) và `media-worker` (consumer RabbitMQ, `dist/worker.js`, cổng 3005 chỉ cho `/health` và `/ready`).

Route và mã lỗi: [`http-and-event-contracts-v2.md` §4.4](../../../docs/processed/architecture/http-and-event-contracts-v2.md); sở hữu dữ liệu: [`data-ownership-and-fault-matrix-v2.md` §2.4](../../../docs/processed/architecture/data-ownership-and-fault-matrix-v2.md).

## Cấu trúc

```text
src/domain/                      loại media, object key, Range, trích id media từ markdown, tiến độ job, lỗi
src/application/ports/           repository, MediaUnitOfWork, ObjectStorage, StudentClient (HTTP sang `identity`), ThumbnailRenderer
src/application/use-cases/       media/ usages/ jobs/ worker/ — mỗi use case một class
src/adapters/http/{public,internal,shared}
src/adapters/{persistence,storage,thumbnail,clients,messaging}
src/{main,bootstrap,app.module}.ts        API
src/{worker,worker-bootstrap,worker.module}.ts   worker
```

## Luồng đáng chú ý

- **Upload trực tiếp**: `upload-intents` tạo dòng `PENDING` và presigned POST ghim bucket, key `tmp/{uuid}.{ext}`, content-type và đúng kích thước; client tải thẳng lên MinIO; `upload-complete` kiểm tra kích thước và SHA-256, suy MIME từ nội dung (khác loại đã khai báo thì `FAILED` và `415 MEDIA_MIME_MISMATCH`), copy sang key cuối `yyyy/MM/dd/{uuid}.{ext}` (UTC), xóa `tmp/`, đặt `READY` và ghi command thumbnail vào outbox cùng transaction.
- **MIME do server quyết định**: `src/domain/mime-detection.ts` suy MIME từ chữ ký byte của 64 KiB đầu (ảnh, PDF, Office, video, audio, văn bản UTF-8); `Content-Type` của multipart bị bỏ qua và `mime_type` của `upload-intents` chỉ là gợi ý chọn bucket và mức dung lượng. Chi tiết và giới hạn: [http-and-event-contracts-v2 §4.4](../../../docs/processed/architecture/http-and-event-contracts-v2.md).
- **Thumbnail**: worker render ngoài transaction (ảnh bằng `sharp`, video bằng `ffmpeg` lấy một khung hình) rồi ghi một dòng `media_objects` (`source_media_id`) ở bucket `images` và cập nhật `thumbnail_status` qua `runOnce` (inbox) nên command lặp không tạo trùng.
- **Usage**: ma trận `owner_kind` ↔ `usage_type`, loại chỉ nhận ảnh, singleton thay thế (`COURSE_THUMBNAIL`, `USER_AVATAR`, kèm partial unique index), xóa/sắp xếp lại chỉ do người tạo hoặc admin. Không bắt unique violation trong transaction PostgreSQL (transaction đã hỏng); dùng `createMany skipDuplicates`.
- **Đồng bộ markdown**: command `media.markdown-usage.synchronize` so tập media id tham chiếu (`/media/{uuid}/(content|thumbnail)`) với usage hiện có và thêm/xóa phần chênh. Job `NOTIFICATION_USAGE` chịu được command đến sai thứ tự (`evaluateJobStatus`).
- **Cleanup** (`POST /internal/v1/media/cleanup`, scope `media:cleanup`, caller `scheduler-worker`): `CleanupMediaUseCase`, idempotent, ba pha trong mỗi lần gọi (mỗi pha tối đa `limit` media). (1) Upload `PENDING` stale (quá hạn presigned cộng `pending_grace_minutes`): xóa object tạm và object cuối mồ côi còn sót, chuyển `FAILED` với `failure_reason=UPLOAD_ABANDONED`. (2) Media gốc `READY` không còn usage nào, `created_at` và `updated_at` đều cũ hơn `retention_hours`: xóa mềm (`deleted_at`) cùng thumbnail của nó (dòng `source_media_id`, usage `MEDIA_THUMBNAIL`) rồi xóa object khỏi MinIO. (3) Thumbnail mồ côi (media gốc đã xóa mềm mà thumbnail chưa). Mỗi media xử lý trong transaction riêng: khóa dòng `FOR UPDATE SKIP LOCKED`, kiểm lại điều kiện và đếm usage **sau khi giữ khóa**, ghi DB rồi xóa object; MinIO lỗi thì rollback, media giữ nguyên và được thử lại ở lần sau. Media còn usage (kể cả singleton `COURSE_THUMBNAIL`, `USER_AVATAR`) không bao giờ bị chọn; object đã mất sẵn không phải lỗi. Thời gian lưu giữ tính từ lúc tạo/cập nhật media, không phải từ lúc usage cuối cùng bị gỡ. Phản hồi chỉ có số lượng (`unused_deleted`, `thumbnails_deleted`, `objects_removed`, `pending_recovered`, `pending_orphan_objects_removed`, `skipped`, `failed`, `has_more`), không có object key. Mặc định và biên của tham số do `MEDIA_CLEANUP_*` quyết định.
- **Cờ `extract_text` (R-08)**: `upload-intents` (JSON `extract_text`, mặc định `false`) và `POST /api/v1/media` (multipart field `extract_text` = `true|false`) yêu cầu `ai` trích văn bản tệp. Chỉ hợp lệ cho tệp ai đọc được (`isExtractableDocument`: TXT/MD, DOCX, PDF, ảnh; bảng sao chép từ `ai`) và ≤ 15 MB (`EXTRACT_TEXT_MAX_BYTES`), nếu không 400 `VALIDATION_ERROR`; giá trị không phải boolean cũng 400. Cờ lưu ở `media_objects.extract_text` (migration `20261028100000_media_extract_text`). Khi media thành `READY` (upload multipart hoặc `upload-complete`) command `ai.document.extract` được ghi vào outbox **cùng transaction**; media `FAILED` thì không có command. Media chỉ gọi `ai` bằng command, không có cạnh HTTP.
- **Outbox**: relay chạy trong process API bằng `OutboxRelayLoop`; worker không publish.

## Chạy test

```bash
pnpm --filter @aiops-lms/media build
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/media/jest.config.ts   # unit
pnpm run test:media:e2e   # cần MEDIA_DATABASE_URL (đã migrate), MinIO và RabbitMQ thật
```
