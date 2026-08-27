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
→ người phụ trách hoàn thiện substantive work và bằng chứng DoD
→ commit/push substantive work
→ tạo PR
→ cập nhật URL/số PR vào hồ sơ task và chuyển sang Chờ review
→ commit/push URL PR + trạng thái Chờ review vào chính branch/PR của task
→ task-code-review đưa verdict
→ (CHANGES_REQUESTED: pr-review-response xử lý, rồi review lại)
→ APPROVED
→ người phụ trách dùng task-completion-recording để finalization metadata
→ commit/push metadata vào chính branch/PR của task
→ (nếu approval bị invalidated: reviewer kiểm tra finalization diff rồi re-approve)
→ merge PR vào nhánh canonical
→ `main` nhận substantive work + completion record + trạng thái Hoàn thành
```

- **Invariant Git khép kín:** Mọi thay đổi tracked thuộc lifecycle của một task, gồm artifact, output task, card task, weekly overview, tham chiếu PR/review và trạng thái `Hoàn thành`, phải được commit/push và đưa vào chính branch/PR của task trước khi merge, đồng thời tuân thủ các review và branch-protection requirements áp dụng cho PR đó. Sau khi PR task đã merge, không tạo bookkeeping commit chỉ để cập nhật trạng thái task, merge SHA, merge timestamp, trạng thái PR hoặc metadata có thể suy ra từ Git/GitHub. Post-merge commit chỉ hợp lệ khi là thay đổi/correction thực sự mới có scope riêng.
- **Readiness review trên PR head:** Nếu user cung cấp URL/số PR, reviewer dùng trực tiếp. Nếu user chỉ nêu task, reviewer đọc card canonical để lấy tên branch rồi tìm PR đang mở có head branch khớp; không tìm được hoặc có nhiều PR mơ hồ thì báo rõ, không suy diễn. `Chờ review` chỉ hợp lệ để bắt đầu review khi URL/số PR và trạng thái này đã nằm trong commit hiện tại ở remote PR head/task branch. Reviewer lấy trạng thái operational của task từ card trên PR head tương ứng, không từ working tree local hoặc `main`. Nếu không xác định/đọc được đúng PR head, không tự suy diễn từ `main` và chưa bắt đầu review.
- **Trạng thái trên branch và trạng thái canonical:** Sau `APPROVED`, `task-completion-recording` được phép ghi `Hoàn thành` trên branch task như trạng thái đã finalization/sẵn sàng merge. Đây chưa phải trạng thái hoàn thành project-wide. Task chỉ **canonically hoàn thành** khi commit đó đã được merge vào `main`; khi trả lời trạng thái task hoặc công việc tuần phải ưu tiên card trên `main`, và chỉ nêu branch state là thông tin bổ sung khi cần.
- Người phụ trách tự cập nhật card/output/weekly overview với URL/số PR rồi chuyển task sang `Chờ review` khi work, bằng chứng DoD và PR hợp lệ đã sẵn sàng. Transition này phải được commit/push vào chính PR trước khi request hoặc bắt đầu review; `Chờ review` chỉ ở local không đủ điều kiện.
- Reviewer chỉ dùng `task-code-review` để review và đưa verdict `APPROVED` hoặc `CHANGES_REQUESTED`; reviewer không sửa artifact của người phụ trách, không cập nhật card/weekly overview/output và không chuyển trạng thái task.
- Khi có `CHANGES_REQUESTED`, người phụ trách dùng `pr-review-response` để xử lý feedback, kiểm chứng, commit/push và reply đúng thread; task vẫn chờ review lại.
- `APPROVED` chỉ xác nhận substantive work đủ điều kiện finalization; không đồng nghĩa PR đã merge hoặc task đã canonically hoàn thành. Sau verdict này, chính người phụ trách dùng `task-completion-recording` **trước merge** để cập nhật output, card task, weekly overview, URL PR và verdict review, rồi chuyển trạng thái branch sang `Hoàn thành`. Agent không tự merge nếu người dùng chưa yêu cầu rõ.
- Finalization commit chỉ được chứa metadata/lifecycle: output, card, weekly overview, trạng thái, URL/số PR và verdict/reviewer. Không được lén thay đổi substantive artifact hoặc code; nếu cần sửa substantive work sau `APPROVED`, quay lại luồng review bình thường.
- Nếu GitHub/branch protection dismiss approval sau finalization commit, reviewer chỉ kiểm tra diff finalization có đúng metadata hợp lệ rồi re-approve. Nếu approval vẫn hợp lệ, không bắt buộc thêm một review ceremony. Sau re-approval không tạo thêm tracked lifecycle change trước merge, trừ khi phát hiện vấn đề mới; khi đó quay lại đúng luồng review. Không bypass branch protection và không tạo vòng lặp review vô hạn.
- `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự (ví dụ: quyết định, credential, hạ tầng hoặc artifact từ task khác), không dùng chỉ vì PR đang chờ merge.

## Commit/push: điều kiện workflow và quyền thực thi

- Workflow có thể yêu cầu một transition phải được commit/push để hợp lệ, ví dụ URL PR + `Chờ review` trước review và completion metadata + `Hoàn thành` trước merge.
- Điều kiện này không tự cấp quyền cho agent chạy `git commit` hoặc `git push`. Agent chỉ trực tiếp thực hiện Git write khi yêu cầu hiện tại của người dùng cho phép rõ thao tác đó.
- Nếu chưa có quyền Git write, agent được phép chuẩn bị/sửa metadata khi yêu cầu cho phép, nhưng phải báo rõ commit/push còn thiếu và không tuyên bố transition đã sẵn sàng trên remote.

## Pull request bắt buộc

- Mỗi task phải có một pull request vào `main`, kể cả task chỉ thay đổi tài liệu.
- Pull request phải gắn với đúng nhánh và card task; link PR phải được ghi trong output task và card task chung.
- Khi người phụ trách xác nhận đã làm xong và DoD có bằng chứng, cập nhật URL/số PR, output/card/weekly overview và chuyển task sang **Chờ review**, không phải **Hoàn thành**. Toàn bộ transition này phải được commit/push vào PR head trước khi request hoặc bắt đầu review.
- Ít nhất collaborator được chỉ định, hoặc thành viên còn lại của nhóm, phải review PR trước khi verdict `APPROVED` được đưa ra. Chỉ bỏ qua review khi người dùng yêu cầu rõ và lý do được ghi trong PR.
- Sau `APPROVED`, người phụ trách phải finalization bằng `task-completion-recording` và push metadata vào chính PR. PR chỉ được merge vào `main` sau khi finalization đã sẵn sàng và mọi yêu cầu review/branch protection còn hiệu lực đã được đáp ứng.
- URL hoặc số PR là tham chiếu ổn định bắt buộc và có thể được cập nhật sau khi PR được tạo bằng một commit tiếp theo trên chính branch task. Không yêu cầu merge SHA, merge commit/reference, merge timestamp hoặc trạng thái mutable `Đã merge` trong Markdown; Git/GitHub là nguồn tra cứu các dữ liệu đó.

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
