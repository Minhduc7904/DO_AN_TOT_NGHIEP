# Báo cáo chọn cấu hình phát hiện trên validation v1

> **Task:** `task-06_select-detectors-on-validation` (tuần 16).
>
> **Trạng thái:** chọn và freeze xong ngày 25/11/2026. Mọi số trong báo cáo là **số để chọn trên validation, không phải kết luận**: validation chỉ có 4 fault run (một mỗi case) và 2 run khỏe; kết luận của E1 lấy ở test (evaluation-protocol-v1 mục 6.1.2, 6.3).
>
> **Tài liệu liên quan:** [evaluation-protocol-v1](evaluation-protocol-v1.md) mục 6.1.1 (bảng F), 6.1.2, 6.1.3, 6.2, 17.2–17.8, 20.6; tập ứng viên [`detection-candidates-v1.json`](../../../aiops-platform/training/configs/detection-candidates-v1.json), [`detection-candidates-v2.json`](../../../aiops-platform/training/configs/detection-candidates-v2.json); [dataset-v0](dataset-v0.md); [fault-pilot-report-v1](fault-pilot-report-v1.md).
>
> **Bảng sinh tự động:** [`evaluations/validation-v1/tables.md`](../../../aiops-platform/training/evaluations/validation-v1/tables.md) (lệnh `uv run aiops-training select-detectors report`). Các bảng dưới chép từ đó.

## 0. Đọc nhanh

| Phần | Kết quả |
| --- | --- |
| Window/persistence (bước 1, robust z) | **30 s, persistence 4** (`late_tolerance` 75 s), ngưỡng z = 5. 11/12 tổ hợp đạt ≤ 1 báo động giả/giờ, cả 11 khớp 4/4 fault run; 4 tổ hợp 0 báo động giả, chọn tổ hợp có `late_tolerance` nhỏ nhất |
| Tham số incident (bước 2a) | **merge gap 300 s, `max_chain_gap` 120 s** (recovery 3, tương quan 300 s). Cả 4 ứng viên như nhau (4/4, 0 báo động giả), chọn theo `tie_rank` |
| Ngưỡng tĩnh | **`loose`**. Cả 3 bộ như nhau (4/4, 0 báo động giả), chọn theo `tie_rank` |
| Isolation Forest | **q 99,5% (0,780)**: 4/4, 1 báo động giả (0,28/giờ). q 99,9% (0,842) không báo giả nhưng chỉ khớp 2/4. Điểm của từng service có trần riêng, còn ngưỡng phân vị gộp mọi service: ở 0,780, `course` (trần 0,746) và `scheduler` (0,500) không bao giờ vượt được (mục 5, 9) |
| Điểm hợp nhất | **Trọng số bằng nhau, q 99,9% (1,769)**: 4/4, 0 báo động giả. q 99% (cả hai bộ trọng số) vượt giới hạn: 1,41/giờ |
| Config đã freeze | [`detector-e1-v1.json`](../../../aiops-platform/training/configs/detector-e1-v1.json) (`detector-e1.v1`), [`incident-e1-v1.json`](../../../aiops-platform/training/configs/incident-e1-v1.json) (`incident-e1.v1`), evaluation config `detection-evaluation.v1` giữ nguyên |
| E1 sơ bộ | Cả 4 detector khớp 4/4 fault run. Chỉ Isolation Forest có 1 báo động giả (run khỏe `normal-mixed`). Delay giống nhau ở C3 (737 s) và C4 (117 s); robust z và fused sớm hơn 15 s ở C2, C6 |
| Error analysis | 1 FP, 0 FN trên 4 tổ hợp E1. FP do model Isolation Forest của `scheduler-worker` cho điểm bão hòa với lệch rất nhỏ. Delay C3 do job AI đến muộn (lời gọi provider đầu tiên ở khoảng giây 470 của fault) |

Đọc kết quả cùng giới hạn ở mục 8: recall chỉ có 5 mức, báo động giả đo trên 3,54 giờ, nhiều hòa được quyết định bằng thứ tự khai báo trước chứ không bằng số đo.

## 1. Thực thi và chống rò rỉ

