---
name: task-completion-recording
description: "Ghi nhận một task tuần đã hoàn thành bằng quy trình hỏi sản phẩm rồi xác nhận từng DoD, sau đó cập nhật bảng task chung và hồ sơ input/output cá nhân. Dùng khi người dùng nói đã hoàn thành task; không dùng để lập hoặc chia task mới."
---

# Ghi nhận task hoàn thành

Đọc trước `AGENTS.md`, skill `graduation-workspace`, `references/workspace-standard.md` và file task chung tương ứng trong `docs/processed/plan/weekly/`.

## Quy trình bắt buộc

Khi người dùng nói đã hoàn thành một task, xác định tuần, mã/tên task và người phụ trách từ card task. Nếu một trong các thông tin này không xác định được, chỉ hỏi phần thiếu; không đoán hoặc sửa card của người khác.

1. **Hỏi sản phẩm trước.** Hỏi người dùng sản phẩm/đường dẫn/link thực tế là gì, nhánh task và URL pull request đã merge là gì, đã bắt đầu và hoàn thành lúc nào, cùng thay đổi phạm vi hoặc tồn đọng nếu có. Yêu cầu người dùng xác nhận PR giữ các mục bắt buộc: Tổng quan, Trước thay đổi, Sau thay đổi, Database và Cần review. Không cập nhật trạng thái hoàn thành ở bước này.
2. **Hỏi DoD sau.** Liệt kê nguyên văn từng DoD chưa có bằng chứng từ card task và yêu cầu người dùng xác nhận từng mục `Đạt` hoặc `Chưa đạt`, kèm bằng chứng/đường dẫn khi phù hợp. Không gộp thành một câu hỏi “đã xong hết chưa?”.
3. **Đánh giá.** Nếu bất kỳ DoD nào chưa đạt, PR chưa merge, hoặc PR không đáp ứng mô tả bắt buộc, giữ card ở `Đang thực hiện` hoặc `Chờ xử lý`, ghi phần còn thiếu và không tạo output hoàn thành. Nếu mọi DoD đạt, PR đã merge và sản phẩm mở được, tiếp tục bước 4.
4. **Ghi hồ sơ.** Kiểm tra trước xem task tương ứng đã có trong `workspace/<owner>/<week>/` chưa. Nếu có, cập nhật hồ sơ đó. Nếu chưa có, tạo task có số kế tiếp chưa dùng trong tuần của đúng người sở hữu, với `input/task-input.md` và `output/task-output.md` từ template.
5. **Cập nhật hai nơi.** Input ghi mục tiêu, phạm vi, phụ thuộc, sản phẩm dự kiến, DoD và nhánh từ card. Nếu tạo sau khi người dùng đã làm xong, ghi rõ ở nội dung rằng đây là **ghi nhận hồi tố**. Output ghi thời gian thực tế, sản phẩm thực tế, URL PR đã merge, từng DoD và bằng chứng người dùng xác nhận. Sau đó đổi card task thành `Hoàn thành`, gắn link input/output/PR và cập nhật hàng trạng thái trong `weekly-overview.md`.

## Ràng buộc

- Không tự tạo bằng chứng, thời điểm hay kết quả DoD. Nếu người dùng không cung cấp đủ, dừng ở trạng thái chưa hoàn thành.
- Không chuyển card sang `Hoàn thành` khi output chưa có link sản phẩm có thể truy cập.
- Không chuyển card sang `Hoàn thành` khi chưa có PR đã merge hoặc PR thiếu một trong năm mục bắt buộc theo rule Git/PR.
- Card task chung và task trong workspace có thể khác số thứ tự; liên kết giữa hai nơi là nguồn đối chiếu bắt buộc.
- Chỉ tạo task mới trong `workspace/duc/` khi Đức yêu cầu, và tương tự cho `workspace/bach/`.
