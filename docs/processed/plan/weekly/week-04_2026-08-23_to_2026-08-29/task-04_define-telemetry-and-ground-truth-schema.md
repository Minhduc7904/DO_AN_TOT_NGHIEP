# Task tuần: Chốt telemetry schema và ground-truth schema v0

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_define-telemetry-and-ground-truth-schema` |
| Tuần | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức kiểm tra khả năng instrument/export từ testbed |
| Ưu tiên | Cao |
| Hạn dự kiến | 27/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-04-define-telemetry-and-ground-truth-schema` |

## Yêu cầu và phạm vi

### Cần thực hiện

Chốt schema telemetry v0 cho metrics, traces và logs, cùng ground-truth schema cho run/fault. Schema cần có identity, UTC time, correlation, coverage/data-quality field và mapping đủ cho feature/RCA sau này.

### Không thực hiện

- Không viết collector, instrument code hoặc feature pipeline.
- Không chốt model/detector cuối cùng.
- Không yêu cầu observability modality ngoài MVP nếu không có giá trị evaluation rõ.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: AI/RCA blueprint, task-01 và task-03 draft.
- Người hoặc phần việc cần phối hợp: Đức xác thực các field/resource attribute thực sự có thể export từ service/dependency, workload và fault hook.
- Rủi ro/giả định: missing telemetry phải biểu diễn rõ, không thay bằng giá trị 0 máy móc.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Telemetry và ground-truth schema v0 | Docs | `docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md` |

## Definition of Done

- [ ] Schema nêu identity, UTC time, trace/log/metric correlation, resource attributes và coverage/data-quality cho mỗi modality.
- [ ] Ground truth có run ID, fault target/type, start/end, parameters, expected symptom và reset/verification metadata.
- [ ] Schema ánh xạ được tới service/edge feature và service-level RCA trong AI/RCA blueprint.
- [ ] Đức review khả năng instrument/export; field không thể thu được đã được loại hoặc ghi rõ giải pháp.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 23/08/2026 — task được phân công.
- Ghi chú/tồn đọng: là đầu vào của task-02, task-03 và task-05.
