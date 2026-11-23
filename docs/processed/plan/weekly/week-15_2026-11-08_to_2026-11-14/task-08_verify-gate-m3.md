# Task tuần: Gate M3 — chạy lại từ môi trường sạch và xác nhận ground truth độc lập

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-08_verify-gate-m3` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 30/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-08-verify-gate-m3` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [plan v0.4](../../plan-v0.4-24-weeks.md) tuần 15 (Gate M3: hai thành viên đổi case cho nhau, đều chạy, reset, export telemetry và xác nhận ground truth độc lập) và mục 0.1 dòng "Nhân sự" (giai đoạn tự bắt kịp: Bách chạy lại từ môi trường sạch theo checklist, ghi trung thực là ngoại lệ):

- Checklist Gate M3 viết trước khi chạy, mỗi mục kiểm được: dựng stack từ trạng thái sạch (`down --volumes`, `up --build --wait` + lớp fault) chỉ theo experiment runbook; reset-and-seed; chạy mỗi case C2, C3, C4, C6 một fault run bằng runner; export; quality report; `RunGroundTruth` với `verification_checks`.
- **Xác nhận ground truth độc lập:** với mỗi run, đối chiếu `fault_start`/`fault_end` và thành phần gốc trong `RunGroundTruth` với nhật ký fault và telemetry thô (truy vấn Prometheus/Tempo/Loki trực tiếp, không qua code ground truth), ghi truy vấn và số đo.
- Mọi bước runbook bị thiếu/sai phát hiện khi làm được sửa trong runbook và ghi lại.
- Ghi kết quả Gate M3 và ngoại lệ một người vào overview tuần 15 và plan (nếu cần).

### Không thực hiện

- Không thay thế bằng chạy lại trên stack đang chạy sẵn; không dùng run của task-03/task-04 làm bằng chứng gate.
- Không đóng Gate R điều kiện 5 (Bách tự làm riêng).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 (runner, runbook), task-03 (tham số fault đã chốt); nên sau task-04 để không chen vào lúc thu dataset.
- Người hoặc phần việc cần phối hợp: không có (ngoại lệ một người).
- Rủi ro/giả định: dựng lại từ volume sạch xóa dữ liệu stack hiện có; export artifact của mọi run trước đó phải xong trước khi `down --volumes`. Build lại image tốn RAM; kiểm `free -h` trước.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Checklist Gate M3 và kết quả từng mục | Docs | `docs/processed/plan/weekly/week-15_2026-11-08_to_2026-11-14/` hoặc runbook |
| Bốn fault run từ môi trường sạch, đối chiếu ground truth độc lập | Bằng chứng | Mô tả PR; ledger |

## Definition of Done

- [x] Checklist được commit trước khi chạy; mỗi mục có kết quả đạt/không đạt và bằng chứng.
- [x] Bốn case chạy được từ môi trường sạch chỉ theo runbook; mỗi run có ground truth được đối chiếu độc lập với telemetry thô.
- [x] Ngoại lệ một người của Gate M3 được ghi trung thực trong overview tuần.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 24/11/2026 — Gate M3 (ngoại lệ một người) đạt: checklist commit ở `909a6ce` trước run đầu tiên; 4 fault run C2, C3, C4, C6 chạy ngày 23/11/2026 từ worktree sạch theo runbook, đều `completed`, gate thực thi `pass`, ground truth `valid`, đối chiếu thô bằng `verify-raw-ground-truth.mjs` đạt ở cả 4 run ([checklist](gate-m3-checklist.md) mục Kết quả). Runbook thêm bước đối chiếu độc lập (mục 3).
- Ghi chú/tồn đọng: độc lập ở đây là độc lập về code, không về người (ngoại lệ giai đoạn tự bắt kịp). Kiểm trước/sau của C3 đi qua nhánh dự phòng vì trước fault không có lời gọi LLM (checklist mục 12).
