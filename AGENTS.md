# Hướng dẫn bắt buộc cho AI agent

Đây là nguồn quy ước ngắn gọn duy nhất cho agent. `CLAUDE.md` và `.github/copilot-instructions.md` chỉ trỏ về đây. Chỉ đọc thêm đúng file cần cho loại việc đang làm (bảng bên dưới); không đọc cả bộ quy ước cho mọi việc.

## Quy tắc luôn áp dụng

- Tôn trọng quyền sở hữu `workspace/duc/` và `workspace/bach/`; không tự sửa, di chuyển hoặc xóa `docs/raw/` hay công việc của thành viên còn lại nếu không có yêu cầu rõ.
- Nội dung diễn giải (tài liệu, báo cáo, README, comment cần thiết) viết bằng tiếng Việt. Tên file/thư mục mới dùng tiếng Anh, chữ thường, ASCII, `kebab-case`. Định danh kỹ thuật trong code giữ tiếng Anh.
- Không đánh dấu task hoàn thành khi chưa có output chứng minh từng DoD.
- Chỉ nhận diện người dùng là Đức hay Bách theo lời nói rõ “tôi là Đức/Bách” trong yêu cầu hiện tại. Chưa rõ thì hỏi lại; không đoán từ lịch sử, tài khoản, tên nhánh, thư mục hoặc task cũ.
- Kế hoạch và tiến độ lấy từ Markdown canonical trong `docs/processed/plan/` cùng hồ sơ `workspace/`. Sau mỗi thay đổi tuần/task, đối chiếu trực tiếp overview, card, input/output và trạng thái GitHub (người phụ trách, trạng thái, nhánh, PR, bằng chứng DoD).
- Yêu cầu commit/push/merge trong workflow không tự cấp quyền Git write. Chưa được yêu cầu rõ thì chỉ chuẩn bị thay đổi và báo transition chưa hợp lệ trên remote.

## Đọc gì cho loại việc nào

| Loại việc | Đọc |
| --- | --- |
| Tạo/sửa hồ sơ `workspace/`, tài liệu, input/output, biên bản họp | `agent-resources/skills/graduation-workspace/SKILL.md` (link sang `workspace-standard.md`) |
| Tạo branch, sửa code, mở PR | `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md`; `docs/processed/guides/git-workflow.md` chỉ khi cần lệnh; PR dùng `.github/pull_request_template.md` |
| Lập/chia task tuần, hỏi công việc tuần | `agent-resources/skills/weekly-task-planning/SKILL.md` |
| Review task/PR của người khác | `agent-resources/skills/task-code-review/SKILL.md` |
| Xử lý feedback/comment trên PR của chính task | `agent-resources/skills/pr-review-response/SKILL.md` |
| Finalization/ghi nhận hoàn thành (trước merge) | `agent-resources/skills/task-completion-recording/SKILL.md` |
| Tạo/gợi ý commit message | `.github/commit-message-template.md` |

## Vòng đời task và Git

Quy tắc canonical về branch, PR, review, finalization, merge, ngoại lệ theo chỉ thị trực tiếp của người phụ trách và thay đổi vận hành dùng chung được phép commit trực tiếp lên `main` nằm duy nhất tại `docs/processed/rules/git-and-pull-request-rules.md`. Không sao chép lại các quy tắc đó vào file khác; chỉ link.
