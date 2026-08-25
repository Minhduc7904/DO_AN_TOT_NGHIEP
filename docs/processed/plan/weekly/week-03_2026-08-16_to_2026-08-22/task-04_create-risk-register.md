# Task tuần: Lập risk register và quy tắc giảm scope

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_create-risk-register` |
| Tuần | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức review rủi ro platform, observability và reproducibility |
| Ưu tiên | Trung bình |
| Hạn dự kiến | 21/08/2026 |
| Nhánh thực hiện | `docs/week-03/task-04-create-risk-register` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tạo risk register v1 cho các rủi ro scope, testbed, observability, telemetry/data quality, fault reproducibility, data leakage, model/RCA, evaluation và tiến độ. Mỗi rủi ro có tín hiệu sớm, mức độ, người theo dõi, biện pháp giảm thiểu và quy tắc cắt scope.

### Không thực hiện

- Không tạo risk register cấp vận hành/production không liên quan đồ án.
- Không thay thế quy tắc chống scope creep trong plan canonical.
- Không đánh dấu rủi ro đã đóng nếu chưa có bằng chứng.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: plan v0.2, hai blueprint và scope/RQ v1 khi có.
- Người hoặc phần việc cần phối hợp: Đức review rủi ro ở Compose, instrumentation, fault, workload và experiment runner.
- Rủi ro/giả định: register phải đủ ngắn để được rà soát mỗi tuần.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Risk register v1 | Docs | `docs/processed/plan/risk-register-v1.md` |

## Definition of Done

- [ ] Register bao phủ tối thiểu scope, testbed, observability, telemetry/data quality, reproducibility, data leakage, evaluation và tiến độ.
- [ ] Mỗi rủi ro có tín hiệu sớm, mức độ ưu tiên, owner, mitigation và quy tắc giảm/cắt scope cụ thể.
- [ ] Các rủi ro đã có trong plan/blueprint được giữ nhất quán; không tạo quyết định kiến trúc cạnh tranh.
- [ ] Đức đã review nhóm rủi ro platform/experiment; các hành động tuần 4 được liên kết hoặc ghi rõ là tồn đọng.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.

## Cập nhật tiến độ

- Cập nhật gần nhất: 16/08/2026 — task được phân công.
- Ghi chú/tồn đọng: chờ scope/RQ v1 để chốt mức ưu tiên.
