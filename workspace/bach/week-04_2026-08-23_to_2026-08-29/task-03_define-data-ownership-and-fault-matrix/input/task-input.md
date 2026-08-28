# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-data-ownership-and-fault-matrix` |
| Tên task | Chốt data ownership, dependency strategy và fault matrix MVP |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Chờ review |
| Ngày tạo | 28/08/2026 |
| Thời gian dự kiến | 28/08/2026, theo hạn của card task |
| Nhánh thực hiện | `docs/week-04/task-03-define-data-ownership-and-fault-matrix` |
| Pull request | [PR #11](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/11) |

## Mục tiêu và phạm vi

### Task cần làm gì?

Chốt database/cache/queue/storage ownership theo service và fault matrix MVP. Matrix phải xác định target, injector/hook, workload context, expected symptom/propagation, ground truth và cách reset cho từng fault scenario.

### Phạm vi không thực hiện

- Không triển khai injector, Chaos Mesh hoặc fault platform.
- Không thêm multi-fault, component-level RCA hoặc resilience scenario Stretch.
- Không cho phép truy cập database chéo giữa các service.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Data ownership và fault matrix MVP | Docs | `docs/processed/architecture/data-ownership-and-fault-matrix-v1.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01, task-02, backend blueprint và input telemetry/ground truth từ task-04.
- Người cần phối hợp: Đức review ground truth, symptom và evidence cần cho RCA.
- Rủi ro hoặc giả định: fault phải controllable, quan sát được và có thời điểm bắt đầu/kết thúc rõ ràng.

## Definition of Done

- [x] Có bảng ownership cho PostgreSQL logical database, Redis, RabbitMQ và storage mock; không có database access chéo.
- [x] Fault matrix có tối thiểu năm scenario MVP, mỗi scenario gồm target, injector/hook, workload, ground truth, symptom/propagation và reset/verification.
- [x] Mỗi fault có thể ánh xạ tới service-level RCA evaluation và không vượt scope MVP.
- [ ] Đức review label ground truth/evidence; các rủi ro chưa giải quyết được ghi rõ.
- [x] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [x] URL/số PR và trạng thái `Chờ review` được chuẩn bị để commit/push vào PR head trước finalization.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
