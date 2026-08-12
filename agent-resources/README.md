# Tài nguyên cho AI agent

## Cách dùng trong dự án này

- **Claude Code** tự đọc `CLAUDE.md` ở thư mục gốc.
- **Codex** tự đọc `AGENTS.md` ở thư mục gốc. Để dùng skill như skill cài đặt, sao chép hoặc liên kết thư mục `agent-resources/skills/graduation-workspace` vào thư mục skills cá nhân của Codex, rồi khởi động phiên mới.
- **GitHub Copilot** đọc `.github/copilot-instructions.md`.
- Các agent khác cần được khởi động với chỉ dẫn đọc `AGENTS.md` trước khi làm việc.

Không có một cơ chế cấu hình chuẩn được mọi AI agent tự động hỗ trợ. Ba file cấu hình ở trên giúp các agent phổ biến đọc cùng một bộ quy tắc; skill trong repo là nguồn chuẩn duy nhất để cập nhật.

## Cài skill cho Codex

Thay `<codex-home>` bằng thư mục cấu hình Codex của máy. Ví dụ thường dùng là `~/.codex`.

```bash
mkdir -p <codex-home>/skills
ln -s "$(pwd)/agent-resources/skills/graduation-workspace" \
  <codex-home>/skills/graduation-workspace
```

Nếu hệ điều hành không hỗ trợ symbolic link, sao chép thư mục skill thay cho lệnh `ln -s`. Khi cập nhật skill trong repo, symbolic link sẽ luôn dùng bản mới nhất.
