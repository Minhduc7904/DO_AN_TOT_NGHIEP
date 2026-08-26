# Task tuần: Chốt research questions và metric đánh giá

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-research-questions-and-metrics` |
| Tuần | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Bách |
| Collaborator | Đức kiểm tra tính khả thi của telemetry, fault và experiment |
| Ưu tiên | Cao |
| Hạn dự kiến | 20/08/2026 |
| Nhánh thực hiện | `docs/week-03/task-03-define-research-questions-and-metrics` |

## Yêu cầu và phạm vi

### Cần thực hiện

Chốt tập RQ và metric v1 phục vụ anomaly detection, incident detection, RCA, cost hệ thống và robustness. Mỗi RQ phải có giả thuyết hoặc phép so sánh, input telemetry/ground truth cần thiết, phương pháp/baseline và metric đánh giá tương ứng.

### Không thực hiện

- Không chọn hoặc huấn luyện model cuối cùng.
- Không thay đổi telemetry contract hay evaluation protocol chi tiết của tuần 4.
- Không thêm RQ tùy chọn nếu chưa chứng minh đủ nguồn lực để đánh giá.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: định hướng tổng thể (RQ1–RQ5), AI/RCA blueprint và backend blueprint.
- Người hoặc phần việc cần phối hợp: Đức xác nhận mỗi metric có thể thu được từ testbed, workload, fault và ground truth dự kiến.
- Rủi ro/giả định: metric phải phù hợp granularity service-level MVP và tách training/validation/test theo experiment run.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Research questions và metrics v1 | Docs | `docs/processed/direction/research-questions-and-metrics-v1.md` |

## Definition of Done

- [ ] RQ1–RQ5 được ghi rõ, có phạm vi MVP và loại phép so sánh/ablation dự kiến; RQ6 chỉ xuất hiện nếu được quyết định bổ sung có chủ đích.
- [ ] Có bảng ánh xạ RQ → telemetry/ground truth → baseline hoặc phương pháp → metric detection/RCA/system/robustness.
- [ ] Metric detection, RCA và system phù hợp blueprint, bao gồm quy tắc không tune trên test campaign.
- [ ] Đức đã review tính khả thi của việc instrument, inject fault, thu ground truth và chạy evaluation cho từng RQ.

## Liên kết hồ sơ thực hiện

- Input workspace: [`workspace/bach/week-03_2026-08-16_to_2026-08-22/task-03_define-research-questions-and-metrics/input/task-input.md`](../../../../../workspace/bach/week-03_2026-08-16_to_2026-08-22/task-03_define-research-questions-and-metrics/input/task-input.md).
- Output workspace: [`workspace/bach/week-03_2026-08-16_to_2026-08-22/task-03_define-research-questions-and-metrics/output/task-output.md`](../../../../../workspace/bach/week-03_2026-08-16_to_2026-08-22/task-03_define-research-questions-and-metrics/output/task-output.md).
- Pull request: Chưa tạo.

## Cập nhật tiến độ

- Cập nhật gần nhất: 26/08/2026 — Bách đã khởi tạo task theo workflow và bắt đầu thực hiện.
- Ghi chú/tồn đọng: là đầu vào cho task-04 và task-05.
