# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-enroll-to-submit-workflow` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 26/09/2026, bắt đầu từ commit khởi tạo `0174296` |
| Hoàn thành thực tế | Chưa ghi — chờ review GitHub và finalization theo quy trình |
| Tổng thời lượng | Chưa chốt — chỉ chốt khi đủ approval và finalization |
| Pull request | [#30](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/30) |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Bổ sung public Gateway route cho tạo và đọc Submission; Gateway kiểm tra JWT, chuyển principal context và không expose `enrollments/check` nội bộ.
- Mở rộng Compose với Submission, Storage Mock, `submission_db`, healthcheck và dependency order; CI Compose smoke kiểm tra nộp/đọc bài qua Gateway.
- Mở rộng E2E PostgreSQL cho `login → enroll → nộp bài`, W3C context, các dependency `enrollment-postgres`, `enrollment→course`, `submission→course/enrollment/storage` và nhánh lỗi Storage; thêm reset deterministic cho `submission_db`.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Gateway route Submission | Code | [gateway.controller.ts](../../../../../lms/services/gateway/src/adapters/http/gateway/gateway.controller.ts) |
| E2E PostgreSQL và reset Submission | Code | [w3-postgres-workflow.e2e-spec.ts](../../../../../lms/test/w3-postgres-workflow.e2e-spec.ts), [reset-submission-postgres.mjs](../../../../../lms/services/submission/test/reset-submission-postgres.mjs) |
| Compose và CI smoke | Cấu hình | [compose.yaml](../../../../../docker-compose/compose.yaml), [ci.yml](../../../../../.github/workflows/ci.yml) |
| Pull request | GitHub | [#30](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/30) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Compose khởi động toàn bộ service và persistence riêng | Đạt tại local | `docker compose ... up --build -d --wait` báo toàn bộ service healthy; Compose tạo `enrollment_db` và `submission_db` riêng. |
| E2E login, enroll và nộp bài qua Gateway; kiểm tra role | Đạt tại local | `pnpm run test:w3:postgres` pass 5/5; Compose smoke nộp và đọc lại Submission qua Gateway đạt. |
| Enrollment→Course và Submission→Storage failure | Đạt tại local | E2E PostgreSQL kiểm tra `DEPENDENCY_UNAVAILABLE` cho cả hai nhánh. |
| W3C trace và dependency telemetry | Đạt tại local | E2E assertion kiểm tra `enrollment-postgres`, `enrollment-course`, `submission-course`, `submission-enrollment`, `submission-storage`; `pnpm run ci:verify` pass. |
| CI và chạy độc lập của Đức | Chờ review | `pnpm run ci:verify` pass tại local; Đức cần chạy/review độc lập trên PR #30. |
| URL PR và `Chờ review` nằm trên PR head trước review | Đang ghi nhận | Commit metadata này sẽ được push lên PR #30 trước khi yêu cầu Đức review. |
| GitHub `APPROVED` và completion metadata trước merge | Chưa đạt | Chờ Đức review và gửi verdict GitHub hợp lệ; chưa finalization hoặc merge. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không đổi phạm vi; thêm reset `submission_db` để E2E PostgreSQL tái lập.
- Việc chưa hoàn thành hoặc trở ngại: Chưa có GitHub `APPROVED`; không đánh dấu task `Hoàn thành`.
- Bước tiếp theo: Push metadata `Chờ review`, yêu cầu Đức review PR #30; sau `APPROVED` dùng `task-completion-recording` để finalization trước merge.

> `Hoàn thành thực tế` chỉ ghi sau GitHub `APPROVED`, finalization metadata trên PR và khi người phụ trách sẵn sàng merge; không ghi merge time.
