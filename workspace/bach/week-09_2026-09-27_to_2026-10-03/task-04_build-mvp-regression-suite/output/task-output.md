# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_build-mvp-regression-suite` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 12/10/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa xác định |
| Pull request | Chưa tạo |
| Người review | Chưa có |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- 12/10/2026: Khởi tạo branch, input/output và chuyển task sang `Đang thực hiện`.
- 12/10/2026 — đợt 1 (chưa cần dependency của Đức):
  - Thêm entrypoint `pnpm run test:regression`: build, chuẩn bị dữ liệu sạch rồi chạy suite qua `jest.regression.config.ts`.
  - `test/regression/testbed.ts` dựng toàn bộ topology trong process: Gateway, Auth, Course, Enrollment, Submission, Storage mock, Grading và Notification consumer, nối PostgreSQL/Redis/RabbitMQ thật; mọi service gọi nhau qua HTTP thật, không stub.
  - Helper `waitUntil` (poll có timeout/interval) và `step` (gắn tên workflow, bước, service vào lỗi).
  - `test/regression/prepare-regression-data.mjs` tạm gọi tuần tự năm script reset của service và dọn key `course:v1:*` trên Redis; sẽ thay bằng lệnh reset/seed của W9 task-03.
  - Suite `mvp-regression.e2e-spec.ts` gồm 5 test: workflow `login → course → enroll → submit`, workflow `submit → grade → grade.completed → notification`, topology, timeout HTTP và dependency unavailable.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Regression entrypoint | Code | `lms/package.json` (`test:regression`), `lms/jest.regression.config.ts` |
| Testbed harness và helper | Code | `lms/test/regression/testbed.ts` |
| Chuẩn bị dữ liệu tạm thời | Code | `lms/test/regression/prepare-regression-data.mjs` |
| Regression suite | Code | `lms/test/regression/mvp-regression.e2e-spec.ts` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Một command reset/seed rồi kiểm chứng hai workflow từ trạng thái sạch | Đạt một phần | `pnpm run test:regression` chạy hai workflow từ dữ liệu sạch; bước chuẩn bị dữ liệu còn dùng script tạm, chờ lệnh reset/seed W9 task-03 |
| Bao phủ timeout HTTP, dependency unavailable và failure/recovery messaging | Đạt một phần | Timeout Storage → `504 DEPENDENCY_TIMEOUT`, Storage unavailable → `503 DEPENDENCY_UNAVAILABLE`, mỗi ca có bước phục hồi và kiểm tra không retry; ca messaging chờ W9 task-02 |
| Assertions topology và trace correlation sync/async | Đạt (local) | Test topology kiểm 18 dependency identity của sáu business service + Gateway, PostgreSQL, Redis, RabbitMQ; chuỗi span Gateway → Grading → publish → consume → process cùng trace |
| Async polling có timeout, ổn định ba lần liên tiếp, có diagnostics | Đạt (local, đợt 1) | 3 lần liên tiếp `5/5` pass (khoảng 2,8–3,4 giây mỗi lần); lỗi cố ý ở bước xem khóa học báo `[login → course → enroll → submit] Bước "xem khóa học" (service: gateway → course) thất bại`; cần chạy lại sau đợt 2 |
| Chạy trong CI hoặc có lý do tách job; `pnpm run ci:verify` và Compose smoke pass | Chưa đạt | `pnpm run ci:verify` pass local ngày 12/10/2026; chưa đưa vào CI và chưa chạy Compose smoke |
| URL/số PR và `Chờ review` được commit/push vào PR head trước review | Chưa đạt | Chưa tạo PR |
| `APPROVED` hợp lệ và finalization trước merge | Chưa đạt | Chưa review |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có.
- Việc chưa hoàn thành hoặc trở ngại: W9 task-02 và task-03 của Đức chưa merge nên chưa thể thay bước chuẩn bị dữ liệu tạm và thêm ca failure/recovery messaging; regression chưa chạy trong CI.
- Bước tiếp theo: Sau khi task-03 và task-02 merge, rebase lên `main`, dùng lệnh reset/seed chính thức, thêm ca messaging failure/recovery, đưa `test:regression` vào CI, chạy lại ba lần và Compose smoke.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
