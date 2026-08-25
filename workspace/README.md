# Workspace phân công đồ án

Thư mục này lưu kế hoạch và báo cáo công việc cá nhân của đồ án. Đức chỉ chủ động sửa `workspace/duc/`; Bách chỉ chủ động sửa `workspace/bach/`. Biên bản họp của cả nhóm được lưu riêng tại [meetings](../meetings/README.md).

Task để nhận và theo dõi trong tuần nằm ở [bảng task chung](../docs/processed/plan/weekly/), không nằm trong workspace cá nhân. Sau khi task được xác nhận, hồ sơ input/output của người thực hiện nằm trong workspace này.

## Cấu trúc chuẩn

Mỗi người có các thư mục tuần riêng. Một tuần chứa trực tiếp các task của người đó; không tạo thư mục task dùng chung giữa Đức và Bách.

```text
workspace/
├── _templates/
│   └── task/
│       ├── input/task-input.md
│       └── output/task-output.md
├── duc/
│   └── week-02_2026-08-09_to_2026-08-15/
│       └── task-01_thesis-project-and-github-setup/
│           ├── input/task-input.md
│           └── output/task-output.md
└── bach/
    └── week-02_2026-08-09_to_2026-08-15/
        └── task-01_short-title/
            ├── input/task-input.md
            └── output/task-output.md
```

Task đã hoàn thành của Đức trong tuần 2 đang được tổ chức đúng theo cấu trúc trên: [task-01_thesis-project-and-github-setup](duc/week-02_2026-08-09_to_2026-08-15/task-01_thesis-project-and-github-setup/).

## Quy tắc cho một task

Một task tương ứng đúng một thư mục `task-<so-thu-tu>_<short-title>` và có đúng hai tài liệu quản lý bắt buộc:

- `input/task-input.md`: hoàn tất trước khi bắt đầu, ghi mục tiêu, phạm vi, phụ thuộc, sản phẩm dự kiến và Definition of Done (DoD).
- `output/task-output.md`: ghi sau khi thực hiện, gồm thời gian thực tế, sản phẩm/link, đối chiếu từng DoD với bằng chứng và phần tồn đọng.

Sản phẩm của task không cần đặt thêm vào thư mục task nếu chúng đã có vị trí phù hợp trong repository: tài liệu đặt tại `docs/processed/`, mã nguồn đặt tại thư mục dự án tương ứng. Trong `task-output.md` phải liên kết đến các sản phẩm đó.

## Khi một tuần có nhiều task

Đánh số task liên tiếp trong phạm vi từng tuần, bắt đầu lại từ `01` khi sang tuần mới. Mỗi task tự có cặp file input/output; không dùng chung một file input hoặc output cho nhiều task.

```text
workspace/duc/week-03_2026-08-16_to_2026-08-22/
├── task-01_collect-requirements/
│   ├── input/task-input.md
│   └── output/task-output.md
├── task-02_design-database/
│   ├── input/task-input.md
│   └── output/task-output.md
└── task-03_implement-authentication/
    ├── input/task-input.md
    └── output/task-output.md
```

Ví dụ, khi Đức có thêm việc trong tuần 2, tạo `task-02_<short-title>` ngay cạnh `task-01_thesis-project-and-github-setup`, rồi sao chép hai file từ `_templates/task/`. Không đổi số hoặc tái sử dụng số của task đã tồn tại.

## Quy tắc đặt tên và hoàn thành

- Tuần: `week-<02-so-thu-tu>_<yyyy-mm-dd>_to_<yyyy-mm-dd>`.
- Task: `task-<02-so-thu-tu>_<short-title>`; `short-title` dùng tiếng Anh, chữ thường và các từ cách nhau bằng dấu gạch ngang.
- Chỉ tạo thư mục tuần khi đã có kế hoạch hoặc task thực tế.
- Chỉ ghi trạng thái **Hoàn thành** trong output khi mọi DoD đạt và từng sản phẩm có đường dẫn hoặc link có thể mở được.

Quy tắc đầy đủ: [tiêu chuẩn workspace](../agent-resources/skills/graduation-workspace/references/workspace-standard.md).
