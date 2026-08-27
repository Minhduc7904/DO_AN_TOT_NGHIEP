# Quy trình ghi nhận task hoàn thành sau merge

Đọc `AGENTS.md`, skill `graduation-workspace`, `graduation-workspace/references/workspace-standard.md`, [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical) và card task chung tương ứng trong `docs/processed/plan/weekly/` trước khi thay đổi.

Skill này chỉ áp dụng khi người phụ trách muốn ghi nhận/đóng task **sau** khi PR đã có verdict `APPROVED` và đã merge vào nhánh canonical. Không dùng skill này để tạo PR, chuyển sang `Chờ review`, review artifact hoặc xử lý feedback.

## Điều kiện đầu vào

1. Người dùng phải nói rõ họ là **Đức** hay **Bách** trong yêu cầu hiện tại, đồng thời nêu tuần và mã/tên task. Nếu thiếu, chỉ hỏi phần thiếu trước khi đọc/sửa workspace hoặc card task.
2. Xác nhận người dùng là đúng người phụ trách trên card task. Không ghi completion record thay người phụ trách.
3. Xác minh PR đúng nhánh task, có verdict `APPROVED` và đã merge vào nhánh canonical (hiện là `main`). Không suy đoán trạng thái merge từ review đạt hay từ một PR đang mở.
4. Xác minh sản phẩm có thể truy cập và từng DoD có bằng chứng. Nếu thiếu điều kiện nào, giữ trạng thái hiện có hoặc dùng `Chờ xử lý`, nêu rõ phần thiếu và không chuyển `Hoàn thành`.

## Quy trình bắt buộc

1. **Đối chiếu bằng chứng cuối cùng.** Thu thập hoặc xác minh URL PR, commit/merge reference, sản phẩm thực tế, thời điểm bắt đầu/hoàn thành, mọi thay đổi phạm vi hoặc tồn đọng, cùng bằng chứng cho từng DoD. Không gộp xác nhận DoD thành một câu hỏi chung khi bằng chứng còn thiếu.
2. **Cập nhật hồ sơ người phụ trách.** Trong `workspace/<owner>/<week>/`, cập nhật output với thời gian thực tế, sản phẩm, từng DoD, reviewer/verdict, URL PR và trạng thái/commit merge. Nếu chưa có hồ sơ thì chỉ tạo khi người phụ trách yêu cầu rõ; input ghi rõ đây là ghi nhận hồi tố.
3. **Cập nhật card và tổng quan tuần.** Ghi link input/output, URL PR, reviewer/verdict và merge reference cần thiết vào card; đồng bộ hàng tương ứng trong `weekly-overview.md`.
4. **Chuyển trạng thái.** Sau khi các điều kiện trên đều đạt, chính người phụ trách chuyển output, card task và hàng weekly overview sang `Hoàn thành`.

## Ràng buộc

- Không tự tạo bằng chứng, thời điểm, verdict, merge reference hoặc kết quả DoD.
- Không tự merge; thao tác merge chỉ thực hiện khi người dùng yêu cầu rõ.
- `APPROVED` không đủ để ghi nhận `Hoàn thành`; PR phải đã merge vào nhánh canonical.
- Card task chung và task workspace có thể khác số thứ tự; liên kết giữa hai nơi là nguồn đối chiếu bắt buộc.
- Chỉ tạo hoặc sửa `workspace/duc/` khi Đức nói rõ mình là chủ sở hữu, và tương tự với `workspace/bach/`.
