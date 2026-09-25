# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-submission-contract-and-storage-tests` |
| Tên task | Bổ sung contract/integration test cho Submission và storage dependency |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 25/09/2026 |
| Thời gian dự kiến | Bắt đầu 25/09/2026; hạn canonical 19/09/2026 đã qua và chưa tự thay đổi kế hoạch |
| Nhánh thực hiện | `test/week-07/task-05-add-submission-contract-and-storage-tests` |
| Pull request dự kiến | Sẽ tạo từ nhánh task vào `main` sau khi có bằng chứng DoD |

## Mục tiêu và phạm vi

### Task cần làm gì?

Bổ sung HTTP contract test cho Submission↔Course và Submission↔Enrollment. Bổ sung integration test cho storage mock dependency, bao phủ latency injection, error injection và hành vi Submission khi storage lỗi hoặc timeout theo error envelope canonical. Kiểm tra topology từ trace để xác nhận các dependency `submission→course`, `submission→enrollment` và `submission→storage` có identity, status, duration và error cần thiết.

### Phạm vi không thực hiện

Không triển khai business logic Submission mới ngoài thay đổi tối thiểu để test pass; không bổ sung fault injector F1 đầy đủ, benchmark hoặc experiment campaign; không đưa student/course/submission ID, trace ID hay error message tùy ý vào Prometheus label có cardinality cao.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Contract/integration test Submission↔Course, Submission↔Enrollment và storage mock | Code | `lms/services/submission/` hoặc `lms/test/` |
| Assertion topology trace cho các dependency của Submission | Code | `lms/services/submission/` hoặc `lms/test/` |
| Pull request task | GitHub | Tạo từ nhánh task vào `main` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: Task 4 đã merge vào `main` qua PR #28; `docs/processed/architecture/http-and-event-contracts-v1.md`; `docs/processed/architecture/data-ownership-and-fault-matrix-v1.md`; `docs/processed/architecture/telemetry-and-ground-truth-schema-v1.md`; policy lỗi/timeout Week 6.
- Người cần phối hợp: Đức review dependency identity, RED metrics và topology sinh từ trace.
- Rủi ro hoặc giả định: Storage failure behavior phải nhất quán với error/timeout policy chung, không che lỗi thật của Course hoặc Enrollment, và telemetry không tiết lộ secret, JWT, PII hay ground-truth label.

## Definition of Done

- [x] Ít nhất một HTTP contract test cho Submission↔Course và một cho Submission↔Enrollment pass.
- [x] Test bao phủ storage mock latency injection, error injection và invalidation/fallback behavior theo policy đã chốt.
- [x] Span/metric cho Submission HTTP, `submission→course`, `submission→enrollment` và `submission→storage` có dependency identity canonical cùng status/duration/error cần thiết.
- [x] Topology sinh ra từ trace khớp dependency graph Submission→Course/Enrollment/storage và có assertion kiểm tra.
- [x] Telemetry không chứa secret, JWT, PII, ground-truth label hoặc label cardinality cao bị cấm.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
