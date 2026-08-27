# Quy trình dùng Git và pull request

> Quy trình này hướng dẫn cách thực hiện. Các điều kiện bắt buộc nằm tại [quy tắc Git và pull request](../rules/git-and-pull-request-rules.md).

## 1. Bắt đầu một task

1. Mở file task trong `docs/processed/plan/weekly/week-.../` để lấy đúng tên nhánh đã được giao.
2. Đồng bộ nhánh `main` trước khi tạo nhánh:

   ```bash
   git switch main
   git pull --ff-only origin main
   ```

3. Tạo và chuyển sang nhánh của task:

   ```bash
   git switch -c <task-branch>
   ```

4. Cập nhật card task thành `Đang thực hiện` nếu người phụ trách đã bắt đầu.

## 2. Trong khi làm

- Chỉ đưa thay đổi phục vụ task vào nhánh; nếu phát sinh việc độc lập, tạo task và nhánh mới.
- Commit theo lát thay đổi có thể review. Dùng [mẫu commit message](../../../.github/commit-message-template.md): ưu tiên tóm tắt tiếng Việt, ví dụ `docs: chốt phạm vi MVP`; dùng tiếng Anh khi thuật ngữ kỹ thuật, tên riêng hoặc ngữ cảnh rõ hơn. Khi cần mô tả thêm, dùng phần `Tổng quan:` với 1–3 gạch đầu dòng ngắn.
- Trước khi push, chạy các kiểm tra phù hợp với thay đổi và xem lại `git diff`.

## 3. Tạo pull request

1. Push nhánh lên remote:

   ```bash
   git push -u origin <task-branch>
   ```

2. Tạo một pull request từ nhánh task vào `main`. Dùng [PR template](../../../.github/pull_request_template.md), không xóa các heading bắt buộc.
3. Gắn link PR vào file task chung và `output/task-output.md` khi có.
4. Khi người phụ trách báo đã xong và đã xác nhận từng DoD, ghi output/card task với link PR và chuyển task sang `Chờ review`.
5. Yêu cầu collaborator hoặc thành viên còn lại review đúng phần đã ghi trong mục **Cần review** của PR.
6. Nếu review yêu cầu thay đổi, người phụ trách dùng `pr-review-response` để xử lý, kiểm chứng, push và reply thread; sau đó gửi review lại. Review đạt chưa được chuyển task sang `Hoàn thành`.

## 4. Sau review: merge rồi ghi nhận hoàn thành

- `APPROVED` là verdict review, không phải trạng thái task `Hoàn thành`. PR chỉ được merge sau verdict này và khi người dùng yêu cầu rõ.
- Sau khi PR đã merge vào `main`, người phụ trách dùng `task-completion-recording` để ghi reviewer/verdict, sản phẩm, link PR, merge reference và bằng chứng DoD trong output/card/weekly overview, rồi chuyển task sang `Hoàn thành`.

## Xử lý ngoại lệ

Nếu không thể dùng PR do sự cố kỹ thuật, không tự bỏ qua quy trình. Ghi rõ trở ngại trong task và xin người dùng quyết định cách xử lý; không đánh dấu task hoàn thành cho đến khi có quyết định và bằng chứng thay thế.
