---
name: task-code-review
description: "Review PR của task đang chờ review theo thay đổi thực tế, DoD và nội dung PR; có thể đăng inline comment khi được yêu cầu rõ, không tự merge."
---

# Review task và pull request

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình review](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Khi người dùng yêu cầu rõ, reviewer được đăng nhận xét inline vào các dòng thay đổi của pull request qua tài khoản GitHub đã xác thực của reviewer. Không được giả danh tài khoản khác, không ghi nhận xét dưới tên ChatGPT và không tự cập nhật trạng thái card/output hoặc gắn link PR thay người phụ trách task.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không tạo bản sao template trong skill.
