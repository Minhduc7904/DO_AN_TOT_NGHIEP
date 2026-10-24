# Issue #50: POST /grades trả 503 dù điểm đã lưu; client không biết grade_id và gửi lại nhận 409

> Nguồn: [issue #50 trên GitHub](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/50). Ticket này theo dõi trạng thái xử lý; chi tiết báo lỗi nằm ở issue gốc.

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Issue GitHub | [#50](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/50) |
| Trạng thái | Chưa fix |
| Mức độ | Không chặn |
| Nhãn GitHub | `bug` |
| Người báo | Minhduc7904 |
| Ngày mở | 24/10/2026 |
| Người xử lý | Chưa nhận |
| Nhánh fix | Chưa tạo |
| PR fix | Chưa có |

## Mô tả

Khi publish `grade.completed` lên RabbitMQ lỗi, `POST /api/v1/grades` trả 503 trong khi điểm đã được lưu vào `grading_db` ở trạng thái `pending` và worker sẽ tự phát lại. Client không biết điều đó: `details` của lỗi luôn là `null` nên không có `grade_id`/`event_id`, gửi lại bị 409 do `UNIQUE(submission_id)`, và khi đi qua Gateway message giải thích còn bị thay bằng lỗi chung.

## Bằng chứng lỗi

Suy ra từ code ngày 24/10/2026, chưa tái hiện trên stack thật:

- Lưu điểm rồi ném `GradeEventPendingError`: [grading.service.ts:29-54](../../../lms/services/grading/src/application/grading.service.ts#L29-L54).
- Map thành 503, `details: null`: [http-exception.filter.ts:65](../../../lms/services/grading/src/adapters/http/http-exception.filter.ts#L65).
- Gửi lại → unique `submission_id` → 409: [postgres-grade.repository.ts:168-176](../../../lms/services/grading/src/adapters/persistence/postgres-grade.repository.ts#L168-L176).
- Gateway thay mọi 5xx upstream bằng lỗi chung: [gateway-proxy.ts:110](../../../lms/services/gateway/src/application/gateway-proxy.ts#L110).

## Hạng mục cần xử lý

| Mã | Hạng mục | Trạng thái | PR |
| --- | --- | --- | --- |
| 01 | Xác minh hành vi trên stack thật (dừng RabbitMQ, `POST /grades`, gửi lại, kiểm tra `grades.publish_status`) | Chưa xác minh | — |
| 02 | Quyết định cách phản hồi: 2xx kèm `grade_id` và `publish_status: pending`, hoặc 503 có `details` chứa `grade_id`/`event_id` | Chưa fix (cần thống nhất) | — |
| 03 | Gateway giữ nguyên `details` của upstream cho trường hợp này | Chưa fix | — |
| 04 | Cập nhật `http-and-event-contracts-v1` và thêm test cho trường hợp broker chết | Chưa fix | — |

## Cách fix và bằng chứng

Chưa bắt đầu.

## Còn lại hoặc ngoài phạm vi

- Liên quan [issue #44](issue-044_w5-w10-overall-review.md), hạng mục E03 (chỉ đề xuất sửa tài liệu, chưa xử lý hành vi). Khi fix, cập nhật cả hạng mục đó.

## Lịch sử trạng thái

| Ngày | Trạng thái | Ghi chú |
| --- | --- | --- |
| 24/10/2026 | Chưa fix | Issue được mở |
