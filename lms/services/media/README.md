# `@aiops-lms/media` và `media-worker`

## Trách nhiệm

Sở hữu `media_db` và các bucket MinIO (`images`, `videos`, `documents`, `audios`, `other`): upload multipart và upload trực tiếp (presigned POST), thư viện media, stream nội dung (Range), thumbnail, usage (media gắn vào course/lesson/quiz/thông báo/avatar), job nền và thống kê. Một image, hai entrypoint: `media` (API, `dist/main.js`, cổng 3004) và `media-worker` (consumer RabbitMQ, `dist/worker.js`, cổng 3005 chỉ cho `/health` và `/ready`).

Route và mã lỗi: [`http-and-event-contracts-v2.md` §4.4](../../../docs/processed/architecture/http-and-event-contracts-v2.md); sở hữu dữ liệu: [`data-ownership-and-fault-matrix-v2.md` §2.4](../../../docs/processed/architecture/data-ownership-and-fault-matrix-v2.md).

## Cấu trúc

```text
src/domain/                      loại media, object key, Range, trích id media từ markdown, tiến độ job, lỗi
src/application/ports/           repository, MediaUnitOfWork, ObjectStorage, StudentClient, ThumbnailRenderer
src/application/use-cases/       media/ usages/ jobs/ worker/ — mỗi use case một class
src/adapters/http/{public,internal,shared}
src/adapters/{persistence,storage,thumbnail,clients,messaging}
src/{main,bootstrap,app.module}.ts        API
src/{worker,worker-bootstrap,worker.module}.ts   worker
```

## Luồng đáng chú ý

- **Upload trực tiếp**: `upload-intents` tạo dòng `PENDING` và presigned POST ghim bucket, key `tmp/{uuid}.{ext}`, content-type và đúng kích thước; client tải thẳng lên MinIO; `upload-complete` kiểm tra kích thước và SHA-256, copy sang key cuối `yyyy/MM/dd/{uuid}.{ext}` (UTC), xóa `tmp/`, đặt `READY` và ghi command thumbnail vào outbox cùng transaction.
- **Thumbnail**: worker render ngoài transaction (ảnh bằng `sharp`, video bằng `ffmpeg` lấy một khung hình) rồi ghi một dòng `media_objects` (`source_media_id`) ở bucket `images` và cập nhật `thumbnail_status` qua `runOnce` (inbox) nên command lặp không tạo trùng.
- **Usage**: ma trận `owner_kind` ↔ `usage_type`, loại chỉ nhận ảnh, singleton thay thế (`COURSE_THUMBNAIL`, `STUDENT_AVATAR`, kèm partial unique index), xóa/sắp xếp lại chỉ do người tạo hoặc admin. Không bắt unique violation trong transaction PostgreSQL (transaction đã hỏng); dùng `createMany skipDuplicates`.
- **Đồng bộ markdown**: command `media.markdown-usage.synchronize` so tập media id tham chiếu (`/media/{uuid}/(content|thumbnail)`) với usage hiện có và thêm/xóa phần chênh. Job `NOTIFICATION_USAGE` chịu được command đến sai thứ tự (`evaluateJobStatus`).
- **Outbox**: relay chạy trong process API bằng `OutboxRelayLoop`; worker không publish.

## Chạy test

```bash
pnpm --filter @aiops-lms/media build
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/media/jest.config.ts   # unit
pnpm run test:media:e2e   # cần MEDIA_DATABASE_URL (đã migrate), MinIO và RabbitMQ thật
```
