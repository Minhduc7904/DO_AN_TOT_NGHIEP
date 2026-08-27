# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-research-questions-and-metrics` |
| Tên task | Chốt research questions và metric đánh giá |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 26/08/2026 |
| Thời gian dự kiến | Theo hạn dự kiến trong task card: 20/08/2026; thời lượng cụ thể sẽ chốt khi bắt đầu deliverable |
| Nhánh thực hiện | `docs/week-03/task-03-define-research-questions-and-metrics` |
| Pull request dự kiến | PR vào `main` từ branch task này, sẽ tạo sau khi hoàn tất deliverable |

## Mục tiêu và phạm vi

### Task cần làm gì?

Chốt bộ research questions và metric v1 phục vụ anomaly detection, incident detection, RCA, chi phí hệ thống và robustness. Với mỗi RQ, ghi rõ giả thuyết hoặc phép so sánh, telemetry/ground truth cần thiết, phương pháp hoặc baseline và metric đánh giá tương ứng.

### Phạm vi không thực hiện

- Không chọn hoặc huấn luyện model cuối cùng.
- Không thay đổi telemetry contract hoặc evaluation protocol chi tiết của tuần 4.
- Không thêm RQ tùy chọn nếu chưa chứng minh đủ nguồn lực để đánh giá.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Research questions và metrics v1 | Docs | `docs/processed/direction/research-questions-and-metrics-v1.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: định hướng tổng thể (RQ1–RQ5), AI/RCA blueprint và backend blueprint.
- Người cần phối hợp: Đức xác nhận tính khả thi của telemetry, fault và experiment.
- Rủi ro hoặc giả định: metric phải phù hợp granularity service-level MVP và tách training/validation/test theo experiment run.

## Definition of Done

- [ ] RQ1–RQ5 được ghi rõ, có phạm vi MVP và loại phép so sánh/ablation dự kiến; RQ6 chỉ xuất hiện nếu có quyết định bổ sung có chủ đích.
- [ ] Có bảng ánh xạ RQ → telemetry/ground truth → baseline hoặc phương pháp → metric detection/RCA/system/robustness.
- [ ] Metric detection, RCA và system phù hợp blueprint, bao gồm quy tắc không tune trên test campaign.
- [ ] Đức đã review tính khả thi của việc instrument, inject fault, thu ground truth và chạy evaluation cho từng RQ.
- [ ] Sản phẩm được lưu tại `docs/processed/direction/research-questions-and-metrics-v1.md` và có thể truy cập.
- [ ] Pull request từ branch task vào `main` có đủ mục bắt buộc, được Đức review và chỉ được merge sau khi task đạt trạng thái `Hoàn thành`.