- **Commit.** Nhánh `feat/week-16/task-06-select-detectors-on-validation` tách từ `main` tại `c6738ae`, chứa merge commit `f57c322` của PR #103 (khai báo `detection-candidates.v2`). Code chọn được commit (`175e1cf`) và push **trước** lần chấm đầu. Lệnh `select-detectors` từ chối chấm khi:
  - HEAD không chứa `f57c322`;
  - code training (`src`, `configs`, `pyproject.toml`, `uv.lock`) có thay đổi chưa commit, hoặc khác nội dung đã ghi ở `setup` (tree sha);
  - tổ hợp đã có trong ledger (không chấm lại).
- **Ledger chấm validation:** [`evaluations/validation-v1/ledger.jsonl`](../../../aiops-platform/training/evaluations/validation-v1/ledger.jsonl), mỗi sự kiện một dòng, chỉ ghi thêm. Gồm 1 `setup`, 1 `fit_model`, 1 `train_thresholds`, 27 cặp `score_started`/`score`, 1 `reuse`, 5 `select`, 1 `freeze`; không có `score_failed`. Lần chấm đầu lúc 08:19:33 UTC ngày 25/11/2026 (`w30-p3-z3`), sau khi PR #103 merge.
  - Ledger nằm ở `evaluations/`, không ở `configs/` như card dự kiến: harness coi thay đổi chưa commit trong `configs/` là code bẩn và từ chối chấm, nên ghi ledger vào đó sẽ chặn chính lần chấm kế tiếp.
  - Kết quả mỗi bước được commit trước khi chạy bước sau: bước 1 `4b2c3dd`, bước 2a `d5f4c35`, bước 2b `d20ca1e`, freeze `8f5c8fe`.
- **27 lần chấm**, đúng số khai báo ở v2 (12 + 3 + 3 + 3 + 6; tổ hợp `merge120-chain120` của bước 2a dùng lại artifact `w30-p4-z5` của bước 1). Không đổi tập ứng viên sau khi xem kết quả.
- **`candidate_binding`:** config detector/incident của mỗi tổ hợp sinh tất định từ ứng viên (`evaluations/validation-v1/configs/`). Trước khi chọn, sha256 của chúng được đối chiếu với `detector_config_sha256`, `incident_config_sha256` (và model, ngưỡng, window, persistence) trong artifact.
- **`setup`** kiểm 10 run (4 train, 6 validation) đã apply đúng baseline `dataset-v0-w30.json` (`08ddaefb…`) và `dataset-v0-w60.json` (`9d8ffe38…`), chạy `check-leakage` cho cả hai cửa sổ: không lỗi. Mọi bước so lại sha256 của tập ứng viên v1, v2, evaluation config, dataset manifest, hai baseline với dòng `setup`.
- **Không chạm test:** chỉ chấm split `validation` của dataset-v0; harness chặn split test khi không có `--final-test`.
- **Ngưỡng phân vị** của Isolation Forest và fused tính trên 4 run train khỏe, trước khi chấm bước 2b, bằng baseline và model của cửa sổ 30 s (mục 4).

## 2. Bước 1: window/persistence bằng robust z

Tham số incident của bước 1: persistence theo tổ hợp, recovery `W / 15 + 1`, merge gap 120 s, `max_chain_gap` 120 s, tương quan 300 s. Luật: báo động giả ≤ 1/giờ; nhiều fault run khớp nhất; ít báo động giả hơn; `late_tolerance` nhỏ hơn; ngưỡng lớn hơn.

