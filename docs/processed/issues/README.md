# Theo dõi issue

Thư mục này lưu mỗi GitHub issue của dự án thành một ticket Markdown, để biết trong repository issue đó đã được fix chưa, fix ở nhánh nào và bằng PR nào. GitHub issue là nguồn gốc báo lỗi; ticket ghi trạng thái xử lý và bằng chứng. Quy trình xử lý nằm ở [skill issue-fix](../../../agent-resources/skills/issue-fix/SKILL.md).

## Bảng tổng hợp

| Ticket | Tiêu đề | Trạng thái | PR fix |
| --- | --- | --- | --- |
| [#44](issue-044_w5-w10-overall-review.md) | Review tổng thể W5–W10 task-03: lệch code, hồ sơ và tài liệu canonical | Chưa fix | Chưa có |
| [#45](issue-045_w10-task-01-03-followup.md) | W10: blocker cho task-05 và tồn đọng sau review task-01/02/03 | Đã fix | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |

Khi đọc tiến độ, chỉ coi `Đã fix` trên nhánh `main` là đã fix; trạng thái đã ghi trên nhánh của PR chưa thay thế nguồn này.

## Trạng thái

| Trạng thái | Ý nghĩa |
| --- | --- |
| `Chưa fix` | Issue còn mở, chưa có ai nhận |
| `Đang fix` | Đã có người xử lý và nhánh fix; chưa có PR hoặc PR chưa sẵn sàng review |
| `Chờ review` | PR fix đã tạo, URL đã ghi vào ticket, đang chờ review |
| `Đã fix` | PR fix đã được duyệt và có bằng chứng; ghi trên nhánh PR trước khi merge |
| `Chờ xử lý` | Bị chặn bởi quyết định, quyền truy cập hoặc dependency ngoài repository; ghi rõ blocker |

Ticket được merge vào `main` cùng PR fix nên trạng thái `Đã fix` trên `main` là trạng thái canonical. Không ghi merge SHA, thời điểm merge hoặc trạng thái `Đã merge` vào ticket; tra Git/GitHub khi cần.

## Quy tắc

- Mỗi GitHub issue có đúng một ticket, đặt tên `issue-<3-chữ-số>_<short-title>.md`, ví dụ `issue-044_w5-w10-overall-review.md`. Số là số issue trên GitHub.
- Tạo ticket mới từ [mẫu ticket](templates/issue-ticket.md); không sao chép mẫu sang nơi khác.
- Ticket phải có link issue GitHub. Khi đã có PR, ghi link PR; chỉ ghi `Đã fix` kèm bằng chứng cho từng hạng mục (test, lệnh, output hoặc link dòng code).
- PR fix dùng `Closes #<số>` khi xử lý toàn bộ issue, `Refs #<số>` khi chỉ xử lý một phần. Issue tổng hợp nhiều hạng mục chỉ được đóng khi mọi hạng mục là `Đã fix` hoặc `Không áp dụng` có lý do.
- Nhánh, PR, review và merge tuân theo [quy tắc Git và pull request](../rules/git-and-pull-request-rules.md) và [quy tắc đặt tên](../rules/naming-rules.md). Việc ngoài repository (ví dụ cấu hình dịch vụ bên thứ ba) ghi ở mục "Còn lại hoặc ngoài phạm vi", không đánh dấu `Đã fix`.
