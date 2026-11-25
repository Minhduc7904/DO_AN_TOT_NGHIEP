# Task tuần: Evaluation harness cho phát hiện sự cố

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_build-detection-evaluation-harness` |
| Tuần | `week-16_2026-11-15_to_2026-11-21` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 29/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-16/task-04-build-detection-evaluation-harness` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 3.3, 6.1.2, 7.1, 17, 20.2, 20.6, 20.7, 22 và [analysis-anomaly-rca-blueprint-v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 19.2:

- Module `aiops_training/evaluation/detection/`:
  - **Lọc incident theo evaluation interval** (mục 7.1). Incident ngoài khoảng giữ lại làm diagnostic, không tính vào chỉ số.
  - **Ghép incident với fault** theo mục 17.4: early tolerance 0; `late_tolerance` lấy duy nhất từ `detection-candidates-v1.json` theo cặp window/persistence; incident sớm nhất trong khoảng được ghép (hòa thì theo `incident_id`); các incident còn lại là FP.
  - **Chỉ số:** TP/FP/FN, Precision/Recall/F1 (`null` khi mẫu số bằng 0, mục 17.6); healthy-run FPR và báo động giả/giờ theo profile khỏe (mục 17.7); Detection Delay theo case với count/mean/median (FN không gán delay, mục 17.5, 20.2).
- **Evaluation config có version:**
  - Ghi rõ công thức `late_tolerance` của mục 17.3 vẫn giữ cho ngữ nghĩa persistence bỏ qua cửa sổ null (mục 17.3 yêu cầu định nghĩa khi semantic khác số cửa sổ liên tiếp).
  - Ghi **mẫu số** của báo động giả/giờ. Với luật chọn ở mục 6.1.2: thời gian sau warm-up của run khỏe cộng thời gian không fault của fault run. Đoạn `(fault_end, fault_end + late_tolerance]` có bị trừ hay không phải chốt trước khi chấm validation.
- **Báo động giả trong đoạn cao điểm** của `healthy-spike` (mục 17.8). Đoạn cao điểm định nghĩa từ lịch workload (kế hoạch phiên hoặc manifest workload), không từ telemetry, và ghi trong evaluation config.
- **Hàm của luật chọn** ở mục 6.1.2 (điều kiện ≤ 1 incident/giờ, thứ tự ưu tiên, fallback) để task-06 dùng nguyên.
- **Bootstrap percentile CI 95%** (mục 20.7): lấy mẫu lại theo run; fault run phân tầng theo case, run khỏe phân tầng theo profile; 10.000 lần, seed cố định trong config. Tầng chỉ có một run cho CI suy biến và phải được báo là suy biến, không báo như khoảng tin cậy thật.
- **Không giấu mẫu số:** báo số run bị loại theo lý do (mục 20.6).
- **Evaluation artifact** (phần detection của mục 22): ghi sha256 của config ứng viên, commit code, `generated_at` và lineage tới incident record, ground truth, config.
- Chỉ harness được đọc ground truth (ranh giới mục 3.3).

### Không thực hiện

- Không làm chỉ số RCA (Top-K, MRR) hay thời gian chẩn đoán (tuần 17–18).
- Không chạy trên split test.
- Không chọn ngưỡng hay cấu hình (task-06).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: `RunGroundTruth` (tuần 14–15); dataset manifest v0; schema incident record của task-03 (làm song song, thống nhất interface sớm).
- Người hoặc phần việc cần phối hợp: task-03 (incident record), task-05 (mẫu số và đoạn cao điểm phải xong trước khi khai báo v2), task-06 (dùng harness để chọn).
- Rủi ro/giả định: đoạn cao điểm phải xác định được từ kế hoạch phiên hoặc manifest workload của run.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Lọc interval, ghép incident, chỉ số, hàm luật chọn, bootstrap, evaluation artifact, CLI, test | Code | `aiops-platform/training/src/aiops_training/evaluation/detection/`, `tests/` |
| Evaluation config (công thức `late_tolerance`, mẫu số báo động giả, đoạn cao điểm, seed bootstrap) | Config / Docs | `aiops-platform/training/configs/`; README `training/` |

## Definition of Done

- [x] Unit test với incident và ground truth dựng tay cho mọi nhánh của mục 17.2–17.7: trước fault, trong khoảng, sau `late_tolerance`, incident trùng, FN, mẫu số 0, run khỏe không có incident, incident ngoài evaluation interval.
- [x] Test riêng cho hàm luật chọn (điều kiện, thứ tự ưu tiên, fallback), mẫu số báo động giả và báo động giả trong đoạn cao điểm.
- [x] Bootstrap CI xác định (cùng seed cùng kết quả) và báo suy biến khi tầng chỉ có một run (test).
- [x] Evaluation config có version, ghi đoạn cao điểm và mẫu số, được commit trước khi task-05 khai báo v2.
- [x] Chạy trên incident record của task-03 cho run pilot, ra evaluation artifact đúng schema và đủ lineage.
- [x] `uv run pytest` và `ruff` đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#107](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/107).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp). Đã review bằng agent riêng hai vòng; các phát hiện đã sửa trong PR (xem mô tả PR). CI GitHub đạt trước khi merge. PR #107 được Bách (người phụ trách) merge ngày 25/11/2026 (merge commit `e5289f9`) trước khi finalization; card chuyển `Hoàn thành` bằng PR ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — đã merge PR #107 (`e5289f9`); ghi nhận hậu kiểm, chuyển Hoàn thành. Khi merge, gộp `main` (đã có PR #104–#106) vào nhánh: giữ cả lệnh `fit-iforest`/`detect`/`incidents` và `evaluate-detection` trong `cli.py`, README xếp Detector → Incident → Evaluation harness; 198 test đạt; chấm lại incident robust z của 4 fault run pilot bằng code đã gộp cho cùng kết quả (4/4 khớp, 0 FP). Trước đó cùng ngày — module `evaluation/detection/` và lệnh `evaluate-detection`, `configs/detection-evaluation-v1.json`; chạy trên incident record thật của task-03 cho 4 fault run pilot (C2, C3, C4, C6) và 1 run pilot khỏe với 4 detector (README training, mục harness).
- Ghi chú/tồn đọng:
  - Thêm ngoài card: `tie_rank` cho luật hòa đã khai báo (yêu cầu của `detection-candidates.v2`), chặn chấm split test ở mọi đường vào.
  - Rủi ro cho tuần 19: test chỉ có 1 run khỏe mỗi profile nên CI báo động giả/giờ suy biến (ghi ở config `bootstrap.risk`).
  - Pilot không có run khỏe `healthy-spike`, nên phần đoạn cao điểm mới kiểm bằng test và plan pilot, chưa chạy trên run thật.
