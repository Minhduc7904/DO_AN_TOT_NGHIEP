# Upload media và dọn media không dùng v1

> **Trạng thái:** giữ chỗ — chưa viết.
>
> **Service tham gia:** `media`, `media-worker`, `scheduler`, `scheduler-worker`

Phạm vi dự kiến: Upload trực tiếp lên MinIO, thumbnail, usage markdown, job `MEDIA_UNUSED_CLEANUP`; trace mẫu: `http-media-upload`, `async-markdown-usage`, `scheduler-media-cleanup`.

Nội dung viết theo [workflow-template](../templates/workflow-template.md).
