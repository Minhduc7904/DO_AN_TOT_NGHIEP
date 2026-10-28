# `@aiops-lms/course`

## Trách nhiệm

Sở hữu `course_db`: khóa học, bài học, quiz (câu hỏi, lựa chọn), ghi danh, tiến độ bài học và lượt làm quiz. Gộp phần enrollment và chấm điểm quiz của topology v1. Danh mục route và mã lỗi: [`http-and-event-contracts-v2.md` §4.3](../../../docs/processed/architecture/http-and-event-contracts-v2.md); sở hữu dữ liệu: [`data-ownership-and-fault-matrix-v2.md` §2.3](../../../docs/processed/architecture/data-ownership-and-fault-matrix-v2.md).

Chưa có ở R-05 (để R-06/R-08): đồng bộ usage media bằng command, luồng AI soạn bài. Bảng `outbox_messages` đã có sẵn cho các producer đó.

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
