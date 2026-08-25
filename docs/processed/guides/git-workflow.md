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
- Commit theo lát thay đổi có thể review; dùng thông điệp ngắn, mệnh lệnh và tiếng Anh, ví dụ `docs: define mvp scope` hoặc `feat: add auth service skeleton`.
- Trước khi push, chạy các kiểm tra phù hợp với thay đổi và xem lại `git diff`.

## 3. Tạo pull request

1. Push nhánh lên remote:

   ```bash
   git push -u origin <task-branch>
   ```

2. Tạo một pull request từ nhánh task vào `main`. Dùng [PR template](../../../.github/pull_request_template.md), không xóa các heading bắt buộc.
3. Gắn link PR vào file task chung và `output/task-output.md` khi có.
4. Yêu cầu collaborator hoặc thành viên còn lại review đúng phần đã ghi trong mục **Cần review** của PR.
5. Xử lý comment, cập nhật kiểm tra nếu cần và chỉ merge sau khi PR được chấp thuận theo rule.

## 4. Sau khi merge

- Xác nhận link PR mở được và trạng thái merged.
- Ghi sản phẩm, link PR và bằng chứng DoD trong output task.
- Chỉ sau đó mới cập nhật task chung thành `Hoàn thành`.

## Xử lý ngoại lệ

Nếu không thể dùng PR do sự cố kỹ thuật, không tự bỏ qua quy trình. Ghi rõ trở ngại trong task và xin người dùng quyết định cách xử lý; không đánh dấu task hoàn thành cho đến khi có quyết định và bằng chứng thay thế.
