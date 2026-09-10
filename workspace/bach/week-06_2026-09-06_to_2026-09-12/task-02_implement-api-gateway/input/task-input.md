# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_implement-api-gateway` |
| Tên task | Triển khai Gateway, xác thực JWT cục bộ và error handling |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Chưa bắt đầu |
| Ngày tạo | 10/09/2026 |
| Thời gian dự kiến | 10/09/2026 |
| Nhánh thực hiện | `feat/week-06/task-02-implement-api-gateway` |
| Pull request dự kiến | PR từ nhánh task vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Triển khai Gateway route Auth và cấu hình route Course, xác minh JWT cục bộ, derive principal headers tin cậy, kiểm tra role, propagate trace context và chuẩn hóa timeout/error handling.

### Phạm vi không thực hiện

Không remote-introspect Auth, không thêm API management production-grade, không truy cập database/downstream source và không triển khai business logic.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Gateway và test | Code | `lms/services/gateway/` |
| Runtime/Compose configuration | Code / Docs | `lms/services/gateway/` và cấu hình Compose liên quan |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 đã merge; HTTP contract v1; backend blueprint; telemetry schema v0.
- Người cần phối hợp: Đức review routing, trust boundary và timeout semantics.
- Rủi ro hoặc giả định: public key/secret contract đồng nhất với Auth; retry tắt mặc định.

## Definition of Done

- [ ] Auth routes hoạt động qua Gateway và giữ error envelope canonical.
- [ ] JWT signature/expiry/claims/role được xác minh cục bộ; external principal headers bị strip/overwrite.
- [ ] Outbound timeout cấu hình rõ, retry tắt mặc định và error mapping có test.
- [ ] W3C trace context được propagate; unit/integration tests và build pass.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
