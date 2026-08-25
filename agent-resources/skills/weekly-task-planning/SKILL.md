---
name: weekly-task-planning
description: "Lập bảng task chung theo tuần từ plan canonical, chia việc hợp lý cho Đức và Bách, hoặc trả lời công việc tuần của một thành viên. Dùng cho yêu cầu breakdown kế hoạch, phân công, nhận task và tra cứu task tuần; không dùng để ghi nhận hoàn thành."
---

# Lập và tra cứu task tuần

Đọc trước `AGENTS.md`, skill `graduation-workspace` và `references/workspace-standard.md`. Bảng task chung nằm ở `docs/processed/plan/weekly/`; hồ sơ cá nhân `input/output` nằm ở `workspace/<owner>/` và không được thay thế bằng bảng này.

## Chọn nguồn và nơi lưu

1. Tìm plan canonical hiện hành qua `README.md`; hiện tại là `docs/processed/plan/plan-v0.2-24-weeks.md`.
2. Chỉ cụ thể hóa một tuần khi người dùng chỉ rõ tuần hoặc có đủ ngày/mốc để xác định tuần. Không tự đổi milestone, scope hay primary/collaborator canonical.
3. Dùng `docs/processed/plan/weekly/week-<nn>_<start>_to_<end>/`. Sao chép cấu trúc từ `templates/weekly-overview.md` và `templates/weekly-task.md`.

## Chia task

- Tạo đúng một `weekly-overview.md` và một file `task-<nn>_<short-title>.md` cho mỗi task; các file task nằm trực tiếp trong thư mục tuần.
- Mỗi task phải có một kết quả kiểm tra được, người phụ trách duy nhất, phạm vi rõ, phụ thuộc, sản phẩm kỳ vọng và DoD kiểm chứng được. Chia task lớn theo ranh giới deliverable hoặc dependency, không chia thành các thao tác vụn.
- Phân công cân bằng theo vai trò primary/collaborator, độ phức tạp, phụ thuộc và khả năng review chéo. Không gán một người nếu nguồn canonical hoặc người dùng đã gán người khác. Khi dữ kiện không đủ để gán hợp lý, để `Chưa phân công` và hỏi người dùng thay vì suy đoán.
- Cập nhật bảng task trong overview để khớp mọi file task. Trạng thái hợp lệ: `Chưa phân công`, `Đã giao`, `Đang thực hiện`, `Chờ xử lý`, `Hoàn thành`.
- Không đánh dấu hoàn thành chỉ vì plan nói cần làm. Chỉ skill ghi nhận hoàn thành mới được chuyển trạng thái khi có bằng chứng.

## Trả lời “tuần này tôi phải làm gì?”

1. Xác định tuần hiện tại theo ngày hiện hành; nếu người dùng chỉ định tuần khác thì dùng tuần đó.
2. Đọc `weekly-overview.md` và toàn bộ file `task-*.md` của tuần. Lọc theo trường **Người phụ trách** đúng với người hỏi, trạng thái không phải `Hoàn thành`.
3. Trả lời ngắn gọn theo thứ tự ưu tiên: mã task, yêu cầu/kết quả cần đạt, hạn, phụ thuộc và trạng thái. Nếu không có task, nói rõ không có task đang mở; không tự tạo task.

## Liên kết với workspace cá nhân

Khi task được nhận, khuyến nghị tạo `input/task-input.md` trước khi làm. File task chung ghi link đến input/output khi chúng có. Tôn trọng quyền sở hữu `workspace/duc/` và `workspace/bach/`; chỉ sửa workspace người dùng đã yêu cầu rõ.
