# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_define-evaluation-protocol` |
| Tên task | Chốt experiment metadata, dataset split và evaluation protocol v0 |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 30/08/2026 |
| Thời gian dự kiến | Làm bù sau tuần 4; dự kiến 1–2 phiên làm việc, thời lượng thực tế sẽ ghi ở output. |
| Nhánh thực hiện | `docs/week-04/task-05-define-evaluation-protocol` |
| Pull request dự kiến | Chưa tạo; chỉ mở sau khi artifact và DoD đã sẵn sàng. |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo evaluation protocol v0, gồm experiment metadata, đơn vị split theo experiment run, ranh giới train/validation/test, metric detection/RCA/system và cách lưu artifact. Protocol phải được chốt trước khi phát triển detector/RCA.

### Phạm vi không thực hiện

- Không train/tune model trên test campaign.
- Không triển khai experiment runner hoặc dashboard.
- Không thêm benchmark/dataset bên ngoài vào critical path MVP.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Evaluation protocol v0 | Docs | `docs/processed/architecture/evaluation-protocol-v0.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: RQ/metrics v1, AI/RCA blueprint, task-04 và fault matrix draft từ task-03.
- Người cần phối hợp: Đức kiểm tra mỗi metadata/artifact có thể sinh/lưu được từ Compose, workload, fault và runner dự kiến.
- Rủi ro hoặc giả định: test manifest phải freeze trước final campaign để chống leakage/tuning theo kết quả test.

## Definition of Done

- [ ] Protocol định nghĩa experiment manifest/metadata, run artifact, cách split theo run và quy tắc freeze test campaign.
- [ ] Có metric detection, RCA service-level và system phù hợp RQ/AI-RCA blueprint, cùng cách xử lý baseline/ablation/robustness MVP.
- [ ] Protocol nêu rõ đầu vào ground truth, thiếu dữ liệu/missing modality và điều kiện tái lập.
- [ ] Đức review khả năng orchestration/lưu artifact; các requirement không khả thi được ghi rõ trước tuần 5.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
