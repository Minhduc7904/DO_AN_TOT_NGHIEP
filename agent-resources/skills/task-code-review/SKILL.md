---
name: task-code-review
description: "Review pull request của một task đang chờ review theo thay đổi thực tế, Definition of Done và mục Cần review trong PR; chỉ dùng khi review code hoặc thay đổi task, không dùng để tự merge."
---

# Review task và pull request

Đọc trước `AGENTS.md`, skill `graduation-workspace`, `references/workspace-standard.md`, `docs/processed/rules/git-and-pull-request-rules.md` và card task tương ứng.

## Xác định task và PR

1. Nếu người dùng chưa nêu task cần review, hỏi ngắn gọn: “Bạn muốn review task nào (tuần và mã/tên task)?” rồi chờ câu trả lời.
2. Tìm card task trong `docs/processed/plan/weekly/`. Task phải có trạng thái `Chờ review`, nhánh và link PR. Nếu thiếu link PR, yêu cầu người dùng cung cấp; không đoán PR từ tên nhánh.
3. Lấy mô tả, trạng thái, nhánh nguồn/đích, file thay đổi và diff của PR. Ưu tiên công cụ GitHub có sẵn; nếu không truy xuất được PR/diff, yêu cầu người dùng cung cấp URL, nội dung PR và diff cần review. Không kết luận khi chưa có thay đổi thực tế.

## Kiểm tra bắt buộc

- PR target là `main`, head branch khớp nhánh trên card task và giữ đủ năm mục: Tổng quan, Trước thay đổi, Sau thay đổi, Database, Cần review.
- Đọc Definition of Done, phạm vi và phụ thuộc từ card task; đối chiếu từng yêu cầu với diff, sản phẩm và kiểm tra đã chạy.
- Review thay đổi theo các điểm cụ thể trong mục **Cần review** của PR, sau đó kiểm tra scope creep, lỗi logic, lỗi xử lý lỗi, bảo mật, test, contract/schema và migration/database khi có liên quan.
- Không review theo cảm tính: mỗi nhận xét blocking phải chỉ ra file/vị trí, tác động và yêu cầu sửa; nhận xét không blocking phải được phân loại rõ.

## Kết quả và trạng thái

1. Báo cáo ngắn: phạm vi thay đổi, các yêu cầu PR đã kiểm, blocking issues, non-blocking suggestions và kết luận `Đạt` hoặc `Cần chỉnh sửa`.
2. Nếu có blocking issue hoặc thiếu bằng chứng DoD, giữ task/card/output là `Chờ review`, ghi nội dung cần sửa và không approve/merge.
3. Nếu review đạt, cập nhật output với reviewer, ngày review và kết quả `Đạt`; cập nhật card task/overview thành `Hoàn thành`, giữ link PR và ghi đã đủ điều kiện merge.
4. Không tự merge PR. Chỉ sau khi task đã là `Hoàn thành` thì PR mới được phép merge, và thao tác merge chỉ thực hiện khi người dùng yêu cầu rõ.
