# Tổng quan tuần 16 — Anomaly baselines và incident detection

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-16_2026-11-15_to_2026-11-21` |
| Nguồn plan canonical | [Plan v0.4 — Tuần 16](../../plan-v0.4-24-weeks.md#tuần-16--anomaly-baselines-và-incident-detection) |
| Mục tiêu tuần | Detector ngưỡng tĩnh, robust z-score và Isolation Forest fit trên run train khỏe của dataset v0; điểm hợp nhất metric/trace/log có fallback khi thiếu modality; feature cửa sổ 30 s cho tập ứng viên; incident lifecycle có `detected_at` và `estimated_start_time`; evaluation harness cho Precision/Recall/F1, healthy-run FPR, báo động giả/giờ và Detection Delay; khai báo tập ứng viên còn mở trước validation; chọn cấu hình trên validation, E1 sơ bộ và error analysis ban đầu |
| Trạng thái tuần | Đang thực hiện — bảng task lập ngày 25/11/2026; Gate R điều kiện 5 vẫn mở (ngoại lệ ở dưới) |

> Tuần canonical là 15/11/2026–21/11/2026. Kế hoạch được lập ngày 25/11/2026 để bù tiến độ; hạn task bên dưới là mốc bù tiến độ. Theo quyết định của Bách (19/11/2026), phạm vi MVP làm đầy đủ, không áp dụng phương án nén lịch của plan v0.4 mục 9 chỉ vì trễ lịch.

> **Ngoại lệ Gate R kéo dài sang tuần 16 (25/11/2026).** Gate R điều kiện 5 (Bách tự dựng stack theo README và giải thích W1–W7) chưa có bằng chứng trên `main`; Bách sẽ tự làm sau và yêu cầu tiếp tục tuần 16. Lý do và rủi ro giống ngoại lệ tuần 13–15: điều kiện 5 kiểm chứng hiểu biết của người thực hiện, không thay đổi testbed. Gate R không bị cắt.

> Nhánh `chore/week-16/task-01-trim-project-scope` (PR #73) và `docs/week-16/task-02-fix-doc-code-drift` (PR #74) là việc dọn repo làm theo tuần lịch trước khi có bảng này, không thuộc các task dưới đây.

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_build-anomaly-detectors](task-01_build-anomaly-detectors.md) | Detector ngưỡng tĩnh, robust z-score, Isolation Forest fit trên train khỏe; điểm hợp nhất M/T/L có fallback khi thiếu modality; `telemetry_silent` | Bách | Không có | Cao | Chờ review |
| [task-02_add-30s-window-features](task-02_add-30s-window-features.md) | Feature và baseline cửa sổ 30 s cho tập ứng viên, tách khỏi cửa sổ 60 s về version, thư mục và kiểm leakage | Bách | Không có | Cao | Đã giao |
| [task-03_build-incident-lifecycle](task-03_build-incident-lifecycle.md) | Incident lifecycle (persistence, recovery, merge, gộp nhiều service), `detected_at`, `estimated_start_time`, incident record | Bách | Không có | Cao | Chờ review |
| [task-04_build-detection-evaluation-harness](task-04_build-detection-evaluation-harness.md) | Evaluation harness: ghép incident với fault, Precision/Recall/F1, healthy-run FPR, báo động giả/giờ (kể cả đoạn cao điểm), Detection Delay, bootstrap CI, hàm của luật chọn | Bách | Không có | Cao | Đã giao |
| [task-05_declare-detection-candidates-v2](task-05_declare-detection-candidates-v2.md) | Khai báo trước mọi lần chấm validation phần còn mở của phát hiện: quy tắc gộp điểm, tham số incident, Isolation Forest, điểm hợp nhất, ngưỡng tĩnh E1 | Bách | Không có | Cao | Đã giao |
| [task-06_select-detectors-on-validation](task-06_select-detectors-on-validation.md) | Chọn window/persistence và ngưỡng trên validation theo luật đã khai báo, freeze config; E1 sơ bộ trên validation; error analysis ban đầu | Bách | Không có | Cao | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc:
  - Task-01 và task-02 dùng feature pipeline v1 và baseline healthy của tuần 15 (task-05), dataset v0 (task-04 tuần 15) và `detection-candidates.v1` ([evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1.2). Hai task làm song song.
  - Task-01 fit Isolation Forest cho cửa sổ 30 s sau khi task-02 có feature 30 s; phần 60 s không phải chờ.
  - Task-03 nhận điểm/cờ bất thường của bất kỳ detector nào ở task-01, để E1 chỉ đổi detector (mục 17.8).
  - Task-04 làm song song task-01: kiểm bằng incident và ground truth dựng tay, rồi chạy trên incident của task-03.
  - Task-05 viết khi interface của task-01, task-03 và task-04 đã rõ (interface của task-03 chốt trước hạn của task-03). Nó phải nằm trên `main` **trước mọi lần chấm validation**, kể cả bước chọn window/persistence bằng robust z.
  - Task-06 cần task-01 đến task-05.
- Rủi ro:
  - **Validation nhỏ:** 4 fault run (một mỗi case, C2 là slot trùng cao điểm) và 2 run khỏe. Recall chỉ có 5 mức (0/4 tới 4/4). Thời gian đo báo động giả gồm 2 × 42 phút sau warm-up của hai run khỏe cộng phần không có fault của 4 fault run. Mỗi tầng (case, profile) chỉ có một run nên bootstrap CI trên validation suy biến; validation chỉ dùng để chọn, kết luận lấy ở test (mục 6.1.2, 6.3).
  - **Trace mẫu ở run validation `healthy-spike`:** trace là mẫu đều 52,5% (dataset-v0 mục 6.1). Theo bảng F hệ quả (a) của mục 6.1.1, báo động giả của detector dùng trace trên run này đo trên mẫu và ghi thành giới hạn. Detector không đổi cách chạy theo chất lượng export của run, và đặc trưng trace chỉ là tỉ lệ, không dùng số đếm tuyệt đối (hệ quả (c)).
  - **Feature cửa sổ 30 s chưa có:** số cửa sổ gấp đôi cửa sổ 60 s (đo 60 s: khoảng 62 s và 1,7 GB RAM mỗi run), nên RAM và thời gian phải đo lại; chạy tuần tự.
  - **Train không có fault run:** robust z và Isolation Forest chỉ học trạng thái bình thường.
  - **Vai trò của pilot:** số đo của 13 run pilot được dùng làm lý do cho **khoảng** ứng viên và để kiểm code chạy đúng (mục 6.1); không chọn giá trị cuối trên pilot; pilot không vào final metric.
  - **Cạnh thưa và runtime im lặng:** C3 chỉ có 11–15 lời gọi provider trong cửa sổ fault; C6 có `telemetry_silent`, là tín hiệu riêng của detector, không đi qua robust z (mục 6.1.2).
  - **Đồ thị phụ thuộc v2 làm ở tuần 17:** tương quan incident tuần này chỉ dựa vào khoảng thời gian và danh sách service cố định. Khi thay bằng đồ thị v2 thì phải tăng `incident_config_version` và chạy lại phần chọn tham số incident theo cùng luật đã khai báo ở task-05.
  - **RAM:** mỗi lúc một lệnh nặng; không tính feature khi stack đang chạy run.
- Quyết định đã chốt:
  - Giai đoạn tự bắt kịp: mọi task do Bách phụ trách, không collaborator; review/merge theo ngoại lệ Bách xác nhận (plan v0.4 mục 0.1, dòng "Nhân sự").
  - `detection-candidates.v1` (window, persistence, ngưỡng robust z, luật chọn) đã khai báo ngày 23/11/2026, không đổi. Task-05 khai báo phần còn mở của phát hiện thành v2. Phần RCA (SimpleRCA, BARO, `base-manual-auto`, trọng số RCA) khai báo ở tuần 17–18.
  - Baseline ngưỡng tĩnh là đối chứng phát hiện cho E1 và RQ6 (plan v0.4 tuần 16).
  - Không chạm split test: campaign tuần 19, E1 chính thức đo trên test ở tuần 20.
  - Phạm vi: MVP làm đầy đủ; change-point (Target) và deep model (Stretch) không làm tuần này. Diagnostic E1 trên run mức 1 (mục 17.8) không bắt buộc, không làm tuần này.
  - Tồn đọng mang từ tuần 15:
    - Run mức 1 và mức 2 thuần ở `healthy-spike` cho kết luận độ thực: phần bổ sung **sau khi** task-07 tuần 15 đã `Hoàn thành`, trên nhánh `feat/week-15/task-07-healthy-spike-simple-sources` (cách dùng nhánh bổ sung giống PR #90 của task-03 tuần 14, nhưng PR #90 merge khi task đó còn `Đang thực hiện`). Card task-07 tuần 15 giữ `Hoàn thành` và ghi phần bổ sung cùng PR trong chính PR đó.
    - Export chờ tới `time_end` + 10 s.
    - C2 ở cao điểm `healthy-spike` làm cạn pool `course`.
    - Chạy thử trên Windows (tuần 17–18).
    - Gate R điều kiện 5.

## Thứ tự thực hiện đề xuất

1. Task-01, task-02 và task-04 song song (task-02 là việc nặng RAM, chạy riêng).
2. Task-03 khi detector của task-01 đã ra được điểm theo cửa sổ.
3. Task-05: khai báo, merge vào `main`.
4. Task-06: chọn robust z trên lưới 12 tổ hợp, cố định window/persistence, rồi chọn ngưỡng các detector còn lại; E1 sơ bộ và error analysis.

## Tiêu chí kết thúc tuần

- [ ] Các task ưu tiên cao có trạng thái và bằng chứng được cập nhật.
- [ ] Các task hoàn thành đã liên kết đến PR và bằng chứng DoD.
- [ ] Mọi lần chấm validation chạy trên commit đã có `detection-candidates.v2` và được ghi trong ledger chấm validation.
- [ ] Gate R điều kiện 5 có bằng chứng của Bách (đóng ngoại lệ của tuần 13–16).
- [ ] Tồn đọng và việc chuyển sang tuần 17 đã được ghi rõ.
