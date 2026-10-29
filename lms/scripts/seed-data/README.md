# Seeder dữ liệu quy mô lớn

Hướng dẫn chạy từng bước: [`seed-data-guide.md`](../../../docs/processed/guides/seed-data-guide.md).

Nạp dữ liệu nền vào các database PostgreSQL của LMS (R-10) để telemetry của các lần chạy healthy và fault không chạy trên database gần như rỗng. Seeder không sinh nhãn hay ground truth; nó chỉ tạo khối lượng dữ liệu có cấu trúc hợp lệ.

## Cách chạy

Từ thư mục `lms/`, sau khi stack compose đã chạy và các service đã migrate:

```bash
# Giao diện terminal: chọn database, nhập số lượng từng bảng, xem tiến độ
pnpm run seed:data -- --environment local --compose-env-file ../docker-compose/.env

# Không tương tác (CI, script)
pnpm run seed:data -- --environment local --non-interactive --yes --profile medium --seed 42 \
  --count course.enrollments=100000 --report /tmp/seed-report.json
```

Giao diện gồm bốn bước: (1) kiểm tra kết nối và chọn các database (database chưa migrate hoặc không kết nối được bị khóa kèm lý do); (2) nhập số dòng cho từng bảng, theo thứ tự cha trước con, mỗi bảng hiện khoảng cho phép; (3) màn hình tóm tắt và xác nhận; (4) tiến độ từng bảng, bảng nào xong có dòng `✔ ... thành công`, bảng lỗi hiện `✖` kèm thông điệp. Cuối cùng là báo cáo số dòng, thời gian và fingerprint. Không có TTY thì tự chuyển sang chế độ không tương tác và in từng dòng.

Chạy `pnpm run seed:data -- --help` để xem toàn bộ tùy chọn. Kết nối mặc định là `localhost:5432`, user `lms` (khớp `docker-compose/.env.example`); `--compose-env-file` đọc `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`. Biến `<DB>_DATABASE_URL` trong môi trường (ví dụ `AUTH_DATABASE_URL`) ghi đè kết nối của từng database.

## Bảng được seed

| Database          | Bảng                                                                                                                                           | Ghi chú                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `auth_db`         | `auth_users` (học viên, giảng viên)                                                                                                            | Dùng chung một hash scrypt cho mọi tài khoản                                                                      |
| `student_db`      | `students`                                                                                                                                     | Cùng `id` và email với học viên ở `auth_users`                                                                    |
| `course_db`       | `courses`, `lessons`, `quizzes`, `quiz_questions`, `quiz_options`, `enrollments`, `lesson_progresses`, `quiz_attempts`, `quiz_attempt_answers` | Khóa học `PUBLISHED`, chỉ có lượt làm bài `SUBMITTED`; điểm khớp đáp án; đáp án quiz tự tính theo số lượt làm bài |
| `media_db`        | `media_objects` (tệp gốc và thumbnail), `media_usages`                                                                                         | Mọi tệp gốc có ít nhất một usage; thumbnail tự tính                                                               |
| `notification_db` | `notifications` (đơn lẻ và từ đợt gửi), `notification_batches`, `notification_batch_items`                                                     | Đợt gửi `COMPLETED`, mục `SUCCESS`; notification từ đợt gửi tự tính                                               |
| `ai_db`           | `ai_invocations`, `ai_documents`, `ai_jobs`                                                                                                    | Tài liệu `EXTRACTED`, job `COMPLETED`/`FAILED`; không seed provider, model, binding                               |
| `scheduler_db`    | `background_jobs`, `background_job_runs`                                                                                                       | Job `MANUAL` ở trạng thái `PAUSED`, run đã kết thúc                                                               |

Không seed `outbox_messages`, `inbox_states`, `auth_service_clients`, `auth_refresh_tokens` và mọi dòng đang xử lý dở (`PENDING`, `RUNNING`, `PROCESSING`, `RETRY`, `SNAPSHOT_*`): relay và worker sẽ nhặt và phát lệnh thật (email Mailpit, gọi AI, dọn media).

## Quy tắc dữ liệu

- **Nhận diện dòng seed**: `id` bắt đầu bằng `5eed<mã loại>` (xem `ids.mjs`), email học viên là `seed-student-<i>@seed.test`. Ba tài khoản bootstrap của `auth` (`admin@example.test`, `instructor@example.test`, `student@example.test`) không bị đụng.
- **Tham chiếu chéo database**: id sinh theo chỉ số nên các database khớp nhau mà không cần truy vấn chéo. Database cha không được chọn lần này thì seeder đếm số dòng seed đang có ở đó; bằng 0 thì từ chối và nêu rõ cần seed gì trước.
- **Mật khẩu**: mọi tài khoản seed dùng chung mật khẩu `seed-password`. Chỉ dùng cho testbed local.
- **Chạy lại**: seeder dọn toàn bộ dữ liệu seed cũ của database được chọn rồi nạp lại, trong một transaction cho mỗi database. Lỗi ở database nào thì database đó rollback; các database đã nạp xong trước đó giữ nguyên (không atomic giữa các database). Cùng `--seed` và cùng số lượng cho đúng cùng dữ liệu.
- **Media không có tệp thật**: `media_objects` chỉ có dòng trong database, không có đối tượng trong MinIO. Truy vấn danh sách và usage hoạt động; `GET /media/{id}/content` và thumbnail của các dòng seed sẽ lỗi.
- **Trần số dòng**: mỗi bảng con bị giới hạn theo bảng cha (ví dụ `enrollments` ≤ số học viên × số khóa học; `lesson_progresses` và `quiz_attempts` chỉ cho học viên đã ghi danh). Nhập vượt trần thì bị từ chối kèm giá trị tối đa.

## Fingerprint

Mỗi database tính `md5` toàn bộ nội dung các dòng seed (sắp theo id), rồi `sha256` gộp theo database và toàn bộ. Cùng cấu hình và cùng `--seed` cho cùng fingerprint. Fingerprint này tách khỏi fingerprint của `testbed:reset` (bốn bảng bootstrap), nên seeder không làm đổi giá trị đó.

## Thêm bảng hoặc database mới

Thêm một mục vào `datasets` trong [`catalogue.mjs`](catalogue.mjs) (khóa, nhãn, bảng, loại id, mục cha, số lượng mặc định, trần/sàn, câu `INSERT ... SELECT`) và thêm bảng vào danh sách dọn của database. TUI, kiểm tra, dọn dữ liệu và fingerprint đọc từ danh mục này. Test `catalogue khớp schema.prisma` sẽ báo đỏ nếu catalogue thiếu cột bắt buộc hoặc tham chiếu cột không còn tồn tại.

## Kiểm thử

```bash
pnpm run test:seed-data
```

Test đơn vị không cần database. Kiểm chứng trên database thật nằm ở bằng chứng R-10 trong [`refactor-board-v1.md`](../../../docs/processed/plan/refactor/refactor-board-v1.md).
