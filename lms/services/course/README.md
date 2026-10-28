# `@aiops-lms/course`

## Trách nhiệm

Sở hữu `course_db`: khóa học, bài học, quiz (câu hỏi, lựa chọn), ghi danh, tiến độ bài học và lượt làm quiz. Gộp phần enrollment và chấm điểm quiz của topology v1. Danh mục route và mã lỗi: [`http-and-event-contracts-v2.md` §4.3](../../../docs/processed/architecture/http-and-event-contracts-v2.md); sở hữu dữ liệu: [`data-ownership-and-fault-matrix-v2.md` §2.3](../../../docs/processed/architecture/data-ownership-and-fault-matrix-v2.md).

Đồng bộ usage media bằng command đã có từ R-06 (xem bên dưới). Chưa có (để R-08): luồng AI soạn bài.

## Cấu trúc

```text
src/domain/                      entity thuần, QuizGrader, quy tắc nội dung quiz, lỗi nghiệp vụ, CSV
src/application/ports/           interface repository (course, lesson, quiz, enrollment, progress, attempt)
src/application/use-cases/       courses/ lessons/ quizzes/ learning/ student-quizzes/ — mỗi use case một class
src/adapters/http/               4 controller mỏng (course, lesson, quiz, student-learning) và presenter
src/adapters/persistence/        Prisma repository, mọi truy vấn đi qua observeDependency('course-postgres')
prisma/                          schema.prisma và migrations (kèm partial unique index trong migration)
```

`domain/` và `application/` không import `@nestjs/*`, `@prisma/client` hay `@aiops-lms/common/{http,clients,...}`; ESLint chặn các import này.

## Đồng bộ usage media (R-06)

- Use case dựng `MediaEffect` (port `application/ports/media-effects.ts`, helper `MediaUsageEffects`) và truyền vào repository; Prisma repository ghi chúng vào `outbox_messages` **trong cùng transaction** với thay đổi nghiệp vụ (`adapters/messaging/media-effects.outbox.ts`). Tên command và queue chỉ xuất hiện ở adapter, lấy từ `@aiops-lms/contracts/commands`.
- Tạo/sửa course, lesson, quiz: lệnh `media.markdown-usage.synchronize` chỉ phát khi markdown thay đổi. Markdown của quiz gồm mô tả, câu hỏi và đáp án.
- Xóa course/lesson/quiz: `MediaHttpClient` (`course-media`, scope `media:usage:read`) hỏi `POST /internal/v1/media/usages/ids:query` theo lô ≤ 500 owner để lấy usage id, rồi ghi `media.usages.delete-by-ids`. Media không trả lời thì xóa thất bại với 503 `DEPENDENCY_UNAVAILABLE` và không xóa gì (không để usage mồ côi).
- `OutboxRelayService` (trong process API) dùng `OutboxRelayLoop` của `@aiops-lms/common/messaging` để phát outbox sang RabbitMQ; broker chết thì command nằm lại trong outbox.

## Quy ước nghiệp vụ đáng chú ý

- **Quyền sở hữu**: admin quản lý mọi khóa học; instructor chỉ quản lý khóa có `instructor_id` là mình (403 nếu khác). Danh sách và export theo vai trò: admin tất cả, instructor của mình, student chỉ khóa `PUBLISHED`.
- **Một attempt đang làm**: partial unique index `quiz_attempts_one_in_progress` (`WHERE status = 'IN_PROGRESS'`); hai yêu cầu `start` đồng thời cùng nhận một attempt.
- **Quiz khóa khi đã có attempt**: sửa cây câu hỏi hoặc xóa quiz trả 409 `QUIZ_HAS_ATTEMPTS`; kiểm tra lặp lại trong transaction để không xóa mất câu trả lời đã chấm.
- **Chấm điểm**: `QuizGrader` thuần, cộng điểm theo phần trăm điểm (số nguyên) nên không sai số số thực; `max_score` chốt lúc nộp.
- **Reorder bài học**: đi qua số âm trong một transaction vì ràng buộc unique `(course_id, display_order)` kiểm tra từng dòng.
- **Export CSV**: keyset theo `id`, khối 500, `StreamableFile` với `@RawResponse()` (không bọc envelope).

## Chạy

```bash
export COURSE_DATABASE_URL=postgresql://user:pw@localhost:5432/course_db
pnpm prisma:migrate:dev   # lần đầu
pnpm build && pnpm start
```

Container tự chạy `prisma migrate deploy` trước khi khởi động; cổng mặc định `3003`.

## Kiểm thử

```bash
pnpm exec jest --config jest.config.ts                              # unit (in-memory repository)
COURSE_DATABASE_URL=... pnpm --dir ../.. run test:course:e2e         # e2e với PostgreSQL thật đã migrate
```
