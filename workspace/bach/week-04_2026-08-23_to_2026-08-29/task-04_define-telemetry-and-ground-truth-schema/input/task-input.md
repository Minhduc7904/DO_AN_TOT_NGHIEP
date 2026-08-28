# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_define-telemetry-and-ground-truth-schema` |
| Tên task | Chốt telemetry schema và ground-truth schema v0 |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Chờ review |
| Ngày tạo | 28/08/2026 |
| Thời gian dự kiến | 28/08/2026, theo hạn của card task |
| Nhánh thực hiện | `docs/week-04/task-04-define-telemetry-and-ground-truth-schema` |
| Pull request dự kiến | Chưa tạo; sẽ tạo sau khi hoàn thành work và DoD |

## Mục tiêu và phạm vi

### Task cần làm gì?

Chốt schema telemetry v0 cho metrics, traces và logs, cùng ground-truth schema cho run/fault. Schema cần có identity, UTC time, correlation, coverage/data-quality field và mapping đủ cho feature/RCA sau này.

### Phạm vi không thực hiện

- Không viết collector, instrument code hoặc feature pipeline.
- Không chốt model/detector cuối cùng.
- Không yêu cầu observability modality ngoài MVP nếu không có giá trị evaluation rõ.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Telemetry và ground-truth schema v0 | Docs | `docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: AI/RCA blueprint, task-01 và task-03 draft.
- Người cần phối hợp: Đức xác thực các field/resource attribute thực sự có thể export từ service/dependency, workload và fault hook.
- Rủi ro hoặc giả định: missing telemetry phải biểu diễn rõ, không thay bằng giá trị 0 máy móc.

## Definition of Done

- [ ] Schema nêu identity, UTC time, trace/log/metric correlation, resource attributes và coverage/data-quality cho mỗi modality.
- [ ] Ground truth có run ID, fault target/type, start/end, parameters, expected symptom và reset/verification metadata.
- [ ] Schema ánh xạ được tới service/edge feature và service-level RCA trong AI/RCA blueprint.
- [ ] Đức review khả năng instrument/export; field không thể thu được đã được loại hoặc ghi rõ giải pháp.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
