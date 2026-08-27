# Quy ước bắt buộc

Trước khi đề xuất hoặc sửa code/tài liệu, hãy đọc `AGENTS.md` và hai file sau:

- `agent-resources/skills/graduation-workspace/SKILL.md`
- `agent-resources/skills/graduation-workspace/references/workspace-standard.md`

Tuân thủ toàn bộ quy ước workspace, quyền sở hữu, ngôn ngữ, tên file/thư mục và tiêu chí hoàn thành task.

Khi cần biết người dùng là Đức hay Bách để lọc task hoặc sửa workspace, chỉ dùng thông tin người dùng nói rõ trong yêu cầu hiện tại. Nếu chưa rõ, phải hỏi lại; không đoán từ lịch sử hội thoại, tên tài khoản, tên thư mục hoặc task cũ.

- Lập/chia task tuần hoặc trả lời công việc tuần: đọc `agent-resources/skills/weekly-task-planning/SKILL.md`.
- Review task hoặc pull request của người khác: đọc `agent-resources/skills/task-code-review/SKILL.md`.
- Người phụ trách muốn xử lý feedback/comment/review trên PR của chính task: đọc `agent-resources/skills/pr-review-response/SKILL.md`.
- PR đã review đạt, đã merge vào nhánh canonical và người phụ trách muốn ghi nhận/đóng task: đọc `agent-resources/skills/task-completion-recording/SKILL.md`.

Trước khi tạo branch, sửa code/tài liệu hoặc mở pull request, bắt buộc đọc `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md` và `docs/processed/guides/git-workflow.md`. Mỗi task có một branch và PR trước khi chờ review. Review đạt không đồng nghĩa `Hoàn thành`; chỉ người phụ trách, qua `task-completion-recording`, mới ghi nhận trạng thái này sau khi PR đã merge vào nhánh canonical. PR phải dùng `.github/pull_request_template.md`.

Khi người dùng yêu cầu tạo hoặc gợi ý commit message, đọc `.github/commit-message-template.md`, dựa trên staged diff hoặc diff được chỉ định và ưu tiên dùng cấu trúc sau:

```text
<type>(<scope-tùy-chọn>): <tóm tắt thay đổi>

Tổng quan:
- <thay đổi cụ thể 1>
- <thay đổi cụ thể 2>
```

- Ưu tiên type `feat`, `fix`, `docs`, `refactor`, `test` hoặc `chore`.
- Ưu tiên dòng tóm tắt ở thể mệnh lệnh, bằng tiếng Việt, ngắn gọn và không có dấu chấm cuối câu. Tiếng Anh được phép khi thuật ngữ kỹ thuật, tên riêng, conventional-commit type/scope hoặc ngữ cảnh làm câu rõ hơn.
- Phần thân là tùy chọn; khi cần, dùng nhãn `Tổng quan:` với 1–3 gạch đầu dòng ngắn, ưu tiên tiếng Việt và chỉ mô tả thay đổi có trong diff.
- Không ép chuyển thuật ngữ kỹ thuật, tên riêng hoặc ngữ cảnh mà tiếng Anh rõ hơn sang tiếng Việt.
- Không thêm tiêu đề, giải thích, tên người thực hiện, lời chào, nội dung PR hoặc Markdown fence vào message được sinh.
- Không tạo commit nếu người dùng chưa yêu cầu rõ.
