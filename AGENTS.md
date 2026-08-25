# Hướng dẫn bắt buộc cho AI agent

Trước khi tạo, sửa hoặc đánh giá code, tài liệu, kế hoạch, tuần hoặc task, hãy đọc đầy đủ:

1. `agent-resources/skills/graduation-workspace/SKILL.md`
2. `agent-resources/skills/graduation-workspace/references/workspace-standard.md`

Áp dụng các quy tắc trong đó. Đặc biệt: tôn trọng quyền sở hữu `workspace/duc/` và `workspace/bach/`, dùng tiếng Việt cho nội dung diễn giải, dùng tên file/thư mục mới bằng tiếng Anh, và không đánh dấu task hoàn thành khi chưa có output chứng minh DoD.

Khi lập/chia task tuần hoặc trả lời “tuần này tôi phải làm gì”, đọc thêm `agent-resources/skills/weekly-task-planning/SKILL.md`. Khi người dùng báo đã hoàn thành một task, đọc thêm `agent-resources/skills/task-completion-recording/SKILL.md` và thực hiện đúng chuỗi xác nhận sản phẩm rồi đến từng DoD trước khi chuyển task sang `Chờ review`. Khi review code hoặc pull request, đọc `agent-resources/skills/task-code-review/SKILL.md`.

Trước khi tạo branch, vibe code, hard code hoặc mở pull request, bắt buộc đọc:

1. `docs/processed/rules/naming-rules.md`
2. `docs/processed/rules/git-and-pull-request-rules.md`
3. `docs/processed/guides/git-workflow.md`

Mỗi task phải có nhánh riêng và pull request trước khi chuyển sang `Chờ review`. Chỉ skill review mới được chuyển task sang `Hoàn thành`; PR chỉ được merge sau trạng thái này và khi người dùng yêu cầu rõ. Pull request phải dùng template `.github/pull_request_template.md`.

Không tự sửa, di chuyển hoặc xóa tài liệu trong `docs/raw/` hay công việc của thành viên còn lại nếu không có yêu cầu rõ ràng.