| Hạng | Tổ hợp | W (s) | P | z | late_tolerance (s) | Fault khớp | Báo động giả | Giờ | BĐG/giờ | Đạt ≤ 1/giờ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `w30-p4-z5` **(chọn)** | 30 | 4 | 5 | 75 | 4/4 | 0 | 3,54 | 0 | có |
| 2 | `w60-p5-z5` | 60 | 5 | 5 | 120 | 4/4 | 0 | 3,49 | 0 | có |
| 3 | `w60-p6-z5` | 60 | 6 | 5 | 135 | 4/4 | 0 | 3,47 | 0 | có |
| 4 | `w60-p6-z4` | 60 | 6 | 4 | 135 | 4/4 | 0 | 3,47 | 0 | có |
| 5 | `w30-p3-z5` | 30 | 3 | 5 | 60 | 4/4 | 1 | 3,56 | 0,28 | có |
| 6 | `w30-p4-z4` | 30 | 4 | 4 | 75 | 4/4 | 1 | 3,54 | 0,28 | có |
| 7 | `w60-p5-z4` | 60 | 5 | 4 | 120 | 4/4 | 1 | 3,49 | 0,29 | có |
| 8 | `w60-p6-z3` | 60 | 6 | 3 | 135 | 4/4 | 1 | 3,47 | 0,29 | có |
| 9 | `w30-p3-z4` | 30 | 3 | 4 | 60 | 4/4 | 2 | 3,56 | 0,56 | có |
| 10 | `w30-p4-z3` | 30 | 4 | 3 | 75 | 4/4 | 2 | 3,54 | 0,56 | có |
| 11 | `w60-p5-z3` | 60 | 5 | 3 | 120 | 4/4 | 3 | 3,49 | 0,86 | có |
| 12 | `w30-p3-z3` | 30 | 3 | 3 | 60 | 4/4 | 4 | 3,56 | 1,12 | không |

- Mọi tổ hợp khớp 4/4, nên recall không phân biệt được tổ hợp nào. Lựa chọn do báo động giả quyết định (0–4 incident trên 3,5 giờ), rồi do `late_tolerance`.
- Báo động giả giảm khi z hoặc persistence tăng, đúng chiều kỳ vọng. Tổ hợp z = 3 ít persistence nhất vượt giới hạn.
- Thời gian đo báo động giả khác nhau theo cửa sổ (3,47–3,56 giờ) vì khoảng loại trừ `[fault_start, fault_end + late_tolerance]` dài theo `late_tolerance`.

## 3. Bước 2a: tham số incident

Robust z với `w30-p4-z5`; luật như bước 1 nhưng hòa cuối theo `tie_rank` của v2.

| Hạng | Tổ hợp | Fault khớp | Báo động giả | BĐG/giờ | tie_rank |
| --- | --- | --- | --- | --- | --- |
| 1 | `merge300-chain120` **(chọn)** | 4/4 | 0 | 0 | 1 |
| 2 | `merge300-chain300` | 4/4 | 0 | 0 | 2 |
| 3 | `merge120-chain120` (dùng lại bước 1) | 4/4 | 0 | 0 | 3 |
| 4 | `merge120-chain300` | 4/4 | 0 | 0 | 4 |

Bốn ứng viên cho cùng số đếm, nên lựa chọn hoàn toàn do thứ tự đã khai báo trước. Validation không phân biệt được tham số incident; đây là giới hạn ghi ở mục 8.

## 4. Ngưỡng phân vị trên train

Cửa sổ 30 s; mỗi loại điểm 7.436 giá trị (cửa sổ, service) sau khi bỏ warm-up, cửa sổ im lặng, `flagged` rỗng và điểm rỗng; `numpy.quantile` nội suy tuyến tính. Model Isolation Forest fit trên 4 run train khỏe (676 cửa sổ mỗi service, sha256 `7df97006…`, metadata ở [`evaluations/validation-v1/models/`](../../../aiops-platform/training/evaluations/validation-v1/models/)).

| Điểm | q 99% | q 99,5% | q 99,9% |
| --- | --- | --- | --- |
| Isolation Forest | 0,744 | 0,780 | 0,842 |
| Fused, trọng số bằng nhau | 0,772 | 1,375 | 1,769 |
| Fused, 0,4/0,4/0,2 | 0,936 | 1,650 | 2,123 |

## 5. Bước 2b: ngưỡng của ba detector còn lại

Window 30 s, persistence 4, tham số incident của bước 2a; hòa cuối theo `tie_rank`.

