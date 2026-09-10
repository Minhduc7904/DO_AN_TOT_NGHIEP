---
name: task-completion-recording
description: "Finalization hoặc correction hồ sơ task theo xác nhận của người phụ trách; cập nhật output, card và weekly overview."
---

# Finalization task trước merge

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình ghi nhận](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Mặc định skill dùng sau khi GitHub ghi nhận verdict `APPROVED` hợp lệ và trước khi merge. Nếu đúng người phụ trách yêu cầu tiếp tục dù thiếu cổng hoặc PR đã merge, cảnh báo một lần rồi thực hiện finalization/correction theo chỉ thị rõ. Hồ sơ phải ghi trung thực nguồn xác nhận, không biến approval ngoài GitHub thành verdict GitHub. Git write chỉ thực hiện khi yêu cầu hiện tại cho phép rõ.

Sau khi cập nhật output/card/weekly overview và trước khi kiểm tra diff finalization để commit/push, bắt buộc chạy `tools/sync-plan-json-and-timeline.ps1`. JSON và timeline phải phản ánh trạng thái mới trong cùng diff. Nếu đồng bộ thất bại, không coi finalization hoàn tất và không commit/push trạng thái `Hoàn thành`.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không tạo bản sao template trong skill.
