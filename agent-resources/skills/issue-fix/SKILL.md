---
name: issue-fix
description: "Xử lý một GitHub issue: xác minh còn đúng trên main, fix trên nhánh riêng, mở PR có Closes/Refs, và cập nhật ticket trong docs/processed/issues/ với trạng thái, nhánh, PR và bằng chứng."
---

# Xử lý GitHub issue

Dùng skill này khi cần fix một GitHub issue, tra cứu issue đã fix chưa, hoặc tạo ticket theo dõi cho issue mới. Không dùng để review PR của người khác (dùng `task-code-review`), xử lý comment review (dùng `pr-review-response`) hoặc ghi nhận hoàn thành task tuần (dùng `task-completion-recording`).

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình fix issue](references/workflow.md) và [bảng nguồn canonical](templates/canonical-templates.md).

Ticket nằm tại [docs/processed/issues/](../../../docs/processed/issues/README.md), mỗi GitHub issue một file. Chỉ coi `Đã fix` trên `main` là đã fix. Không ghi `Đã fix` khi chưa có bằng chứng cho từng hạng mục, và không ghi merge SHA hoặc trạng thái `Đã merge` vào ticket.

Skill này không tự chạy Git write (commit, push, tạo PR, merge). Chỉ thực hiện khi yêu cầu hiện tại của người dùng cho phép rõ; nếu chưa, chuẩn bị thay đổi và báo rõ bước Git còn thiếu. Không đóng issue thủ công thay cho `Closes #<số>` trong PR, và không sửa `docs/raw/` hay workspace của thành viên còn lại.
