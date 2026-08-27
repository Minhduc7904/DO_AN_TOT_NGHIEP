# Quy trình lập và tra cứu task tuần

Đọc `AGENTS.md`, skill `graduation-workspace` và `graduation-workspace/references/workspace-standard.md` trước khi thực hiện. Bảng task chung nằm ở `docs/processed/plan/weekly/`; hồ sơ cá nhân `input/output` nằm ở `workspace/<owner>/` và không được thay thế bằng bảng này.

## Chọn nguồn và nơi lưu

1. Tìm plan canonical hiện hành qua `README.md`; hiện tại là `docs/processed/plan/plan-v0.2-24-weeks.md`.
2. Chỉ cụ thể hóa một tuần khi người dùng chỉ rõ tuần hoặc có đủ ngày/mốc để xác định tuần. Không tự đổi milestone, scope hay primary/collaborator canonical.
3. Dùng `docs/processed/plan/weekly/week-<nn>_<start>_to_<end>/`. Khởi tạo `weekly-overview.md` và mọi card từ đúng template được liệt kê tại [bảng template](../templates/canonical-templates.md).

## Lập và phân công task

- Tạo đúng một `weekly-overview.md` và một file `task-<nn>_<short-title>.md` cho mỗi task; các file task nằm trực tiếp trong thư mục tuần.
- Mỗi task phải có kết quả kiểm tra được, người phụ trách duy nhất, phạm vi rõ, phụ thuộc, sản phẩm kỳ vọng và DoD kiểm chứng được. Chia task lớn theo ranh giới deliverable hoặc dependency, không chia thành thao tác vụn.
- Gán một nhánh Git riêng cho mỗi task theo `docs/processed/rules/naming-rules.md`: `<type>/week-<nn>/task-<nn>-<short-title>`. Ghi nhánh vào card trước khi giao; không dùng một nhánh cho hai task.
- Mỗi task phải có PR vào `main`. Card task và output giữ link PR. Người phụ trách hoàn tất phần việc sẽ chuyển task sang `Chờ review`; review đạt phải được merge vào `main` trước khi chính người phụ trách dùng `task-completion-recording` chuyển `Hoàn thành`. PR tuân thủ [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical) và template PR canonical.
- Phân công cân bằng theo vai trò primary/collaborator, độ phức tạp, phụ thuộc và khả năng review chéo. Không gán trái plan canonical hoặc phân công người dùng đã nêu. Nếu chưa đủ dữ kiện, để `Chưa phân công` và hỏi lại.
- Cập nhật bảng overview khớp với mọi file task. Chỉ dùng trạng thái: `Chưa phân công`, `Đã giao`, `Đang thực hiện`, `Chờ xử lý`, `Chờ review`, `Hoàn thành`.
- Không đánh dấu hoàn thành chỉ vì plan nói cần làm. Chỉ người phụ trách, qua `task-completion-recording` sau merge, mới chuyển trạng thái khi có đủ bằng chứng.

## Trả lời “tuần này tôi phải làm gì?”

1. Xác định người hỏi là **Đức** hay **Bách** từ yêu cầu hiện tại. Nếu chưa được nêu rõ, hỏi “Bạn là Đức hay Bách?” và không suy đoán từ lịch sử, tài khoản, thư mục hoặc phân công cũ.
2. Xác định tuần hiện tại theo ngày hiện hành; nếu người dùng chỉ định tuần khác thì dùng tuần đó.
3. Đọc `weekly-overview.md` và toàn bộ `task-*.md` của tuần. Lọc: (a) task có người phụ trách đúng với người hỏi và trạng thái khác `Hoàn thành`; (b) task `Chờ review` mà người hỏi là collaborator/reviewer.
4. Tra cứu hệ thống Git của repository để tìm mọi PR đang mở vào `main` liên quan đến task của tuần, bằng link PR trên card hoặc nhánh thực hiện ghi trên card. Với mỗi PR, kiểm tra review request và review đã có. Một PR chưa có review vẫn được xem là cần review khi card xác định người hỏi là collaborator/reviewer; không yêu cầu GitHub phải có review request tường minh.
5. Đối chiếu từng PR với card task. Liệt kê PR cần người hỏi review khi: (a) GitHub yêu cầu người hỏi review và review của họ chưa hoàn tất; hoặc (b) task tương ứng ghi người hỏi là collaborator/reviewer và PR đang mở, chưa có review đạt. Vẫn liệt kê PR hợp lệ chưa có hoặc chưa đồng bộ với card, nhưng nêu rõ đó là chênh lệch cần xử lý.
6. Trả lời hai nhóm: **Task cần thực hiện** và **Task/PR cần review**. Nhóm review phải gộp kết quả từ card `Chờ review` và PR đang chờ người hỏi review, không liệt kê trùng. Mỗi dòng có mã task (nếu xác định được), PR, yêu cầu/kết quả, hạn, phụ thuộc và trạng thái. Nếu một nhóm trống, nói rõ; không tự tạo task hoặc thay đổi trạng thái card/PR.

## Liên kết với workspace cá nhân

Khi task được nhận, khuyến nghị tạo input trước khi làm. Card task chung ghi link input/output khi có. Chỉ sửa `workspace/duc/` khi Đức nói rõ mình là chủ sở hữu, và tương tự với Bách.
