# Quy trình dùng Git và pull request

> Quy trình này hướng dẫn cách thực hiện. Các điều kiện bắt buộc nằm tại [quy tắc Git và pull request](../rules/git-and-pull-request-rules.md).

> Commit/push được nêu trong guide là điều kiện để transition hợp lệ trên remote, không tự cấp quyền cho agent chạy Git write. Chỉ thực hiện lệnh khi yêu cầu hiện tại của người dùng cho phép; nếu chưa cho phép, chuẩn bị thay đổi và báo rõ bước còn thiếu.

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
3. Gắn URL/số PR vào file task chung, `output/task-output.md` và `weekly-overview.md` khi có; chuyển task sang `Chờ review`.
4. Commit/push URL PR và trạng thái `Chờ review` vào chính branch/PR. Đây là điều kiện bắt buộc trước review; nếu user chưa cho phép Git write, không request/bắt đầu review và báo rõ transition vẫn chỉ ở local.
5. Chỉ sau khi kiểm tra PR head ở remote đã chứa `Chờ review`, yêu cầu collaborator hoặc thành viên còn lại review đúng phần đã ghi trong mục **Cần review** của PR.
6. Nếu review yêu cầu thay đổi, người phụ trách dùng `pr-review-response` để xử lý, kiểm chứng, push và reply thread; sau đó gửi review lại. Review đạt chưa được chuyển task sang `Hoàn thành`.

## 4. Sau review: finalization rồi merge

- `APPROVED` là verdict review, không phải trạng thái task đã canonically `Hoàn thành`. Người phụ trách dùng `task-completion-recording` **trước merge** để ghi reviewer/verdict, sản phẩm, link PR và bằng chứng DoD trong output/card/weekly overview, rồi chuyển task sang `Hoàn thành` trên chính branch/PR.
- Finalization metadata (output, card, weekly overview, trạng thái và tham chiếu PR/review) **phải** được commit/push vào chính branch PR trước merge. Không thay đổi substantive artifact/code trong commit này; nếu cần, quay lại review thông thường. Agent chỉ trực tiếp chạy commit/push khi user đã cho phép; nếu không, báo rõ finalization chưa sẵn sàng merge trên remote.
- Nếu finalization commit không dismiss approval, PR được merge bình thường khi người dùng yêu cầu rõ. Nếu approval bị dismiss, reviewer kiểm tra diff metadata rồi re-approve; sau đó không tạo thêm tracked lifecycle change trước merge nếu không có vấn đề mới.
- Khi PR merge vào `main`, cùng commit đưa substantive work và trạng thái `Hoàn thành` vào nguồn project-wide canonical. Không tạo commit hậu-merge để ghi `Đã merge`, merge SHA, merge timestamp hoặc đóng task.

## Xử lý ngoại lệ

Nếu không thể dùng PR do sự cố kỹ thuật, không tự bỏ qua quy trình. Ghi rõ trở ngại trong task và xin người dùng quyết định cách xử lý; không đánh dấu task hoàn thành cho đến khi có quyết định và bằng chứng thay thế.
