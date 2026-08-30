---
name: graduation-workspace
description: "Tổ chức workspace đồ án: task cá nhân, kế hoạch tuần, báo cáo và tài liệu. Dùng khi tạo, cập nhật hoặc đánh giá công việc đồ án."
---

# Graduation Workspace

Trước khi thực hiện, đọc [AGENTS.md](../../../AGENTS.md), [quy chuẩn workspace](references/workspace-standard.md), [quy trình vận hành](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md).

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không sao chép hoặc duy trì template thứ hai trong skill.

Khi yêu cầu là lập/tra cứu task tuần, ghi nhận hoàn thành hoặc review, đọc thêm skill chuyên biệt tương ứng trước khi thay đổi trạng thái hay hồ sơ.

## Đồng bộ dữ liệu kế hoạch và timeline

Markdown canonical trong `docs/processed/plan/` vẫn là nguồn sự thật. Sau mọi thay đổi làm ảnh hưởng đến plan, `weekly-overview.md` hoặc card `task-*.md`, bắt buộc chạy `tools/sync-plan-json-and-timeline.ps1` và xác minh script thành công. Không báo workflow hoàn tất, không commit/push trạng thái mới và không để JSON/timeline lệch với Markdown khi bước đồng bộ thất bại.

JSON tại `docs/processed/plan/json/` và timeline tại `docs/processed/plan/timeline/` là đầu ra sinh tự động; không sửa trực tiếp. Skill chuyên biệt chịu trách nhiệm đặt bước đồng bộ đúng vị trí trong workflow của nó.
