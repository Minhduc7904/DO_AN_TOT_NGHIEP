# Tiêu chuẩn workspace đồ án

## Cấu trúc chuẩn

```text
workspace/
├── _templates/
│   └── task/
│       ├── input/task-input.md
│       └── output/task-output.md
├── duc/
│   └── week-01_2026-08-02_to_2026-08-08/
│       └── task-01_short-title/
│           ├── input/task-input.md
│           └── output/task-output.md
└── bach/
    └── week-01_2026-08-02_to_2026-08-08/
        └── task-01_short-title/
            ├── input/task-input.md
            └── output/task-output.md
```

- `workspace/duc/` chỉ do Đức chủ động sửa; `workspace/bach/` chỉ do Bách chủ động sửa.
- Mỗi người có riêng các tuần và task của mình. Một task cần phối hợp vẫn có một chủ sở hữu duy nhất; task phụ của người còn lại phải tạo trong thư mục của người đó và liên kết chéo trong input.
- Chỉ tạo tuần khi đã có kế hoạch làm việc. Không dùng thư mục tuần chung cho cả hai người.

## Biên bản họp dùng chung

```text
meetings/
├── _templates/
│   └── meeting-notes.md
└── week-02_2026-08-09_to_2026-08-15/
    └── 2026-08-12_1400.md
```

- `meetings/` là thư mục dùng chung cho họp nội bộ nhóm và họp nhóm với thầy; không đặt biên bản họp trong `workspace/duc/` hoặc `workspace/bach/`.
- Thư mục tuần dùng đúng quy tắc đặt tên tuần của workspace.
- Mỗi biên bản là một file Markdown trong thư mục tuần và có tên đúng thời điểm bắt đầu họp theo giờ Việt Nam: `yyyy-mm-dd_hhmm.md`.
  Ví dụ: `2026-08-12_1400.md` là cuộc họp bắt đầu lúc 14:00 ngày 12/08/2026. Nếu hai cuộc họp bắt đầu cùng phút, thêm hậu tố `-02`, `-03`.
- Trong file phải ghi rõ **Loại cuộc họp** là `Họp nội bộ nhóm` hoặc `Họp nhóm với thầy`, người tham dự, nội dung, quyết định, việc cần làm tiếp theo và người phụ trách.
- Mỗi việc cần làm sau họp phải liên kết đến task tương ứng; nếu chưa có task, ghi rõ người dự kiến tạo task và thời hạn.

## Quy tắc đặt tên

- Tên thư mục và tên file mới dùng tiếng Anh, chữ thường, ASCII và `kebab-case`; không dấu, không khoảng trắng, không viết tắt khó hiểu.
- Thư mục tuần: `week-<02-so-thu-tu>_<yyyy-mm-dd>_to_<yyyy-mm-dd>`.
  Ví dụ: `week-01_2026-08-02_to_2026-08-08` tương ứng **Tuần 1 (02/08/2026 → 08/08/2026)**; `week-02_2026-08-09_to_2026-08-15` tương ứng **Tuần 2 (09/08/2026 → 15/08/2026)**.
- Thư mục task: `task-<02-so-thu-tu>_<short-title>`; đánh số lại từ `01` ở mỗi tuần và không tái sử dụng số đã có.
  Ví dụ: `task-02_design-service-topology`.
- Thư mục bắt buộc trong mỗi task: `input/` và `output/`.
- Tên Markdown theo vai trò: `task-input.md`, `task-output.md`, `weekly-summary.md`, `meeting-notes.md`, `experiment-report.md`.
- Riêng biên bản họp theo quy tắc `meetings/` dùng tên thời gian `yyyy-mm-dd_hhmm.md`.
- Không đổi tên hoặc sửa nội dung nguồn gốc trong `docs/raw/`. Đây là ngoại lệ có chủ ý khi tài liệu gốc được nhận với tên tiếng Việt; mọi file **mới** phải theo quy tắc tiếng Anh.

## Quy tắc ngôn ngữ

