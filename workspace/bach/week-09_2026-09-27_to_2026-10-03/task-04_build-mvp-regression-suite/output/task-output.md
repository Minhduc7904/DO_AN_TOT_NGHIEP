# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                             |
| ------------------ | ------------------------------------ |
| Mã task            | `task-04_build-mvp-regression-suite` |
| Người phụ trách    | Bách                                 |
| Trạng thái         | Đang thực hiện                       |
| Bắt đầu thực tế    | 12/10/2026                           |
| Hoàn thành thực tế | Chưa hoàn thành                      |
| Tổng thời lượng    | Chưa xác định                        |
| Pull request       | Chưa tạo                             |
| Người review       | Chưa có                              |
| Kết quả review     | Chưa review                          |

## Báo cáo công việc đã làm

- 12/10/2026: Khởi tạo branch, input/output và chuyển task sang `Đang thực hiện`.
- 12/10/2026 — đợt 1 (chưa cần dependency của Đức):
  - Thêm entrypoint `pnpm run test:regression`: build, chuẩn bị dữ liệu sạch rồi chạy suite qua `jest.regression.config.ts`.
  - `test/regression/testbed.ts` dựng toàn bộ topology trong process: Gateway, Auth, Course, Enrollment, Submission, Storage mock, Grading và Notification consumer, nối PostgreSQL/Redis/RabbitMQ thật; mọi service gọi nhau qua HTTP thật, không stub.
  - Helper `waitUntil` (poll có timeout/interval) và `step` (gắn tên workflow, bước, service vào lỗi).
  - `test/regression/prepare-regression-data.mjs` tạm gọi tuần tự năm script reset của service và dọn key `course:v1:*` trên Redis; sẽ thay bằng lệnh reset/seed của W9 task-03.
  - Suite `mvp-regression.e2e-spec.ts` gồm 5 test: workflow `login → course → enroll → submit`, workflow `submit → grade → grade.completed → notification`, topology, timeout HTTP và dependency unavailable.
- 14/10/2026 — đợt 2 sau khi W9 task-02 và task-03 merge:
  - Merge `main` vào branch task, cập nhật harness theo API reconnect/telemetry mới của Notification.
  - Thay script chuẩn bị dữ liệu tạm bằng `run-regression.mjs`; một command build, gọi reset/seed canonical trên project `aiops-lms-test-regression`, dựng biến kết nối host từ Compose env file, chạy E2E và tái sử dụng messaging stability của task-02.
  - Tạo course riêng cho từng kịch bản để không xung đột seed canonical và giữ span `course-postgres` trong trace của workflow.
  - Thêm job `Testbed MVP regression` vào GitHub Actions, có log khi lỗi và cleanup volume/project trong bước `always()`.
  - Bỏ qua `.omc` khỏi Prettier để artifact công cụ đã được Git ignore không làm nhiễu quality gate local.

## Sản phẩm thực tế

| Sản phẩm                  | Loại   | Link hoặc đường dẫn                                                     |
| ------------------------- | ------ | ----------------------------------------------------------------------- |
| Regression entrypoint     | Code   | `lms/package.json` (`test:regression`), `lms/jest.regression.config.ts` |
| Testbed harness và helper | Code   | `lms/test/regression/testbed.ts`                                        |
| Regression suite          | Code   | `lms/test/regression/mvp-regression.e2e-spec.ts`                        |
| Regression orchestrator   | Code   | `lms/test/regression/run-regression.mjs`                                |
| CI regression job         | Config | `.github/workflows/ci.yml` (`mvp-regression`)                           |

## Đối chiếu Definition of Done

| Điều kiện từ input                                                               | Kết quả      | Bằng chứng                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Một command reset/seed rồi kiểm chứng hai workflow từ trạng thái sạch            | Đạt (local)  | `pnpm run test:regression -- --compose-env-file ../docker-compose/.env.example` gọi reset/seed canonical, fingerprint `c0222dc2c158f2f46368db43fe77752a044832ef76a218b9836da2fa5256f522`, 11 service healthy và E2E `5/5` pass                                                 |
| Bao phủ timeout HTTP, dependency unavailable và failure/recovery messaging       | Đạt (local)  | Timeout Storage → `504 DEPENDENCY_TIMEOUT`, Storage unavailable → `503 DEPENDENCY_UNAVAILABLE`; messaging stability đạt `3/3` vòng reconnect, redelivery, duplicate và backlog drain                                                                                           |
| Assertions topology và trace correlation sync/async                              | Đạt (local)  | Test topology kiểm 18 dependency identity của sáu business service + Gateway, PostgreSQL, Redis, RabbitMQ; chuỗi span Gateway → Grading → publish → consume → process cùng trace                                                                                               |
| Async polling có timeout, ổn định ba lần liên tiếp, có diagnostics               | Đạt (local)  | Sau đợt 2, E2E `5/5` và messaging stability `3/3` cùng pass ba lượt liên tiếp; polling dùng timeout hữu hạn và `step` gắn workflow/bước/service vào lỗi                                                                                                                        |
| Chạy trong CI hoặc có lý do tách job; `pnpm run ci:verify` và Compose smoke pass | Đạt một phần | Đã thêm job CI `mvp-regression`; Compose config pass. `ci:verify` local qua format/build/lint và 10/11 reset guard, còn subtest command-resolution thất bại vì Corepack từ repository root dùng pnpm `9.15.9` thay vì pinned `11.19.0`; chờ GitHub CI xác minh toolchain chuẩn |
| URL/số PR và `Chờ review` được commit/push vào PR head trước review              | Chưa đạt     | Chưa tạo PR                                                                                                                                                                                                                                                                    |
| `APPROVED` hợp lệ và finalization trước merge                                    | Chưa đạt     | Chưa review                                                                                                                                                                                                                                                                    |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có.
- Việc chưa hoàn thành hoặc trở ngại: Chưa tạo PR; GitHub CI chưa có kết quả. Máy local không tái hiện được đúng pnpm `11.19.0` khi reset guard spawn command từ repository root nên không dùng lần `ci:verify` local làm bằng chứng gate đầy đủ.
- Bước tiếp theo: Commit/push substantive work, tạo PR, ghi URL PR và chuyển `Chờ review` trên PR head sau khi GitHub CI xanh.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
