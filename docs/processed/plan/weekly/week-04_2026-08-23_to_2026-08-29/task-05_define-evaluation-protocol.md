# Task tuần: Chốt experiment metadata, dataset split và evaluation protocol v0

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_define-evaluation-protocol` |
| Tuần | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức review tính khả thi của run orchestration và artifact |
| Ưu tiên | Cao |
| Hạn dự kiến | 29/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-05-define-evaluation-protocol` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tạo evaluation protocol v0, gồm experiment metadata, đơn vị split theo experiment run, train/validation/test boundary, metric detection/RCA/system và cách lưu artifact. Protocol phải được chốt trước khi phát triển detector/RCA.

### Không thực hiện

- Không train/tune model trên test campaign.
- Không triển khai experiment runner hoặc dashboard.
- Không thêm benchmark/dataset bên ngoài vào critical path MVP.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: RQ/metrics v1, AI/RCA blueprint, task-04 và fault matrix draft từ task-03.
- Người hoặc phần việc cần phối hợp: Đức kiểm tra mỗi metadata/artifact có thể sinh/lưu được từ Compose, workload, fault và runner dự kiến.
- Rủi ro/giả định: test manifest phải freeze trước final campaign để chống leakage/tuning theo kết quả test.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Evaluation protocol v0 | Docs | `docs/processed/architecture/evaluation-protocol-v0.md` |

## Definition of Done

- [ ] Protocol định nghĩa experiment manifest/metadata, run artifact, cách split theo run và quy tắc freeze test campaign.
- [ ] Có metric detection, RCA service-level và system phù hợp RQ/AI-RCA blueprint, cùng cách xử lý baseline/ablation/robustness MVP.
- [ ] Protocol nêu rõ đầu vào ground truth, thiếu dữ liệu/missing modality và điều kiện tái lập.
- [ ] Đức review khả năng orchestration/lưu artifact; các requirement không khả thi được ghi rõ trước tuần 5.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 23/08/2026 — task được phân công.
- Ghi chú/tồn đọng: phụ thuộc telemetry/ground truth schema và fault matrix draft.
