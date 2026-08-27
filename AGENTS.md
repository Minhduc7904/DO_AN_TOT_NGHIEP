# Hướng dẫn bắt buộc cho AI agent

Trước khi tạo, sửa hoặc đánh giá code, tài liệu, kế hoạch, tuần hoặc task, hãy đọc đầy đủ:

1. `agent-resources/skills/graduation-workspace/SKILL.md`
2. `agent-resources/skills/graduation-workspace/references/workspace-standard.md`

Áp dụng các quy tắc trong đó. Đặc biệt: tôn trọng quyền sở hữu `workspace/duc/` và `workspace/bach/`, dùng tiếng Việt cho nội dung diễn giải, dùng tên file/thư mục mới bằng tiếng Anh, và không đánh dấu task hoàn thành khi chưa có output chứng minh DoD.

Khi yêu cầu cần biết người dùng là ai để lọc task, tạo/sửa workspace, ghi nhận hoàn thành hoặc review, chỉ nhận diện theo việc người dùng nói rõ “tôi là Đức” hoặc “tôi là Bách” trong yêu cầu hiện tại. Nếu chưa có thông tin này, phải hỏi lại; không suy đoán từ lịch sử hội thoại, tên tài khoản, tên nhánh, thư mục hoặc task cũ.

Khi lập/chia task tuần hoặc trả lời “tuần này tôi phải làm gì”, đọc thêm `agent-resources/skills/weekly-task-planning/SKILL.md`. Khi review task/PR của người khác, dùng `agent-resources/skills/task-code-review/SKILL.md`. Khi người dùng là người phụ trách và muốn xử lý feedback/comment/review trên PR của chính task, dùng `agent-resources/skills/pr-review-response/SKILL.md`. Khi PR đã có verdict `APPROVED` và người phụ trách muốn finalization/ghi nhận hồ sơ, dùng `agent-resources/skills/task-completion-recording/SKILL.md` **trước merge**.

Trước khi tạo branch, vibe code, hard code hoặc mở pull request, bắt buộc đọc:

1. `docs/processed/rules/naming-rules.md`
2. `docs/processed/rules/git-and-pull-request-rules.md`
3. `docs/processed/guides/git-workflow.md`

Mỗi task phải có nhánh riêng và pull request trước khi chuyển sang `Chờ review`. URL/số PR và `Chờ review` phải được commit/push vào PR head trước review; reviewer lấy readiness từ PR head, không từ `main`. Vòng đời task canonical nằm tại `docs/processed/rules/git-and-pull-request-rules.md`: review đạt cho phép người phụ trách dùng `task-completion-recording` ghi `Hoàn thành` trên branch/PR của chính task trước merge; task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. Requirement commit/push không tự cho phép agent chạy Git write khi người dùng chưa yêu cầu rõ. Pull request phải dùng template `.github/pull_request_template.md`.

Không tự sửa, di chuyển hoặc xóa tài liệu trong `docs/raw/` hay công việc của thành viên còn lại nếu không có yêu cầu rõ ràng.
