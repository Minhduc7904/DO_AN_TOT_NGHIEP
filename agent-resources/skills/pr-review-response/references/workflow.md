# Quy trình xử lý phản hồi review pull request

Đọc `AGENTS.md`, skill `graduation-workspace`, `graduation-workspace/references/workspace-standard.md`, `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md`, `docs/processed/guides/git-workflow.md`, card task và mô tả PR trước khi sửa.

## Xác định chủ sở hữu và PR

1. Xác định người phụ trách là **Đức** hay **Bách** từ yêu cầu hiện tại. Nếu chưa rõ, hỏi lại; không suy đoán từ lịch sử, tên tài khoản hay nhánh.
2. Xác nhận card task ghi đúng người phụ trách, nhánh và link PR. Chỉ làm việc trên nhánh hiện có của task; không tạo nhánh mới hoặc gộp thay đổi của task khác.
3. Đọc kỹ mô tả PR trước khi xem diff hoặc comment để hiểu mục tiêu, phạm vi, điểm cần review và kiểm tra đã chạy.
4. Kiểm tra tài khoản GitHub đang xác thực là tài khoản của người phụ trách đã xác định. Reply sẽ hiển thị dưới tài khoản đó; nếu không khớp hoặc không xác thực được, không sửa/đăng reply lên GitHub và yêu cầu người dùng đăng nhập đúng tài khoản.

## Đọc và lập kế hoạch phản hồi

1. Đọc toàn bộ review đang có: review summary, comment tổng quát, comment inline và mọi thread chưa resolve. Đọc cả ngữ cảnh diff, file và dòng mà từng comment tham chiếu.
2. Lập bảng đối chiếu cho từng comment: yêu cầu của reviewer, tác động, tiêu chí chấp nhận, thay đổi dự kiến và cách kiểm chứng. Phân biệt rõ blocking issue, góp ý không blocking, câu hỏi và comment đã được xử lý ở commit trước.
3. Khi comment mơ hồ, mâu thuẫn với DoD/canonical hoặc đòi hỏi mở rộng phạm vi, không tự đoán giải pháp. Nêu rõ điểm xung đột và hỏi người dùng hoặc reviewer trước khi thay đổi.
4. Chỉ sửa và phản hồi khi người dùng yêu cầu xử lý review. Nếu người dùng chỉ yêu cầu đọc/đánh giá comment, báo cáo kế hoạch nhưng không thay đổi nhánh hoặc đăng reply.

## Sửa theo review

1. Chỉ thay đổi những file cần thiết để đáp ứng từng comment đã xác nhận, giữ đúng phạm vi task và không sửa `docs/raw/` hoặc workspace của thành viên còn lại.
2. Đối chiếu lại diff với yêu cầu reviewer, DoD và mô tả PR. Không nói đã sửa khi thay đổi chưa có trong diff hoặc chưa được đẩy lên PR.
3. Chạy các kiểm tra phù hợp với thay đổi; với tài liệu, tối thiểu kiểm tra link/Markdown, consistency với tài liệu canonical và `git diff --check`. Ghi nhận chính xác kiểm tra đã chạy hoặc lý do không áp dụng.
4. Thay đổi phải được commit/push lên chính nhánh PR trước khi reply để reviewer có thể thấy thay đổi thực tế. Agent chỉ trực tiếp chạy Git write khi yêu cầu hiện tại của user cho phép; nếu chưa cho phép, không reply rằng đã sửa và báo rõ commit/push còn thiếu. Không tự merge hay đổi trạng thái task.

## Reply chi tiết trên review thread

1. Chỉ reply trên đúng review thread sau khi thay đổi đã xuất hiện trên PR. Không tạo comment tổng quát thay cho một inline review có vị trí cụ thể.
2. Mỗi reply phải nêu đủ, theo ngữ cảnh phù hợp:

   ```text
   Đã cập nhật ở `<file>` (commit `<sha>`).

   - Vấn đề: <diễn giải chính xác concern của reviewer>.
   - Giải pháp: <quyết định kỹ thuật/tài liệu đã chọn và lý do>.
   - Thay đổi: <điều đã sửa, field/rule/test liên quan>.
   - Kiểm chứng: <test, lệnh, kiểm tra tài liệu hoặc bằng chứng đã chạy>.
   - Phạm vi/giới hạn: <ảnh hưởng còn lại hoặc lý do không mở rộng thêm, nếu có>.
   ```

3. Với comment không cần sửa, reply rõ kết luận, bằng chứng và lý do không thay đổi. Với comment chưa thể xử lý, reply nêu trở ngại, phương án đang cân nhắc và câu hỏi cần reviewer xác nhận; không tuyên bố đã sửa.
4. Không reply chung chung như “đã sửa” hoặc “done”. Không giả danh reviewer khác, không ký tên ChatGPT và không đăng approve/request-changes nếu người dùng chưa yêu cầu rõ.
5. Sau khi đăng, xác minh từng reply hiển thị ở đúng thread, đúng tài khoản GitHub và trỏ đến thay đổi đã đẩy.

## Kết quả và ranh giới trạng thái

- Báo cáo comment nào đã xử lý, commit/file/kiểm tra tương ứng, comment nào đang chờ làm rõ và link các reply đã đăng.
- Chỉ người phụ trách task mới tự cập nhật hồ sơ của mình theo quy trình phù hợp. Skill này không cập nhật card task, weekly overview, input/output, link PR hoặc trạng thái `Hoàn thành`.
- Skill này không tự quyết định task đã hoàn thành, không tự merge và không đổi trạng thái task. Sau khi feedback đã được xử lý, task cần review lại; sau `APPROVED`, người phụ trách dùng `task-completion-recording` để ghi `Hoàn thành` và push metadata vào chính PR trước merge theo [vòng đời task canonical](../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical). Skill này không được dùng để đóng task hoặc xử lý bookkeeping hậu-merge.
