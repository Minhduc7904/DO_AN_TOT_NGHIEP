# Grading service

Grading tạo và đọc grade hoàn tất cho một Submission. Service sở hữu `grading_db`, không đọc `submission_db` hay import source của Submission; việc xác nhận Submission luôn đi qua HTTP `GET /api/v1/submissions/{submission_id}`.

## API

- `POST /api/v1/grades` — chỉ `instructor`; body `{ "submission_id", "score" }` với `score` trong `[0, 100]` và tối đa 4 chữ số thập phân (khớp `numeric(7,4)`, vượt thì `400`). Trả `201` với `{ id, submission_id, score, completed_at }`; `404` nếu Submission không tồn tại, `409` nếu Submission đã có grade (grade là create-only), `503`/`504` khi Submission hoặc PostgreSQL lỗi/quá hạn.
- `GET /api/v1/grades/{grade_id}` — `instructor` đọc mọi grade; `student` chỉ đọc grade của chính mình (người khác nhận `403`).
- `GET /health`.

Request cần `x-principal-id` và `x-principal-role` do Gateway tạo từ JWT. Lời gọi nội bộ sang Submission không mang Bearer JWT hay principal header, chỉ propagate W3C trace context.

## Cấu hình

Xem `.env.example`. Cổng mặc định `3007`. Timeout dependency HTTP dùng `GRADING_DEPENDENCY_TIMEOUT_MS`; PostgreSQL dùng connection timeout 1000 ms và query timeout 2000 ms. Không log database URL.

## Dữ liệu và kiểm thử

`pnpm --filter @aiops-lms/grading build` rồi `node services/grading/dist/scripts/migrate.js` tạo bảng `grades` và seed một grade cho `submission-001` (idempotent). Kiểm thử PostgreSQL thật: `pnpm run test:grading:postgres` với `W1_AUTH_DATABASE_URL` và `GRADING_DATABASE_URL`.

Dependency telemetry dùng identity `grading-submission` và `grading-postgres` (span client, `grading.dependency.request.count`, `grading.dependency.error.count`, `grading.dependency.duration`).
