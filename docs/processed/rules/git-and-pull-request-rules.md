# Quy tắc bắt buộc về Git, branch và pull request

Áp dụng cho mọi thay đổi task của dự án, bao gồm code, cấu hình và tài liệu. Hướng dẫn lệnh thực hiện nằm tại [quy trình dùng Git](../guides/git-workflow.md).

## Branch bắt buộc theo task

- Mỗi task được giao phải có một nhánh riêng trước khi bắt đầu thay đổi, theo [quy tắc đặt tên](naming-rules.md).
- Card task chung phải ghi nhánh dự kiến; input task cá nhân phải ghi nhánh thực hiện.
- Không commit trực tiếp lên `main`; không gộp thay đổi của nhiều task độc lập vào cùng nhánh.

## Commit message bắt buộc

- Dùng [mẫu commit message](../../../.github/commit-message-template.md) làm nguồn chuẩn duy nhất.
- Dòng tóm tắt dùng dạng `<type>(<scope-tùy-chọn>): <tóm tắt>`; dùng Conventional Commit type/scope phù hợp, thường là `feat`, `fix`, `docs`, `refactor`, `test` hoặc `chore`.
- Ưu tiên tóm tắt bằng tiếng Việt, thể mệnh lệnh, ngắn gọn và không có dấu chấm cuối câu. Tiếng Anh được phép khi thuật ngữ kỹ thuật, tên riêng, type/scope hoặc ngữ cảnh làm câu rõ hơn.
- Khi cần phần thân, dùng nhãn `Tổng quan:` và 1–3 gạch đầu dòng ngắn, mỗi gạch mô tả một thay đổi có trong diff. Không viết đoạn văn dài, không lặp lại toàn bộ PR và không bịa thông tin.
- Copilot phải sinh commit message theo mẫu trên, dựa trên staged diff hoặc diff người dùng chỉ định; người dùng vẫn là người quyết định commit cuối cùng.

## Vòng đời task canonical

Đây là nguồn quy định duy nhất cho thứ tự review, merge và ghi nhận hoàn thành. Nhánh đích canonical của repository hiện là `main`, trừ khi repository quy định rõ nhánh khác.

```text
Đang thực hiện
→ người phụ trách hoàn thiện work, bằng chứng DoD và PR
→ Chờ review
→ task-code-review đưa verdict
→ (CHANGES_REQUESTED: pr-review-response xử lý, rồi review lại)
→ APPROVED
→ PR merge vào nhánh canonical
→ task-completion-recording ghi hồ sơ
→ Hoàn thành
```

- Người phụ trách tự cập nhật card/output của task để chuyển sang `Chờ review` khi work, bằng chứng DoD và PR hợp lệ đã sẵn sàng.
- Reviewer chỉ dùng `task-code-review` để review và đưa verdict `APPROVED` hoặc `CHANGES_REQUESTED`; reviewer không sửa artifact của người phụ trách, không cập nhật card/weekly overview/output và không chuyển trạng thái task.
- Khi có `CHANGES_REQUESTED`, người phụ trách dùng `pr-review-response` để xử lý feedback, kiểm chứng, commit/push và reply đúng thread; task vẫn chờ review lại.
- `APPROVED` chỉ là kết luận review, không phải `Hoàn thành`. PR phải được merge vào nhánh canonical trước khi ghi nhận task hoàn thành. Agent không tự merge nếu người dùng chưa yêu cầu rõ.
- Sau khi merge, chính người phụ trách dùng `task-completion-recording` để cập nhật output, card task, weekly overview và tham chiếu PR/merge cần thiết, rồi chuyển task sang `Hoàn thành`.

## Pull request bắt buộc

- Mỗi task phải có một pull request vào `main`, kể cả task chỉ thay đổi tài liệu.
- Pull request phải gắn với đúng nhánh và card task; link PR phải được ghi trong output task và card task chung.
- Khi người phụ trách xác nhận đã làm xong và DoD có bằng chứng, task chuyển sang **Chờ review**, không phải **Hoàn thành**.
- Ít nhất collaborator được chỉ định, hoặc thành viên còn lại của nhóm, phải review PR trước khi verdict `APPROVED` được đưa ra. Chỉ bỏ qua review khi người dùng yêu cầu rõ và lý do được ghi trong PR.
- Sau `APPROVED`, PR được phép merge vào `main`; chỉ sau khi merge và completion record được cập nhật mới chuyển task sang **Hoàn thành**.

## Nội dung pull request bắt buộc

PR phải dùng [template chuẩn](../../../.github/pull_request_template.md) và giữ nguyên các mục sau, kể cả khi nội dung là “Không có”:

1. `## Tổng quan`
2. `## Trước thay đổi`
3. `## Sau thay đổi`
4. `## Database`
5. `## Cần review`

Mục **Database** phải ghi rõ có hay không có migration, schema, seed, dữ liệu test hoặc thay đổi tương thích. Mục **Cần review** phải chỉ rõ reviewer cần kiểm tra phần nào, không ghi chung chung “review code”.

## Trước khi merge

- Mọi kiểm tra phù hợp với task phải chạy và kết quả được ghi trong PR.
- Thay đổi contract, schema telemetry, database hoặc cấu hình runtime phải được nêu trong PR và cập nhật tài liệu liên quan.
- PR chỉ được merge khi không còn comment bắt buộc, review đã đáp ứng rule và phạm vi vẫn đúng task đã giao.
