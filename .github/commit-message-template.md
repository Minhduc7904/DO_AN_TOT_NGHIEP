# Mẫu commit message

`<type>(<scope-tùy-chọn>): <tóm tắt thay đổi>`

```text
<type>(<scope-tùy-chọn>): <tóm tắt thay đổi ngắn gọn>

Tổng quan:
- <thay đổi chính 1>
- <thay đổi chính 2>
```

- `<type>` dùng Conventional Commit type phù hợp, thường là `feat`, `fix`, `docs`, `refactor`, `test` hoặc `chore`; giữ nguyên type và scope kỹ thuật theo chuẩn này.
- Ưu tiên tóm tắt bằng tiếng Việt, ở thể mệnh lệnh, ngắn gọn và không thêm dấu chấm ở cuối. Tiếng Anh không bị cấm khi thuật ngữ kỹ thuật, tên riêng, type/scope hoặc ngữ cảnh làm câu rõ hơn.
- Phần `Tổng quan:` chỉ dùng khi cần nêu thêm ngữ cảnh; gồm 1–3 gạch đầu dòng ngắn, mỗi dòng mô tả một thay đổi cụ thể.
- Không thêm thông tin không có trong diff, tên người thực hiện, lời chào hoặc nội dung PR vào commit message.

Ví dụ:

```text
docs: chốt phạm vi MVP

Tổng quan:
- Phân loại MVP, Target và Stretch.
- Bổ sung các hạng mục ngoài phạm vi.
```