| Detector | Hạng | Tổ hợp | Ngưỡng | Fault khớp | Báo động giả | BĐG/giờ | Đạt | tie_rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ngưỡng tĩnh | 1 | `static-loose` **(chọn)** | bộ loose | 4/4 | 0 | 0 | có | 1 |
| | 2 | `static-medium` | bộ medium | 4/4 | 0 | 0 | có | 2 |
| | 3 | `static-strict` | bộ strict | 4/4 | 0 | 0 | có | 3 |
| Isolation Forest | 1 | `iforest-q0.995` **(chọn)** | 0,780 | 4/4 | 1 | 0,28 | có | 2 |
| | 2 | `iforest-q0.99` | 0,744 | 4/4 | 1 | 0,28 | có | 3 |
| | 3 | `iforest-q0.999` | 0,842 | 2/4 | 0 | 0 | có | 1 |
| Điểm hợp nhất | 1 | `fused-equal-q0.999` **(chọn)** | 1,769 | 4/4 | 0 | 0 | có | 1 |
| | 2 | `fused-w442-q0.999` | 2,123 | 4/4 | 0 | 0 | có | 2 |
| | 3 | `fused-equal-q0.995` | 1,375 | 4/4 | 1 | 0,28 | có | 3 |
| | 4 | `fused-w442-q0.995` | 1,650 | 4/4 | 1 | 0,28 | có | 4 |
| | 5 | `fused-equal-q0.99` | 0,772 | 3/4 | 5 | 1,41 | không | 5 |
| | 6 | `fused-w442-q0.99` | 0,936 | 3/4 | 5 | 1,41 | không | 6 |

- **Ngưỡng tĩnh hòa hoàn toàn.** Phần công bố của v2 dự đoán chỉ bộ `strict` (0,5 s) bắt được C4, vì ở pilot độ lớn triệu chứng chỉ khoảng 0,3–0,6 s (C4) và 0,29 s (C2). Trên validation, p95 của cửa sổ 30 s cao hơn nhiều:
  - C2: `course.latency_p95` và `gateway → course` khoảng 2,32 s.
  - C4: `gateway → media` và `media.latency_p95` khoảng 2,35 s.
  - C3: `ai-worker.downstream_latency_p95` 10 s.
  - C6: `gateway → identity` lỗi 100%.

  Cả ba bộ đều vượt ngưỡng (`loose` 2 s vượt với biên khoảng 0,3 s), nên chọn `loose` theo thứ tự khai báo. Validation không cho biết bộ nào tốt hơn. Ở test, C2 và C4 chỉ cần p95 dưới 2 s là bộ `loose` bỏ lỡ.
- **Isolation Forest: trần điểm theo service.** Mỗi service một model, và điểm của mỗi model bão hòa ở một mức trần riêng. Điểm lớn nhất quan sát trên 4 run train và 6 run validation:

  | Service | `scheduler` | `course` | `gateway` | `notification` | `identity` | `media` | `ai-worker` | `scheduler-worker` | `notification-worker` | `ai` | `media-worker` |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Điểm lớn nhất | 0,500 | 0,746 | 0,788 | 0,811 | 0,826 | 0,834 | 0,838 | 0,842 | 0,847 | 0,849 | 0,855 |

  - Ngưỡng phân vị gộp mọi (cửa sổ, service) theo luật của v2, nên service có trần dưới ngưỡng không bao giờ vượt. Ở C2, `course` đạt trần 0,746 ở 45 cửa sổ trong lúc fault.
  - Ở q 99,9% (0,842): `course`, `gateway` và `ai-worker` đều không vượt được, nên C2 và C3 không có incident nào (2/4).
  - Ở q 99,5% (0,780, đã chọn): C2 vẫn được bắt qua `gateway` (0,788) và `ai-worker`, nhưng `course` và `scheduler` bị bỏ qua hoàn toàn.
  - Đây là giới hạn của luật đã khai báo, không đổi sau khi xem kết quả (mục 9).
- **Điểm hợp nhất:** ngưỡng q 99% có 5 báo động giả và mất C6. Ở run C6, một incident báo giả lúc 21:55:40 (56 s trước `fault_start`) nuốt đợt của fault qua cửa sổ tương quan, thành FP + FN. Đây là rủi ro đã ghi ở v2.

## 6. Config đã freeze

