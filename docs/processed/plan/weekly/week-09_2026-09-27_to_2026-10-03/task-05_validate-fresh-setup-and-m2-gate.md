# Task tuần: Xác minh fresh setup và Gate M2

## Thông tin chung

| Trường          | Nội dung                                                |
| --------------- | ------------------------------------------------------- |
| Mã task         | `task-05_validate-fresh-setup-and-m2-gate`              |
| Tuần            | `week-09_2026-09-27_to_2026-10-03`                      |
| Trạng thái      | Chờ review                                          |
| Người phụ trách | Đức                                                    |
| Collaborator    | Không có; Đức tiếp quản theo chỉ thị trực tiếp                |
| Ưu tiên         | Trung bình                                              |
| Hạn dự kiến     | 17/10/2026 — mốc bù tiến độ                             |
| Nhánh thực hiện | `test/week-09/task-05-validate-fresh-setup-and-m2-gate` |

## Yêu cầu và phạm vi

### Cần thực hiện

Từ checkout/môi trường sạch, làm theo tài liệu để dựng Testbed MVP v0.1, chạy reset/seed và regression suite, rồi ghi bằng chứng về topology, hai workflow xuyên service và khả năng vận hành/giải thích. Đối chiếu Gate M2; nếu thiếu người thứ hai, ghi rõ gate chưa đạt thay vì tự xác nhận.

### Không thực hiện

- Không sửa substantive code của các task hardening trước dưới danh nghĩa validation.
- Không dùng cache, volume hoặc cấu hình bí mật từ môi trường phát triển hiện có để làm bằng chứng fresh setup.
- Không đánh dấu Gate M2 đạt khi chỉ có Đức thực hiện.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: W9 task-04 và Quick Start/Compose README hiện hành.
- Người hoặc phần việc cần phối hợp: Đức cùng vận hành hai workflow và cung cấp trạng thái các task hardening; Bách thực hiện fresh setup độc lập.
- Rủi ro/giả định: W9 task-04 đã merge (PR #39) nên task bắt đầu từ 14/10/2026. Gate M2 cần Đức kiểm chứng độc lập trước khi chuyển `Chờ review`; không dùng kiểm chứng một người để thay thế yêu cầu canonical của hai thành viên.

## Sản phẩm kỳ vọng

| Sản phẩm                                      | Loại | Vị trí hoặc link dự kiến                |
| --------------------------------------------- | ---- | --------------------------------------- |
| Báo cáo fresh setup và Gate M2                | Docs | `docs/processed/` hoặc output task      |
| Sửa tài liệu setup phát hiện trong validation | Docs | `README.md`, `docker-compose/README.md` |

## Definition of Done

- [ ] Checkout sạch chỉ dùng dependency/version được tài liệu hóa; Compose dựng đủ sáu business service + Gateway, PostgreSQL, Redis và RabbitMQ healthy.
- [ ] Reset/seed và regression suite chạy pass, có log/thời lượng/commit làm bằng chứng tái lập.
- [ ] Người thực hiện vận hành và giải thích được ít nhất hai workflow xuyên nhiều service, gồm một luồng async.
- [ ] Một người thứ hai chạy hoặc kiểm chứng độc lập và ghi kết quả; nếu chưa có, Gate M2 được ghi `Chờ xử lý`, không ghi đạt.
- [ ] Mọi lỗi tài liệu setup được sửa và kiểm tra lại từ trạng thái sạch; không còn bước thủ công chưa được ghi.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-05_validate-fresh-setup-and-m2-gate/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-05_validate-fresh-setup-and-m2-gate/output/task-output.md).
- Pull request: [#40](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/40).
- Kết quả review: Không có GitHub APPROVED; Đức xác nhận ngoại lệ sau cảnh báo.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 14/10/2026 — hai lượt fresh setup trên máy Bách pass (11 service healthy, reset/seed cùng fingerprint, regression E2E `5/5` và messaging ba vòng); sửa bảy lỗi tài liệu setup và kiểm tra lại từ clone mới.
- Ghi chú/tồn đọng: Gate M2 `Chờ xử lý` đến khi Bách ghi nhận phần giải thích hai workflow và Đức kiểm chứng độc lập trên PR.

## Tiếp quản và đối chiếu hiện hành

Ngày 21/10/2026, Đức chỉ thị tiếp quản task thay Bách và xác nhận ngoại lệ, cho phép commit/push/merge PR #40 sau cảnh báo. Không có GitHub APPROVED; không xác nhận Gate M2 hai thành viên đạt khi thiếu phần giải thích của Bách.

Kiểm chứng Đức đã có tại [comment PR](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/40#issuecomment-6314205006); các ghi chú chờ Đức phía trên là lịch sử 14/10. Output Đức là bảng DoD hiện hành. Gate M2 canonical vẫn `Chờ xử lý` vì thiếu bằng chứng Bách tự giải thích; task đóng theo ngoại lệ, không sửa tiêu chí milestone.
