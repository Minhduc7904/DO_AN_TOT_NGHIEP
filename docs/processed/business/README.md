# Tài liệu nghiệp vụ

> **Trạng thái:** domain identity đã viết (chờ Đức xác nhận); các domain và workflow còn lại là file giữ chỗ.
>
> **Phạm vi:** mô tả hành vi mà người dùng và hệ thống nhìn thấy (luồng, trạng thái, quy tắc ràng buộc, ngoại lệ). Contract HTTP/command, ownership dữ liệu và topology thuộc [architecture](../architecture/); tài liệu ở đây chỉ link sang, không chép lại.

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| [glossary-v1.md](glossary-v1.md) | Thuật ngữ và enum trạng thái dùng chung. |
| [templates/](templates/) | Mẫu viết luồng nghiệp vụ và quy tắc domain. |
| [domains/](domains/) | Quy tắc nghiệp vụ theo service sở hữu: `identity`, `course`, `media`, `notification`, `ai`, `scheduler`. |
| [workflows/](workflows/) | Luồng đặc biệt đi qua nhiều service, mỗi luồng một file. |

## Quy ước

- Tên file tiếng Anh, chữ thường, `kebab-case`, hậu tố `-v<n>` khi có phiên bản; nội dung tiếng Việt ([naming-rules](../rules/naming-rules.md)).
- Một luồng đặc biệt dùng một file trong `workflows/`; quy tắc dùng chung của một domain nằm trong `domains/<service>/`.
- Mỗi quy tắc phải trỏ về nơi kiểm chứng: use case hoặc test trong `lms/`, hoặc luồng trace trong [complex-case-catalogue-and-rca-result-v0](../architecture/complex-case-catalogue-and-rca-result-v0.md).
- Đổi hành vi nghiệp vụ thì sửa tại chỗ khi tài liệu chưa được xác nhận; sau khi Đức xác nhận thì viết file `-v<n+1>`, giữ bản cũ kèm banner "Đã được thay thế" như các tài liệu kiến trúc.

## Mục lục

| Tài liệu | Loại | Service sở hữu | Trạng thái |
| --- | --- | --- | --- |
| [ai-lesson-authoring-v1](workflows/ai-lesson-authoring-v1.md) | workflow | `course`, `ai`, `ai-worker` | Giữ chỗ |
| [media-upload-and-cleanup-v1](workflows/media-upload-and-cleanup-v1.md) | workflow | `media`, `media-worker`, `scheduler` | Giữ chỗ |
| [notification-batch-v1](workflows/notification-batch-v1.md) | workflow | `notification`, `notification-worker`, `identity` | Giữ chỗ |
| [service-token-expiry-v1](workflows/service-token-expiry-v1.md) | workflow | `identity`, `gateway` | Đề xuất — chờ Đức xác nhận |
| [domains/identity](domains/identity/README.md) | domain | `identity` | Đề xuất — chờ Đức xác nhận |
| [domains/identity/student-registration-v1](domains/identity/student-registration-v1.md) | domain | `identity` | Đề xuất — chờ Đức xác nhận |
| [domains/identity/login-v1](domains/identity/login-v1.md) | domain | `identity` | Đề xuất — chờ Đức xác nhận |
| [domains/identity/bootstrap-v1](domains/identity/bootstrap-v1.md) | domain | `identity` | Đề xuất — chờ Đức xác nhận |
| [domains/identity/business-rules-v1](domains/identity/business-rules-v1.md) | domain | `identity` | Đề xuất — chờ Đức xác nhận |
| [domains/course](domains/course/README.md) | domain | `course` | Giữ chỗ |
| [domains/media](domains/media/README.md) | domain | `media` | Giữ chỗ |
| [domains/notification](domains/notification/README.md) | domain | `notification` | Giữ chỗ |
| [domains/ai](domains/ai/README.md) | domain | `ai` | Giữ chỗ |
| [domains/scheduler](domains/scheduler/README.md) | domain | `scheduler` | Giữ chỗ |