| Config | Nội dung |
| --- | --- |
| `detector-e1.v1` | Cửa sổ 30 s, persistence 4. Ngưỡng tĩnh `loose`: tỉ lệ lỗi 10%; latency p95 (service, downstream, cạnh) 2 s; message sẵn sàng 200; chờ ack 100; consumer < 1. Robust z 5. Isolation Forest 0,7800 (q 99,5%; 200 cây, `max_samples` 256, seed 20260819). Fused trọng số bằng nhau, 1,7691 (q 99,9%) |
| `incident-e1.v1` | Persistence 4, recovery 3, merge gap 300 s, `max_chain_gap` 120 s, tương quan 300 s |
| `detection-evaluation.v1` | Giữ nguyên (đã khai báo ở task-04) |

Lineage trong cả hai file: sha256 của tập ứng viên v1, v2, evaluation config, dataset manifest, baseline 30 s, model Isolation Forest (và 4 run fit), file ngưỡng train, 5 file lựa chọn, ledger lúc freeze, commit code. Mỗi detector ghi tổ hợp được chọn, sha256 artifact, config detector/incident của tổ hợp.

Số E1 dưới đây tính từ artifact của tổ hợp được chọn (config sinh từ ứng viên, cùng tham số). Ở test, detector chạy bằng config đã freeze; file config khác nên `detector_config_sha256` khác, nhưng tham số giống hệt.

## 7. E1 sơ bộ trên validation

Không báo bootstrap CI: mỗi tầng (case, profile) chỉ có một run nên CI suy biến (mục 6.1.2, 20.7). Báo động giả đo trên 3,54 giờ: 2 run khỏe (0,72 giờ mỗi run sau warm-up) cộng phần không có fault của 4 fault run.

| Chỉ số | Ngưỡng tĩnh | Robust z | Isolation Forest | Điểm hợp nhất |
| --- | --- | --- | --- | --- |
| Tổ hợp | `static-loose` | `merge300-chain120` (z 5) | `iforest-q0.995` | `fused-equal-q0.999` |
| Fault run khớp | 4/4 | 4/4 | 4/4 | 4/4 |
| TP / FP / FN (gộp 6 run) | 4 / 0 / 0 | 4 / 0 / 0 | 4 / 1 / 0 | 4 / 0 / 0 |
| Precision / Recall / F1 | 1 / 1 / 1 | 1 / 1 / 1 | 0,80 / 1 / 0,89 | 1 / 1 / 1 |
| Báo động giả / giờ | 0 / 3,54 → 0 | 0 / 3,54 → 0 | 1 / 3,54 → 0,28 | 0 / 3,54 → 0 |
| Run khỏe `normal-mixed`: FP / giờ; FPR | 0 / 0,72; 0/1 | 0 / 0,72; 0/1 | 1 / 0,72; 1/1 | 0 / 0,72; 0/1 |
| Run khỏe `healthy-spike`: FP / giờ; FPR | 0 / 0,72; 0/1 | 0 / 0,72; 0/1 | 0 / 0,72; 0/1 | 0 / 0,72; 0/1 |
| Đoạn cao điểm 600 s (`healthy-spike`) | 0 / 0,167 giờ | 0 / 0,167 giờ | 0 / 0,167 giờ | 0 / 0,167 giờ |
| Delay C2, trùng cao điểm (s) | 76 | 61 | 76 | 61 |
| Delay C3 (s) | 737 | 737 | 737 | 737 |
| Delay C4 (s) | 117 | 117 | 117 | 117 |
| Delay C6 (s) | 78 | 63 | 78 | 63 |
| Incident trong khoảng đánh giá | 4 | 4 | 5 | 4 |

- Mẫu số: 6 run eligible (4 fault, 2 khỏe), không run nào bị loại; đoạn cao điểm tính được ở run `healthy-spike` (kế hoạch phát lại khớp sha256).
- Bốn detector gần như không phân biệt được trên validation. Khác biệt duy nhất: 1 báo động giả của Isolation Forest, và robust z/fused sớm hơn 15 s (một bước) ở C2 và C6.
- Mỗi fault run có đúng một incident, gom các service liên quan:
  - C2: `course`, `gateway`, `ai-worker`.
  - C4: `gateway`, `media`, `media-worker`.
  - C6: `gateway`, `identity` im lặng.
  - C3: `ai-worker`.
