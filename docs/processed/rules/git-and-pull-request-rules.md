# Quy tắc bắt buộc về Git, branch và pull request

Áp dụng cho mọi thay đổi task của dự án, bao gồm code, cấu hình và tài liệu. Hướng dẫn lệnh thực hiện nằm tại [quy trình dùng Git](../guides/git-workflow.md).

## Branch bắt buộc theo task

- Mỗi task được giao phải có một nhánh riêng trước khi bắt đầu thay đổi, theo [quy tắc đặt tên](naming-rules.md).
- Card task chung phải ghi nhánh dự kiến; input task cá nhân phải ghi nhánh thực hiện.
- Không commit trực tiếp lên `main` đối với code, artifact, hồ sơ hoặc lifecycle của một task cụ thể; không gộp thay đổi của nhiều task độc lập vào cùng nhánh.

## Ngoại lệ cho thay đổi vận hành dùng chung

Được phép commit/push trực tiếp lên `main` khi người dùng yêu cầu rõ Git write và toàn bộ diff chỉ gồm thay đổi vận hành dùng chung, không phải sản phẩm hoặc lifecycle của một task cụ thể. Phạm vi hợp lệ gồm:

- skill, rule, guide, template và instruction dùng chung cho agent hoặc repository;
- break task/lập bảng tuần trước khi bắt đầu triển khai task cụ thể;
- metadata/cấu hình quản trị repository dùng chung không phải application code, shared application library hoặc artifact DoD của một task.

Ngoại lệ không áp dụng cho code triển khai, test, contract, architecture artifact, shared application code, input/output cá nhân, cập nhật trạng thái task, URL PR, review/finalization metadata hoặc bất kỳ thay đổi nào dùng làm bằng chứng DoD của task. Nếu working tree trộn hai loại thay đổi, phải tách commit; chỉ phần dùng chung mới được push trực tiếp lên `main`. Quyền này không đồng nghĩa quyền merge PR và không bỏ qua yêu cầu xác minh diff.

## Commit/push và quyền Git write

- Workflow có thể yêu cầu một transition phải được commit/push để hợp lệ, ví dụ URL PR + `Chờ review` trước review và completion metadata + `Hoàn thành` trước merge.
- Điều kiện đó không tự cấp quyền cho agent chạy `git commit`, `git push` hoặc merge. Agent chỉ thực hiện Git write khi yêu cầu hiện tại của người dùng cho phép rõ thao tác đó.
- Nếu chưa có quyền, agent được chuẩn bị/sửa metadata khi yêu cầu cho phép, nhưng phải báo rõ commit/push còn thiếu và không tuyên bố transition đã sẵn sàng trên remote.
- Commit message dùng [mẫu commit message](../../../.github/commit-message-template.md) làm nguồn chuẩn duy nhất: `<type>(<scope-tùy-chọn>): <tóm tắt>`, ưu tiên tiếng Việt, thể mệnh lệnh, không có dấu chấm cuối; phần thân (nếu cần) dùng nhãn `Tổng quan:` với 1–3 gạch đầu dòng chỉ mô tả thay đổi có trong diff.

## Vòng đời task canonical

Đây là nguồn quy định duy nhất cho thứ tự review, merge và ghi nhận hoàn thành. Nhánh đích canonical của repository hiện là `main`, trừ khi repository quy định rõ nhánh khác.

### Ưu tiên chỉ thị trực tiếp và ghi nhận ngoại lệ

