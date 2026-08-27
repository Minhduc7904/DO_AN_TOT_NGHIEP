# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_create-risk-register` |
| Tên task | Lập risk register và quy tắc giảm scope |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 27/08/2026 |
| Thời gian dự kiến | Theo hạn dự kiến trong task card: 21/08/2026; thời lượng cụ thể sẽ chốt khi bắt đầu deliverable |
| Nhánh thực hiện | `docs/week-03/task-04-create-risk-register` |
| Pull request dự kiến | PR vào `main` từ branch task này, sẽ tạo sau khi hoàn tất deliverable |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo risk register v1 cho các rủi ro scope, testbed, observability, telemetry/data quality, fault reproducibility, data leakage, model/RCA, evaluation và tiến độ. Mỗi rủi ro phải có tín hiệu sớm, mức độ ưu tiên, người theo dõi, biện pháp giảm thiểu và quy tắc cắt scope.

### Phạm vi không thực hiện

- Không tạo risk register cấp vận hành/production không liên quan đồ án.
- Không thay thế quy tắc chống scope creep trong plan canonical.
- Không đánh dấu rủi ro đã đóng nếu chưa có bằng chứng.
- Chưa tạo artifact risk register trong phiên setup này.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Risk register v1 | Docs | `docs/processed/plan/risk-register-v1.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: plan v0.2, hai blueprint và scope/RQ v1 khi có.
- Người cần phối hợp: Đức review rủi ro platform, observability và reproducibility; cụ thể Compose, instrumentation, fault, workload và experiment runner.
- Rủi ro hoặc giả định: register phải đủ ngắn để được rà soát mỗi tuần; mức ưu tiên cần nhất quán với plan/blueprint và không tạo quyết định kiến trúc cạnh tranh.

## Definition of Done

- [ ] Register bao phủ tối thiểu scope, testbed, observability, telemetry/data quality, reproducibility, data leakage, evaluation và tiến độ.
- [ ] Mỗi rủi ro có tín hiệu sớm, mức độ ưu tiên, owner, mitigation và quy tắc giảm/cắt scope cụ thể.
- [ ] Các rủi ro đã có trong plan/blueprint được giữ nhất quán; không tạo quyết định kiến trúc cạnh tranh.
- [ ] Đức đã review nhóm rủi ro platform/experiment; các hành động tuần 4 được liên kết hoặc ghi rõ là tồn đọng.
- [ ] Risk register được lưu tại `docs/processed/plan/risk-register-v1.md` và có thể truy cập.
- [ ] Pull request từ branch task vào `main` có đủ mục bắt buộc, được Đức review và chỉ được merge sau khi task đạt trạng thái `Hoàn thành`.
