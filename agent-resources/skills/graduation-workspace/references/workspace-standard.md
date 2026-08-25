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
- Trước khi lọc task cho người dùng hoặc tạo/sửa hồ sơ trong `workspace/<owner>/`, agent phải biết rõ người dùng là **Đức** hay **Bách** từ yêu cầu hiện tại. Nếu chưa rõ, agent phải hỏi lại; không suy đoán từ lịch sử hội thoại, tên tài khoản, tên nhánh, thư mục hoặc task đã có.
- Chỉ tạo tuần khi đã có kế hoạch làm việc. Không dùng thư mục tuần chung cho cả hai người.

## Bảng task chung theo tuần

Kế hoạch tác nghiệp dùng chung được lưu tại `docs/processed/plan/weekly/`, tách biệt với `workspace/`. Đây là nơi hai thành viên xem, nhận và theo dõi các task của tuần; không phải nơi lưu báo cáo input/output cá nhân.

```text
docs/processed/plan/weekly/
├── templates/
│   ├── weekly-overview.md
│   └── weekly-task.md
└── week-03_2026-08-16_to_2026-08-22/
    ├── weekly-overview.md
    ├── task-01_define-service-boundaries.md
    └── task-02_define-telemetry-schema.md
```

- Mỗi tuần có đúng một `weekly-overview.md`: nguồn plan canonical, mục tiêu tuần, bảng tất cả task và người phụ trách, phụ thuộc/rủi ro, cùng tiêu chí kết thúc tuần.
- Mỗi file `task-<02-so-thu-tu>_<short-title>.md` là một task nhỏ, ghi người phụ trách duy nhất, collaborator (nếu có), yêu cầu/phạm vi, đầu vào, sản phẩm kỳ vọng, DoD, trạng thái và link đến hồ sơ cá nhân khi đã có.
- Mỗi task được giao phải có một nhánh Git riêng và một pull request vào `main`; card task ghi tên nhánh và link PR. Khi người phụ trách xác nhận đã làm xong và DoD có bằng chứng, chuyển card sang **Chờ review** và ghi link PR trong card/output.
- Trạng thái card task chỉ dùng một trong: `Chưa phân công`, `Đã giao`, `Đang thực hiện`, `Chờ xử lý`, `Chờ review`, `Hoàn thành`.
- Chỉ chuyển trạng thái **Hoàn thành** khi code review đạt, output có link PR/sản phẩm và mọi DoD đạt. Pull request chỉ được merge sau khi task đã ở trạng thái **Hoàn thành**; agent không tự merge nếu người dùng chưa yêu cầu rõ.
- Khi hỏi “tuần này tôi làm gì?”, đọc các file task trong tuần hiện tại có **Người phụ trách** là người hỏi và trạng thái khác `Hoàn thành`, đồng thời tìm các task **Chờ review** có người hỏi là collaborator/reviewer.
- Bảng task chỉ là bản phân công. Một card chỉ được chuyển sang **Hoàn thành** sau khi mọi DoD có bằng chứng và đã có link đến `workspace/<owner>/.../input/task-input.md` và `output/task-output.md`.
- Đây là thư mục dùng chung, nhưng chỉ thay đổi người phụ trách/trạng thái của card khi người sở hữu task hoặc nhóm đã yêu cầu rõ ràng.

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
- `guides/` chứa quy trình/hướng dẫn thực hiện; `rules/` chứa quy tắc bắt buộc. Khi có mâu thuẫn, `rules/` được ưu tiên hơn `guides/`.
- Khi xử lý một tài liệu raw, tạo file Markdown mới trong thư mục processed tương ứng, ghi rõ nguồn gốc bằng đường dẫn tương đối ở đầu tài liệu. Không xóa raw sau khi đã xử lý.
- Cây tài liệu này chỉ quy định nơi lưu và provenance. Quyết định kiến trúc phải tham chiếu tài liệu canonical được liệt kê trong `README.md`, không được định nghĩa cạnh tranh trong workspace standard.
- Các file trong `docs/processed/plan/weekly/` là kế hoạch tác nghiệp ngắn hạn. Chúng phải dẫn link đến plan canonical hiện hành và không được âm thầm đổi milestone, phạm vi hay phân vai canonical.

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

Với mọi task mới, output phải ghi link pull request và trạng thái review. Mô tả PR phải tuân thủ `docs/processed/rules/git-and-pull-request-rules.md`.

Chỉ đặt trạng thái **Hoàn thành** khi tất cả DoD được đánh dấu đạt, sản phẩm có thể mở được từ link/đường dẫn đã ghi và code review đã đạt. Nếu phần việc đã xong nhưng chưa review, dùng **Chờ review**; nếu thiếu điều kiện khác, dùng **Đang thực hiện** hoặc **Chờ xử lý** và nêu rõ phần còn thiếu.

Thông thường tạo `input/task-input.md` ngay khi task được giao, trước khi bắt đầu làm. Nếu người dùng chỉ thông báo task sau khi đã hoàn thành, được phép tạo hồ sơ **ghi nhận hồi tố**: input phải ghi rõ đây là ghi nhận hồi tố và dùng thông tin người dùng cung cấp; output vẫn phải có thời gian, sản phẩm, DoD và bằng chứng đầy đủ. Không được ghi nhận hồi tố khi người dùng chưa xác nhận sản phẩm và từng DoD.
