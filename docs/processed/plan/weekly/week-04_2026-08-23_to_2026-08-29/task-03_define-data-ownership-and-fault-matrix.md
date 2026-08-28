# Task tuần: Chốt data ownership, dependency strategy và fault matrix MVP

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-data-ownership-and-fault-matrix` |
| Tuần | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Đức review ground truth, symptom và evidence cần cho RCA |
| Ưu tiên | Cao |
| Hạn dự kiến | 28/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-03-define-data-ownership-and-fault-matrix` |

## Yêu cầu và phạm vi

### Cần thực hiện

Chốt database/cache/queue/storage ownership theo service và fault matrix MVP. Matrix phải xác định target, injector/hook, workload context, expected symptom/propagation, ground truth và cách reset cho từng fault scenario.

### Không thực hiện

- Không triển khai injector, Chaos Mesh hoặc fault platform.
- Không thêm multi-fault, component-level RCA hoặc resilience scenario Stretch.
- Không cho phép truy cập database chéo giữa các service.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01, task-02, backend blueprint và input telemetry/ground truth từ task-04.
- Người hoặc phần việc cần phối hợp: Đức kiểm tra mỗi fault có label ground truth và evidence đủ cho RCA/evaluation.
- Rủi ro/giả định: fault phải controllable, quan sát được và có thời điểm bắt đầu/kết thúc rõ ràng.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Data ownership và fault matrix MVP | Docs | `docs/processed/architecture/data-ownership-and-fault-matrix-v1.md` |

## Definition of Done

- [x] Có bảng ownership cho PostgreSQL logical database, Redis, RabbitMQ và storage mock; không có database access chéo.
- [x] Fault matrix có tối thiểu năm scenario MVP, mỗi scenario gồm target, injector/hook, workload, ground truth, symptom/propagation và reset/verification.
- [x] Mỗi fault có thể ánh xạ tới service-level RCA evaluation và không vượt scope MVP.
- [ ] Đức review label ground truth/evidence; các rủi ro chưa giải quyết được ghi rõ.

## Liên kết hồ sơ thực hiện

- Input workspace: [`task-input.md`](../../../../../workspace/bach/week-04_2026-08-23_to_2026-08-29/task-03_define-data-ownership-and-fault-matrix/input/task-input.md).
- Output workspace: [`task-output.md`](../../../../../workspace/bach/week-04_2026-08-23_to_2026-08-29/task-03_define-data-ownership-and-fault-matrix/output/task-output.md).
- Pull request: [PR #11](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/11).
- Kết quả review: Chờ ghi nhận finalization sau AI self-review do Bách xác nhận.

## Cập nhật tiến độ

- Cập nhật gần nhất: 28/08/2026 — Bách đã hoàn thiện artifact, tạo PR #11 và chuyển task sang `Chờ review`.
- Ghi chú/tồn đọng: artifact đã cross-check với topology, HTTP/event contract và telemetry/ground-truth schema v0.
