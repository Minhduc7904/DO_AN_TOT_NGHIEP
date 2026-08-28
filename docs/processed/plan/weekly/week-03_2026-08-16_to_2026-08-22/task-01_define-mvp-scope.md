# Task tuần: Chốt scope và out-of-scope MVP

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-mvp-scope` |
| Tuần | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Đức |
| Collaborator | Bách review để loại feature LMS không phục vụ nghiên cứu |
| Ưu tiên | Cao |
| Hạn dự kiến | 18/08/2026 |
| Nhánh thực hiện | `docs/week-03/task-01-define-mvp-scope` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tạo scope v1 cho đồ án, chuyển các quyết định MVP/Target/Stretch đã có trong blueprint thành danh sách rõ ràng: phần bắt buộc, phần hoãn và phần không làm. Scope phải giải thích vì sao mỗi hạng mục MVP phục vụ dependency, fault propagation, telemetry, ground truth hoặc evaluation.

### Không thực hiện

- Không thay đổi topology canonical 6 business service + API Gateway.
- Không thêm feature LMS, Kubernetes, service mesh, deep learning hoặc LLM reasoning vào MVP.
- Không scaffold mã nguồn Backend hoặc Python trong task này.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: định hướng tổng thể, backend blueprint và AI/RCA blueprint.
- Người hoặc phần việc cần phối hợp: Bách review để bảo đảm scope Backend không loại bỏ dữ liệu/telemetry cần cho analysis và không tăng scope vô ích.
- Rủi ro/giả định: scope phải đủ nhỏ cho hai người hoàn thành trước mốc tuần 22.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Scope/out-of-scope v1 | Docs | `docs/processed/direction/project-scope-v1.md` |

## Definition of Done

- [ ] File scope phân biệt rõ MVP, Target, Stretch và ngoài phạm vi; mỗi nhóm dẫn chiếu blueprint canonical phù hợp.
- [ ] MVP nêu rõ 6 business service + Gateway, dependency observability/fault cần thiết và không có hạng mục production-grade ngoài scope.
- [ ] Có bảng out-of-scope nêu lý do hoãn/loại cho các hạng mục dễ gây scope creep.
- [ ] Bách đã review và phản hồi về tác động tới telemetry, feature, anomaly/RCA và evaluation; phản hồi được xử lý hoặc ghi rõ tồn đọng.

## Liên kết hồ sơ thực hiện

- Input workspace: [`workspace/duc/week-03_2026-08-16_to_2026-08-22/task-01_define-mvp-scope/input/task-input.md`](../../../../../workspace/duc/week-03_2026-08-16_to_2026-08-22/task-01_define-mvp-scope/input/task-input.md).
- Output workspace: [`workspace/duc/week-03_2026-08-16_to_2026-08-22/task-01_define-mvp-scope/output/task-output.md`](../../../../../workspace/duc/week-03_2026-08-16_to_2026-08-22/task-01_define-mvp-scope/output/task-output.md).
- Pull request: [#4](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/4).

## Cập nhật tiến độ

- Cập nhật gần nhất: 28/08/2026 — Bách đã xác nhận verdict `APPROVED`; completion metadata đã được finalization trên chính PR head và task sẵn sàng merge.
- Ghi chú/tồn đọng: blocking issue RQ5 đã được xử lý trong `project-scope-v1.md`; không còn tồn đọng trước merge.
