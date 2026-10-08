# Task tuần: Triển khai Grading service và call tới Submission

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-grading-service` |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Chờ review |
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

- [ ] Grading tạo/cập nhật grade theo HTTP contract, validation/authorization/error envelope rõ ràng và gọi Submission qua HTTP để xác nhận input.
- [ ] `grading_db` được migration/seed từ trạng thái sạch, chạy lại không nhân bản dữ liệu; không cross-service database/source import.
- [ ] Health, config, Compose/Gateway wiring và unit/PostgreSQL integration tests phù hợp pass.
- [ ] HTTP server/client và PostgreSQL telemetry giữ trace context, có dependency identity/error semantics và không lộ secret/PII.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-08_2026-09-20_to_2026-09-26/task-04_implement-grading-service/input/task-input.md)
- Output workspace: [task-output.md](../../../../../workspace/duc/week-08_2026-09-20_to_2026-09-26/task-04_implement-grading-service/output/task-output.md)
- Pull request: [#32](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/32)
- Kết quả review: Chờ Bách review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 08/10/2026 — Đức tạo PR #32, đủ bằng chứng kiểm chứng, chuyển `Chờ review`.
- Ghi chú/tồn đọng: Timeline/JSON chờ đồng bộ bằng Windows PowerShell (script không chạy được trên Linux); Đức chỉ thị tiếp tục, không sửa tay đầu ra.
