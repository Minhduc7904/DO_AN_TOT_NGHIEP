# Quy trình finalization task trước merge

Đọc `AGENTS.md`, skill `graduation-workspace`, `graduation-workspace/references/workspace-standard.md`, [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical) và card task chung tương ứng trong `docs/processed/plan/weekly/` trước khi thay đổi.

Skill này chỉ áp dụng khi người phụ trách muốn finalization/ghi nhận task **sau** verdict `APPROVED` và **trước** khi PR merge vào nhánh canonical. Không dùng skill này để tạo PR, chuyển sang `Chờ review`, review artifact, xử lý feedback hoặc làm bookkeeping sau merge.

## Điều kiện đầu vào

1. Người dùng phải nói rõ họ là **Đức** hay **Bách** trong yêu cầu hiện tại, đồng thời nêu tuần và mã/tên task. Nếu thiếu, chỉ hỏi phần thiếu trước khi đọc/sửa workspace hoặc card task.
2. Xác nhận người dùng là đúng người phụ trách trên card task. Không ghi completion record thay người phụ trách.
3. Xác minh task đang ở trạng thái phù hợp để finalization (thông thường là `Chờ review`), PR đang mở đúng nhánh task, không còn blocking issue/thread cần xử lý và chưa merge vào nhánh canonical (hiện là `main`). Đọc review submissions trực tiếp từ GitHub; xác minh có verdict `APPROVED` còn hiệu lực từ đúng collaborator/reviewer là thành viên còn lại. Self-approval của người phụ trách, `COMMENTED`, `CHANGES_REQUESTED`, approval stale/dismissed hoặc approval của tài khoản không đúng reviewer đều không hợp lệ. Không suy đoán verdict hoặc trạng thái PR từ card task.
4. Xác minh substantive work đã hoàn tất, sản phẩm có thể truy cập và từng DoD có bằng chứng. Nếu thiếu điều kiện nào, giữ trạng thái hiện có; chỉ dùng `Chờ xử lý` khi có blocker/dependency thật, không dùng vì PR đang chờ merge.

## Quy trình bắt buộc

1. **Đối chiếu bằng chứng finalization.** Thu thập hoặc xác minh URL/số PR, reviewer/verdict, sản phẩm thực tế, thời điểm bắt đầu/hoàn thành, mọi thay đổi phạm vi hoặc tồn đọng, cùng bằng chứng cho từng DoD. `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, review và finalization; không phải thời điểm merge. Không yêu cầu hoặc ghi merge SHA, merge commit/reference, merge timestamp hay trạng thái mutable của PR.
2. **Cập nhật hồ sơ người phụ trách.** Trong `workspace/<owner>/<week>/`, cập nhật output với thời gian thực tế, sản phẩm, từng DoD, reviewer/verdict và URL PR. Nếu chưa có hồ sơ thì chỉ tạo khi người phụ trách yêu cầu rõ; input ghi rõ đây là ghi nhận hồi tố.
3. **Cập nhật card và tổng quan tuần.** Ghi link input/output, URL/số PR và reviewer/verdict vào card; đồng bộ hàng tương ứng trong `weekly-overview.md`.
4. **Chuyển trạng thái trên branch task.** Sau khi các điều kiện trên đều đạt, chính người phụ trách chuyển output, card task và hàng weekly overview sang `Hoàn thành`. Đây là trạng thái đã finalization/sẵn sàng merge trên branch, chưa là trạng thái project-wide canonical.
5. **Commit/push vào chính PR.** Chỉ kiểm tra diff finalization có output/card/weekly overview/trạng thái/tham chiếu PR-review; không để diff này sửa substantive artifact hoặc code. Metadata phải được commit/push vào chính branch/PR của task trước merge. Agent chỉ trực tiếp chạy Git write khi yêu cầu hiện tại của user cho phép; nếu chưa cho phép, giữ thay đổi đã chuẩn bị, báo rõ finalization chưa sẵn sàng merge trên remote và không tự tạo commit. Nếu PR URL chỉ có sau khi tạo PR, cập nhật nó bằng commit tiếp theo trên chính branch này là hợp lệ.
6. **Kiểm tra approval sau finalization.** Sau khi push finalization commit, đọc lại review/merge state trên GitHub. Nếu approval vẫn hợp lệ, người phụ trách có thể yêu cầu/thực hiện merge. Nếu approval bị stale/dismissed, reviewer chỉ kiểm tra diff finalization rồi re-approve; không review lại toàn bộ PR. Không tạo thêm tracked lifecycle change sau re-approval trừ khi phát hiện vấn đề mới.
7. **Ranh giới merge.** Reviewer không merge. Chỉ người phụ trách task được yêu cầu hoặc thực hiện merge PR của task mình; agent chỉ merge khi người dùng hiện tại nói rõ họ là đúng người phụ trách và yêu cầu merge. Trước merge phải xác minh lại `APPROVED` hợp lệ, PR head, branch protection/checks và trạng thái finalization.

## Ràng buộc

- Không tự tạo bằng chứng, thời điểm, verdict hoặc kết quả DoD.
- Không merge thay reviewer hoặc thay người phụ trách khác. Chỉ merge khi đúng người phụ trách yêu cầu rõ trong yêu cầu hiện tại và mọi cổng approval/finalization/branch protection đều đạt.
- `APPROVED` không tự chuyển task sang `Hoàn thành`; người phụ trách phải finalization metadata và push vào chính PR trước khi tự merge. Sau merge, commit đó mới là trạng thái canonical trên `main`; không tạo commit hậu-merge chỉ để đóng task.
- Finalization commit chỉ chứa metadata/lifecycle. Nếu cần thay đổi substantive artifact/code sau `APPROVED`, dừng finalization và quay lại review bình thường.
- Card task chung và task workspace có thể khác số thứ tự; liên kết giữa hai nơi là nguồn đối chiếu bắt buộc.
- Chỉ tạo hoặc sửa `workspace/duc/` khi Đức nói rõ mình là chủ sở hữu, và tương tự với `workspace/bach/`.
