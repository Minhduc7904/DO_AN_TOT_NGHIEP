# Hướng dẫn chạy seeder dữ liệu quy mô lớn

> Guide này hướng dẫn thao tác chạy seeder (R-10). Thiết kế, quy tắc dữ liệu và cách thêm bảng mới nằm ở [`lms/scripts/seed-data/README.md`](../../../lms/scripts/seed-data/README.md); bằng chứng đã chạy nằm ở mục R-10 của [`refactor-board-v1.md`](../plan/refactor/refactor-board-v1.md).

## Seeder để làm gì

Nạp dữ liệu nền (học viên, khóa học, enrollment, lượt làm quiz, notification, media, nhật ký AI, lịch sử job) vào các database PostgreSQL của LMS để các lần chạy thử không diễn ra trên database gần như rỗng. Seeder ghi trực tiếp bằng SQL nên dữ liệu không đi qua API, outbox hay command, và không sinh trace hay log nghiệp vụ.

## Chuẩn bị

- Docker đang chạy; cổng host `5432` (Postgres), `3000` (Gateway) và các cổng khác trong `docker-compose/.env` còn trống.
- File `docker-compose/.env` (sao từ `docker-compose/.env.example` nếu chưa có). File này không được commit.
- Node `22.13.1` và pnpm `11.19.0` để chạy script. Nếu máy mặc định Node cũ: `export PATH=$HOME/.nvm/versions/node/v22.13.1/bin:$PATH`.

## Bước 1: dựng stack LMS

Chạy từ thư mục gốc repo:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml up --build -d --wait
```

Lần đầu build mất vài phút. Mỗi service tự `prisma migrate deploy` khi khởi động, nên khi lệnh trả về thì cả 7 database đã có bảng. Seeder cần Postgres publish ra host (`POSTGRES_PORT`, mặc định `5432`).

## Bước 2: chạy seeder bằng giao diện terminal

```bash
cd lms
pnpm run seed:data -- --environment local --compose-env-file ../docker-compose/.env
```

| Bước | Bạn thấy | Thao tác |
| --- | --- | --- |
| 1. Chọn database | Danh sách 7 database kèm trạng thái và số dòng seed đang có. Database chưa migrate hoặc không kết nối được bị khóa kèm lý do | `Space` chọn/bỏ, `a` chọn hết, `Enter` tiếp tục |
| 2. Nhập số lượng | Từng bảng một, kèm khoảng cho phép và số gợi ý theo profile `medium` | `Enter` nhận gợi ý hoặc gõ số khác. Bảng "tự tính" chỉ hiện số, không hỏi |
| 3. Xác nhận | Bảng tóm tắt số dòng từng bảng và câu hỏi dọn rồi nạp | Gõ `y` để chạy, `n` để hủy (chưa ghi gì) |
| 4. Tiến độ | Mỗi bảng một dòng có thanh tiến độ; bảng xong hiện `✔ ... thành công`, bảng lỗi hiện `✖` kèm thông điệp | Chờ |
| 5. Báo cáo | Thời gian và số dòng từng bảng, fingerprint từng database và tổng | Ghi lại nếu cần đối chiếu |

Để thử nhanh, cứ `Enter` ở mọi câu hỏi số lượng. Thêm `--profile small` nếu muốn nhẹ hơn.

### Số lượng mặc định theo profile

| Bảng | small | medium | large |
| --- | ---: | ---: | ---: |
| `identity_users` (học viên) và `identity_student_profiles` (tự tính, mỗi học viên một hồ sơ) | 1.000 | 20.000 | 100.000 |
| `identity_users` (giảng viên) | 10 | 50 | 200 |
| `courses` | 20 | 100 | 300 |
| `lessons` | 100 | 800 | 3.000 |
| `quizzes` | 60 | 500 | 2.000 |
| `quiz_questions` | 300 | 3.000 | 16.000 |
| `quiz_options` | 1.200 | 12.000 | 64.000 |
| `enrollments` | 3.000 | 60.000 | 400.000 |
| `lesson_progresses` | 6.000 | 150.000 | 1.000.000 |
| `quiz_attempts` | 2.000 | 30.000 | 150.000 |
| `media_objects` (tệp gốc) | 500 | 5.000 | 50.000 |
| `media_usages` | 700 | 7.000 | 70.000 |
| `notifications` (đơn lẻ) | 2.000 | 40.000 | 300.000 |
| `notification_batches` | 3 | 10 | 30 |
| `notification_batch_items` | 1.500 | 50.000 | 600.000 |
| `ai_invocations` | 500 | 20.000 | 200.000 |
| `ai_documents` | 100 | 1.000 | 10.000 |
| `ai_jobs` | 100 | 2.000 | 20.000 |
| `background_jobs` | 2 | 5 | 10 |
| `background_job_runs` | 50 | 1.000 | 10.000 |

Các bảng tự tính, không nhập số: `quiz_attempt_answers` (theo số lượt làm bài, đáp án và điểm luôn khớp nhau), thumbnail của media, và notification sinh từ các đợt gửi.

### Giới hạn khi nhập số lượng

Mỗi bảng con bị giới hạn theo bảng cha để dữ liệu luôn hợp lệ. Nhập vượt giới hạn thì giao diện từ chối và nêu giá trị tối đa.

- `lessons` ≤ số khóa học × 200; `quizzes` ≤ số bài học × 20; `quiz_questions` ≤ số quiz × 100.
- `quiz_options` từ 2 đến 10 phương án cho mỗi câu hỏi.
- `enrollments` ≤ số học viên × số khóa học (mỗi cặp học viên và khóa học chỉ một lần).
- `lesson_progresses` và `quiz_attempts` chỉ cho học viên đã ghi danh, nên bị giới hạn theo `enrollments`.
- `media_usages` từ số media gốc trở lên (mỗi tệp có ít nhất một usage).
- `notification_batch_items` ≤ số đợt gửi × số học viên (tối đa 100.000 người nhận mỗi đợt).
- `ai_documents` ≤ số tài liệu trong các media đã seed.

Database cha không được chọn lần này thì seeder dùng số dòng seed đang có ở đó. Nếu bằng 0, seeder nêu rõ cần seed gì trước.

## Bước 3: kiểm tra kết quả

Đăng nhập bằng học viên seed qua Gateway (mật khẩu chung của mọi tài khoản seed là `seed-password`):

```bash
curl -s -H 'content-type: application/json' \
  -d '{"email":"seed-student-1@seed.test","password":"seed-password"}' \
  http://localhost:3000/api/v1/auth/student/login
