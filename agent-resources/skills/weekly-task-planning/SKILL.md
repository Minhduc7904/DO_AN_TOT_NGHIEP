---
name: weekly-task-planning
description: "Lập, phân công hoặc tra cứu task tuần theo plan canonical của đồ án; không dùng để ghi nhận hoàn thành task."
---

# Lập và tra cứu task tuần

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), skill `graduation-workspace`, [quy trình task tuần](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Khi trả lời câu hỏi về công việc của tuần hiện tại, phải tra cứu cả kế hoạch tuần lẫn các pull request đang mở liên quan đến task của tuần; không chỉ dựa vào trạng thái card task hoặc review request tường minh trên GitHub.

Khi tạo tuần mới, break task, phân công hoặc cập nhật nội dung/trạng thái overview hay card task, bắt buộc chạy `tools/sync-plan-json-and-timeline.ps1` sau khi hoàn tất các thay đổi Markdown. Chỉ coi workflow thành công khi script sinh JSON/timeline không lỗi và các đầu ra nằm trong cùng diff với thay đổi kế hoạch. Không sửa trực tiếp JSON hoặc HTML đã sinh.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không tạo bản sao template trong skill.
