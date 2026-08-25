# Quy tắc bắt buộc về đặt tên folder và file

Áp dụng cho mọi folder/file mới tạo trong repository, đặc biệt khi vibe code hoặc hard code. Không đổi tên, di chuyển hoặc chỉnh sửa tài liệu gốc trong `docs/raw/` chỉ để khớp quy tắc này.

## Quy tắc chung

- Tên mới dùng tiếng Anh, chữ thường, ASCII và `kebab-case`.
- Không dùng dấu tiếng Việt, khoảng trắng, `camelCase`, `PascalCase`, ký tự khó hiểu hoặc viết tắt mơ hồ.
- Tên phải mô tả vai trò/nội dung; không dùng `new`, `final`, `test2`, `temp` hay ngày tháng tùy tiện.
- Giữ các tên kỹ thuật và file chuẩn của công cụ khi chúng bắt buộc, ví dụ `README.md`, `Dockerfile`, `package.json`, `pyproject.toml`, `.github/`.

## Tài liệu

- Tài liệu Markdown mới đặt trong `docs/processed/` theo mục đích: `architecture/`, `direction/`, `plan/`, `description/`, `course-materials/`, `guides/`, `rules/` hoặc `adr/` khi có ADR thực tế.
- File tài liệu thông thường dùng `<subject>-v<version>.md` khi có phiên bản, ví dụ `project-scope-v1.md`; không gắn `final` vào tên file.
- Tên theo vai trò cố định: `task-input.md`, `task-output.md`, `weekly-overview.md`, `meeting-notes.md`, `experiment-report.md`.
- Không tạo bản tóm tắt/chuẩn hóa trong `docs/raw/`; tài liệu xử lý phải dẫn đường dẫn nguồn raw ở đầu file khi có nguồn raw.

## Workspace và task tuần

- Tuần: `week-<02-so-thu-tu>_<yyyy-mm-dd>_to_<yyyy-mm-dd>`.
- Task trong workspace: `task-<02-so-thu-tu>_<short-title>/`.
- Card task chung: `task-<02-so-thu-tu>_<short-title>.md`.
- `short-title` dùng các từ tiếng Anh cách nhau bằng dấu gạch ngang, ví dụ `task-02_create-implementation-backlog.md`.

## Nhánh Git

Mỗi task có một nhánh duy nhất theo mẫu:

```text
<type>/week-<02-so-thu-tu>/task-<02-so-thu-tu>-<short-title>
```

- `type` là `feat`, `fix`, `docs`, `chore`, `refactor` hoặc `test` theo loại thay đổi chính.
- Ví dụ task tài liệu: `docs/week-03/task-01-define-mvp-scope`.
- Ví dụ task code: `feat/week-05/task-02-create-auth-service`.
- Không dùng chung một nhánh cho hai task; không đổi tên nhánh đã tạo nếu chưa có quyết định rõ ràng của nhóm.
