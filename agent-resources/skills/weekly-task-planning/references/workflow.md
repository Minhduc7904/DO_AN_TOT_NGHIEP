# Quy trình lập và tra cứu task tuần

Đọc `AGENTS.md`, skill `graduation-workspace` và `graduation-workspace/references/workspace-standard.md` trước khi thực hiện. Bảng task chung nằm ở `docs/processed/plan/weekly/`; hồ sơ cá nhân `input/output` nằm ở `workspace/<owner>/` và không được thay thế bằng bảng này.

## Chọn nguồn và nơi lưu

1. Tìm plan canonical hiện hành qua `README.md`; hiện tại là `docs/processed/plan/plan-v0.2-24-weeks.md`.
2. Chỉ cụ thể hóa một tuần khi người dùng chỉ rõ tuần hoặc có đủ ngày/mốc để xác định tuần. Không tự đổi milestone, scope hay primary/collaborator canonical.
3. Dùng `docs/processed/plan/weekly/week-<nn>_<start>_to_<end>/`. Khởi tạo `weekly-overview.md` và mọi card từ đúng template được liệt kê tại [bảng template](../templates/canonical-templates.md).

## Lập và phân công task

- Tạo đúng một `weekly-overview.md` và một file `task-<nn>_<short-title>.md` cho mỗi task; các file task nằm trực tiếp trong thư mục tuần.
- Mỗi task phải có kết quả kiểm tra được, người phụ trách duy nhất, phạm vi rõ, phụ thuộc, sản phẩm kỳ vọng và DoD kiểm chứng được. Chia task lớn theo ranh giới deliverable hoặc dependency, không chia thành thao tác vụn.
- Không ấn định trước số task cho mọi tuần. Xác định số lượng sau khi đã nhận diện deliverable, dependency, độ phức tạp, năng lực thực hiện và thời gian còn lại trong tuần. Không thêm task chỉ để đạt một con số, cũng không gộp nhiều deliverable độc lập chỉ để giảm số lượng.
- Trước khi chốt phân rã, kiểm tra cân bằng: mỗi task là một đơn vị có thể hoàn tất và review trong tuần; không chỉ là một thao tác đơn lẻ; không ôm nhiều kết quả hoặc dependency độc lập đến mức gây quá tải. Tổng khối lượng và rủi ro phải đủ rõ để hai thành viên theo dõi tiến độ mà không bị ngợp.
- Gán một nhánh Git riêng cho mỗi task theo `docs/processed/rules/naming-rules.md`: `<type>/week-<nn>/task-<nn>-<short-title>`. Ghi nhánh vào card trước khi giao; không dùng một nhánh cho hai task.
- Mỗi task phải có PR vào `main`. Card task và output giữ URL/số PR. Người phụ trách hoàn tất phần việc sẽ ghi URL/số PR, chuyển `Chờ review` và commit/push transition này vào chính PR head trước review. Thành viên còn lại phải review và gửi `APPROVED` hợp lệ trên GitHub; sau đó chính người phụ trách dùng `task-completion-recording` để finalization, chuyển `Hoàn thành` trên branch/PR và tự merge task của mình. Chỉ khi commit đó vào `main` thì task mới canonically hoàn thành. Requirement commit/push/merge không tự cấp quyền Git write hoặc merge cho agent. PR tuân thủ [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical) và template PR canonical.
- Phân công cân bằng theo vai trò primary/collaborator, độ phức tạp, phụ thuộc và khả năng review chéo. Không gán trái plan canonical hoặc phân công người dùng đã nêu. Nếu chưa đủ dữ kiện, để `Chưa phân công` và hỏi lại.
- Cập nhật bảng overview khớp với mọi file task. Chỉ dùng trạng thái: `Chưa phân công`, `Đã giao`, `Đang thực hiện`, `Chờ xử lý`, `Chờ review`, `Hoàn thành`.
- Không đánh dấu hoàn thành chỉ vì plan nói cần làm. Chỉ người phụ trách, qua `task-completion-recording` sau khi xác minh `APPROVED` hợp lệ từ thành viên còn lại, mới finalization trạng thái trên branch/PR và tự merge; `main` sau merge là nguồn trạng thái project-wide canonical.
- Sau khi tạo/cập nhật `weekly-overview.md` hoặc card task, chạy `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-plan-json-and-timeline.ps1` từ repository root. Kiểm tra script exit thành công, đủ 24 tuần và không có lỗi schema/liên kết trước khi báo hoàn tất hoặc commit/push. JSON sinh ra chỉ dùng để kiểm tra tại local, bị Git ignore và không được force-add; timeline HTML phải đi cùng diff của thay đổi tuần. Nếu đồng bộ lỗi, giữ workflow chưa hoàn tất và sửa nguồn Markdown hoặc script, không chỉnh tay đầu ra.
- Việc break task/lập bảng tuần và timeline sinh tương ứng là thay đổi vận hành dùng chung, có thể commit/push trực tiếp lên `main` khi người dùng yêu cầu rõ và diff không chứa code, artifact, hồ sơ hoặc lifecycle của task cụ thể. Khi đã bắt đầu một task, mọi thay đổi thuộc task vẫn dùng branch/PR riêng theo quy tắc canonical.

