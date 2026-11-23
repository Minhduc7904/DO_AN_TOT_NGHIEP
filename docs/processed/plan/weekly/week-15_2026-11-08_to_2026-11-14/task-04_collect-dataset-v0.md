# Task tuần: Dataset v0 — tập train healthy, tập validation và manifest split theo run

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_collect-dataset-v0` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 28/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-04-collect-dataset-v0` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 5 và 8, [workload-design-v1](../../../architecture/workload-design-v1.md) mục 11.4:

- **Kế hoạch phiên theo split.** Phiên Moodle cho train, validation và test lấy từ các đoạn log khác nhau trong phần xây (ngày 0–59), không trùng hold-out (mục 5.4). Chia ngày của phần xây thành ba nhóm theo luật ghi trước, sinh kế hoạch `normal-mixed` và `healthy-spike` cho từng nhóm; ghi sha256 kế hoạch. Nhóm test chỉ sinh kế hoạch, chưa chạy.
- **Tập train healthy:** mỗi profile (`normal-mixed`, `healthy-spike`, cộng profile đối chứng nếu task-03 quyết định thêm) ít nhất một run, seed 1000–1999.
- **Tập validation** (seed 2000–2999): mỗi case C2, C3, C4, C6 có `repeat_index=1`; ít nhất một run validation trùng cao điểm cho cả campaign (mục 5.3); healthy validation cho `normal-mixed` và `healthy-spike` (mục 5.4). Đề xuất của workload-design-v1 mục 11.4 (fault run các case cùng `repeat_index` dùng cùng seed) được chốt và ghi.
- **Kiểm label và ground truth:** mỗi run có `RunGroundTruth` hợp lệ, `verification_checks` đạt, quality report `pass` hoặc `partial` có lý do; run `fail` được thay bằng `run_id` mới theo mục 8.6 và giữ trong ledger.
- **Dataset manifest v0:** danh sách run theo split (train/validation; slot test khai báo nhưng chưa chạy), seed, kế hoạch phiên, phiên bản dữ liệu seed, đường dẫn artifact và sha256; kiểm tự động không có `run_id`/seed/ngày log trùng giữa các split.

### Không thực hiện

- Không chạy final test và không freeze campaign manifest (tuần 19).
- Không dùng run pilot của task-02/03 trong dataset (mục 6.1).
- Không commit dữ liệu Moodle, artifact telemetry hay kế hoạch phiên (gitignore); repo giữ manifest, script và sha256.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 (runner), task-02 (mức tải), task-03 (tham số fault đã chốt, quyết định profile đối chứng); công cụ phiên Moodle (task-01 tuần 14).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: tối thiểu khoảng 8 run healthy + 4 fault run, gần 1,5 giờ máy mỗi run; artifact mỗi run vài trăm MB, cần kiểm dung lượng đĩa. Chia ngày phần xây thành ba nhóm làm mỗi nhóm ít ngày hơn; nếu một nhóm không đủ ngày cho luật chọn ngày của profile thì ghi luật thay thế trước khi sinh kế hoạch.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Script chia ngày theo split và sinh kế hoạch phiên | Code | `aiops-platform/load/tools/` |
| Dataset manifest v0 và kiểm tra trùng giữa split | Code | `aiops-platform/experiments/` |
| Mô tả dataset v0 (run, split, seed, quality, giới hạn) | Docs | `docs/processed/architecture/dataset-v0.md` |

## Definition of Done

- [ ] Kế hoạch phiên của train, validation, test lấy từ nhóm ngày tách rời, không trùng hold-out; sha256 ghi trong manifest.
- [ ] Mỗi profile có ít nhất một run train; mỗi case có run validation `repeat_index=1`; có healthy validation cho hai profile bắt buộc; có ít nhất một run validation trùng cao điểm.
- [ ] Mọi run trong manifest có `RunGroundTruth` hợp lệ và quality `pass`/`partial`; run bị thay có dòng ledger và `replacement_for_run_id`.
- [ ] Kiểm tự động xác nhận không trùng `run_id`, seed, ngày log giữa các split.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 20/11/2026 — xong phần không cần chạy stack (làm song song với pilot của task-03): luật chia ngày `day-split-v1`, kế hoạch phiên cho ba split, dataset manifest v0 với 28 slot, công cụ `check-dataset.mjs` có test, spec của 6 run healthy; bản nháp [dataset-v0](../../../architecture/dataset-v0.md).
- Ghi chú/tồn đọng:
  - Chờ task-03: fault manifest v2, slot validation trùng cao điểm, quyết định profile đối chứng; sau đó viết spec 4 fault run validation.
  - Kế hoạch validation `normal-mixed` có đỉnh 2,43 phiên/s, vượt 0,35 × `λ_knee` (1,96). Giữ kế hoạch; run healthy validation phải đạt tiêu chí mục 8.4, nếu trượt thì hạ `k` (dataset-v0 mục 2).
  - Còn chạy 10 run (khoảng 13 giờ máy) sau khi task-03 xong.
