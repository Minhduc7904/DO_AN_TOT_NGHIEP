---
name: task-completion-recording
description: "Finalization hồ sơ task đã review đạt trên chính branch/PR của task trước merge; cập nhật output, card và weekly overview của người phụ trách."
---

# Finalization task trước merge

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình ghi nhận](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Skill này chỉ dùng sau khi GitHub ghi nhận verdict `APPROVED` hợp lệ từ thành viên còn lại và **trước khi merge** vào nhánh canonical. Skill xác nhận danh tính approver, hiệu lực approval và điều kiện finalization, rồi để **người phụ trách task** cập nhật output, card task, weekly overview, tham chiếu PR/review và chuyển sang `Hoàn thành` trên chính branch/PR của task. `main` chỉ nhận trạng thái hoàn thành canonical khi chính người phụ trách merge PR này. Finalization metadata phải được commit/push vào PR trước merge, nhưng skill không tự chạy Git write hoặc merge nếu yêu cầu hiện tại của user chưa cho phép rõ. Skill không tạo PR, không chuyển task sang `Chờ review`, không review artifact, không thay người phụ trách xử lý feedback và không ghi merge metadata.

Sau khi cập nhật output/card/weekly overview và trước khi kiểm tra diff finalization để commit/push, bắt buộc chạy `tools/sync-plan-json-and-timeline.ps1`. JSON và timeline phải phản ánh trạng thái mới trong cùng diff. Nếu đồng bộ thất bại, không coi finalization hoàn tất và không commit/push trạng thái `Hoàn thành`.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không tạo bản sao template trong skill.
