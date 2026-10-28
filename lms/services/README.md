# Business services

## Trách nhiệm

Chứa Gateway và các LMS business service deploy độc lập. Mỗi service sở hữu source code, runtime configuration, Dockerfile và test của chính nó.

## Quy tắc dependency

- Được dùng shared technical package và published contract dưới `lms/packages/` hoặc `lms/contracts/`.
- Không được import controller, entity, repository hoặc source code của service khác.
- Không đặt business model dùng chung tại workspace root.

## Cấu trúc một service v2

```text
src/domain/ → src/application/{ports,use-cases/<area>/<verb-noun>.use-case.ts}
           → src/adapters/{http/{public,internal,open,shared},persistence,clients,messaging,storage,mail}
prisma/{schema.prisma,migrations/}   prisma.config.ts   Dockerfile
```

Mỗi use case một class có method `execute`; controller chỉ map HTTP ↔ `execute()`.

### Hai bề mặt HTTP (ADR-004)

| Thư mục                   | Prefix                                | Ai gọi       | Decorator                       |
| ------------------------- | ------------------------------------- | ------------ | ------------------------------- |
| `adapters/http/public/`   | `${PUBLIC_PREFIX}` (`/api/v1`)        | chỉ Gateway  | `@Roles(...)` / `@Anonymous()`  |
| `adapters/http/internal/` | `${INTERNAL_PREFIX}` (`/internal/v1`) | service khác | `@InternalApi({ scopes })`      |
| `adapters/http/open/`     | tùy (JWKS…)                           | hạ tầng      | `@SkipAuth()`                   |
| `adapters/http/shared/`   | —                                     | —            | presenter dùng chung hai bề mặt |

Mọi request, kể cả route public, phải mang service access token (guard `ServiceAuthGuard` toàn cục). Client gọi service khác nằm ở `adapters/clients/` và dùng `HttpQueryClient` với `auth: { audience, tokens }`. `public/` và `internal/` không import nhau (ESLint); `lms/test/http-surface.test.mjs` kiểm tra thư mục, prefix và decorator. Tạo service mới bằng `pnpm new-service <name> --port <port>` (template ở `lms/templates/service/`); `student` là service mẫu đầy đủ, `course` là service lớn nhất (30 use case). Service v1 còn lại: `notification` (thay ở R-07); `enrollment`, `submission`, `grading`, `submission-storage-mock` đã bị gỡ ở R-05.

## Thay thế README

README này tiếp tục giữ vai trò quy ước chung khi các service mới được tạo từ task tuần tương ứng.
