# Task tuần: Chọn cấu hình phát hiện trên validation, E1 sơ bộ và error analysis

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_select-detectors-on-validation` |
| Tuần | `week-16_2026-11-15_to_2026-11-21` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 03/12/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-16/task-06-select-detectors-on-validation` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1.1 (bảng F), 6.1.2, 6.2, 9.2, 17.5–17.8, 20.2, 20.6 và bàn giao tuần 16 của plan v0.4 ("detector benchmark trên validation; incident record; error analysis ban đầu"):

- **Chỉ chấm validation từ commit chứa merge commit của PR task-05 trên `main`** (nhánh tách từ nhánh task-05 chưa merge không đủ). Mọi lần chấm ghi vào một **ledger chấm validation** được commit: thời điểm, commit code, sha256 của config ứng viên v1/v2, tổ hợp, kết quả. Ledger này cũng chứng minh việc chạy lại toàn bộ lưới khi có lỗi cài đặt.
- **Bước 1:** chạy robust z trên lưới 12 tổ hợp của `detection-candidates.v1` với tham số incident đã khai báo cho bước 1, rồi chọn window/persistence đúng thứ tự luật của mục 6.1.2:
  - điều kiện: báo động giả ≤ 1 incident/giờ;
  - trong các tổ hợp đạt: nhiều fault run có incident khớp nhất;
  - hòa thì ít báo động giả hơn;
  - hòa tiếp thì `late_tolerance` nhỏ hơn;
  - cuối cùng là ngưỡng lớn hơn.
  
  Window/persistence được chọn cố định cho mọi detector của E1.
- **Bước 2:** với window/persistence đã cố định, chọn theo luật của `detection-candidates.v2`:
  - bộ tham số incident dùng chung, nếu luật v2 cho chọn (nếu không thì giữ giá trị cố định đã khai báo);
  - ngưỡng tĩnh;
  - ngưỡng và hyperparameter của Isolation Forest;
  - ngưỡng và trọng số của điểm hợp nhất.
- **Freeze config có version:** `detector_config_version`, `incident_config_version`, `evaluation_config_version`. Kèm lineage: sha256 của baseline, model, dataset manifest và config ứng viên.
- **E1 sơ bộ trên validation** cho bốn detector (ngưỡng tĩnh, robust z, Isolation Forest, điểm hợp nhất), cùng feature, window/persistence và incident rule:
  - báo động giả/giờ và healthy-run FPR trên run khỏe `normal-mixed` và `healthy-spike`, tách riêng đoạn cao điểm;
  - Precision/Recall/F1 trên 4 fault run;
  - Detection Delay theo từng case, tách riêng C2 (slot trùng cao điểm, mục 17.8);
  - số incident thô.
  
  Báo số đếm và mẫu số (mục 20.6). Không báo bootstrap CI vì mỗi tầng chỉ có một run (CI suy biến). Ghi rõ đây là số để chọn, không phải kết luận (mục 6.1.2, lưu ý cuối). Báo động giả của detector dùng trace trên run `healthy-spike` đo trên trace mẫu 52,5%, ghi thành giới hạn (bảng F, hệ quả (a)).
- **Error analysis ban đầu:** với từng FP và FN trên validation, ghi service, feature đóng góp, cửa sổ, giả thuyết nguyên nhân (nhiễu, cao điểm, trace mẫu, cạnh thưa, runtime im lặng). Pipeline không đổi theo kết quả validation, trừ lỗi cài đặt; nếu có thì ghi rõ và chạy lại toàn bộ lưới.
- Báo cáo `detection-validation-report-v1.md` và script tái lập toàn bộ bảng bằng một lệnh.

### Không thực hiện

