# Quy ước bắt buộc

Trước khi đề xuất hoặc sửa code/tài liệu, hãy đọc `AGENTS.md` và hai file sau:

- `agent-resources/skills/graduation-workspace/SKILL.md`
- `agent-resources/skills/graduation-workspace/references/workspace-standard.md`

Tuân thủ toàn bộ quy ước workspace, quyền sở hữu, ngôn ngữ, tên file/thư mục và tiêu chí hoàn thành task.

Khi cần biết người dùng là Đức hay Bách để lọc task hoặc sửa workspace, chỉ dùng thông tin người dùng nói rõ trong yêu cầu hiện tại. Nếu chưa rõ, phải hỏi lại; không đoán từ lịch sử hội thoại, tên tài khoản, tên thư mục hoặc task cũ.

- Lập/chia task tuần hoặc trả lời công việc tuần: đọc `agent-resources/skills/weekly-task-planning/SKILL.md`.
- Review task hoặc pull request của người khác: đọc `agent-resources/skills/task-code-review/SKILL.md`.
- Người phụ trách muốn xử lý feedback/comment/review trên PR của chính task: đọc `agent-resources/skills/pr-review-response/SKILL.md`.
- PR đã có verdict `APPROVED` và người phụ trách muốn finalization/ghi nhận hồ sơ: đọc `agent-resources/skills/task-completion-recording/SKILL.md` trước merge.

Trước khi tạo branch, sửa code/tài liệu hoặc mở pull request, bắt buộc đọc `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md` và `docs/processed/guides/git-workflow.md`. Mỗi task có một branch và PR trước khi chờ review; URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Review đạt cho phép người phụ trách dùng `task-completion-recording` ghi `Hoàn thành` trên branch/PR trước merge; chỉ `main` sau merge mới là trạng thái hoàn thành canonical. PR phải dùng `.github/pull_request_template.md`.

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
- Không tạo commit nếu người dùng chưa yêu cầu rõ. Requirement workflow về commit/push không tự cấp quyền Git write; khi chưa được phép, chỉ chuẩn bị thay đổi và báo bước còn thiếu.
