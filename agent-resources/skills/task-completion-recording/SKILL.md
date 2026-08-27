---
name: task-completion-recording
description: "Finalization hồ sơ task đã review đạt trên chính branch/PR của task trước merge; cập nhật output, card và weekly overview của người phụ trách."
---

# Finalization task trước merge

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình ghi nhận](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Skill này chỉ dùng sau khi PR của task đã có verdict `APPROVED` và **trước khi merge** vào nhánh canonical. Skill xác nhận điều kiện finalization, rồi để **người phụ trách task** cập nhật output, card task, weekly overview, tham chiếu PR/review và chuyển sang `Hoàn thành` trên chính branch/PR của task. `main` chỉ nhận trạng thái hoàn thành canonical khi PR này merge. Finalization metadata phải được commit/push vào PR trước merge, nhưng skill không tự chạy Git write nếu yêu cầu hiện tại của user chưa cho phép. Skill không tạo PR, không chuyển task sang `Chờ review`, không review artifact, không thay người phụ trách xử lý feedback và không yêu cầu/ghi merge metadata.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không tạo bản sao template trong skill.