- Nội dung mô tả, kế hoạch, checklist, báo cáo, ghi chú và tài liệu Markdown phải viết bằng tiếng Việt.
- Tên file và thư mục mới phải viết bằng tiếng Anh theo quy tắc trên.
- Với mã nguồn, giữ cú pháp và định danh kỹ thuật bằng tiếng Anh; mọi phần diễn giải cho người đọc (README, hướng dẫn, comment cần thiết) viết bằng tiếng Việt.

## Tài liệu

```text
docs/
├── raw/
│   └── ...
└── processed/
    ├── architecture/
    ├── direction/
    ├── plan/
    ├── description/
    ├── course-materials/
    ├── adr/              # tùy chọn, khi có ADR thực tế
    └── ...
```

- `docs/raw/`: tài liệu nhận vào, file gốc, bản scan, PDF/DOCX chưa đọc hoặc chưa chuẩn hóa. Không đặt bản tóm tắt tại đây.
- `docs/processed/`: Markdown tiếng Việt đã đọc, trích xuất, tóm tắt, chuẩn hóa hoặc là sản phẩm quản trị của nhóm. Phân loại theo mục đích ở các thư mục con.
- Giữ nguyên taxonomy hiện có trong `docs/raw/`; không bắt buộc rename folder hoặc file nguồn để khớp một cây mẫu.
- `architecture/`, `direction/`, `plan/`, `description/` và `course-materials/` là các nhóm đang được repository sử dụng. `adr/` và thư mục khác chỉ tạo khi có sản phẩm thực tế; không coi folder tùy chọn là bắt buộc.
- Khi xử lý một tài liệu raw, tạo file Markdown mới trong thư mục processed tương ứng, ghi rõ nguồn gốc bằng đường dẫn tương đối ở đầu tài liệu. Không xóa raw sau khi đã xử lý.
- Cây tài liệu này chỉ quy định nơi lưu và provenance. Quyết định kiến trúc phải tham chiếu tài liệu canonical được liệt kê trong `README.md`, không được định nghĩa cạnh tranh trong workspace standard.

## Cách viết input

`input/task-input.md` phải hoàn tất trước khi bắt đầu task. Mỗi input phải trả lời được:

1. Ai làm, làm trong tuần nào, thời gian dự kiến nào và trạng thái hiện tại là gì?
2. Task cần làm gì, phạm vi nào không làm, và phụ thuộc vào ai/tài liệu nào?
3. Sản phẩm dự kiến là gì, loại gì (docs/code/khác), và sẽ nằm hoặc được liên kết ở đâu?
4. Definition of Done (DoD) gồm những điều kiện kiểm tra nào?

DoD phải kiểm chứng được, không dùng câu mơ hồ như “hoàn thiện tốt”. Ví dụ tốt: “Backend blueprint ghi rõ topology MVP gồm 6 business service + Gateway, `Assignment` thuộc Target và sản phẩm nằm tại `docs/processed/architecture/backend_microservice_testbed_blueprint.md`.”

## Cách viết output và điều kiện hoàn thành

`output/task-output.md` là báo cáo thực tế sau khi làm. Bắt buộc ghi:

1. Khoảng thời gian thực tế: bắt đầu, hoàn thành, tổng thời lượng.
2. Việc đã làm, thay đổi phạm vi (nếu có), và các trở ngại còn lại.
3. Sản phẩm thực tế với link URL hoặc đường dẫn tương đối. Docs phải gắn link file/docs; code phải gắn link repository, pull request hoặc đường dẫn project.
4. Bảng/checkbox đối chiếu từng DoD với bằng chứng.

Chỉ đặt trạng thái **Hoàn thành** khi tất cả DoD được đánh dấu đạt và sản phẩm có thể mở được từ link/đường dẫn đã ghi. Nếu thiếu bất kỳ điều kiện nào, dùng **Đang thực hiện** hoặc **Chờ xử lý** và nêu rõ phần còn thiếu.
