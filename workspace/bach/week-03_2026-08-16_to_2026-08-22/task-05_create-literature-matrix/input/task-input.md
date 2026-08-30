# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_create-literature-matrix` |
| Tên task | Tổng hợp literature matrix cho baseline/phương pháp |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 30/08/2026 |
| Thời gian dự kiến | Làm bù sau tuần 3; thời lượng cụ thể sẽ chốt trước khi thực hiện substantive work |
| Nhánh thực hiện | `docs/week-03/task-05-create-literature-matrix` |
| Pull request dự kiến | Chưa tạo; sẽ cập nhật sau khi hoàn thiện substantive work |

## Mục tiêu và phạm vi

### Task cần làm gì?

Lập literature matrix v0 cho các baseline và hướng phương pháp cần thiết cho anomaly detection, incident detection, dependency/temporal RCA, multi-source fusion, evidence và evaluation. Matrix là căn cứ chọn baseline khả thi cho MVP, không phải bài tổng quan đầy đủ.

### Phạm vi không thực hiện

- Không viết literature review hoàn chỉnh cho báo cáo tốt nghiệp.
- Không chọn phương pháp deep learning, LLM hoặc causal discovery làm core chỉ vì mới lạ.
- Không đưa nguồn không truy xuất được hoặc không ghi metadata vào matrix.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Literature matrix v0 | Docs | `docs/processed/plan/literature-matrix-v0.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: RQ/metrics v1, AI/RCA blueprint và định hướng tổng thể.
- Người cần phối hợp: Đức kiểm tra từng baseline có thể được đánh giá bằng testbed và artifact dự kiến.
- Rủi ro hoặc giả định: ưu tiên baseline đơn giản, tái lập và giải thích được trước phương pháp phức tạp.

## Definition of Done

- [ ] Matrix có tối thiểu 8 nguồn truy xuất được và metadata tối thiểu: tác giả/năm, link hoặc DOI, bài toán, telemetry/input, phương pháp, metric và giới hạn.
- [ ] Matrix có các nhóm baseline cần cho MVP: threshold/z-score hoặc robust z-score, Isolation Forest, RCA dựa dependency/temporal và evaluation phù hợp.
- [ ] Mỗi baseline được gắn với RQ/metric v1 và nhận xét tính khả thi trong testbed hiện tại.
- [ ] Đức đã review tính khả thi của data, fault scenario và telemetry cần cho các baseline ưu tiên.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
