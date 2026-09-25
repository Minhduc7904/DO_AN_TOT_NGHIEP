# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-submission-contract-and-storage-tests` |
| Người phụ trách | Bách |
| Trạng thái | Hoàn thành trên task branch theo ngoại lệ; PR chưa merge |
| Bắt đầu thực tế | 25/09/2026 10:43 (UTC+7), theo commit đầu tiên của task |
| Hoàn thành thực tế | 25/09/2026 11:23 (UTC+7), finalization trên task branch |
| Tổng thời lượng | Khoảng 40 phút theo mốc commit đầu tiên và finalization |
| Pull request | [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29) |
| Người review | Tự review kỹ thuật theo ủy quyền Đức do Bách xác nhận; không có review submission GitHub |
| Kết quả review | Không có GitHub `APPROVED`; Bách xác nhận ngoại lệ và yêu cầu finalization trực tiếp ngày 25/09/2026 |

## Báo cáo công việc đã làm

- Bổ sung suite tích hợp gọi Submission qua HTTP, dùng Course/Enrollment stub chạy qua HTTP thật và Storage Mock chạy thành process riêng. Kiểm tra contract request/response, principal headers, W3C `traceparent`, object đã lưu và lỗi khi course/enrollment không hợp lệ.
- Điều khiển Storage Mock qua control plane để thử latency, lỗi 503 và timeout 504. Khi client hủy request PUT, Storage Mock dừng thao tác và không ghi object sau timeout; suite kiểm tra thêm điều này qua HTTP. Submission không tạo metadata khi dependency lỗi và hoạt động lại sau reset. Test dùng repository trong bộ nhớ; không kiểm chứng PostgreSQL ở suite này.
- Kiểm tra graph span `submission→course/enrollment/storage`, quan hệ parent với Submission HTTP server span, status lỗi, metric request/error/duration và không đưa dữ liệu nhạy cảm vào attributes/labels.
- Nối suite vào `test:telemetry`; toàn bộ `pnpm run ci:verify` pass ngày 25/09/2026. Node local là 22.22.0, khác bản pin 22.13.1 nên pnpm có cảnh báo engine.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Suite contract, Storage Mock fault và topology | Code | [contract-storage-integration.mjs](../../../../../lms/services/submission/test/contract-storage-integration.mjs) |
| Hủy ghi object khi client ngắt kết nối | Code | [storage.controller.ts](../../../../../lms/services/submission-storage-mock/src/adapters/http/storage/storage.controller.ts), [storage-mock.service.ts](../../../../../lms/services/submission-storage-mock/src/application/storage-mock.service.ts) |
| Quality gate chạy suite | Cấu hình | [package.json](../../../../../lms/package.json) |
| Pull request | GitHub | [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| HTTP contract Submission↔Course và Submission↔Enrollment | Đạt tại local | Suite xác nhận Course path/principal headers, Enrollment query, response 404/403 và W3C context; `pnpm run ci:verify` pass |
| Storage Mock latency/error và hành vi khi lỗi/timeout | Đạt tại local | Storage Mock process qua HTTP: latency 10 ms → 201, unavailable → 503, latency 600 ms với timeout 200 ms → 504; không tạo metadata mới khi lỗi, PUT bị hủy không để lại object sau thời gian fault, reset → 201 |
| Span/metric Submission HTTP và ba dependency có identity/status/duration/error | Đạt tại local | Assertion parent span, `dependency_identity`, HTTP/server và dependency metrics; histogram duration có dữ liệu, error counter phân biệt `unavailable`/`timeout` |
| Topology trace khớp Submission→Course/Enrollment/storage | Đạt tại local | Suite so sánh ba CLIENT span với cùng SERVER parent span và trace ID |
| Không đưa secret, JWT, PII, ground truth, label cardinality cao vào telemetry | Đạt trong phạm vi suite | Assertion kiểm tra metric/trace attributes không chứa content, principal/course ID, `root_cause`, `fault_id`, JWT hoặc trace ID làm label; chưa thay thế kiểm tra production |
| Sản phẩm được push và truy cập qua PR | Đạt | Các thay đổi đã push trên nhánh task; [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29), checks trên commit `32ec62b` đều pass |
| URL PR và `Chờ review` nằm trên PR head trước review | Đạt sau commit metadata này | Card, overview và hồ sơ ghi PR #29; commit transition được push lên PR head trước review |
| GitHub `APPROVED` và completion metadata trước merge | Hoàn tất metadata theo ngoại lệ; thiếu GitHub approval | Không có submission `APPROVED` trên GitHub. Bách xác nhận ngoại lệ trực tiếp ngày 25/09/2026 sau cảnh báo; tự review kỹ thuật không được ghi thành verdict GitHub. Metadata finalization được ghi trên chính task branch trước merge. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không thay đổi phạm vi. Dùng Course/Enrollment HTTP stub và Storage Mock process thật để test contract; không chạy PostgreSQL trong suite mới.
- Việc chưa hoàn thành hoặc trở ngại: Không có GitHub `APPROVED`; finalization thực hiện theo ngoại lệ do Bách yêu cầu. Đồng bộ JSON/timeline chưa chạy được vì thiếu runtime PowerShell; timeline đang chờ đồng bộ và không được sửa tay.
- Bước tiếp theo: Bách xem lại trạng thái PR #29 và tự yêu cầu/thực hiện merge theo giới hạn branch protection; chưa có merge metadata nào được ghi nhận.

> `Hoàn thành thực tế` chỉ điền sau khi đủ bằng chứng DoD và finalization hợp lệ; không ghi merge time.
