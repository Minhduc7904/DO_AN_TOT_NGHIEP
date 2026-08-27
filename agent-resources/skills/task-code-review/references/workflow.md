# Quy trình review task và pull request

Đọc `AGENTS.md`, skill `graduation-workspace`, `graduation-workspace/references/workspace-standard.md`, `docs/processed/rules/git-and-pull-request-rules.md` và card task tương ứng trước khi review.

## Xác định task và PR

1. Xác định reviewer là **Đức** hay **Bách** từ yêu cầu hiện tại. Nếu chưa rõ, hỏi lại; không suy đoán từ lịch sử, tài khoản, thư mục hoặc phân công cũ.
2. Nếu user chưa nêu cả PR lẫn task, hỏi: “Bạn muốn review task nào (tuần và mã/tên task), hoặc PR nào?” rồi chờ câu trả lời.
3. Nếu user cung cấp URL/số PR, dùng trực tiếp PR đó. Nếu user chỉ nêu task, đọc card canonical của task để lấy **Nhánh thực hiện**, rồi tìm PR đang mở có head branch khớp. Không phụ thuộc URL PR trên card canonical; nếu không tìm được hoặc có nhiều PR khớp mơ hồ, báo rõ và không suy diễn.
4. Lấy card task ở **commit hiện tại của PR head/task branch trên remote**. Review ban đầu chỉ hợp lệ khi bản card này có URL/số PR, đúng nhánh và trạng thái `Chờ review`. Không lấy `main` hoặc working tree local làm nguồn readiness: `main` chỉ là nguồn trạng thái project-wide canonical. Riêng khi finalization commit đã làm approval bị invalidate, card ở PR head có thể đã là `Hoàn thành`; chỉ xử lý re-approval khi PR vẫn mở, GitHub thực sự yêu cầu review lại và diff chỉ là metadata/lifecycle. Nếu không xác định/đọc được đúng PR head, báo rõ chưa thể review; không tự suy diễn từ `main`.
5. Lấy mô tả, trạng thái PR head, nhánh nguồn/đích, file thay đổi và diff của PR. Ưu tiên công cụ GitHub có sẵn; nếu không truy xuất được PR head/diff, yêu cầu URL, nội dung PR và diff. Không kết luận khi chưa có thay đổi thực tế.

## Kiểm tra bắt buộc

- PR target là `main`, head branch khớp card trong chính PR head và giữ toàn bộ heading trong template PR canonical, bao gồm **Tổng quan**, **Trước thay đổi**, **Sau thay đổi**, **Database**, **Cần review** và **Kiểm tra đã chạy**.
- Đọc DoD, phạm vi và phụ thuộc từ card ở PR head; đối chiếu từng yêu cầu với diff, sản phẩm và kiểm tra đã chạy.
- Review các điểm trong mục **Cần review**, rồi kiểm tra scope creep, lỗi logic/xử lý lỗi, bảo mật, test, contract/schema và migration/database nếu có liên quan.
- Mỗi blocking issue phải nêu file/vị trí, tác động và yêu cầu sửa. Phân loại rõ các góp ý không blocking.

## Đăng nhận xét inline trên pull request

- Chỉ đăng nhận xét khi người dùng yêu cầu rõ review đó được đăng lên GitHub. Việc yêu cầu review không mặc nhiên cho phép tạo comment bên ngoài repository.
- Trước khi đăng, kiểm tra tài khoản GitHub đang xác thực có đúng là reviewer đã được người dùng xác định trong yêu cầu hiện tại. Nhận xét sẽ hiển thị dưới tên tài khoản này; không được giả danh tài khoản khác hoặc ký/ghi nội dung là ChatGPT. Nếu không khớp hoặc không xác thực được, không đăng và yêu cầu người dùng đăng nhập đúng tài khoản.
- Mỗi nhận xét inline phải gắn vào đúng file và dòng thay đổi trong diff, nêu rõ vấn đề, tác động và hướng xử lý. Không dùng inline comment cho nhận xét không xác định được vị trí; đưa nhận xét đó vào phần tổng kết của review.
- Chỉ đăng các nhận xét đã được kiểm chứng từ diff, card task hoặc DoD. Phân biệt blocking issue với góp ý không blocking để người phụ trách biết điều kiện cần sửa.
- Comment inline không tự đồng nghĩa với `Approve`, `Request changes` hoặc merge; chỉ thực hiện các hành động đó khi người dùng yêu cầu rõ.

## Kết quả và ranh giới trách nhiệm

1. Báo cáo phạm vi thay đổi, các yêu cầu PR đã kiểm, blocking issues, non-blocking suggestions và verdict duy nhất: `APPROVED` khi không còn blocking issue/thiếu bằng chứng DoD, hoặc `CHANGES_REQUESTED` khi còn ít nhất một điều kiện blocking.
2. Khi người dùng yêu cầu rõ và tài khoản GitHub xác thực đúng reviewer, có thể đăng verdict review và inline comment tương ứng. Không approve/request changes/merge chỉ vì đã đăng comment inline.
3. Reviewer không tự sửa artifact của người phụ trách, trạng thái card task, weekly overview, input/output hoặc gắn link PR. Reviewer không ghi completion record hay chuyển task sang `Hoàn thành`.
4. Với `CHANGES_REQUESTED`, người phụ trách xử lý bằng `pr-review-response` rồi gửi review lại. `APPROVED` nghĩa là substantive work đủ điều kiện finalization, không có nghĩa PR đã merge hoặc task đã canonically hoàn thành. Sau verdict này, người phụ trách dùng `task-completion-recording` để ghi metadata `Hoàn thành` trên chính branch/PR **trước merge** theo [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).
5. Nếu finalization commit làm GitHub dismiss approval, reviewer chỉ kiểm tra diff metadata/lifecycle đó và re-approve khi hợp lệ. Reviewer không cập nhật completion record hoặc trạng thái task thay người phụ trách.
6. Không tự merge; thao tác merge chỉ thực hiện khi người dùng yêu cầu rõ.
