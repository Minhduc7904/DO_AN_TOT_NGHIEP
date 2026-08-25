# Quy trình review task và pull request

Đọc `AGENTS.md`, skill `graduation-workspace`, `graduation-workspace/references/workspace-standard.md`, `docs/processed/rules/git-and-pull-request-rules.md` và card task tương ứng trước khi review.

## Xác định task và PR

1. Xác định reviewer là **Đức** hay **Bách** từ yêu cầu hiện tại. Nếu chưa rõ, hỏi lại; không suy đoán từ lịch sử, tài khoản, thư mục hoặc phân công cũ.
2. Nếu chưa nêu task, hỏi: “Bạn muốn review task nào (tuần và mã/tên task)?” rồi chờ câu trả lời.
3. Tìm card task trong `docs/processed/plan/weekly/`. Task phải có trạng thái `Chờ review`, nhánh và link PR. Nếu thiếu PR, yêu cầu người dùng cung cấp; không đoán PR từ nhánh.
4. Lấy mô tả, trạng thái, nhánh nguồn/đích, file thay đổi và diff của PR. Ưu tiên công cụ GitHub có sẵn; nếu không truy xuất được PR/diff, yêu cầu URL, nội dung PR và diff. Không kết luận khi chưa có thay đổi thực tế.

## Kiểm tra bắt buộc

- PR target là `main`, head branch khớp card task và giữ toàn bộ heading trong template PR canonical, bao gồm **Tổng quan**, **Trước thay đổi**, **Sau thay đổi**, **Database**, **Cần review** và **Kiểm tra đã chạy**.
- Đọc DoD, phạm vi và phụ thuộc từ card; đối chiếu từng yêu cầu với diff, sản phẩm và kiểm tra đã chạy.
- Review các điểm trong mục **Cần review**, rồi kiểm tra scope creep, lỗi logic/xử lý lỗi, bảo mật, test, contract/schema và migration/database nếu có liên quan.
- Mỗi blocking issue phải nêu file/vị trí, tác động và yêu cầu sửa. Phân loại rõ các góp ý không blocking.

## Kết quả và trạng thái

1. Báo cáo phạm vi thay đổi, các yêu cầu PR đã kiểm, blocking issues, non-blocking suggestions và kết luận `Đạt` hoặc `Cần chỉnh sửa`.
2. Nếu có blocking issue hoặc thiếu bằng chứng DoD, giữ task/card/output là `Chờ review`, ghi phần cần sửa và không approve/merge.
3. Nếu review đạt, cập nhật output với reviewer, ngày review và kết quả `Đạt`; cập nhật card task/overview thành `Hoàn thành`, giữ link PR và ghi đã đủ điều kiện merge.
4. Không tự merge. Chỉ sau trạng thái `Hoàn thành` và khi người dùng yêu cầu rõ thì PR mới được merge.
