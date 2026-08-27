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

Khi người dùng yêu cầu tạo hoặc gợi ý commit message, đọc `.github/commit-message-template.md`, dựa trên staged diff hoặc diff được chỉ định và ưu tiên dùng cấu trúc sau:

```text
<type>: <tóm tắt thay đổi bằng tiếng Việt>

Tổng quan:
- <thay đổi cụ thể 1>
- <thay đổi cụ thể 2>
```

- Ưu tiên type `feat`, `fix`, `docs`, `refactor`, `test` hoặc `chore`.
- Ưu tiên dòng tóm tắt ở thể mệnh lệnh, bằng tiếng Việt, ngắn gọn và không có dấu chấm cuối câu.
- Phần thân là tùy chọn; khi cần, dùng nhãn `Tổng quan:` với 1–3 gạch đầu dòng ngắn bằng tiếng Việt, chỉ mô tả thay đổi có trong diff.
- Tránh câu tiếng Anh như `Update workflow documentation` hoặc `Add validation script`; ưu tiên `docs: cập nhật hướng dẫn quy trình` hoặc câu tiếng Việt tương đương.
- Không thêm tiêu đề, giải thích, tên người thực hiện, lời chào, nội dung PR hoặc Markdown fence vào message được sinh.
- Không tạo commit nếu người dùng chưa yêu cầu rõ.
