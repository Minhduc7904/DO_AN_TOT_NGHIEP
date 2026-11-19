# Task tuần: Experiment runner một lệnh và ledger theo run

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_build-experiment-runner` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 22/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-01-build-experiment-runner` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [plan v0.4 tuần 15](../../plan-v0.4-24-weeks.md#tuần-15--experiment-runner-pilot-và-dataset-v0), [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 5.5, 7, 8, 21 và [telemetry-and-ground-truth-schema-v1](../../../architecture/telemetry-and-ground-truth-schema-v1.md) mục 8:

- Module `aiops-platform/experiments/`: một lệnh chạy trọn một run từ một **run spec** có phiên bản (profile, kế hoạch phiên, `workload_seed`, case hoặc healthy, lịch fault, split, `repeat_index`), ghép các công cụ đã có, không copy logic:
  1. kiểm tiền điều kiện: stack đủ container healthy, biến môi trường (TTL token theo loại run), RAM trống, không có run khác đang chạy;
  2. reset-and-seed dữ liệu (`lms/scripts/reset-and-seed.mjs`), ghi fingerprint phiên bản seed;
  3. chạy profile k6 (`aiops-platform/load/run-k6.sh profile`) và, với fault run, `fault-schedule.mjs run` song song, luôn gỡ fault khi bị ngắt;
  4. export telemetry ngay sau run (`aiops-training export`), kiểm chất lượng (`quality`), ghi `RunGroundTruth` (`ground-truth`), tính feature (`features`);
  5. ghi **run manifest** (commit, diff hash, phiên bản config, seed, sha256 kế hoạch phiên và artifact, thời điểm UTC, `replacement_for_run_id` nếu có).
- **Ledger** append-only (một dòng mỗi run, kể cả run lỗi/hủy): `run_id`, split, case, `repeat_index`, seed, trạng thái thực thi và kết quả execution/data-quality gate (`pass | partial | fail`, mục 8), đường dẫn artifact. Không xóa hay sửa dòng cũ; rerun là `run_id` mới (mục 8.6).
- `run_id` không bao giờ dùng lại; runner từ chối seed nằm ngoài khoảng của split (workload-design-v1 mục 11.4).
- **Experiment runbook**: cách dựng stack, chạy một run healthy và một fault run, đọc ledger, xử lý run lỗi; đủ để task-08 chạy lại từ môi trường sạch.
- Unit test cho phần không cần stack (đọc/kiểm run spec, cấp `run_id`, quy tắc seed, ghi ledger, thứ tự bước và dọn fault khi một bước lỗi).

### Không thực hiện

- Không tạo campaign manifest/freeze final test (tuần 19); không chạy run dataset (task-04).
- Không đổi workload, fault, export hay feature; lỗi tìm thấy trong các module đó sửa ở PR riêng hoặc ghi lại.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: profile k6 (task-02/03 tuần 14), fault manifest và `fault-schedule.mjs` (task-05 tuần 14), `RunGroundTruth` (task-06 tuần 14), export/quality (tuần 13), feature pipeline v0 (task-07 tuần 14), `reset-and-seed.mjs`.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: reset-and-seed trên stack đang chạy có thể làm telemetry của lần reset lẫn vào cửa sổ đầu; cửa sổ phân tích bắt đầu sau `workload_start` và warm-up nên không bị ảnh hưởng — kiểm trên run thật. Export trace của run 48 phút mất 15–20 phút; runner không chạy run kế tiếp khi export chưa xong.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Runner, run spec mẫu, ledger, run manifest | Code | `aiops-platform/experiments/` |
| Experiment runbook | Docs | `aiops-platform/experiments/README.md` |
| Một run healthy và một fault run thật qua runner | Bằng chứng | Mô tả PR |

## Definition of Done

- [ ] Một lệnh chạy trọn một run healthy và một fault run trên stack đầy đủ: artifact có telemetry, quality report, `RunGroundTruth` (fault run có `fault_start`/`fault_end` từ nhật ký fault), feature, run manifest; ledger có đủ dòng.
- [ ] Run bị ngắt giữa chừng (thử bằng tín hiệu dừng) vẫn gỡ fault, ghi dòng ledger trạng thái lỗi và giữ artifact đã có.
- [ ] Từ một `run_id` truy ra được commit, config, seed, kế hoạch phiên, fault và vị trí artifact.
- [ ] Unit test chạy không cần stack đạt; runbook đủ các bước dựng stack và chạy hai loại run.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 19/11/2026 — lập card.
- Ghi chú/tồn đọng:
