# Task tuần: Triển khai Grading service và call tới Submission

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-grading-service` |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Đức |
| Collaborator | Bách rà soát contract và correlation field |
| Ưu tiên | Cao |
| Hạn dự kiến | 23/09/2026 |
| Nhánh thực hiện | `feat/week-08/task-04-implement-grading-service` |

## Yêu cầu và phạm vi

### Cần thực hiện

Triển khai Grading service MVP: API tạo/cập nhật grade cho submission hợp lệ, persistence riêng `grading_db`, migration/seed tái lập và call Submission qua HTTP; wire route cần thiết qua Gateway. Bảo đảm Grading không truy cập `submission_db` hoặc source Submission trực tiếp và có telemetry HTTP/PostgreSQL phù hợp.

### Không thực hiện

- Không publish RabbitMQ, reliability/idempotency publisher hay consumer Notification; thuộc task-05 và task-02.
- Không thêm rubric, Assignment service hoặc UI.
- Không thực hiện full W5 E2E; thuộc task-03.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: Week 7 Submission đã merge; HTTP contracts v1; backend blueprint service boundary.
- Người hoặc phần việc cần phối hợp: Bách rà soát dữ liệu grade đủ cho event contract và telemetry correlation.
- Rủi ro/giả định: Submission là authority xác nhận submission; grading schema tối thiểu, không dùng database chung.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Grading API, migration/seed, HTTP client Submission và test | Code | `lms/services/grading/` |
| Gateway/Compose/CI wiring cần thiết | Code / Config | `lms/services/gateway/`, `docker-compose/`, `.github/workflows/ci.yml` |

## Definition of Done

- [x] Grading tạo/cập nhật grade theo HTTP contract, validation/authorization/error envelope rõ ràng và gọi Submission qua HTTP để xác nhận input.
- [x] `grading_db` được migration/seed từ trạng thái sạch, chạy lại không nhân bản dữ liệu; không cross-service database/source import.
- [x] Health, config, Compose/Gateway wiring và unit/PostgreSQL integration tests phù hợp pass.
- [x] HTTP server/client và PostgreSQL telemetry giữ trace context, có dependency identity/error semantics và không lộ secret/PII.
- [x] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi review.
- [x] Ngoại lệ theo xác nhận trực tiếp của Đức: Bách không thể review nên review do subagent AI theo chỉ định của Đức thực hiện; completion metadata được commit/push vào chính PR trước merge dù chưa có verdict GitHub `APPROVED`; không coi đây là GitHub approval.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-08_2026-09-20_to_2026-09-26/task-04_implement-grading-service/input/task-input.md)
- Output workspace: [task-output.md](../../../../../workspace/duc/week-08_2026-09-20_to_2026-09-26/task-04_implement-grading-service/output/task-output.md)
- Pull request: [#32](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/32)
- Kết quả review: Review nội bộ vòng 1 bởi subagent AI theo chỉ định của Đức (thay Bách), không có blocking, 4 góp ý non-blocking đã xử lý ([comment PR](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/32#issuecomment-6053804131)); **chưa có verdict GitHub `APPROVED`**.

## Cập nhật tiến độ

- Cập nhật gần nhất: 08/10/2026 — xử lý feedback review nội bộ vòng 1, cập nhật contract v1 §10; finalization theo ngoại lệ do Đức xác nhận.
- Ghi chú/tồn đọng: Task sẵn sàng merge theo ngoại lệ của Đức; GitHub chưa có `APPROVED` từ thành viên còn lại. Timeline/JSON chờ đồng bộ bằng Windows PowerShell (script không chạy được trên Linux); Đức chỉ thị tiếp tục, không sửa tay đầu ra.