```

Đếm dòng trực tiếp trong database (từ thư mục `lms/`):

```bash
docker compose --env-file ../docker-compose/.env -f ../docker-compose/compose.yaml exec postgres \
  psql -U lms -d course_db -c "select count(*) from enrollments"
```

Các dòng seed có `id` bắt đầu bằng `5eed`; tài khoản bootstrap (`admin@example.test`, `instructor@example.test`, `student@example.test`) không bị đụng.

## Chạy lại

Seeder dọn toàn bộ dữ liệu seed cũ của các database được chọn rồi nạp lại, nên chạy lại với số lượng khác là cách thay đổi quy mô. Cùng cấu hình và cùng `--seed` cho đúng cùng dữ liệu và cùng fingerprint; đổi `--seed` cho dữ liệu khác.

## Chế độ không tương tác (script, CI)

```bash
pnpm run seed:data -- --environment local --compose-env-file ../docker-compose/.env \
  --non-interactive --yes --profile medium --seed 42 \
  --databases identity,course \
  --count course.enrollments=100000 \
  --report /tmp/seed-report.json
```

- `--databases` giới hạn các database (`identity`, `course`, `media`, `notification`, `ai`, `scheduler`); bỏ qua thì dùng mọi database sẵn sàng.
- `--count <db.bảng>=<số>` ghi đè số lượng một bảng, lặp lại được. Khóa bảng có dạng `course.enrollments`, `media.objects`, `notification.items`; xem danh sách đầy đủ ở `catalogue.mjs`.
- `--report` ghi báo cáo JSON gồm số dòng, thời gian và fingerprint.
- Không có TTY thì seeder tự chạy chế độ này và bắt buộc có `--yes`.

Toàn bộ tùy chọn: `pnpm run seed:data -- --help`.

## Xử lý lỗi thường gặp

| Thông báo | Nguyên nhân và cách xử lý |
| --- | --- |
| `không kết nối được` ở một database | Stack chưa chạy hoặc cổng khác `POSTGRES_PORT`. Kiểm tra `docker compose ... ps`, hoặc truyền `--port` |
| `chưa migrate service ...` | Service tương ứng chưa chạy migration. Khởi động lại service đó, hoặc chạy lại bước 1 |
| `Host "..." không được phép` | Seeder chỉ chạy với `localhost`, `127.0.0.1`, `::1`, `postgres`. Không trỏ vào database ngoài máy |
| `Số lượng không hợp lệ: ...` | Số nhập vượt giới hạn hoặc thiếu bảng cha. Thông báo nêu bảng nào và tối đa bao nhiêu |
| `Chế độ không tương tác cần --yes` | Thêm `--yes` |
| `Seed thất bại: ...` | Database lỗi đã rollback, các database nạp xong trước đó giữ nguyên; thông báo liệt kê database đã xong. Sửa nguyên nhân rồi chạy lại (chạy lại dọn dữ liệu seed cũ) |

## Lưu ý

- Media seed chỉ có dòng trong database, không có tệp trong MinIO: danh sách và usage chạy bình thường, nhưng tải nội dung hoặc thumbnail của các dòng này sẽ lỗi.
- Mọi tài khoản seed dùng chung mật khẩu `seed-password`; chỉ dùng cho testbed local.
- Seeder không đưa dòng nào vào trạng thái đang xử lý, nên worker không phát email, gọi AI hay dọn media từ dữ liệu seed.
- Reset testbed (`pnpm run testbed:reset`) xóa volume Postgres nên xóa luôn dữ liệu seed; chạy seeder lại sau khi reset.

## Dọn dẹp

```bash
# từ thư mục gốc repo
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml down --volumes
```

Bỏ `--volumes` nếu muốn giữ dữ liệu Postgres.
