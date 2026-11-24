# Task tuần: Feature pipeline v1 có kiểm tra chống leakage

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_build-feature-pipeline-v1` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 28/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-05-build-feature-pipeline-v1` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 3.3, 5.1, 7.2, 8.5, 9 và [telemetry-data-dictionary-v2](../../../architecture/telemetry-data-dictionary-v2.md):

- Nâng feature pipeline v0 (task-07 tuần 14) lên v1 trên artifact thật của pilot và dataset v0: sửa những gì v0 làm sai hoặc thiếu khi gặp run 48 phút có fault (series mới giữa cửa sổ, `telemetry_silent`, thiếu modality, cạnh async, ánh xạ identity → service đã biết lệch ở mục 8.5).
- Bước chuẩn hóa/baseline **chỉ fit trên run train**, lưu tham số đã fit thành artifact có phiên bản; validation/test chỉ áp tham số đó (mục 9.1).
- **Kiểm tra chống leakage tự động:** không có cửa sổ của cùng `run_id` ở hai split; bước fit chỉ đọc run có split `train` trong dataset manifest; không trường nào của ground truth (`fault_start`, case, root cause) đi vào bảng feature (mục 3.3); độ trễ thu thập theo modality được áp khi đóng cửa sổ, không dùng dữ liệu tương lai (mục 7.2).
- Version hóa `feature_config_version` và `noise_filter_version`, áp như nhau cho mọi run.
- Đo thời gian và RAM của pipeline trên một run 48 phút.

### Không thực hiện

- Không làm detector, incident detection hay RCA (tuần 16–18).
- Không chọn tham số bằng run validation/test.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: feature pipeline v0 (PR #87); artifact của task-03/task-04; dataset manifest v0 (task-04) cho kiểm tra split.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: bắt đầu trên artifact pilot trước khi dataset v0 xong; kiểm tra leakage hoàn tất khi đã có dataset manifest.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Feature pipeline v1, bước fit theo split, kiểm tra leakage | Code | `aiops-platform/training/` |
| Mô tả cột và quy tắc v1 | Docs | `telemetry-data-dictionary-v2.md` hoặc phiên bản mới; README `training/` |

## Definition of Done

- [x] Pipeline v1 chạy trên mọi run của dataset v0, ghi `feature_config_version` và tham số đã fit chỉ từ run train.
- [x] Kiểm tra leakage tự động chạy trên dataset manifest v0 và đạt; có test cố ý vi phạm (cùng `run_id` hai split, fit đọc run validation, cột ground truth trong feature) để chứng minh kiểm tra bắt được. (Thêm: kiểm thời điểm cắt cửa sổ và metadata của baseline, data dictionary mục 9.4.)
- [x] Unit test trên dữ liệu biết trước đáp án cho phần mới; thời gian/RAM trên một run 48 phút được ghi.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 24/11/2026 — chạy trên 10 run train/validation của dataset v0 ([telemetry-data-dictionary-v2](../../../architecture/telemetry-data-dictionary-v2.md) mục 9.6):
  - `features` thoát 0 ở cả 10 run (`feature.v1`, `noise.v1`).
  - `fit-baseline` đọc đúng 4 run train healthy. Baseline `aiops-platform/training/baselines/dataset-v0.json` được commit, có sha256 của dataset manifest.
  - `apply-baseline` chạy cho cả 10 run. `check-leakage` trên dataset manifest v0 không báo vi phạm nào.
  - Đo trên run 48 phút khi máy rảnh: 60,5–62,9 s, RSS đỉnh 1.787–1.883 MB. Các số của lần chạy này đã được thay bằng lần chạy lại ở cập nhật dưới.
- Cập nhật 24/11/2026 sau review độc lập ([telemetry-data-dictionary-v2](../../../architecture/telemetry-data-dictionary-v2.md) mục 9, 9.4, 9.6, 10):
  - `fit-baseline` chỉ đọc slot train có `case` rỗng (healthy, mục 9.1); `check-leakage` bắt baseline fit trên run train có fault.
  - `check-leakage` không tin metadata tự khai của baseline: đối chiếu khóa `fit_inputs_sha256` với `fit_runs`, sha256 manifest feature hiện có của từng run fit, sha256 của dataset manifest; đối chiếu `run_id` của manifest feature và manifest export.
  - Độ trễ thu thập được áp khi đóng cửa sổ: export ghi `query_started_at` trước truy vấn đầu tiên; pipeline chỉ giữ cửa sổ có `window_end` ≤ min(`time_end`, mốc − 10 s). Artifact cũ lấy mốc từ `run-manifest.json` của runner; không có mốc thì từ chối chạy. `check-leakage` kiểm lại mốc và mọi `window_end`.
  - `apply-baseline` ghi `baseline-apply.json` có sha256 của baseline.
  - Chạy lại `features` cho 10 run: cắt 2–3 cửa sổ cuối sau k6 mỗi run (tổng 28), mỗi run còn 191 cửa sổ. Fit lại baseline, apply cho 10 run; `check-leakage` không báo vi phạm nào.
  - Đo lại khi máy rảnh: `features` 61,0–62,3 s, RSS đỉnh 1.700–1.732 MB trên hai run đo chính thức; `fit-baseline` 3,4 s, RSS 146 MB. Output `/usr/bin/time` nằm trong PR.
- Ghi chú/tồn đọng:
  - Export của runner vẫn bắt đầu trước `time_end` nên mất 2–3 cửa sổ cuối mỗi run; có thể cho export chờ tới `time_end` + 10 s (mục 10 của data dictionary).
  - Artifact feature nằm trong thư mục run (không commit), sinh lại được bằng lệnh ở README `training/`.
  - Nhánh đã gộp task-04 để có dataset manifest có `run_id`.
