# Quy ước bắt buộc

Trước khi đề xuất hoặc sửa code/tài liệu, hãy đọc `AGENTS.md` và hai file sau:

- `agent-resources/skills/graduation-workspace/SKILL.md`
- `agent-resources/skills/graduation-workspace/references/workspace-standard.md`

Tuân thủ toàn bộ quy ước workspace, quyền sở hữu, ngôn ngữ, tên file/thư mục và tiêu chí hoàn thành task.

Khi cần biết người dùng là Đức hay Bách để lọc task hoặc sửa workspace, chỉ dùng thông tin người dùng nói rõ trong yêu cầu hiện tại. Nếu chưa rõ, phải hỏi lại; không đoán từ lịch sử hội thoại, tên tài khoản, tên thư mục hoặc task cũ.

- Lập/chia task tuần hoặc trả lời công việc tuần: đọc `agent-resources/skills/weekly-task-planning/SKILL.md`.
- Người dùng báo task đã hoàn thành: đọc `agent-resources/skills/task-completion-recording/SKILL.md`; hỏi sản phẩm trước, sau đó xác nhận từng DoD trước khi chuyển sang `Chờ review`.
- Review code hoặc pull request: đọc `agent-resources/skills/task-code-review/SKILL.md`.

Trước khi tạo branch, sửa code/tài liệu hoặc mở pull request, bắt buộc đọc `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md` và `docs/processed/guides/git-workflow.md`. Mỗi task có một branch và PR trước khi chờ review; chỉ merge sau khi review đạt và task ở `Hoàn thành`; PR phải dùng `.github/pull_request_template.md`.

Khi người dùng yêu cầu tạo hoặc gợi ý commit message, đọc và dùng `.github/commit-message-template.md` làm nguồn chuẩn duy nhất. Sinh message từ staged diff hoặc diff được chỉ định: dòng tóm tắt bằng tiếng Việt; khi cần thân message, dùng `Tổng quan:` với 1–3 gạch đầu dòng ngắn. Không tạo commit nếu người dùng chưa yêu cầu rõ.
