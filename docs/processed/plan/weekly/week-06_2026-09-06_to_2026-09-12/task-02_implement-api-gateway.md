# Task tuần: Triển khai Gateway, xác thực JWT cục bộ và error handling

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_implement-api-gateway` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức review routing, trust boundary và timeout semantics |
| Ưu tiên | Cao |
| Hạn dự kiến | 10/09/2026 |
| Nhánh thực hiện | `feat/week-06/task-02-implement-api-gateway` |

## Yêu cầu và phạm vi

### Cần thực hiện

Triển khai API Gateway cho route Auth và chuẩn bị route Course theo published contract. Gateway phải strip/overwrite external principal headers, xác minh JWT tại chỗ, derive principal context tin cậy, kiểm tra role cơ bản, propagate W3C trace context và chuẩn hóa timeout/error envelope.

### Không thực hiện

- Không remote-introspect Auth cho mọi request đã có JWT.
- Không thêm API management production-grade, rate limiting hoặc service mesh.
- Không triển khai business logic hoặc truy cập database của Auth/Course tại Gateway.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 đã merge; HTTP contract v1; backend blueprint; telemetry schema v0.
- Người hoặc phần việc cần phối hợp: Đức review route Course placeholder/config và error behavior cho dependency.
- Rủi ro/giả định: public key/secret contract phải đồng nhất với Auth; retry tắt mặc định, timeout có cấu hình rõ.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| API Gateway và test | Code | `lms/services/gateway/` |
| Gateway runtime configuration | Code / Docs | `lms/services/gateway/` và cấu hình Compose liên quan |

## Definition of Done

- [ ] Login/refresh route tới Auth hoạt động qua Gateway theo `/api/v1` và giữ error envelope canonical.
- [ ] Gateway xác minh signature, expiry và claim cần thiết tại chỗ; route bảo vệ trả đúng `401`/`403` cho token hoặc role không hợp lệ.
- [ ] External `x-principal-id`/`x-principal-role` bị strip/overwrite; downstream chỉ nhận principal context derive từ JWT hợp lệ.
- [ ] Outbound call có timeout cấu hình, retry tắt mặc định, phân biệt dependency unavailable/timeout và không lộ raw stack trace.
- [ ] W3C trace context được propagate qua Gateway; unit/integration tests và build pass.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo trên nhánh task.
- Output workspace: Chưa tạo trên nhánh task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — task được giao cho Bách, thực hiện sau task-01.
- Ghi chú/tồn đọng: chờ task-01 merge vào `main` để dùng JWT contract đã kiểm chứng.