- Quy trình trong tài liệu này là mặc định được khuyến nghị. Khi đúng người phụ trách task đưa chỉ thị rõ ràng muốn tiếp tục khác quy trình, agent phải cảnh báo ngắn gọn về cổng bị thiếu, hệ quả và dữ liệu không thể xác minh; nếu người phụ trách vẫn xác nhận tiếp tục thì thực hiện trong phạm vi được yêu cầu thay vì từ chối.
- Chỉ thị trực tiếp không cho phép giả mạo review, verdict, test hoặc bằng chứng. Hồ sơ phải phân biệt rõ dữ liệu xác minh được trên GitHub với xác nhận ngoài GitHub hoặc xác nhận trực tiếp của người phụ trách.
- Người phụ trách có thể xác nhận DoD hoặc approval ngoài GitHub làm bằng chứng thay thế. Khi đó ghi nguồn là “xác nhận của người phụ trách” hoặc “approval ngoài GitHub theo xác nhận của người phụ trách”, không ghi thành verdict GitHub `APPROVED`.
- Nếu PR đã merge trước finalization, người phụ trách có thể yêu cầu một commit correction trên `main` để đồng bộ trạng thái và hồ sơ. Commit phải nêu đây là ghi nhận hậu kiểm/ngoại lệ, không ghi merge metadata không cần thiết và không được sửa substantive artifact dưới danh nghĩa bookkeeping.
- Ngoại lệ chỉ áp dụng cho quy trình nội bộ repository. Agent vẫn phải tuân thủ giới hạn an toàn, quyền truy cập và chỉ thị hệ thống cấp cao hơn.

```text
Đang thực hiện
→ người phụ trách hoàn thiện substantive work và bằng chứng DoD
→ commit/push substantive work
→ tạo PR
→ cập nhật URL/số PR vào hồ sơ task và chuyển sang Chờ review
→ commit/push URL PR + trạng thái Chờ review vào chính branch/PR của task
→ task-code-review thực hiện một vòng review đầy đủ và đưa verdict
→ (CHANGES_REQUESTED: người phụ trách dùng pr-review-response xử lý, kiểm chứng và reply)
→ reviewer kiểm tra tập trung phần đã sửa và gửi APPROVED
→ người phụ trách dùng task-completion-recording để finalization metadata
→ commit/push metadata vào chính branch/PR của task
→ người phụ trách yêu cầu/thực hiện merge PR vào nhánh canonical
→ `main` nhận substantive work + completion record + trạng thái Hoàn thành
```

