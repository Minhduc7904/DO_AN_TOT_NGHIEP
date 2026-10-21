# Quy ước bắt buộc

Đọc `AGENTS.md` trước khi đề xuất hoặc sửa code/tài liệu. Đó là nguồn quy ước duy nhất, gồm bảng "loại việc → file cần đọc". PR phải dùng `.github/pull_request_template.md`.

## Commit message

Khi người dùng yêu cầu tạo hoặc gợi ý commit message, đọc `.github/commit-message-template.md`, dựa trên staged diff hoặc diff được chỉ định và dùng cấu trúc:

```text
<type>(<scope-tùy-chọn>): <tóm tắt thay đổi>

Tổng quan:
- <thay đổi cụ thể 1>
- <thay đổi cụ thể 2>
```

- Ưu tiên type `feat`, `fix`, `docs`, `refactor`, `test` hoặc `chore`.
- Dòng tóm tắt ở thể mệnh lệnh, ưu tiên tiếng Việt, ngắn gọn, không có dấu chấm cuối câu. Tiếng Anh được phép khi thuật ngữ kỹ thuật, tên riêng, type/scope hoặc ngữ cảnh làm câu rõ hơn.
- Phần thân là tùy chọn; khi cần, dùng nhãn `Tổng quan:` với 1–3 gạch đầu dòng ngắn, chỉ mô tả thay đổi có trong diff.
- Không thêm tiêu đề, giải thích, tên người thực hiện, lời chào, nội dung PR hoặc Markdown fence vào message được sinh.
- Không tạo commit nếu người dùng chưa yêu cầu rõ.
