# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                                       |
| ------------------ | -------------------------------------------------------------- |
| Mã task            | `task-03_implement-reset-and-seed-command`                     |
| Người phụ trách    | Đức                                                            |
| Trạng thái         | Chờ review                                                     |
| Bắt đầu thực tế    | 13/10/2026 15:17 (UTC+7)                                       |
| Hoàn thành thực tế | Chưa hoàn thành                                                |
| Tổng thời lượng    | Đang thực hiện                                                 |
| Pull request       | [#38](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/38) |
| Người review       | Chưa review                                                    |
| Kết quả review     | Chưa review                                                    |

## Báo cáo công việc đã làm

- Đã tạo CLI Node fail-closed với option canonical `--compose-env-file` tương thích PowerShell/POSIX, gọi Docker bằng argument array với `shell: false` và timeout hữu hạn 20 phút cho mỗi process.
- Đã khóa environment/project/confirm cùng path Compose/env trong repository; lỗi bất kỳ bước nào dừng nonzero, không in thành công giả.
- Đã chuẩn hóa UUID cố định cho student/instructor Auth và dùng cùng student UUID trong seed Enrollment, Submission, Grading; fingerprint loại password hash.
- Đã xác minh 11 service healthy, năm database, Redis sạch, RabbitMQ queue durable/rỗng và Storage Mock không còn object/fault state.
- Đã chạy automated Compose smoke hai vòng, chủ động tạo dirty Redis key và Storage object giữa hai vòng; fingerprint sau reset vẫn trùng nhau.

## Sản phẩm thực tế

| Sản phẩm                  | Loại      | Link hoặc đường dẫn                               |
| ------------------------- | --------- | ------------------------------------------------- |
| CLI reset/seed            | Code      | `lms/scripts/reset-and-seed.mjs`                  |
| Guard/unit tests          | Test      | `lms/test/testbed-reset/reset-and-seed.test.mjs`  |
| Compose two-reset smoke   | Test      | `lms/test/testbed-reset/compose-reset-smoke.mjs`  |
| Fixed cross-service seeds | Code      | Migration Auth, Enrollment, Submission và Grading |
| Storage baseline endpoint | Code/Test | `lms/services/submission-storage-mock/`           |
| Hướng dẫn vận hành        | Docs      | `docker-compose/README.md`                        |
| CI gate                   | Config    | `.github/workflows/ci.yml`                        |

## Đối chiếu Definition of Done

| Điều kiện từ input                                 | Kết quả            | Bằng chứng                                                                                                                                                                                                                          |
| -------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reset đúng project và đầy đủ state Testbed         | Đạt                | CLI chạy `down --volumes --remove-orphans`, `up --build -d --wait`; fingerprint đọc năm DB, Redis, RabbitMQ, Storage; Notification reset theo process/volume RabbitMQ mới.                                                          |
| Guard fail-closed và child process không qua shell | Đạt                | `test:testbed:reset` pass 11/11, gồm canonical command qua PowerShell/POSIX và alias compatibility; source dùng `spawn(command, args, { shell: false })`; test production/missing/mismatch/outside repo và child failure.           |
| UUID/fingerprint xác định xuyên service            | Đạt                | Student `11111111-1111-4111-8111-111111111111`, instructor `22222222-2222-4222-8222-222222222222`; password hash không được query vào fingerprint.                                                                                  |
| Health và failure semantics                        | Đạt                | 11 service healthy; process timeout hữu hạn; CLI negative case exit 1 và không chứa thông báo hoàn tất.                                                                                                                             |
| Reset hai lần, Redis/Rabbit/Storage baseline       | Đạt                | `test:testbed:reset:compose` pass; hai SHA-256 đều `c0222dc2c158f2f46368db43fe77752a044832ef76a218b9836da2fa5256f522`; Redis `DBSIZE=0`, queue Notification durable/rỗng, Storage `object_count=0`.                                 |
| Gate chung                                         | Đạt một phần local | Build PASS; lint PASS; unit suites đến W1 PASS; telemetry PASS; Compose config và `git diff --check` PASS. Local full test gặp W1 Gateway timeout 504; local `ci:verify` dừng ở 34 file Prettier baseline ngoài diff; chờ CI Linux. |
| PR head ghi URL và trạng thái `Chờ review`         | Đạt                | PR #38; transition được commit/push trên chính PR head trước review.                                                                                                                                                                |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Thêm endpoint nội bộ chỉ đọc của Storage Mock để fingerprint xác minh state in-memory; không thêm persistence hoặc API public.
- Việc chưa hoàn thành hoặc trở ngại: Giao diện canonical đã đổi sang `--compose-env-file` và regression thực thi qua PowerShell command resolution; `--env-file` được giữ làm alias deprecated cho direct invocation. CI Linux và focused re-review chưa hoàn tất.
- Bước tiếp theo: Chờ CI Linux và reviewer độc lập thực hiện focused re-review PR #38; implementer chỉ xử lý blocking finding trước finalization riêng.
