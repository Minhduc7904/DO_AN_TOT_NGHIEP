# ADR-001 — Tái cấu trúc LMS testbed theo bộ service mới

| Trường | Nội dung |
| --- | --- |
| Trạng thái | Đề xuất (chờ Bách review) |
| Ngày | 27/10/2026 |
| Người đề xuất | Đức |
| Thay thế | Phần topology 8 runtime trong [service-catalogue-and-topology-v1](../architecture/service-catalogue-and-topology-v1.md) |
| Nguồn tham chiếu | Repo mẫu .NET `intern_be/ducnm3` (chỉ dùng làm đặc tả nghiệp vụ) |

## Bối cảnh

Testbed MVP (W5–W10) có 8 runtime, SQL viết tay bằng `pg`, schema tạo bằng `CREATE TABLE IF NOT EXISTS`, mỗi service dồn toàn bộ logic vào một lớp service, notification chỉ ghi log và storage là mock trong bộ nhớ. Quan sát đó chưa đủ phức tạp để tạo các case lỗi mà truy vết thủ công khó tìm ra nguyên nhân gốc (xem [ADR-002](adr-002-ai-primary-root-cause-analysis-v1.md)).

## Quyết định

1. **Bộ service mới: 9 service** — `gateway`, `auth`, `student`, `admin`, `course`, `media`, `notification`, `scheduler`, `ai` — cộng hai worker (`media-worker`, `notification-worker`) dùng chung image với entrypoint khác.
2. Bỏ `enrollment`, `submission`, `grading`, `submission-storage-mock`. Enrollment, tiến độ và quiz attempt chuyển vào `course`; lưu file dùng MinIO thật qua `media`.
3. Giữ NestJS/TypeScript. Dùng **Prisma + PostgreSQL 17**, mỗi service một database riêng; migration bằng `prisma migrate`, thay `migrate.ts`.
4. Mỗi use case là một class riêng (`application/use-cases/<area>/<verb-noun>.use-case.ts`, phương thức `execute`); controller chỉ ánh xạ HTTP sang use case.
5. Giữ `auth` riêng với JWT + refresh token + mật khẩu hiện có, mở rộng thành 3 role: `student`, `instructor`, `admin`.
6. `notification` gửi email thật qua SMTP (nodemailer; Mailpit cho dev/CI) và có inbox REST.
7. Bỏ Redis; kênh bất đồng bộ dùng RabbitMQ theo kiểu command (`service--message-type-kebab`) với outbox/inbox.
8. Tách thành phần thu thập dữ liệu sang `aiops-platform/` (xem ADR-002 và [tách observability](../plan/refactor/refactor-board-v1.md)); LMS chỉ gửi OTLP/HTTP tới collector.

## Hệ quả

- Phải viết lại bộ tài liệu kiến trúc, ma trận fault, test và CI; tên `service.name` mới được chốt ở `service-catalogue-v2` trước khi Bách dựng dataset.
- Dữ liệu telemetry thu trên topology cũ không dùng làm dataset chính thức.
- Hồ sơ W2–W10 giữ nguyên làm lịch sử.
- Rủi ro khối lượng: 2 tuần cho một người; theo dõi bằng mốc kiểm tra trong bảng task refactor.

## Phương án đã loại

- Giữ 8 runtime và chỉ thêm Prisma: không tạo được nghiệp vụ đủ phức tạp cho case RCA.
- Gộp `auth` vào `student`: loại để giữ cơ chế token hiện có và ranh giới trách nhiệm rõ.
- Dùng MySQL như repo mẫu: loại để giữ hạ tầng, CI và tài liệu PostgreSQL hiện có.
