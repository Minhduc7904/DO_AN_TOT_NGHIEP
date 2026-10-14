# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Mã task            | `task-04_build-mvp-regression-suite`                                                                                                 |
| Người phụ trách    | Bách                                                                                                                                 |
| Trạng thái         | Hoàn thành                                                                                                                           |
| Bắt đầu thực tế    | 12/10/2026 11:30 (UTC+7)                                                                                                             |
| Hoàn thành thực tế | 14/10/2026 10:55 (UTC+7) — finalization trước merge                                                                                  |
| Tổng thời lượng    | Khoảng 1 ngày 23 giờ 25 phút theo wall clock, gồm thời gian chờ W9 task-02/task-03, Docker và CI; không phải timesheet công thủ công |
| Pull request       | [#39](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/39)                                                                       |
| Người review       | Reviewer agent theo `task-code-review`; Đức cho phép theo xác nhận của Bách                                                          |
| Kết quả review     | `APPROVED` ngoài GitHub theo xác nhận của người phụ trách; không phải GitHub `APPROVED` hợp lệ                                       |

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
  - Mở PR #39; squash commit để xử lý false positive của GitGuardian và xác minh lại toàn bộ sáu checks đều xanh.
- 14/10/2026 — review và finalization:
  - Reviewer agent review PR #39 theo `task-code-review` trên head `a2fd0c3`: không có blocking issue, verdict `APPROVED` ngoài GitHub. Đức cho phép review theo ngoại lệ của repository theo xác nhận của Bách; GitHub chưa ghi nhận review submission nào.
  - Finalization metadata trên chính branch/PR trước merge; không thay đổi substantive code.

## Sản phẩm thực tế

| Sản phẩm                  | Loại   | Link hoặc đường dẫn                                                     |
| ------------------------- | ------ | ----------------------------------------------------------------------- |
| Regression entrypoint     | Code   | `lms/package.json` (`test:regression`), `lms/jest.regression.config.ts` |
| Testbed harness và helper | Code   | `lms/test/regression/testbed.ts`                                        |
| Regression suite          | Code   | `lms/test/regression/mvp-regression.e2e-spec.ts`                        |
| Regression orchestrator   | Code   | `lms/test/regression/run-regression.mjs`                                |
| CI regression job         | Config | `.github/workflows/ci.yml` (`mvp-regression`)                           |

## Đối chiếu Definition of Done

| Điều kiện từ input                                                               | Kết quả           | Bằng chứng                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Một command reset/seed rồi kiểm chứng hai workflow từ trạng thái sạch            | Đạt (local)       | `pnpm run test:regression -- --compose-env-file ../docker-compose/.env.example` gọi reset/seed canonical, fingerprint `c0222dc2c158f2f46368db43fe77752a044832ef76a218b9836da2fa5256f522`, 11 service healthy và E2E `5/5` pass                                                       |
| Bao phủ timeout HTTP, dependency unavailable và failure/recovery messaging       | Đạt (local)       | Timeout Storage → `504 DEPENDENCY_TIMEOUT`, Storage unavailable → `503 DEPENDENCY_UNAVAILABLE`; messaging stability đạt `3/3` vòng reconnect, redelivery, duplicate và backlog drain                                                                                                 |
| Assertions topology và trace correlation sync/async                              | Đạt (local)       | Test topology kiểm 18 dependency identity của sáu business service + Gateway, PostgreSQL, Redis, RabbitMQ; chuỗi span Gateway → Grading → publish → consume → process cùng trace                                                                                                     |
| Async polling có timeout, ổn định ba lần liên tiếp, có diagnostics               | Đạt (local)       | Sau đợt 2, E2E `5/5` và messaging stability `3/3` cùng pass ba lượt liên tiếp; polling dùng timeout hữu hạn và `step` gắn workflow/bước/service vào lỗi                                                                                                                              |
| Chạy trong CI hoặc có lý do tách job; `pnpm run ci:verify` và Compose smoke pass | Đạt               | [GitHub Actions run 38504554203](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/38504554203) trên head `a2fd0c3`: regression (E2E `5/5`, messaging ba vòng), quality gate, reset/seed, fresh Compose, Compose validation và GitGuardian đều xanh trên Node/pnpm pinned |
| URL/số PR và `Chờ review` được commit/push vào PR head trước review              | Đạt               | PR [#39](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/39); card, overview và output được chuyển `Chờ review` trên PR head                                                                                                                                                    |
| `APPROVED` hợp lệ và finalization trước merge                                    | Đạt theo ngoại lệ | Review ngoài GitHub `APPROVED` không có blocking issue; nguồn là xác nhận của Bách rằng Đức cho phép review theo ngoại lệ, không phải GitHub `APPROVED`. Finalization metadata được commit vào chính PR trước merge                                                                  |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có.
- Việc chưa hoàn thành hoặc trở ngại: GitHub chưa ghi nhận `APPROVED` của Đức; cổng approval được thay bằng xác nhận ngoại lệ của người phụ trách. Góp ý không blocking để lại: regression chạy song song với container ứng dụng của Compose dùng chung `grading_db`/broker (worker Grading trong container có thể publish lại event `pending`, Notification đã deduplicate); test topology phụ thuộc thứ tự chạy của hai test workflow.
- Bước tiếp theo: Bách tự merge PR #39 sau khi kiểm tra checks/branch protection; W9 task-05 dùng regression entrypoint này để kiểm chứng fresh setup và Gate M2.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
