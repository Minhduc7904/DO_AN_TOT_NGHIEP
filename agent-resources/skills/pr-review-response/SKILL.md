---
name: pr-review-response
description: "Xử lý phản hồi review trên pull request: đọc đầy đủ comment, sửa đúng yêu cầu và reply chi tiết trên từng thread dưới tài khoản GitHub của người phụ trách."
---

# Xử lý phản hồi review pull request

Dùng skill này khi người phụ trách task cần đọc review của người khác, sửa nhánh của chính task đó và phản hồi lại từng review thread. Không dùng skill này để review PR lần đầu hoặc tự merge.

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình xử lý review](references/workflow.md) và [bảng nguồn canonical](templates/canonical-templates.md).

Mọi reply trên GitHub phải được đăng qua tài khoản GitHub đã xác thực của người phụ trách và không được nhắc đến hoặc ký tên ChatGPT. Skill này không tự đưa verdict `APPROVED`/`CHANGES_REQUESTED`, merge, cập nhật trạng thái card/output hay gắn link PR. Sau khi xử lý, task vẫn cần reviewer review lại; chỉ sau khi PR merge, người phụ trách mới dùng `task-completion-recording` để ghi nhận hoàn thành.
