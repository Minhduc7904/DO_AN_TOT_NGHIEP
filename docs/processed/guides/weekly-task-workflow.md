# Quy trình làm việc theo task hằng tuần

> Quy trình này áp dụng cho Đức, Bách và AI agent. Quy tắc bắt buộc về branch, pull request và review nằm tại [quy tắc Git/PR](../rules/git-and-pull-request-rules.md); lệnh Git chi tiết nằm tại [quy trình Git](git-workflow.md).

## Luồng tổng quát

```text
Giao task → Nhận task → Làm trên branch riêng → PR + DoD
→ Chờ review → Review đạt → Hoàn thành → Merge khi được yêu cầu
```

Không bỏ qua hoặc đảo thứ tự các trạng thái trên.

## 1. Đầu tuần: người giao task

Người giao task yêu cầu agent lập kế hoạch tuần. Agent phải dùng [skill chia task tuần](../../../agent-resources/skills/weekly-task-planning/SKILL.md) để:

1. Đọc plan canonical mới nhất và tạo/cập nhật `docs/processed/plan/weekly/week-.../`.
2. Tạo một `weekly-overview.md` và một file cho mỗi task nhỏ.
3. Ghi rõ người phụ trách, collaborator/reviewer, phạm vi, sản phẩm, DoD, hạn và dependency của từng task.
4. Gán một branch riêng cho từng task theo quy tắc đặt tên.
5. Không đánh dấu task hoàn thành chỉ vì nó đã có trong plan.

Ví dụ yêu cầu cho agent: “Chia task tuần 5 từ plan canonical và phân công cho Đức/Bách.”

## 2. Bắt đầu làm: người thực hiện hỏi công việc tuần

Người thực hiện hỏi agent, ví dụ: “Tuần này Đức phải làm gì?” Agent phải dùng skill chia task tuần để đọc toàn bộ card task của tuần và trả lời hai nhóm:

- **Task cần thực hiện**: các task chưa hoàn thành có người phụ trách là người hỏi.
- **Task cần review**: các task đang `Chờ review` mà người hỏi là collaborator/reviewer.

Sau khi nhận task, người thực hiện tạo nhánh đúng tên ghi trên card, tạo `input/task-input.md` trong workspace cá nhân trước khi làm và chuyển card thành `Đang thực hiện`.

## 3. Thực hiện task và tạo pull request

Người thực hiện chỉ làm thay đổi thuộc task trên branch riêng. Khi DoD đã đạt:

1. Push branch và tạo PR vào `main` bằng [PR template](../../../.github/pull_request_template.md).
2. Đảm bảo PR có đủ: **Tổng quan**, **Trước thay đổi**, **Sau thay đổi**, **Database** và **Cần review**.
3. Ghi link PR vào card task chung và output task.
4. Không merge PR ở bước này.

## 4. Người làm báo đã xong

Người thực hiện báo agent, ví dụ: “Tôi, Đức, đã hoàn thành task-01 của tuần 5.” Agent phải dùng [skill ghi nhận hoàn thành](../../../agent-resources/skills/task-completion-recording/SKILL.md):

1. Hỏi sản phẩm thực tế, branch, link PR đang mở, thời gian làm và tồn đọng.
2. Liệt kê từng DoD và yêu cầu người dùng xác nhận/bổ sung bằng chứng cho từng mục.
3. Cập nhật `input/task-input.md`, `output/task-output.md`, card task và `weekly-overview.md`.
4. Chuyển task sang **Chờ review** khi có đủ DoD, sản phẩm và PR hợp lệ.

Agent không được chuyển task sang **Hoàn thành** ở bước này.

## 5. Review task/PR

Reviewer nói với agent, ví dụ: “Review task-01 tuần 5.” Nếu chưa rõ task nào, agent phải hỏi lại task cần review. Sau đó agent dùng [skill review task/PR](../../../agent-resources/skills/task-code-review/SKILL.md) để:

1. Tìm card task và PR tương ứng; kiểm tra task đang `Chờ review`.
2. Đọc mô tả PR, các file/diff thay đổi, DoD và mục **Cần review**.
3. Review đúng yêu cầu PR, đồng thời kiểm tra phạm vi, test, database/schema, contract và lỗi có thể chặn merge.
4. Nếu có lỗi blocking, giữ task ở **Chờ review** và ghi rõ nội dung cần sửa.
5. Nếu review đạt, cập nhật kết quả review trong output/card task và chuyển task sang **Hoàn thành**.

## 6. Merge pull request

PR chỉ được phép merge sau khi task đã ở trạng thái **Hoàn thành**. Agent không tự merge; chỉ thực hiện merge khi người dùng yêu cầu rõ. Sau khi merge, cập nhật trạng thái PR trong output và card task.
