# Task tuần: Tổng hợp literature matrix cho baseline/phương pháp

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_create-literature-matrix` |
| Tuần | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức review tính phù hợp với testbed, telemetry và fault có thể tạo |
| Ưu tiên | Trung bình |
| Hạn dự kiến | 22/08/2026 |

## Yêu cầu và phạm vi

### Cần thực hiện

Lập literature matrix v0 cho các baseline và hướng phương pháp cần thiết cho anomaly detection, incident detection, dependency/temporal RCA, multi-source fusion, evidence và evaluation. Matrix là căn cứ chọn baseline khả thi cho MVP, không phải bài tổng quan đầy đủ.

### Không thực hiện

- Không viết literature review hoàn chỉnh cho báo cáo tốt nghiệp.
- Không chọn phương pháp deep learning, LLM hoặc causal discovery làm core chỉ vì mới lạ.
- Không đưa nguồn không truy xuất được hoặc không ghi metadata vào matrix.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: RQ/metrics v1, AI/RCA blueprint và định hướng tổng thể.
- Người hoặc phần việc cần phối hợp: Đức kiểm tra từng baseline có thể được đánh giá bằng testbed và artifact dự kiến.
- Rủi ro/giả định: ưu tiên baseline đơn giản, tái lập và giải thích được trước phương pháp phức tạp.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Literature matrix v0 | Docs | `docs/processed/plan/literature-matrix-v0.md` |

## Definition of Done

- [ ] Matrix có tối thiểu 8 nguồn truy xuất được và metadata tối thiểu: tác giả/năm, link hoặc DOI, bài toán, telemetry/input, phương pháp, metric và giới hạn.
- [ ] Matrix có các nhóm baseline cần cho MVP: threshold/z-score hoặc robust z-score, Isolation Forest, RCA dựa dependency/temporal và evaluation phù hợp.
- [ ] Mỗi baseline được gắn với RQ/metric v1 và nhận xét tính khả thi trong testbed hiện tại.
- [ ] Đức đã review tính khả thi của data, fault scenario và telemetry cần cho các baseline ưu tiên.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.

## Cập nhật tiến độ

- Cập nhật gần nhất: 16/08/2026 — task được phân công.
- Ghi chú/tồn đọng: chờ RQ/metrics v1 để chốt ưu tiên đọc tài liệu.
