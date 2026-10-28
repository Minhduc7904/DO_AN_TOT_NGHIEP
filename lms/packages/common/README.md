# `@aiops-lms/common`

## Trách nhiệm

Primitive kỹ thuật dùng chung cho mọi service LMS v2: envelope lỗi, guard role, correlation id, health/readiness, HTTP client có timeout và circuit breaker, observe dependency, command envelope, outbox/inbox và RabbitMQ publisher/consumer.

## Subpath export

Package không có export gốc; mỗi subpath có quy tắc import riêng cho tầng kiến trúc:

| Subpath                       | Nội dung                                                                                                                                                                                     | domain / application được import |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------: |
| `@aiops-lms/common/errors`    | `AppError`, mã lỗi                                                                                                                                                                           |                Có                |
| `@aiops-lms/common/ports`     | `Principal`, `Role`, `Clock`, `CommandOutbox` (interface thuần)                                                                                                                              |                Có                |
| `@aiops-lms/common/http`      | filter lỗi, `ServiceAuthGuard`, `@Roles`, `@Anonymous`, `@InternalApi`, `@SkipAuth`, correlation, `HealthController`                                                                         |       Không (chỉ adapter)        |
| `@aiops-lms/common/auth`      | JWT EdDSA, `TokenVerifier`, `HttpJwksKeyProvider` (cache JWKS), `ServiceTokenProvider` (cache, làm mới nền, stale-while-error), `HttpServiceTokenSource`; `auth/testing` mint token cho test |       Không (chỉ adapter)        |
| `@aiops-lms/common/clients`   | `HttpQueryClient`, `CircuitBreaker`                                                                                                                                                          |              Không               |
| `@aiops-lms/common/telemetry` | `observeDependency`                                                                                                                                                                          |              Không               |
| `@aiops-lms/common/messaging` | envelope, outbox/inbox, RabbitMQ                                                                                                                                                             |              Không               |
| `@aiops-lms/common/prisma`    | `SqlClient`                                                                                                                                                                                  |              Không               |
| `@aiops-lms/common/config`    | schema biến môi trường chung, `parseEnvironment`                                                                                                                                             |              Không               |

## Quy tắc dependency

- Không chứa business entity, repository base class hay source của service.
- Không import Prisma client (mỗi service sinh client riêng); outbox/inbox dùng SQL thô qua `SqlClient`.
- Không thêm helper "tiện" chỉ một service dùng.

## Bảng bắt buộc cho outbox/inbox

Service phát command thêm vào `schema.prisma` (template đã có sẵn):

```prisma
model OutboxMessage {
  id          String    @id @db.Uuid
  routingKey  String    @map("routing_key")
  envelope    Json
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  availableAt DateTime  @default(now()) @map("available_at") @db.Timestamptz(6)
  lockedUntil DateTime? @map("locked_until") @db.Timestamptz(6)
  attempts    Int       @default(0)
  publishedAt DateTime? @map("published_at") @db.Timestamptz(6)
  lastError   String?   @map("last_error")

  @@index([publishedAt, availableAt])
  @@map("outbox_messages")
}

model InboxState {
  messageId   String   @map("message_id") @db.Uuid
  consumer    String
  processedAt DateTime @default(now()) @map("processed_at") @db.Timestamptz(6)

  @@id([messageId, consumer])
  @@map("inbox_states")
}
```
