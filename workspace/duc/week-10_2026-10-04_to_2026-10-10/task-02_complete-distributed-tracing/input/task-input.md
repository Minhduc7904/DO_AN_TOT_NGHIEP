# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_complete-distributed-tracing` |
| Tên task | Hoàn thiện distributed tracing toàn topology |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Chờ review |
| Ngày tạo | 21/10/2026 |
| Thời gian dự kiến | Một phiên triển khai, kiểm chứng và review bù tiến độ |
| Nhánh thực hiện | `feat/week-10/task-02-complete-distributed-tracing` |
| Pull request dự kiến | [PR #42](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/42) vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Kiểm kê và hoàn thiện manual tracing của tám runtime, vòng đời HTTP span và flush SDK; thêm metadata HTTP/dependency có kiểm soát, kiểm tra error semantics và làm sạch dữ liệu nhạy cảm. Kiểm chứng trace thật trên Compose/Tempo qua hai workflow HTTP/async, tám resource identity và PostgreSQL/Redis/storage/RabbitMQ.

### Phạm vi không thực hiện

Không đổi business API/event payload/database schema; không bật auto-instrumentation trùng manual spans; không triển khai metrics task-03 hoặc structured logger/dashboard task-04/05. Retry background không có context gốc không được tạo parent giả.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Tracing primitives và adapters | Code | `lms/packages/observability/`, `lms/services/` |
| Unit và Compose/Tempo tracing smoke | Test | `lms/packages/observability/test/`, `lms/test/observability/` |
| Semantics và hướng dẫn kiểm chứng | Docs | README observability và Compose |
| Nghiệm thu tracing trên CI | Config | `.github/workflows/ci.yml` |

## Đầu vào và phụ thuộc

- [Card task canonical](../../../../../docs/processed/plan/weekly/week-10_2026-10-04_to_2026-10-10/task-02_complete-distributed-tracing.md), task-01/PR #41 đã vào `main`; service catalogue, HTTP/event contract và telemetry schema hiện có.
- Đức cho phép implement agent, review agent độc lập và điều phối viên finalization/merge theo ngoại lệ thiếu review Bách; không ghi agent verdict thành GitHub `APPROVED` của Bách. Xem [quy tắc Git](../../../../../docs/processed/rules/git-and-pull-request-rules.md#ưu-tiên-chỉ-thị-trực-tiếp-và-ghi-nhận-ngoại-lệ).
- Trace workflow dùng synthetic caller context để liên kết các HTTP action độc lập; async consumer phải là con của producer và process là con consumer. Storage giữ resource `submission-storage`, không mở rộng RCA candidate set.

## Definition of Done

- [ ] Tám runtime có đúng ba resource identity; test chặn thiếu/sai tên canonical.
- [ ] Workflow HTTP có parent-child hợp lệ qua Gateway/client/dependency và không span trùng.
- [ ] Luồng Grading → RabbitMQ → Notification giữ trace/producer-consumer-process identity thực tế.
- [ ] PostgreSQL, Redis, storage có span đúng dependency; timeout/unavailable có error status/type phù hợp, không secret/PII/payload/fault label.
- [ ] HTTP finish/close/abort/exception kết thúc span đúng một lần; default SDK processor thực sự flush; baseline AlwaysOn/W3C giữ nguyên.
- [ ] Unit/integration phù hợp, full quality gates và actual Compose/Tempo smoke đạt; CI chạy tracing smoke trên stack đã sẵn sàng.
- [ ] URL PR và `Chờ review` được push trước review; điều phối viên finalization/merge sau verdict agent độc lập theo ngoại lệ đã xác nhận.
