# Quy ước làm việc của đồ án

Trước mọi thay đổi, đọc `AGENTS.md`, sau đó đọc đầy đủ:

- `agent-resources/skills/graduation-workspace/SKILL.md`
- `agent-resources/skills/graduation-workspace/references/workspace-standard.md`

Đây là quy ước bắt buộc của dự án. Áp dụng cho mọi code, task, kế hoạch và tài liệu. Không bỏ qua quy tắc quyền sở hữu thư mục, ngôn ngữ, tên file/thư mục, input/output và Definition of Done.

Khi cần biết người dùng là Đức hay Bách để lọc task hoặc sửa workspace, chỉ dùng thông tin người dùng nói rõ trong yêu cầu hiện tại. Nếu chưa rõ, phải hỏi lại; không đoán từ lịch sử hội thoại, tên tài khoản, tên thư mục hoặc task cũ.

Với yêu cầu lập/chia task tuần hoặc hỏi công việc tuần, đọc `agent-resources/skills/weekly-task-planning/SKILL.md`. Với review task/PR của người khác, đọc `agent-resources/skills/task-code-review/SKILL.md`. Khi người phụ trách muốn xử lý feedback/comment/review trên PR của chính task, đọc `agent-resources/skills/pr-review-response/SKILL.md`. Khi PR đã review đạt và người phụ trách muốn finalization/ghi nhận hồ sơ, đọc `agent-resources/skills/task-completion-recording/SKILL.md` trước merge.

Trước khi tạo branch, sửa code/tài liệu hoặc mở pull request, đọc `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md` và `docs/processed/guides/git-workflow.md`. Mỗi task cần một branch và PR trước khi chờ review; URL/số PR và trạng thái `Chờ review` phải được commit/push vào PR head trước review. Review đạt không đồng nghĩa task đã canonically `Hoàn thành`. Chỉ người phụ trách, qua `task-completion-recording`, mới ghi trạng thái này trên branch/PR trước merge; `main` là nguồn trạng thái canonical sau merge. Dùng `.github/pull_request_template.md`.

Requirement workflow về commit/push không tự cấp quyền Git write. Khi user chưa yêu cầu rõ commit/push, chỉ chuẩn bị thay đổi và báo transition chưa hợp lệ trên remote.
