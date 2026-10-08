# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-grading-service` |
| Tên task | Triển khai Grading service, persistence riêng và call tới Submission |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Chờ review |
| Ngày tạo | 08/10/2026 |
| Thời gian dự kiến | 1–2 ngày làm việc |
| Nhánh thực hiện | `feat/week-08/task-04-implement-grading-service` |
| Pull request dự kiến | Sẽ tạo sau khi hoàn tất code + test |

## Mục tiêu và phạm vi

### Task cần làm gì?

Triển khai Grading service MVP tại `lms/services/grading/`: `POST /api/v1/grades` (chỉ `instructor`) và `GET /api/v1/grades/{grade_id}`, persistence riêng `grading_db` với migration/seed idempotent, và call Submission qua HTTP (`GET /api/v1/submissions/{submission_id}`) để xác nhận submission trước khi ghi grade. Wire route `/api/v1/grades` qua Gateway, Compose (cổng `3007`), CI và bổ sung account seed `instructor@example.test` cho Auth. Có telemetry dependency `grading-submission` và `grading-postgres`.

Quyết định đã chốt từ kế hoạch triển khai:

- Grade là create-only: mỗi submission chỉ có một grade hoàn tất, tạo trùng trả `409 CONFLICT` (không có `PUT`/`PATCH`/`DELETE`/list; "cập nhật grade" trong card được hiểu là ngoài MVP).
- `score` thuộc `[0, 100]`; `instructor` đọc mọi grade, `student` chỉ đọc grade của chính mình (người khác trả `403`).
- Call nội bộ tới Submission không gửi Bearer JWT, không giả mạo principal; chỉ propagate W3C trace context (khớp contract v1 §2.3 mục 3 và Submission cho phép `GET` không có principal).

### Phạm vi không thực hiện

- Không publish RabbitMQ, không publisher reliability/idempotency, không consumer Notification (thuộc task-05 và task-02); không sửa contract `grade.completed` v1.
- Không thêm rubric, Assignment service hoặc UI.
- Không thực hiện full W5 E2E (thuộc task-03).
- Không sửa `workspace/bach/`, `docs/raw/`.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Grading API, migration/seed, HTTP client Submission và test | Code | `lms/services/grading/` |
| Gateway/Compose/CI wiring, seed instructor | Code / Config | `lms/services/gateway/`, `lms/services/auth/`, `docker-compose/`, `.github/workflows/ci.yml` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: Week 7 Submission đã merge; HTTP contracts v1 §10 (`docs/processed/architecture/http-and-event-contracts-v1.md`); data ownership matrix; service topology v1.
- Người cần phối hợp: Bách rà soát contract và correlation field.
- Rủi ro hoặc giả định: Submission là authority xác nhận submission; schema grading tối thiểu, không dùng database chung; `GET /api/v1/submissions/{id}` không yêu cầu principal header khi gọi nội bộ.

## Definition of Done

- [ ] Grading tạo grade theo HTTP contract, validation/authorization/error envelope rõ ràng và gọi Submission qua HTTP để xác nhận input.
- [ ] `grading_db` được migration/seed từ trạng thái sạch, chạy lại không nhân bản dữ liệu; không cross-service database/source import.
- [ ] Health, config, Compose/Gateway wiring và unit/PostgreSQL integration tests phù hợp pass.
- [ ] HTTP server/client và PostgreSQL telemetry giữ trace context, có dependency identity/error semantics và không lộ secret/PII.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
