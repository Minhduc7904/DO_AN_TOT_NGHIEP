---
name: graduation-workspace
description: "Tổ chức workspace đồ án: task cá nhân, kế hoạch tuần, báo cáo và tài liệu. Dùng khi tạo, cập nhật hoặc đánh giá công việc đồ án."
---

# Graduation Workspace

Trước khi thực hiện, đọc [quy chuẩn workspace](references/workspace-standard.md). Đọc thêm [quy trình vận hành](references/workflow.md) và [bảng template canonical](templates/canonical-templates.md) chỉ khi tạo hoặc chuyển trạng thái hồ sơ task.

Chỉ dùng template ở các đường dẫn canonical được liệt kê trong `templates/`; không sao chép hoặc duy trì template thứ hai trong skill.

Khi yêu cầu là lập/tra cứu task tuần, ghi nhận hoàn thành hoặc review, đọc thêm skill chuyên biệt tương ứng trước khi thay đổi trạng thái hay hồ sơ.

## Kiểm tra trực tiếp dữ liệu kế hoạch

Markdown canonical trong `docs/processed/plan/` và hồ sơ `workspace/` là nguồn sự thật duy nhất.

Sau mọi thay đổi ảnh hưởng đến plan, `weekly-overview.md`, card `task-*.md` hoặc hồ sơ task, agent phải đọc lại các file liên quan và đối chiếu trực tiếp người phụ trách, trạng thái, nhánh, liên kết input/output, PR/review và bằng chứng DoD. Khi trạng thái phụ thuộc GitHub, kiểm tra GitHub thay vì suy diễn từ Markdown local. Không báo workflow hoàn tất khi các nguồn canonical còn lệch nhau.
