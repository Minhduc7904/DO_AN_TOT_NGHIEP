# Quy trình dùng Git và pull request

> Guide này chỉ hướng dẫn thao tác. Mọi điều kiện bắt buộc (vòng đời task, approval, finalization, quyền merge, quyền Git write, ngoại lệ vận hành dùng chung và ngoại lệ theo chỉ thị người phụ trách) nằm tại [quy tắc Git và pull request](../rules/git-and-pull-request-rules.md). Chỉ chạy lệnh Git write khi yêu cầu hiện tại của người dùng cho phép.

## Thay đổi vận hành dùng chung

Thay đổi thuộc [ngoại lệ vận hành dùng chung](../rules/git-and-pull-request-rules.md#ngoại-lệ-cho-thay-đổi-vận-hành-dùng-chung) có thể commit/push trực tiếp lên `main` khi người dùng yêu cầu rõ Git write. Trước khi commit, xác minh diff không chứa code/artifact/lifecycle của task cụ thể, đồng bộ `main` bằng fast-forward và chạy kiểm tra phù hợp; diff bị trộn thì tách phần task sang đúng branch/PR.

## 1. Bắt đầu một task

1. Mở file task trong `docs/processed/plan/weekly/week-.../` để lấy đúng tên nhánh đã được giao.
2. Đồng bộ `main` rồi tạo nhánh của task:

   ```bash
   git switch main
   git pull --ff-only origin main
   git switch -c <task-branch>
   ```

3. Cập nhật card task thành `Đang thực hiện` nếu người phụ trách đã bắt đầu.

## 2. Trong khi làm

- Chỉ đưa thay đổi phục vụ task vào nhánh; việc độc lập phát sinh thì tạo task và nhánh mới.
- Commit theo lát thay đổi có thể review, dùng [mẫu commit message](../../../.github/commit-message-template.md) (ví dụ `docs: chốt phạm vi MVP`).
- Trước khi push, chạy các kiểm tra phù hợp và xem lại `git diff`.

## 3. Tạo pull request và chờ review

1. Push nhánh: `git push -u origin <task-branch>`.
2. Tạo PR từ nhánh task vào `main` bằng [PR template](../../../.github/pull_request_template.md), không xóa các heading bắt buộc.
3. Ghi URL/số PR vào card task chung, `output/task-output.md` và `weekly-overview.md`, chuyển task sang `Chờ review`, rồi commit/push vào chính branch/PR.
4. Chỉ sau khi PR head ở remote đã chứa `Chờ review`, yêu cầu thành viên còn lại review đúng phần ghi trong mục **Cần review** của PR.

## 4. Sau review

1. Có `CHANGES_REQUESTED`: người phụ trách dùng `pr-review-response`, push và reply từng thread; reviewer kiểm tra phần đã sửa rồi gửi `APPROVED`.
2. Xác minh `APPROVED` còn hiệu lực trên GitHub, rồi dùng `task-completion-recording` để finalization và commit/push metadata vào chính branch/PR.
3. Người phụ trách merge PR sau finalization. Khi merge, `main` nhận cùng lúc substantive work và trạng thái `Hoàn thành`; không tạo commit hậu-merge để ghi `Đã merge`, merge SHA hay merge timestamp.