- Trace của run `healthy-spike` là mẫu 52,5% (bảng F, hệ quả (a)): báo động giả 0 của detector dùng trace (fused) đo trên mẫu.

## 8. Error analysis ban đầu

### 8.1. FP: Isolation Forest, run khỏe `normal-mixed` (09:53:40 UTC)

| Trường | Giá trị |
| --- | --- |
| Service, khóa bằng chứng | `scheduler-worker`, `edge.duration_p95@scheduler-worker\|scheduler-postgres` (cùng `service.downstream_latency_p95`) |
| Cửa sổ | Các cửa sổ vượt rải từ 09:47:30 tới 10:03:45 (giờ kết thúc cửa sổ). Chuỗi đủ 4 cửa sổ liên tiếp kết thúc ở 09:52:45–09:53:30; `detected_at` = 09:53:30 + 10 s |
| Điểm | 0,842 ở mọi cửa sổ vượt (ngưỡng 0,780) |
| Độ lệch thật | Latency tới `scheduler-postgres` 5–8 ms. z lớn nhất của tín hiệu chỉ 0,01–0,28 |
| Giả thuyết | **Nhiễu do model, không phải triệu chứng.** Ở train, điểm của `scheduler-worker` gần như rời rạc: phần lớn cửa sổ 0,424, một số 0,577–0,747, và mức 0,842 xuất hiện 3 lần (2 ở `healthy-spike` s1003, 1 ở `normal-mixed` s1001). Model Isolation Forest cô lập tổ hợp "có lời gọi DB với z hơi dương" vì vector của service này gần như hằng trên train. Ngưỡng phân vị q 99,5% (0,780) nằm dưới mức bão hòa đó, nên mỗi khi worker chạy job DB vài phút liền thì đủ persistence. Bằng chứng z > 0 (luật khóa của Isolation Forest) quá rộng ở đây; rủi ro này đã ghi ở v2 |

### 8.2. FN

Không có FN ở 4 tổ hợp E1. Các ứng viên không được chọn có FN:

- `iforest-q0.999` bỏ lỡ C2 và C3 vì trần điểm theo service (mục 5).
- `fused-*-q0.99` bỏ lỡ C6 vì incident báo giả trước fault nuốt đợt của fault (mục 5).

### 8.3. Delay C3 737 s: job AI đến muộn

- Fault C3 kéo dài 900 s (19:51:08–20:06:08 UTC). Trong cửa sổ fault, lời gọi `ai-worker → ai-llm-provider` đầu tiên nằm ở cửa sổ kết thúc ở giây 486. Mỗi lời gọi mất khoảng 10 s và nằm trong hai cửa sổ chồng nhau (486, 501).
- Lời gọi kế tiếp đến sau khoảng 180 s, vượt `max_chain_gap` 120 s, nên chuỗi bắt đầu lại. Đợt job kế tiếp có 4 cửa sổ liên tiếp (kết thúc ở giây 681–726); `detected_at` = 726 + 10 s ≈ 737 s.
- Pilot đo thời điểm job AI đầu tiên sau phút 18 ở 8 run: 14–458 s (fault-pilot-report-v1 mục 5). Run validation này có job đầu tiên ở khoảng giây 470 sau `fault_start`, gần biên của pilot.
- Ứng viên `max_chain_gap` 300 s sẽ nối được chuỗi, nhưng chỉ sớm hơn khoảng 30 s (giây 696 + 10). Luật chọn không xét delay nên không đổi lựa chọn.
- Đây là giới hạn của workload, không phải của detector: cả 4 detector có cùng delay.

### 8.4. Giả thuyết theo nhóm nguyên nhân

