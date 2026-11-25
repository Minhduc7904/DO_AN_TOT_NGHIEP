# Task tuần: Feature và baseline cửa sổ 30 s cho tập ứng viên

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_add-30s-window-features` |
| Tuần | `week-16_2026-11-15_to_2026-11-21` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 28/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-16/task-02-add-30s-window-features` |

## Yêu cầu và phạm vi

### Cần thực hiện

`detection-candidates.v1` ([evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1.2) có cửa sổ 30 s và 60 s, nhưng feature pipeline v1 chỉ sinh cửa sổ 60 s (`FeatureConfig.window_s`, hằng `FEATURE_VERSION = "feature.v1"`, thư mục cố định `telemetry/features`). Task này thêm cửa sổ 30 s mà không làm thay đổi kết quả 60 s đã dùng:

- Tham số độ dài cửa sổ cho lệnh `features`; mặc định giữ 60 s.
- `window_s` ghi trong feature manifest và trong baseline. `apply-baseline` và `check-leakage` từ chối khi `window_s` của feature và baseline lệch nhau (hiện chỉ so version, nên áp baseline 60 s lên feature 30 s sẽ không bị phát hiện).
- **Dữ liệu cũ:** không ghi đè `baselines/dataset-v0.json` và manifest feature 60 s đã có, vì đổi file làm đổi sha256 trong lineage. Với manifest cũ, `window_s` đọc từ `config.window_s`. Với baseline cũ thiếu trường, `window_s` suy ra từ manifest của các run train trong `fit_inputs` và được đánh dấu là legacy.
- Thư mục output riêng cho cửa sổ 30 s (ví dụ `telemetry/features-w30/`). `fit-baseline`, `apply-baseline` và `check-leakage` có tham số chọn thư mục, để feature 30 s không ghi đè feature 60 s.
- Tính feature 30 s cho 10 run train/validation của dataset v0, chạy tuần tự; fit `baselines/dataset-v0-w30.json` chỉ trên run train khỏe; áp cho 10 run; `check-leakage` đạt.
- Đo thời gian và RAM của pipeline 30 s trên một run 48 phút.
- Cập nhật data dictionary và README `training/`.

### Không thực hiện

- Không tính lại feature 60 s và không fit lại `baselines/dataset-v0.json`.
- Không đổi định nghĩa feature, bước 15 s hay luật lọc nhiễu.
- Không làm detector (task-01).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: feature pipeline v1, `baselines/dataset-v0.json`, artifact telemetry của 10 run dataset v0 (task-04, task-05 tuần 15).
- Người hoặc phần việc cần phối hợp: task-06 dùng feature/baseline 30 s.
- Rủi ro/giả định:
  - Số cửa sổ gấp đôi, nên RAM có thể vượt 1,7 GB của bản 60 s (data dictionary ghi cần khoảng 2 GB trống). Kiểm `free -h` trước mỗi run, không chạy khi stack đang chạy run.
  - `features-manifest.json` có `generated_at`, nên không so sha256 manifest để chứng minh kết quả 60 s không đổi.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Tham số cửa sổ, `window_s` trong manifest/baseline, thư mục riêng, kiểm lệch cửa sổ, test | Code | `aiops-platform/training/src/aiops_training/features/`, `cli.py`, `tests/` |
| Baseline cửa sổ 30 s | Config | `aiops-platform/training/baselines/dataset-v0-w30.json` |
| Cột/quy tắc cửa sổ 30 s, số đo thời gian và RAM | Docs | `telemetry-data-dictionary-v2.md`; README `training/` |

## Definition of Done

- [ ] Test hồi quy: bảng 60 s sinh bằng code mới bằng bảng sinh bằng code cũ trên cùng một run (`pyarrow.Table.equals`).
- [ ] `check-leakage --baseline baselines/dataset-v0.json` vẫn đạt trên feature 60 s đã có (sha256 manifest khớp `fit_inputs`).
- [ ] Áp baseline 60 s lên feature 30 s (và ngược lại) bị từ chối (test); đường đọc baseline cũ thiếu `window_s` có test.
- [ ] Feature và baseline 30 s cho 10 run; `check-leakage` 30 s không lỗi; baseline 30 s chỉ fit trên run train khỏe.
- [ ] Có số đo thời gian và RAM của pipeline 30 s trên một run; `uv run pytest` và `ruff` đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng:
