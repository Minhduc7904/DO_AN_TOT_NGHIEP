---
name: task-completion-recording
description: "Ghi nhận task tuần đã hoàn thành sau khi PR đã review đạt và merge vào nhánh canonical; cập nhật hồ sơ, card và weekly overview của người phụ trách."
---

# Ghi nhận task hoàn thành sau merge

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình ghi nhận](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Skill này chỉ dùng sau khi PR của task đã review đạt và đã merge vào nhánh canonical. Skill xác nhận điều kiện cuối cùng, rồi để **người phụ trách task** cập nhật output, card task, weekly overview và tham chiếu PR/merge trước khi chuyển sang `Hoàn thành`. Skill không tạo PR, không chuyển task sang `Chờ review`, không review artifact và không thay người phụ trách xử lý feedback.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không tạo bản sao template trong skill.
