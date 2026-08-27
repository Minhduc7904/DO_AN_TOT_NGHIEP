---
name: task-code-review
description: "Review PR của task đang chờ review theo thay đổi thực tế, DoD và nội dung PR; đưa verdict APPROVED hoặc CHANGES_REQUESTED, có thể đăng review/comment khi được yêu cầu rõ."
---

# Review task và pull request

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình review](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Skill này chỉ review artifact/code/PR, phân loại blocking/non-blocking và đưa verdict `APPROVED` hoặc `CHANGES_REQUESTED`. Khi người dùng yêu cầu rõ, reviewer được đăng review hoặc nhận xét inline qua tài khoản GitHub đã xác thực của reviewer. Không được giả danh tài khoản khác, không ghi nhận xét dưới tên ChatGPT, không sửa artifact của người phụ trách, không cập nhật card/weekly overview/output, không chuyển trạng thái task và không ghi completion record thay người phụ trách task.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không tạo bản sao template trong skill.
