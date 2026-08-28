# Input task

> Hồ sơ này được ghi nhận hồi tố ngày 27/08/2026 từ card task và artifact Đức đã cung cấp.

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-mvp-scope` |
| Tên task | Chốt scope và out-of-scope MVP |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-03_2026-08-16_to_2026-08-22` |
| Trạng thái | Hoàn thành |
| Ngày tạo | 27/08/2026 (ghi nhận hồi tố) |
| Thời gian dự kiến | 16/08/2026–18/08/2026 theo kế hoạch tuần |
| Nhánh thực hiện | `docs/week-03/task-01-define-mvp-scope` |
| Pull request | [#4](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/4) |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo scope v1 cho đồ án, chuyển các quyết định MVP, Target và Stretch trong tài liệu canonical thành phạm vi bắt buộc, phạm vi trì hoãn và phạm vi không thực hiện. Mỗi hạng mục MVP phải phục vụ trực tiếp dependency, fault propagation, telemetry, ground truth hoặc evaluation.

### Phạm vi không thực hiện

- Không thay đổi topology canonical gồm 6 business service và API Gateway.
- Không thêm feature LMS, Kubernetes, service mesh, deep learning hoặc LLM reasoning vào MVP.
- Không scaffold mã nguồn Backend hoặc Python trong task này.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Scope/out-of-scope v1 | Docs | [`docs/processed/direction/project-scope-v1.md`](../../../../../docs/processed/direction/project-scope-v1.md) |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: định hướng tổng thể, backend blueprint, Analysis/AI/RCA blueprint và plan v0.2.
- Người cần phối hợp: Bách review để bảo đảm scope Backend không loại bỏ telemetry/data cần cho analysis và không mở rộng LMS ngoài giá trị nghiên cứu.
- Rủi ro hoặc giả định: scope phải đủ nhỏ để nhóm hai người hoàn thành critical path trước cuối tuần 22.

## Definition of Done

- [x] File scope phân biệt rõ MVP, Target, Stretch và ngoài phạm vi; mỗi nhóm dẫn chiếu tài liệu canonical phù hợp.
- [x] MVP nêu rõ 6 business service + Gateway, dependency observability/fault cần thiết và không có hạng mục production-grade ngoài scope.
- [x] Có bảng out-of-scope nêu lý do hoãn/loại các hạng mục dễ gây scope creep.
- [x] Bách đã review tác động tới telemetry, feature, anomaly/RCA và evaluation; phản hồi được xử lý, bao gồm blocking issue RQ5.
- [x] Sản phẩm được lưu tại vị trí dự kiến và có thể truy cập.
- [x] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước khi Bách bắt đầu review.
- [x] Sau verdict `APPROVED`, completion metadata được commit/push vào chính PR trước merge.
