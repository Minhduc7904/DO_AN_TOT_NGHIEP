# `@aiops-lms/course`

## Trách nhiệm

Sở hữu `course_db`: khóa học, bài học, quiz (câu hỏi, lựa chọn), ghi danh, tiến độ bài học, lượt làm quiz. Gộp phần enrollment và chấm điểm quiz của topology v1. Danh mục route và mã lỗi: [`http-and-event-contracts-v2.md` §4.3](../../../docs/processed/architecture/http-and-event-contracts-v2.md); sở hữu dữ liệu: [`data-ownership-and-fault-matrix-v2.md` §2.3](../../../docs/processed/architecture/data-ownership-and-fault-matrix-v2.md).

Đồng bộ usage media bằng command (R-06) và vai trò facade của luồng AI soạn bài (R-08) xem bên dưới.

## Cấu trúc

```text
src/domain/                      entity thuần, QuizGrader, quy tắc nội dung quiz, lỗi nghiệp vụ, CSV
src/application/ports/           interface repository (course, lesson, quiz, enrollment, progress, attempt)
src/application/use-cases/       courses/ lessons/ quizzes/ learning/ student-quizzes/ — mỗi use case một class
src/application/lesson-ai/       facade AI: 5 route (documents, jobs) và 2 use case cho ai-worker (get-lesson-ai-context, apply-lesson-ai-content)
src/adapters/http/               5 controller mỏng (course, lesson, lesson-ai, quiz, student-learning) và presenter
src/adapters/clients/            MediaHttpClient (course-media), AiHttpClient (course-ai)
src/adapters/persistence/        Prisma repository, mọi truy vấn đi qua observeDependency('course-postgres')
prisma/                          schema.prisma và migrations (kèm partial unique index trong migration)
```

`domain/` và `application/` không import `@nestjs/*`, `@prisma/client` hay `@aiops-lms/common/{http,clients,...}`; ESLint chặn các import này.

## Đồng bộ usage media (R-06)

- Use case dựng `MediaEffect` (port `application/ports/media-effects.ts`, helper `MediaUsageEffects`) và truyền vào repository; Prisma repository ghi chúng vào `outbox_messages` **trong cùng transaction** với thay đổi nghiệp vụ (`adapters/messaging/media-effects.outbox.ts`). Tên command và queue chỉ xuất hiện ở adapter, lấy từ `@aiops-lms/contracts/commands`.
- Tạo/sửa course, lesson, quiz: lệnh `media.markdown-usage.synchronize` chỉ phát khi markdown thay đổi. Markdown của quiz gồm mô tả, câu hỏi và đáp án.
- Xóa course/lesson/quiz: `MediaHttpClient` (`course-media`, scope `media:usage:read`) hỏi `POST /internal/v1/media/usages/ids:query` theo lô ≤ 500 owner để lấy usage id, rồi ghi `media.usages.delete-by-ids`. Media không trả lời thì xóa thất bại với 503 `DEPENDENCY_UNAVAILABLE` và không xóa gì (không để usage mồ côi).
- `OutboxRelayService` (trong process API) dùng `OutboxRelayLoop` của `@aiops-lms/common/messaging` để phát outbox sang RabbitMQ; broker chết thì command nằm lại trong outbox.

## Soạn bài học bằng AI (R-08): facade mỏng

`course` **không** sở hữu dữ liệu hay worker AI. Văn bản trích xuất và job nằm ở `ai_db`, việc nền chạy ở `ai-worker` (xem README của `ai`). `course` chỉ:

- **Phục vụ 5 route public** `…/lessons/{lesson_id}/ai-documents(/sync)` và `…/ai-jobs[/{job_id}]` (admin, instructor sở hữu khóa học). Mỗi use case (`application/lesson-ai/`) kiểm tra bài học thuộc khóa học và quyền sở hữu, lấy tệp đính kèm từ `media` (`MediaHttpClient.listLessonAttachments`, scope `media:usage:read`), rồi gọi `ai` qua port `LessonAiService` (`AiHttpClient`, dependency `course-ai`, audience `ai`, scope `ai:document:read|write`, `ai:job:read|write`, timeout `COURSE_AI_TIMEOUT_MS`). Trạng thái `PROCESSING` của `ai` hiển thị `EXTRACTING`; tệp chưa có bản ghi là `NOT_QUEUED`. Lỗi nghiệp vụ của `ai` (`AI_JOB_ALREADY_ACTIVE`, `AI_DOCUMENTS_NOT_EXTRACTED`, 404…) giữ nguyên mã, HTTP và `details`.
- **Tạo job**: `SYNTHESIZE_LESSON` mà bài học đã có nội dung và `overwrite_content=false` thì 409 `LESSON_CONTENT_EXISTS` (không gọi `ai`); `media_ids` phải thuộc tệp đính kèm của bài học (khác thì 422 `AI_DOCUMENTS_NOT_EXTRACTED`); `requested_by` = người gọi (id, role) được truyền tường minh sang `ai`.
- **Phục vụ `ai-worker`** (route `/internal/v1/courses/{course_id}/lessons/{lesson_id}/…`, `LessonAiInternalController`): `GET ai-context` (scope `course:lesson-ai:read`), `PUT ai-content` và `POST ai-quizzes` (scope `course:lesson-ai:write`). Hai route ghi tái dùng `UpdateLessonUseCase`/`CreateQuizUseCase` dưới danh nghĩa `requested_by` nên quyền sở hữu, validate và đồng bộ usage media qua outbox vẫn như thao tác của người dùng; `ai-content` trả bản nội dung cũ, 409 `LESSON_CONTENT_EXISTS` khi bài có nội dung mà không `overwrite_content`; `ai-quizzes` luôn tạo `DRAFT`, dữ liệu sai trả 400 để model sửa.
- **Hệ quả**: năm route AI phụ thuộc `ai` đang chạy (`DEPENDENCY_*` nếu không); các route khác không ảnh hưởng. Vòng `course → ai → course` là bất đồng bộ (course chỉ nhận `202`); telemetry `dependency_identity=ai-worker-course` ở phía `ai-worker`.
- Env: chỉ `COURSE_AI_BASE_URL` (mặc định `http://localhost:3009`), `COURSE_AI_TIMEOUT_MS`, `COURSE_AI_BREAKER_THRESHOLD`, `COURSE_AI_BREAKER_COOLDOWN_MS`. Không còn bảng `lesson_attachment_texts`/`lesson_ai_jobs` hay `COURSE_AI_WORKER_*`.

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
COURSE_DATABASE_URL=... pnpm --dir ../.. run test:course:e2e         # e2e với PostgreSQL thật đã migrate (course.e2e-spec.ts và lesson-ai.e2e-spec.ts: facade AI + route nội bộ cho ai-worker, với auth/media/ai là HTTP stub)
```
