# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-submission-contract-and-storage-tests` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 25/09/2026 (UTC+7) |
| Hoàn thành thực tế | Chưa hoàn thành workflow |
| Tổng thời lượng | Chưa chốt |
| Pull request | [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29) |
| Người review | Đức — chờ review trên GitHub |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Bổ sung suite tích hợp gọi Submission qua HTTP, dùng Course/Enrollment stub chạy qua HTTP thật và Storage Mock chạy thành process riêng. Kiểm tra contract request/response, principal headers, W3C `traceparent`, object đã lưu và lỗi khi course/enrollment không hợp lệ.
- Điều khiển Storage Mock qua control plane để thử latency, lỗi 503 và timeout 504. Kiểm tra Submission không tạo metadata khi dependency lỗi, rồi hoạt động lại sau reset. Test dùng repository trong bộ nhớ; không kiểm chứng PostgreSQL ở suite này.
- Kiểm tra graph span `submission→course/enrollment/storage`, quan hệ parent với Submission HTTP server span, status lỗi, metric request/error/duration và không đưa dữ liệu nhạy cảm vào attributes/labels.
- Nối suite vào `test:telemetry`; toàn bộ `pnpm run ci:verify` pass ngày 25/09/2026. Node local là 22.22.0, khác bản pin 22.13.1 nên pnpm có cảnh báo engine.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Suite contract, Storage Mock fault và topology | Code | [contract-storage-integration.mjs](../../../../../lms/services/submission/test/contract-storage-integration.mjs) |
| Quality gate chạy suite | Cấu hình | [package.json](../../../../../lms/package.json) |
| Pull request | GitHub | [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| HTTP contract Submission↔Course và Submission↔Enrollment | Đạt tại local | Suite xác nhận Course path/principal headers, Enrollment query, response 404/403 và W3C context; `pnpm run ci:verify` pass |
| Storage Mock latency/error và hành vi khi lỗi/timeout | Đạt tại local | Storage Mock process qua HTTP: latency 10 ms → 201, unavailable → 503, latency 600 ms với timeout 200 ms → 504; không tạo metadata mới khi lỗi, reset → 201 |
| Span/metric Submission HTTP và ba dependency có identity/status/duration/error | Đạt tại local | Assertion parent span, `dependency_identity`, HTTP/server và dependency metrics; histogram duration có dữ liệu, error counter phân biệt `unavailable`/`timeout` |
| Topology trace khớp Submission→Course/Enrollment/storage | Đạt tại local | Suite so sánh ba CLIENT span với cùng SERVER parent span và trace ID |
| Không đưa secret, JWT, PII, ground truth, label cardinality cao vào telemetry | Đạt trong phạm vi suite | Assertion kiểm tra metric/trace attributes không chứa content, principal/course ID, `root_cause`, `fault_id`, JWT hoặc trace ID làm label; chưa thay thế kiểm tra production |
| Sản phẩm được push và truy cập qua PR | Đạt | Commit `2934a50` đã push trên nhánh task; [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29) |
| URL PR và `Chờ review` nằm trên PR head trước review | Đạt sau commit metadata này | Card, overview và hồ sơ ghi PR #29; commit transition được push lên PR head trước review |
| GitHub `APPROVED` và completion metadata trước merge | Chưa đạt | Chưa review/finalization |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không thay đổi phạm vi. Dùng Course/Enrollment HTTP stub và Storage Mock process thật để test contract; không chạy PostgreSQL trong suite mới.
- Việc chưa hoàn thành hoặc trở ngại: Chờ Đức review và GitHub `APPROVED` hợp lệ trước finalization. Runtime PowerShell để đồng bộ JSON/timeline hiện thiếu; theo chỉ thị trực tiếp của Bách, bước timeline được để lại.
- Bước tiếp theo: Đức review PR #29 sau khi commit `Chờ review` đã xuất hiện trên remote PR head; Bách xử lý feedback nếu có rồi finalization trước merge.

> `Hoàn thành thực tế` chỉ điền sau khi đủ bằng chứng DoD và finalization hợp lệ; không ghi merge time.