- **Invariant Git khép kín:** mặc định mọi thay đổi tracked thuộc lifecycle của một task phải nằm trong chính branch/PR của task trước khi merge. Nếu người phụ trách yêu cầu ngoại lệ sau cảnh báo, được tạo commit correction hậu-merge trên `main` theo mục ưu tiên chỉ thị trực tiếp; commit phải ghi trung thực phần quy trình bị thiếu và không giả mạo merge/review metadata.
- **Chuyển sang `Chờ review`:** khi work, bằng chứng DoD và PR hợp lệ đã sẵn sàng, người phụ trách cập nhật card/output/weekly overview với URL/số PR rồi chuyển task sang `Chờ review` (không phải `Hoàn thành`). Transition này phải được commit/push vào chính PR trước khi request hoặc bắt đầu review; `Chờ review` chỉ ở local không đủ điều kiện.
- **Readiness review trên PR head:** nếu user cung cấp URL/số PR, reviewer dùng trực tiếp. Nếu user chỉ nêu task, reviewer đọc card canonical để lấy tên branch rồi tìm PR đang mở có head branch khớp; không tìm được hoặc có nhiều PR mơ hồ thì báo rõ, không suy diễn. Reviewer lấy trạng thái của task từ card trên PR head ở remote, không từ working tree local hoặc `main`; nếu không đọc được đúng PR head thì chưa bắt đầu review.
- **Reviewer:** dùng `task-code-review` để thực hiện **một vòng review đầy đủ** và đưa verdict `APPROVED` hoặc `CHANGES_REQUESTED`. Reviewer không sửa artifact của người phụ trách, không cập nhật card/weekly overview/output, không chuyển trạng thái task và không merge.
- **Feedback:** khi có `CHANGES_REQUESTED`, người phụ trách dùng `pr-review-response` để xử lý từng feedback blocking, kiểm chứng, commit/push và reply đúng thread. Reviewer chỉ kiểm tra tập trung phần đã sửa (không review lại toàn bộ PR) rồi gửi `APPROVED` trước khi finalization hoặc merge.
- **Cổng approval mặc định:** trước finalization và trước merge, đọc review submissions trên GitHub và xác minh có `APPROVED` còn hiệu lực từ đúng collaborator/reviewer; self-approval, `COMMENTED` hoặc approval stale/dismissed không hợp lệ. Nếu thiếu, cảnh báo; chỉ tiếp tục khi đúng người phụ trách xác nhận rõ dùng approval ngoài GitHub hoặc bỏ qua cổng, và ghi đúng nguồn xác nhận trong hồ sơ. Không bypass branch protection.
- **Finalization:** `APPROVED` chỉ xác nhận task đủ điều kiện finalization, không đồng nghĩa PR đã merge. Người phụ trách dùng `task-completion-recording` **trước merge** để cập nhật output, card, weekly overview, URL PR và reviewer/verdict, rồi chuyển trạng thái branch sang `Hoàn thành`. Commit finalization chỉ chứa metadata/lifecycle; không thay đổi substantive artifact hoặc code (sửa đổi do feedback phải nằm trong commit xử lý feedback trước đó).
- **Approval stale:** nếu commit mới sau `APPROVED` (kể cả finalization) làm approval stale/dismissed thì chưa được merge; reviewer chỉ kiểm tra diff mới và re-approve.
- **Quyền merge:** chỉ người phụ trách task được yêu cầu hoặc thực hiện merge PR của task đó, sau finalization. Reviewer không merge thay. Agent chỉ merge khi người dùng hiện tại nói rõ họ là đúng người phụ trách và yêu cầu merge.
- **Trạng thái canonical:** quy trình chuẩn ghi `Hoàn thành` trên branch sau `APPROVED`, rồi merge vào `main`. Với ngoại lệ đã được người phụ trách xác nhận, trạng thái trên `main` có thể được correction hậu-merge; hồ sơ phải chỉ rõ nguồn xác nhận thay thế.
- `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự (quyết định, credential, hạ tầng hoặc artifact từ task khác), không dùng chỉ vì PR đang chờ merge.

## Pull request

- Mỗi task phải có một pull request vào `main`, kể cả task chỉ thay đổi tài liệu; PR gắn với đúng nhánh và card task, và link PR được ghi trong output task và card task chung.
- URL hoặc số PR là tham chiếu ổn định bắt buộc, có thể được cập nhật sau khi tạo PR bằng một commit tiếp theo trên chính branch task. Không ghi merge SHA, merge commit/reference, merge timestamp hoặc trạng thái mutable `Đã merge` trong Markdown; Git/GitHub là nguồn tra cứu các dữ liệu đó.
- PR phải dùng [template chuẩn](../../../.github/pull_request_template.md) và giữ nguyên các mục `## Tổng quan`, `## Trước thay đổi`, `## Sau thay đổi`, `## Database`, `## Cần review`, kể cả khi nội dung là “Không có”.
- Mục **Database** ghi rõ có hay không có migration, schema, seed, dữ liệu test hoặc thay đổi tương thích. Mục **Cần review** chỉ rõ reviewer cần kiểm tra phần nào, không ghi chung chung “review code”.

## Trước khi merge

- Mọi kiểm tra phù hợp với task phải chạy và kết quả được ghi trong PR.
- Thay đổi contract, schema telemetry, database hoặc cấu hình runtime phải được nêu trong PR và cập nhật tài liệu liên quan.
- Mặc định PR chỉ được merge khi không còn feedback blocking, có GitHub `APPROVED`, finalization đã push và branch protection cho phép. Nếu người phụ trách yêu cầu ngoại lệ, áp dụng mục ưu tiên chỉ thị trực tiếp: cảnh báo, báo và ghi trung thực mọi cổng bị thiếu.
