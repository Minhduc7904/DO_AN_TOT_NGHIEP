# Business services

## Trách nhiệm

Chứa Gateway và các LMS business service deploy độc lập. Mỗi service sở hữu source code, runtime configuration, Dockerfile và test của chính nó.

## Quy tắc dependency

- Được dùng shared technical package và published contract dưới `lms/packages/` hoặc `lms/contracts/`.
- Không được import controller, entity, repository hoặc source code của service khác.
- Không đặt business model dùng chung tại workspace root.

## Cấu trúc một service v2

```text
src/domain/ → src/application/{ports,use-cases/<area>/<verb-noun>.use-case.ts} → src/adapters/{http,persistence,clients,messaging,storage,mail}
prisma/{schema.prisma,migrations/}   prisma.config.ts   Dockerfile
```

Mỗi use case một class có method `execute`; controller chỉ map HTTP ↔ `execute()`. Tạo service mới bằng `pnpm new-service <name> --port <port>` (template ở `lms/templates/service/`); `student` là service mẫu đầy đủ. Service v1 (`course`, `auth`, `gateway`, `enrollment`, `submission`, `grading`, `notification`, `submission-storage-mock`) được thay dần từ R-04 đến R-08 rồi xóa.

## Thay thế README

README này tiếp tục giữ vai trò quy ước chung khi các service mới được tạo từ task tuần tương ứng.
