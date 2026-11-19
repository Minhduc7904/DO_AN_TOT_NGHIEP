# Tổng quan tuần 15 — Experiment runner, pilot và dataset v0

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Nguồn plan canonical | [Plan v0.4 — Tuần 15](../../plan-v0.4-24-weeks.md#tuần-15--experiment-runner-pilot-và-dataset-v0) |
| Mục tiêu tuần | Runner một lệnh (reset-and-seed → workload → fault → ground truth → export → kiểm chất lượng) có ledger theo run; pilot tìm `λ_knee` và chốt mức tải của hai profile; pilot 4 case MVP (C2, C3, C4, C6) tới khi chuỗi nhân quả xảy ra thật, kể cả fault trùng cao điểm; thu tập train healthy và tập validation thành dataset v0 có manifest split theo run; feature pipeline v1 có kiểm tra chống leakage; cập nhật evaluation protocol bằng số đo pilot; kiểm chứng độ thực v2 (đăng ký tiêu chí trước, nhiều seed); Gate M3. |
| Trạng thái tuần | Đang thực hiện — bảng task lập ngày 19/11/2026; Gate R điều kiện 5 vẫn mở (ngoại lệ ở dưới) |

> Tuần canonical là 08/11/2026–14/11/2026. Kế hoạch được lập ngày 19/11/2026 (tuần lịch 17) để bù tiến độ; hạn task bên dưới là mốc bù tiến độ. Theo quyết định của Bách (19/11/2026), phạm vi MVP của tuần làm đầy đủ, không áp dụng phương án nén lịch của plan v0.4 mục 9 chỉ vì trễ lịch.

> **Ngoại lệ Gate R kéo dài sang tuần 15 (19/11/2026).** Gate R điều kiện 5 (Bách tự dựng stack theo README và giải thích W1–W7) chưa có bằng chứng trên `main`; Bách sẽ tự làm sau và yêu cầu tiếp tục tuần 15. Lý do và rủi ro giống ngoại lệ tuần 13 và 14: điều kiện 5 kiểm chứng hiểu biết của người thực hiện, không thay đổi testbed. Gate R không bị cắt.

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_build-experiment-runner](task-01_build-experiment-runner.md) | Experiment runner một lệnh theo run, ledger, run manifest và experiment runbook | Bách | Không có | Cao | Chờ review |
| [task-02_find-load-knee-and-freeze-profiles](task-02_find-load-knee-and-freeze-profiles.md) | Pilot tìm `λ_knee`, chốt mức tải hai profile healthy theo workload-design-v1 mục 8.4 | Bách | Không có | Cao | Đã giao |
| [task-03_pilot-mvp-fault-cases](task-03_pilot-mvp-fault-cases.md) | Pilot 4 case MVP (kể cả fault trùng cao điểm): chuỗi nhân quả, tín hiệu bắt buộc, độ trễ triệu chứng; chốt cường độ và thời lượng fault | Bách | Không có | Cao | Đã giao |
| [task-04_collect-dataset-v0](task-04_collect-dataset-v0.md) | Dataset v0: kế hoạch phiên theo split, tập train healthy, tập validation, kiểm label/ground truth, manifest split theo run | Bách | Không có | Cao | Đã giao |
| [task-05_build-feature-pipeline-v1](task-05_build-feature-pipeline-v1.md) | Feature pipeline v1 trên dữ liệu pilot/dataset v0, có kiểm tra chống leakage | Bách | Không có | Cao | Đã giao |
| [task-06_update-evaluation-protocol-after-pilot](task-06_update-evaluation-protocol-after-pilot.md) | Cập nhật evaluation protocol bằng số đo pilot (không đụng test); chốt E7 | Bách | Không có | Cao | Đã giao |
| [task-07_validate-workload-realism-v2](task-07_validate-workload-realism-v2.md) | Kiểm chứng độ thực v2: đăng ký tiêu chí thời lượng trước, nhiều seed, báo cáo song song v1/v2 | Bách | Không có | Cao | Đã giao |
| [task-08_verify-gate-m3](task-08_verify-gate-m3.md) | Gate M3: chạy lại từng case từ môi trường sạch theo runbook, export và xác nhận ground truth độc lập | Bách | Không có | Cao | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: task-03 và task-04 chạy run qua runner của task-01 và dùng mức tải đã chốt ở task-02; task-04 dùng cường độ/thời lượng fault đã chốt ở task-03; task-05 chạy trên artifact của task-03/task-04; task-06 tổng hợp số đo của task-02, task-03, task-04; task-08 chạy lại theo runbook của task-01 sau khi task-03 xong. Task-07 độc lập (chạy khi máy không có run khác).
- Rủi ro:
  - Một run 48 phút + export telemetry (khoảng 15–20 phút cho trace) + feature: mỗi run gần 1,5 giờ máy; mỗi lúc chỉ một run (máy ~15 GB RAM). Tổng tuần cỡ 25–30 run.
  - Telemetry chỉ giữ 24 giờ: runner phải export ngay sau run; Tempo đã nâng 1 GiB nhưng export dồn dập vẫn có thể OOM.
  - Chuỗi nhân quả có thể không xảy ra dưới tải bán thực (C3 ít job AI trong cửa sổ fault; C4 lộ muộn ở `scheduler-worker`). Theo plan v0.4 mục 8: sửa mô tả case hoặc loại và ghi ledger, không âm thầm bỏ.
  - Run kiểm chứng độ thực dùng TTL token 600 s, run thí nghiệm dùng 60 s (lớp fault): đổi TTL phải tạo lại `identity`, không chạy chồng hai loại run.
  - Grafana ở 83–84% giới hạn bộ nhớ (task-03 tuần 14), sát ngưỡng "khỏe" 85%.
  - **Đổi máy giữa các tập dữ liệu (ghi ngày 19/11/2026).** Bách dự định chuyển sang máy Windows cá nhân (16 GB RAM) về sau. Train/validation thu ở tuần 15 trên máy Linux hiện tại; nếu test (campaign tuần 19–20) thu trên máy khác thì CPU, độ trễ, Docker/WSL2 và độ trễ nền khác nhau, detector học "bình thường" ở máy này có thể báo động nhầm ở máy kia, và kết quả lẫn hiệu ứng đổi máy (evaluation-protocol-v1: các split chỉ được khác nhau ở seed/slot; runner ghi `environment_profile` vào run manifest để kiểm). Quyết định: thu toàn bộ dữ liệu thí nghiệm (train, validation, test) trên cùng một máy; máy Windows dùng cho demo và gói tái lập (M6, tuần 22–23). Nếu bắt buộc chuyển máy trước campaign thì chuyển trước tuần 19 và thu lại train/validation trên máy mới.
  - **Chạy trên Windows chưa kiểm chứng.** Runner hiện đọc RAM trống từ `/proc/meminfo` (chỉ có trên Linux); `run-k6.sh` là bash; k6 dùng `--network host` để upload thẳng lên MinIO; Docker Desktop mặc định cấp WSL2 khoảng 50% RAM (≈ 8 GB) trong khi stack có tải 3,5–5 GB, k6 đỉnh spike ≈ 3 GB và `up --build` mỗi run. Hướng xử lý (để sau): chạy trong WSL2 với Docker Engine trong WSL, `.wslconfig` khoảng `memory=10GB`, `swap=4GB`; runner đo RAM đa nền tảng, build image một lần mỗi commit, giới hạn bộ nhớ cho container LMS; thêm mục Windows vào runbook. Lịch: chạy thử một run ngắn trên Windows khoảng tuần 17–18 (không đưa vào dataset) để phát hiện lỗi sớm.
