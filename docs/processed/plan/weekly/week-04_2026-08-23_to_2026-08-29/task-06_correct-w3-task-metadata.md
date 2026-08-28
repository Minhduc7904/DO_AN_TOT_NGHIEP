# Task tuần: Sửa metadata hậu-merge W3-T1

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_correct-w3-task-metadata` |
| Tuần | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Bách |
| Collaborator | Đức (bận; Bách tự review theo ngoại lệ workflow đã được chấp thuận) |
| Ưu tiên | Trung bình |
| Hạn dự kiến | 28/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-06-correct-w3-task-metadata` |

## Yêu cầu và phạm vi

### Cần thực hiện

Sửa metadata còn thiếu hoặc stale của W3-T1 sau khi PR #4 đã merge: đồng bộ `task-input.md`, `task-output.md`, card task và weekly overview với bằng chứng review/finalization đã có; đồng thời tạo một PR correction riêng để đưa thay đổi vào `main`.

### Không thực hiện

- Không thay đổi scope, RQ, kiến trúc, topology hoặc artifact nghiên cứu của W3-T1.
- Không thêm merge SHA, merge timestamp hoặc trạng thái mutable của PR vào Markdown.
- Không sửa task hoặc metadata không liên quan đến correction W3-T1.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: W3-T1 trên `main`, PR #4 và quy tắc Git/pull request canonical.
- Người hoặc phần việc cần phối hợp: Bách tự review theo ngoại lệ workflow đã được chấp thuận khi Đức bận.
- Rủi ro/giả định: correction phải tách thành task/PR riêng vì PR #4 đã merge; không dùng branch W3-T1 để tạo bookkeeping hậu-merge.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Metadata W3-T1 nhất quán | Docs | `workspace/duc/.../task-input.md`, `workspace/duc/.../task-output.md`, card W3-T1 và weekly overview W3 |
| Hồ sơ correction W4-T6 | Docs | Card task này và `workspace/bach/week-04_2026-08-23_to_2026-08-29/task-06_correct-w3-task-metadata/` |

## Definition of Done

- [ ] Input W3-T1 ghi đúng trạng thái hoàn thành, PR thực tế và toàn bộ DoD có bằng chứng.
- [ ] Output và card W3-T1 không còn wording stale “sẵn sàng merge” hoặc “bước tiếp theo: merge”.
- [ ] Weekly overview W3 và metadata W3-T1 liên quan nhất quán với nhau.
- [ ] Đã tự review diff, chạy `git diff --check` và chỉ thay đổi metadata W3-T1 cùng hồ sơ/carding của correction task.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước khi review theo ngoại lệ.
- [ ] Sau verdict `APPROVED`, completion metadata của W4-T6 được commit/push vào chính PR trước merge.

## Liên kết hồ sơ thực hiện

- Input workspace: [`workspace/bach/week-04_2026-08-23_to_2026-08-29/task-06_correct-w3-task-metadata/input/task-input.md`](../../../../../workspace/bach/week-04_2026-08-23_to_2026-08-29/task-06_correct-w3-task-metadata/input/task-input.md).
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 28/08/2026 — tạo correction task và input; bắt đầu audit metadata W3-T1.
- Ghi chú/tồn đọng: PR #4 đã merge nên correction phải đi qua branch/PR riêng.