| Nhóm | Quan sát trên validation |
| --- | --- |
| Nhiễu | 1 FP (mục 8.1), do model chứ không do dao động tải |
| Cao điểm | Đoạn cao điểm 600 s của `healthy-spike` không có báo động giả nào ở 4 detector. C2 trùng cao điểm phát hiện sau 61–76 s |
| Trace mẫu | Không có báo động giả ở run `healthy-spike` (trace mẫu 52,5%); chưa thấy tác động |
| Cạnh thưa | C3: lời gọi provider thưa làm delay dài (mục 8.3) |
| Runtime im lặng | C6: `identity` im lặng nằm trong incident nhưng incident mở trước bằng lỗi ở `gateway` (`gateway → identity` 100% lỗi, hoặc `log_error_rate`/latency ở gateway) |

## 9. Giới hạn

- **Validation nhỏ.** 4 fault run, 2 run khỏe. Recall chỉ có 5 mức, và trên validation mọi tổ hợp được chọn đều 4/4. Báo động giả 0–1 trên 3,54 giờ không phân biệt được 0 với 0,28/giờ có ý nghĩa thống kê.
- **Nhiều lựa chọn do thứ tự khai báo.** Bước 2a (cả 4 bộ tham số incident) và ngưỡng tĩnh (cả 3 bộ) hòa hoàn toàn. Lựa chọn khi đó là `tie_rank` đã khai báo trước (merge 300 s, chain 120 s; bộ `loose`), không phải bằng chứng.
- **Ngưỡng tĩnh `loose` có biên hẹp.** Triệu chứng C2/C4 trên validation chỉ vượt ngưỡng 2 s khoảng 0,3 s.
- **Isolation Forest với ngưỡng gộp mọi service.** Ở ngưỡng đã freeze (0,780), `course` và `scheduler` không thể vượt (trần 0,746 và 0,500), nên trên test Isolation Forest chỉ bắt được fault ở các service này qua service khác bị ảnh hưởng. Ngưỡng theo từng service (phân vị riêng hoặc chuẩn hóa điểm theo trần) cần phiên bản ứng viên mới và chọn lại; ghi để cân nhắc, không đổi ở E1.
- **Ngân sách chọn không đều.** Robust z qua 12 tổ hợp; tham số incident cũng chọn bằng robust z; fused 6; ngưỡng tĩnh và Isolation Forest mỗi detector 3. So sánh E1 vì vậy hơi nghiêng về robust z và fused (v2 `known_risks`).
- **Tương quan incident chỉ theo thời gian** cho tới khi có đồ thị phụ thuộc v2 (tuần 17). Khi thay phải tăng `incident_config_version` và chạy lại bước 2a theo cùng luật.
- **Delay C3 phụ thuộc lúc job AI đến** (mục 8.3), nên delay của C3 trên test sẽ dao động theo seed workload nhiều hơn theo detector.

## 10. Tái lập

```bash
cd aiops-platform/training
R=<thư mục runs/ có 10 run dataset v0>; L=<thư mục load/ có data/plans>
uv run aiops-training select-detectors report                       # sinh lại mọi bảng từ file đã commit
uv run aiops-training select-detectors all --runs-dir $R --load-dir $L \
  --out-dir <thư mục mới> --work-dir <thư mục mới>                     # chấm lại toàn bộ vào ledger riêng
```

Lượt tái lập ngày 25/11/2026 (mục 11) chạy `all` trên commit `8f5c8fe` (code giống `bbc3d0d`) vào thư mục riêng.

## 11. Kết quả tái lập

Ngày 25/11/2026 chạy `select-detectors all` vào ledger và thư mục riêng (scratch, không commit): 309 s, RSS lớn nhất 369 MB. So với lượt chính:

- 27/27 evaluation artifact giống hệt, sau khi bỏ `generated_at`, `evaluation_artifact_id` và lineage (đường dẫn, commit).
- Model Isolation Forest fit lại có cùng sha256 (`7df97006…`), nên ngưỡng phân vị trên train giống hệt.
- Năm lựa chọn và hai config đã freeze (phần `detectors`, `incident`) giống hệt. `tables.md` giống hệt, trừ phần ledger (thời điểm, commit).

Thời gian của lượt chính: bước 1 46 s, bước 2a 4 s, bước 2b 256 s (gồm fit model và điểm train); RSS lớn nhất 314–366 MB. Mỗi lệnh chạy tuần tự.
