generator client {
  provider = "prisma-client"
  output   = "../src/adapters/persistence/generated"
}

datasource db {
  provider = "postgresql"
}

// Thêm model của service tại đây. Service phát command giữ hai bảng dưới; service không phát
// hoặc không consume command xóa chúng (xem packages/common/README.md).

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