## Trả lời “tuần này tôi phải làm gì?”

1. Xác định người hỏi là **Đức** hay **Bách** từ yêu cầu hiện tại. Nếu chưa được nêu rõ, hỏi “Bạn là Đức hay Bách?” và không suy đoán từ lịch sử, tài khoản, thư mục hoặc phân công cũ.
2. Xác định tuần hiện tại theo ngày hiện hành; nếu người dùng chỉ định tuần khác thì dùng tuần đó.
3. Đọc `weekly-overview.md` và toàn bộ `task-*.md` của tuần từ nhánh canonical `main` để lọc **task cần thực hiện** có người phụ trách đúng với người hỏi và trạng thái khác `Hoàn thành`. Nếu task branch đã ghi `Hoàn thành` nhưng PR chưa merge, nêu rõ là đã finalization/sẵn sàng merge, chưa canonically hoàn thành; không loại nó khỏi nhóm task chỉ dựa vào branch state.
4. Tra cứu hệ thống Git để tìm mọi PR đang mở vào `main` liên quan đến task của tuần. Nếu có URL/số PR thì dùng trực tiếp; nếu chỉ có task, lấy nhánh thực hiện từ card canonical rồi tìm PR có head branch khớp. Không tìm được hoặc có nhiều PR mơ hồ thì nêu rõ. Với mỗi PR xác định được, đọc card tương ứng ở PR head/task branch trên remote, rồi kiểm tra review request và review đã có. Một PR chỉ là sẵn sàng review khi card ở PR head đã có trạng thái `Chờ review`; không suy diễn readiness từ card trên `main`.
5. Đối chiếu từng PR với card ở PR head. Liệt kê PR cần người hỏi review khi: (a) GitHub yêu cầu người hỏi review và review của họ chưa hoàn tất; hoặc (b) task tương ứng ở PR head ghi người hỏi là collaborator/reviewer, đang `Chờ review` và PR còn mở, chưa có review đạt. Nêu rõ các PR có card local/main cũ hoặc chưa commit/push `Chờ review` là chênh lệch cần xử lý, không phải PR sẵn sàng review.
6. Trả lời hai nhóm: **Task cần thực hiện** và **Task/PR cần review**. Nhóm review phải gộp kết quả từ card `Chờ review` và PR đang chờ người hỏi review, không liệt kê trùng. Mỗi dòng có mã task (nếu xác định được), PR, yêu cầu/kết quả, hạn, phụ thuộc và trạng thái. Nếu một nhóm trống, nói rõ; không tự tạo task hoặc thay đổi trạng thái card/PR.

## Liên kết với workspace cá nhân

Khi task được nhận, khuyến nghị tạo input trước khi làm. Card task chung ghi link input/output khi có. Chỉ sửa `workspace/duc/` khi Đức nói rõ mình là chủ sở hữu, và tương tự với Bách.
