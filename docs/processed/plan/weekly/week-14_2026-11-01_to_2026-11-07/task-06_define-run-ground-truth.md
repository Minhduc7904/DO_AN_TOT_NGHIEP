# Task tuần: `RunGroundTruth` tối thiểu, validation và đường lan của 4 case

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_define-run-ground-truth` |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 22/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-14/task-06-define-run-ground-truth` |

## Yêu cầu và phạm vi

### Cần thực hiện

- `RunGroundTruth` tối thiểu trong `aiops-platform/training/` theo [telemetry-and-ground-truth-schema-v1](../../../architecture/telemetry-and-ground-truth-schema-v1.md) mục 8: dựng từ `workload-manifest.json` (task-03) và nhật ký bật/tắt fault (task-05); ghi JSON có `ground_truth_schema_version`.
- Validation: đối chiếu khoảng fault với telemetry đã export (tuần 13) — triệu chứng chính của case xuất hiện trong cửa sổ fault và không có trước đó; kết quả ghi vào `run_status`/ghi chú theo mục 8.3.
- Triệu chứng và đường lan dự kiến cho C2, C3, C4, C6 (thành phần gốc, service bị ảnh hưởng, cạnh, metric/log/trace kỳ vọng) — bổ sung tài liệu ground truth, không mâu thuẫn mục 10.

### Không thực hiện

- Không làm campaign manifest, split train/validation/test (tuần 15).
- Không làm RCA.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-05 (nhật ký fault); task-03 (manifest workload); export telemetry và data-quality (PR #77, #81).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: Collector giữ giá trị cuối ~5 phút khi runtime dừng (C6) — validation dùng tốc độ tăng của counter, không dùng sự có mặt của mẫu.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Model và CLI `RunGroundTruth`, validation | Code | `aiops-platform/training/` |
| Triệu chứng và đường lan 4 case | Docs | `docs/processed/architecture/` (bổ sung tài liệu ground truth) |
| Ground truth và kết quả validation của run thử có fault | Bằng chứng | Mô tả PR |

## Definition of Done

- [ ] Schema ground truth ổn định, có test (thiếu trường bắt buộc bị từ chối).
- [ ] Validation chạy trên ít nhất một run thử có fault cho mỗi case và báo đạt/không đạt kèm lý do.
- [ ] Tài liệu đường lan 4 case khớp manifest (task-05) và mục 10 của schema.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#86](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/86).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp; CI GitHub bị khóa thanh toán, kiểm tra chạy cục bộ, kết quả trong PR). Có một vòng review bằng agent ngoài GitHub; các phát hiện đã sửa trong PR. PR #86 được Bách (người phụ trách) merge ngày 18/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 18/11/2026 — đã merge PR #86; ghi nhận hậu kiểm, chuyển Hoàn thành.
- Ghi chú/tồn đọng: Không có.
