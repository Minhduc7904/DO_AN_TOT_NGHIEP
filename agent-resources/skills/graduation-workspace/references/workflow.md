# Quy trình vận hành workspace

Đọc [workspace-standard.md](workspace-standard.md) trước khi tạo hoặc thay đổi task, kế hoạch, hồ sơ công việc hoặc tài liệu.

## Quy trình bắt buộc

1. Xác định loại công việc. Với task cá nhân, chỉ nhận diện chủ sở hữu khi người dùng nói rõ là `Đức` hoặc `Bách` trong yêu cầu hiện tại. Nếu chưa rõ, hỏi lại và không suy đoán từ lịch sử, tài khoản, thư mục hoặc card task.
2. Với lập kế hoạch/phân công tuần, dùng `docs/processed/plan/weekly/` và đọc skill `weekly-task-planning`. Với họp nhóm hoặc họp thầy, dùng `meetings/`, không dùng workspace cá nhân.
3. Tìm hoặc tạo thư mục tuần đúng định dạng trong `workspace/<owner>/`; đánh số task tuần tự. Khởi tạo `input/` và `output/` từ template canonical được liệt kê tại [bảng template](../templates/canonical-templates.md).
4. Hoàn tất input trước khi bắt đầu task. Không đánh dấu hoàn thành chỉ dựa trên kế hoạch.
5. Hoàn tất output sau khi làm xong; đối chiếu từng DoD với bằng chứng, thời gian và link sản phẩm hoặc repository.
6. Lưu nguồn gốc tại `docs/raw/`, tài liệu Markdown tiếng Việt đã xử lý tại `docs/processed/`. Không sửa, di chuyển hoặc xóa tài liệu raw nếu không có yêu cầu rõ.
7. Lưu biên bản vào `meetings/week-.../` theo thời điểm bắt đầu và ghi đủ loại họp, thành phần, quyết định, việc tiếp theo và người phụ trách.

## Chuyển trạng thái và Git

- Khi người phụ trách đã hoàn thiện work, bằng chứng DoD và PR, người phụ trách cập nhật URL/số PR và task sang `Chờ review`, rồi commit/push transition này vào chính PR trước review theo [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical). Requirement này không tự cho phép agent chạy Git write khi user chưa yêu cầu.
- Khi review code hoặc PR của người khác, đọc `task-code-review`; skill này chỉ đưa verdict review, không cập nhật hồ sơ hoặc trạng thái task.
- Khi người phụ trách xử lý feedback trên PR của chính task, đọc `pr-review-response`; sau khi review lại đạt, đọc `task-completion-recording` để finalization và ghi `Hoàn thành` vào chính branch/PR trước merge.
- Trước khi tạo nhánh, thay đổi code hoặc mở PR, đọc `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md` và `docs/processed/guides/git-workflow.md`; dùng template PR canonical.

## Ràng buộc không thương lượng

- Nội dung diễn giải viết bằng tiếng Việt; tên file và thư mục mới dùng tiếng Anh, chữ thường, ASCII và kebab-case.
- Tôn trọng quyền sở hữu `workspace/duc/` và `workspace/bach/`; không âm thầm ghi đè việc hoặc output của thành viên còn lại.
- Trên branch task, người phụ trách chỉ finalization/ghi `Hoàn thành` khi mọi DoD được đánh dấu đạt, sản phẩm có thể truy cập, thời gian được ghi và review đã đạt. Trạng thái đó chỉ canonically hoàn thành khi cùng commit đã merge vào nhánh canonical; không tạo commit bookkeeping sau merge.