- Quyết định đã chốt:
  - Giai đoạn tự bắt kịp: mọi task do Bách phụ trách, không collaborator; review/merge theo ngoại lệ Bách xác nhận. Gate M3 viết cho hai người được làm bằng cách chạy lại từ môi trường sạch theo checklist và ghi trung thực là ngoại lệ (plan v0.4 mục 0.1, dòng "Nhân sự").
  - Phạm vi: MVP làm đầy đủ; Target chỉ đưa vào khi triển khai được mà không phình phạm vi; Stretch chưa làm. Target duy nhất của tuần 15 trong plan là chốt người tham gia E7: Bách xác nhận (19/11/2026) không có người tham gia ngoài hai thành viên nhóm, mà người xây testbed không làm người tham gia hợp lệ, nên E7 ra khỏi kế hoạch (task-06 ghi vào protocol và plan). E6 (RCAEval) bắt đầu ở tuần 18 và biến thể case ở campaign tuần 19, nên không nằm trong tuần này. Ba profile healthy đối chứng (workload-design-v1 mục 8.3) chỉ thêm khi pilot cho thấy cần (task-03/task-04 ghi quyết định).
  - Module mới `aiops-platform/experiments/` cho runner, theo blueprint v2 mục 6 ("Experiment: orchestration… chưa có (tuần 15)"); không copy workload/fault vào đây.
  - Seed theo workload-design-v1 mục 11.4: pilot 1–999, train 1000–1999, validation 2000–2999; final test 3000–3999 chưa chạy (campaign tuần 19).

## Thứ tự thực hiện đề xuất

1. Task-07 chạy nền trước (đăng ký tiêu chí v2 rồi chạy 3 seed) trong lúc viết task-01.
2. Task-02 (pilot `λ_knee`) song song với phần code của task-01.
3. Task-03 bằng runner của task-01, mức tải của task-02.
4. Task-04 (thu dataset v0), trong lúc chạy làm task-05 trên artifact pilot.
5. Task-06 tổng hợp số đo; task-08 chạy lại từ môi trường sạch.

## Tiêu chí kết thúc tuần

- [ ] Các task ưu tiên cao có trạng thái và bằng chứng được cập nhật.
- [ ] Các task hoàn thành đã liên kết đến PR và bằng chứng DoD.
- [ ] Gate M3 có bằng chứng (ngoại lệ một người ghi trung thực).
- [ ] Gate R điều kiện 5 có bằng chứng của Bách (đóng ngoại lệ của tuần 13, 14 và 15).
- [ ] Tồn đọng và việc chuyển sang tuần 16 đã được ghi rõ.
