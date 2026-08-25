# Quy trình ghi nhận task hoàn thành

Đọc `AGENTS.md`, skill `graduation-workspace`, `graduation-workspace/references/workspace-standard.md` và file task chung tương ứng trong `docs/processed/plan/weekly/` trước khi thay đổi.

Trước khi tạo nhánh hoặc PR, đọc `docs/processed/rules/naming-rules.md`, `docs/processed/rules/git-and-pull-request-rules.md` và `docs/processed/guides/git-workflow.md`.

## Quy trình bắt buộc

Khi người dùng nói đã hoàn thành task, xác định tuần, mã/tên task và người phụ trách từ card. Người dùng phải nói rõ họ là **Đức** hay **Bách** trong yêu cầu hiện tại; nếu chưa rõ, hỏi lại trước khi đọc/sửa workspace. Nếu tuần/mã task chưa xác định được, chỉ hỏi phần thiếu; không đoán hoặc sửa card của người khác.

1. **Hỏi sản phẩm trước.** Hỏi sản phẩm/đường dẫn/link thực tế, nhánh task, thời điểm bắt đầu và hoàn thành, thay đổi phạm vi hoặc tồn đọng. Nếu PR đã có, hỏi URL PR; không yêu cầu PR ở bước này.
2. **Hỏi từng DoD.** Liệt kê nguyên văn từng DoD chưa có bằng chứng từ card task. Yêu cầu người dùng xác nhận riêng từng mục `Đạt` hoặc `Chưa đạt`, kèm bằng chứng/đường dẫn khi phù hợp. Không gộp thành một câu hỏi “đã xong hết chưa?”.
3. **Đánh giá sản phẩm và DoD.** Nếu bất kỳ DoD chưa đạt hoặc sản phẩm không mở được, giữ card ở `Đang thực hiện` hoặc `Chờ xử lý` và ghi rõ phần thiếu. Nếu mọi DoD đạt và sản phẩm mở được, tiếp tục bước 4.
4. **Xác nhận hoặc tạo PR.**
   - Nếu đã có PR, kiểm tra PR còn mở, nhánh nguồn khớp card task, target là `main` và mô tả giữ đủ các heading trong template PR canonical.
   - Nếu chưa có PR, hỏi rõ: **“Bạn có muốn mình tạo pull request cho task này không?”** Không tự tạo PR trước khi có đồng ý.
   - Khi người dùng đồng ý, tạo PR từ nhánh task vào `main` theo git workflow. Dùng trực tiếp template PR canonical, điền đầy đủ mọi heading bằng thông tin đã xác nhận và không để mục bắt buộc trống. Kiểm tra URL PR và trạng thái mở trước khi tiếp tục.
   - Nếu người dùng chưa muốn tạo PR hoặc không thể tạo/kiểm tra PR, không chuyển task sang `Chờ review`; giữ trạng thái phù hợp và ghi rõ PR còn thiếu.
5. **Ghi hồ sơ.** Kiểm tra task tương ứng trong `workspace/<owner>/<week>/`. Nếu có, cập nhật hồ sơ đó; nếu chưa có, tạo task có số kế tiếp chưa dùng trong tuần của đúng chủ sở hữu, dùng input/output template canonical. Nếu ghi sau khi đã làm xong, input phải nêu đây là **ghi nhận hồi tố**.
6. **Cập nhật hai nơi.** Output ghi thời gian thực tế, sản phẩm thực tế, URL PR mở, từng DoD và bằng chứng; trạng thái output là `Chờ review`. Đổi card task sang `Chờ review`, gắn link input/output/PR và cập nhật hàng tương ứng trong `weekly-overview.md`. Không chuyển sang `Hoàn thành` trong skill này.

## Ràng buộc

- Không tự tạo bằng chứng, thời điểm hoặc kết quả DoD. Nếu người dùng không cung cấp đủ, không ghi nhận hoàn thành.
- Chỉ skill review được chuyển card sang `Hoàn thành` sau review đạt.
- Không chuyển sang `Chờ review` khi output chưa có link sản phẩm/PR truy cập được hoặc PR thiếu heading bắt buộc của template canonical.
- Card task chung và task workspace có thể khác số thứ tự; liên kết giữa hai nơi là nguồn đối chiếu bắt buộc.
- Chỉ tạo task trong `workspace/duc/` khi Đức yêu cầu rõ, và tương tự với `workspace/bach/`.
