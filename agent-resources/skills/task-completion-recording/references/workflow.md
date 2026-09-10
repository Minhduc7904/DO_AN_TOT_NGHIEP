# Quy trình finalization task trước merge

Đọc `AGENTS.md`, skill `graduation-workspace`, `graduation-workspace/references/workspace-standard.md`, [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical) và card task chung tương ứng trong `docs/processed/plan/weekly/` trước khi thay đổi.

Quy trình chuẩn áp dụng sau verdict `APPROVED` và trước khi PR merge. Khi đúng người phụ trách yêu cầu ngoại lệ, agent cảnh báo cổng còn thiếu rồi tiếp tục nếu người dùng xác nhận rõ. Với PR đã merge, dùng correction trên `main` và ghi đây là ghi nhận hậu kiểm/ngoại lệ.

## Điều kiện đầu vào

1. Người dùng phải nói rõ họ là **Đức** hay **Bách** trong yêu cầu hiện tại, đồng thời nêu tuần và mã/tên task. Nếu thiếu, chỉ hỏi phần thiếu trước khi đọc/sửa workspace hoặc card task.
2. Xác nhận người dùng là đúng người phụ trách trên card task. Không ghi completion record thay người phụ trách.
3. Xác minh trạng thái task, PR và review khi có thể. Nếu thiếu GitHub `APPROVED`, PR đã merge hoặc còn lệch workflow, cảnh báo rõ. Sau xác nhận tiếp tục của đúng người phụ trách, dùng xác nhận đó làm bằng chứng ngoại lệ và ghi đúng nguồn; không suy diễn thành verdict GitHub.
4. Xác minh substantive work, sản phẩm và DoD trong khả năng hiện có. Người phụ trách được quyền xác nhận phần không thể kiểm chứng trực tiếp; ghi rõ điều kiện nào dựa trên xác nhận thay thế.

## Quy trình bắt buộc

1. **Đối chiếu bằng chứng finalization.** Thu thập hoặc xác minh URL/số PR, reviewer/verdict, sản phẩm thực tế, thời điểm bắt đầu/hoàn thành, mọi thay đổi phạm vi hoặc tồn đọng, cùng bằng chứng cho từng DoD. `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, review và finalization; không phải thời điểm merge. Không yêu cầu hoặc ghi merge SHA, merge commit/reference, merge timestamp hay trạng thái mutable của PR.
2. **Cập nhật hồ sơ người phụ trách.** Trong `workspace/<owner>/<week>/`, cập nhật output với thời gian thực tế, sản phẩm, từng DoD, reviewer/verdict và URL PR. Nếu chưa có hồ sơ thì chỉ tạo khi người phụ trách yêu cầu rõ; input ghi rõ đây là ghi nhận hồi tố.
3. **Cập nhật card và tổng quan tuần.** Ghi link input/output, URL/số PR và reviewer/verdict vào card; đồng bộ hàng tương ứng trong `weekly-overview.md`.
4. **Chuyển trạng thái.** Quy trình chuẩn cập nhật trên branch task trước merge. Với ngoại lệ hậu-merge được người phụ trách xác nhận, cập nhật correction trực tiếp trên `main` và ghi nguồn xác nhận.
5. **Đồng bộ JSON và timeline.** Chạy `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-plan-json-and-timeline.ps1` từ repository root. Chỉ tiếp tục khi script thành công và JSON/timeline phản ánh trạng thái finalization trong cùng diff. Nếu script lỗi, không sửa tay đầu ra, không báo finalization hoàn tất và không commit/push trạng thái mới.
6. **Commit/push.** Quy trình chuẩn commit metadata vào chính PR. Với correction hậu-merge đã được xác nhận, commit/push trên `main` được phép. Giữ diff ở metadata/lifecycle và timeline sinh tự động; không trộn substantive artifact hoặc code.
7. **Kiểm tra approval sau finalization.** Sau khi push finalization commit, đọc lại review/merge state trên GitHub. Nếu approval vẫn hợp lệ, người phụ trách có thể yêu cầu/thực hiện merge. Nếu approval bị stale/dismissed, reviewer chỉ kiểm tra diff finalization rồi re-approve; không review lại toàn bộ PR. Không tạo thêm tracked lifecycle change sau re-approval trừ khi phát hiện vấn đề mới.
8. **Ranh giới merge.** Reviewer không merge. Chỉ người phụ trách task được yêu cầu hoặc thực hiện merge PR của task mình; agent chỉ merge khi người dùng hiện tại nói rõ họ là đúng người phụ trách và yêu cầu merge. Trước merge phải xác minh lại `APPROVED` hợp lệ, PR head, branch protection/checks và trạng thái finalization.

## Ràng buộc

- Không tự tạo bằng chứng, thời điểm hoặc verdict. Có thể ghi kết quả DoD dựa trên xác nhận trực tiếp của đúng người phụ trách nhưng phải ghi rõ nguồn.
- Không merge thay reviewer hoặc thay người phụ trách khác. Chỉ merge khi đúng người phụ trách yêu cầu rõ trong yêu cầu hiện tại và mọi cổng approval/finalization/branch protection đều đạt.
- Mặc định `APPROVED` không tự chuyển task sang `Hoàn thành`. Ngoại lệ hậu-merge chỉ được ghi bằng commit correction trên `main` sau cảnh báo và chỉ thị rõ của người phụ trách.
- Finalization commit chỉ chứa metadata/lifecycle. Nếu cần thay đổi substantive artifact/code sau `APPROVED`, dừng finalization và quay lại review bình thường.
- Card task chung và task workspace có thể khác số thứ tự; liên kết giữa hai nơi là nguồn đối chiếu bắt buộc.
- Chỉ tạo hoặc sửa `workspace/duc/` khi Đức nói rõ mình là chủ sở hữu, và tương tự với `workspace/bach/`.