- Không chấm trên split test; không đổi tập ứng viên sau khi xem kết quả (nếu buộc phải đổi thì ra phiên bản mới và ghi thứ tự thời gian).
- Không làm RCA hay đồ thị phụ thuộc (tuần 17).
- Không làm diagnostic E1 trên run mức 1 (không bắt buộc, mục 17.8).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 (detector, model Isolation Forest cho 30 s và 60 s), task-02 (feature/baseline 30 s), task-03 (incident), task-04 (harness, evaluation config), task-05 (v2 đã merge); 6 run validation của dataset v0.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định:
  - Recall chỉ có 5 mức, nên nhiều tổ hợp có thể hòa. Luật hòa đã khai báo quyết định, không chọn theo cảm tính.
  - Không tổ hợp nào đạt giới hạn 1 incident/giờ thì áp dụng luật fallback và ghi là không đạt điều kiện.
  - Tương quan incident đổi sang đồ thị v2 ở tuần 17 thì phải tăng `incident_config_version` và chạy lại phần chọn tham số incident theo cùng luật.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Config đã freeze (detector, incident, evaluation), ledger chấm validation | Config | `aiops-platform/training/configs/` |
| Script chọn và tái lập bảng | Code | `aiops-platform/training/` |
| Báo cáo chọn cấu hình, E1 sơ bộ, error analysis | Docs | `docs/processed/architecture/detection-validation-report-v1.md` |

## Definition of Done

- [x] Ledger chấm validation được commit; lần chấm đầu tiên chạy trên commit chứa merge commit của PR task-05 trên `main` (đối chiếu với timeline PR của task-05).
- [x] Bảng 12 tổ hợp robust z có đủ số fault run khớp, báo động giả/giờ và `late_tolerance`; tổ hợp được chọn đúng thứ tự luật, tái lập bằng một lệnh.
- [x] Tham số incident, ngưỡng và hyperparameter của ba detector còn lại được chọn trong `detection-candidates.v2`.
- [x] Config đã freeze được commit, có version và lineage (sha256 baseline, model, dataset manifest, config ứng viên).
- [x] Báo cáo E1 sơ bộ cho bốn detector: báo động giả/giờ (tách đoạn cao điểm), healthy-run FPR, Precision/Recall/F1, delay theo case (tách C2), số đếm và mẫu số, giới hạn mẫu nhỏ và trace mẫu.
- [x] Error analysis liệt kê từng FP và FN trên validation.
- [x] Không có lần chấm nào trên test; `check-leakage` đạt cho cả 30 s và 60 s.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#110](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/110).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp). Code đã review bằng agent riêng hai vòng trước lần chấm đầu; báo cáo được soát số liệu bằng agent riêng; các phát hiện đã sửa trong PR (xem mô tả PR). CI GitHub đạt trước khi merge. PR #110 được Bách (người phụ trách) merge ngày 25/11/2026 (merge commit `886d394`) trước khi finalization; card chuyển `Hoàn thành` bằng PR ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — đã merge PR #110 (`886d394`); ghi nhận hậu kiểm, chuyển Hoàn thành. Trước đó cùng ngày — chọn và freeze xong ([detection-validation-report-v1](../../../architecture/detection-validation-report-v1.md)):
  - Bằng chứng DoD: ledger [`evaluations/validation-v1/ledger.jsonl`](../../../../../aiops-platform/training/evaluations/validation-v1/ledger.jsonl); lần chấm đầu 08:19:33 UTC trên `175e1cf` (chứa `f57c322` của PR #103); 27 lần chấm, không `score_failed`. Ledger đặt ở `evaluations/` thay cho `configs/` vì harness coi `configs/` chưa commit là code bẩn (báo cáo mục 1).
  - Bước 1 chọn `w30-p4-z5`; bước 2a `merge300-chain120`; bước 2b `static-loose`, `iforest-q0.995`, `fused-equal-q0.999`. Hyperparameter Isolation Forest cố định theo v2 (không tune). Config `configs/detector-e1-v1.json`, `configs/incident-e1-v1.json` có version và lineage.
  - Bảng tái lập bằng `uv run aiops-training select-detectors report`; lượt `all` vào thư mục riêng cho 27/27 artifact, model và config freeze giống hệt.
  - `check-leakage` cửa sổ 30 s và 60 s không lỗi (dòng `setup` của ledger); chỉ chấm split validation.
  - Phát hiện ghi lại: Isolation Forest có trần điểm theo service nên ở ngưỡng 0,780 `course` và `scheduler` không vượt được.
  - Trước đó cùng ngày: bắt đầu trên nhánh tách từ `main` tại `c6738ae`; lập card.
- Ghi chú/tồn đọng:
