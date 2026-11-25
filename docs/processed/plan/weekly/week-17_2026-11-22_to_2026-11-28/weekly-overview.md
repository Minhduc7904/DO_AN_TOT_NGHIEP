# Tổng quan tuần 17 — Dependency graph và RCA baselines

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Nguồn plan canonical | [Plan v0.4 — Tuần 17](../../plan-v0.4-24-weeks.md#tuần-17--dependency-graph-và-rca-baselines) |
| Mục tiêu tuần | Dynamic dependency graph từ trace (cạnh sync, async, xác thực, hạ tầng) kèm graph validation với catalogue v2; RCA harness Top-1/Top-3/MRR có mốc constant/random; baseline nội bộ Max anomaly, Earliest anomaly, Graph-aware simple và baseline ngưỡng tĩnh; `base-manual-auto` có nhật ký thao tác cho E4; SimpleRCA và BARO; khai báo tập ứng viên RCA trước validation; kết quả RCA baseline trên validation |
| Trạng thái tuần | Chưa bắt đầu — bảng task lập ngày 25/11/2026; chưa task nào bắt đầu. Hạn task-06 đến task-08 (02–05/12/2026) chồng lên tuần 18 canonical |

> Tuần canonical là 22/11/2026–28/11/2026. Bảng được lập ngày 25/11/2026, ngay sau khi tuần 16 xong phần task; hạn task bên dưới là mốc bù tiến độ. Theo quyết định của Bách (19/11/2026), phạm vi MVP làm đầy đủ, không áp dụng phương án nén lịch của plan v0.4 mục 9 chỉ vì trễ lịch.

> **Gate R điều kiện 5 vẫn mở (25/11/2026).** Điều kiện 5 (Bách tự dựng stack theo README và giải thích W1–W7) chưa có bằng chứng trên `main`; ngoại lệ của tuần 13–16 vẫn chưa đóng. Điều kiện này kiểm chứng hiểu biết của người thực hiện, không thay đổi testbed hay pipeline phân tích, nên không chặn task tuần 17.

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_build-dynamic-dependency-graph](task-01_build-dynamic-dependency-graph.md) | Dynamic graph theo run/cửa sổ từ trace (sync, async, dependency, auth) cộng cạnh thiết kế (shared-resource, `scheduler → scheduler-worker`), bảng quy về chủ sở hữu, graph artifact có version; graph validation với catalogue v2 | Bách | Không có | Cao | Đã giao |
| [task-02_build-rca-evaluation-harness](task-02_build-rca-evaluation-harness.md) | Đọc và kiểm `RcaIncidentResult`, `service-candidates.v1`, ghép với incident matched; Top-1/Top-3/MRR/Average Rank, coverage, end-to-end; mốc constant/random | Bách | Không có | Cao | Đã giao |
| [task-03_build-internal-rca-baselines](task-03_build-internal-rca-baselines.md) | Max anomaly, Earliest anomaly, Graph-aware simple (chỉ cạnh sync) và baseline ngưỡng tĩnh; xuất `RcaIncidentResult` từ incident và điểm bất thường | Bách | Không có | Cao | Đã giao |
| [task-04_build-base-manual-auto](task-04_build-base-manual-auto.md) | `base-manual-auto` theo ADR-006 mục 3.2 trên artifact đã export, nhật ký thao tác đếm trace/PromQL/LogQL cho E4 | Bách | Không có | Cao | Đã giao |
| [task-05_build-simplerca-baseline](task-05_build-simplerca-baseline.md) | SimpleRCA (Fang et al. 2025) theo protocol mục 15.2.1, ghi chỗ khác bài gốc | Bách | Không có | Cao | Đã giao |
| [task-06_build-baro-baseline](task-06_build-baro-baseline.md) | BARO qua RCAEval (MIT): adapter `metrics.parquet`, kiểm adapter trên một phần RE2 trước khi dùng trên testbed | Bách | Không có | Cao | Đã giao |
| [task-07_declare-rca-candidates-v1](task-07_declare-rca-candidates-v1.md) | Khai báo trước validation: detector nuôi RCA, không gian tham số của các baseline, luật chọn và luật hòa, policy điểm thiếu | Bách | Không có | Cao | Đã giao |
| [task-08_select-rca-baselines-on-validation](task-08_select-rca-baselines-on-validation.md) | Chạy mọi RCA baseline và mốc tham chiếu trên validation theo luật của task-07, freeze `rca_config_version`, báo cáo kết quả và error analysis | Bách | Không có | Cao | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc:
  - Đầu vào từ tuần 16 trên `main`: config đã freeze `detector-e1.v1` và `incident-e1.v1`, incident record và anomalies của validation (task-06 tuần 16), evaluation harness phát hiện (task-04 tuần 16), dataset v0 và export telemetry 10 run (tuần 15).
  - Task-01 và task-02 làm song song trước. Task-03 cần graph của task-01 và schema/harness của task-02. Task-04, task-05, task-06 cần schema của task-02.
  - Task-07 viết khi interface và tham số của task-03 đến task-06 đã rõ. Nó phải nằm trên `main` **trước mọi lần chấm RCA trên validation** (protocol mục 6.1.2: không gian ứng viên commit trước lần chạy validation đầu tiên dùng nó).
  - Task-08 cần task-01 đến task-07.
- Rủi ro:
  - **Validation rất nhỏ cho RCA:** 4 fault run, một mỗi case; Top-1 chỉ có 5 mức (0/4 tới 4/4). Bộ case MVP có bốn root cause khác nhau (`course`, `ai`, `media`, `identity`) nên ranking hằng tốt nhất đạt 25% Top-1 và 75% Top-3 (protocol mục 18.4). Validation chỉ dùng để chọn; nhiều tổ hợp sẽ hòa và luật hòa khai báo trước quyết định.
  - **Đánh giá RCA phụ thuộc phát hiện:** chỉ incident matched mới có RCA; ở validation, 4 detector E1 đều khớp 4/4 nên chưa thấy tác động, nhưng end-to-end trên test phải dùng semantic miss (mục 18.6).
  - **Owner khác `service.name`:** bằng chứng C3 nằm ở `ai-worker` trong khi ground truth ghi `ai`, C4 ở `media-worker`/`gateway → media` trong khi ground truth ghi `media` (blueprint mục 11.3). Bảng quy về chủ sở hữu ảnh hưởng trực tiếp tới Top-1.
  - **Graph thiếu cạnh:** `scheduler → scheduler-worker` không cùng trace; cạnh xác thực tần suất thấp; trace validation `healthy-spike` là mẫu 52,5%; vòng `course → ai → course` (protocol mục 11).
  - **BARO và RCAEval:** thêm dependency nặng và dữ liệu RE2 lớn. Chỉ tải một phần RE2 để kiểm adapter; cài trong nhóm dependency tùy chọn; theo dõi RAM (mỗi lúc một lệnh nặng).
  - **Mô tả SimpleRCA chưa đối chiếu từng dòng với mã tác giả** (protocol mục 15.2.1): bản cài phải ghi chỗ khác bài gốc.
- Quyết định cần chốt:
  - **Tương quan incident bằng graph (blueprint mục 10.3):** đề xuất **giữ** tương quan theo thời gian của `incident-e1.v1`, chỉ dùng graph cho RCA ở tuần 17. Lý do:
    - Config đã freeze sau khi chọn trên validation.
    - Ở validation, mỗi fault run có đúng một incident (detection-validation-report-v1 mục 7). Danh sách service trong incident khác nhau theo detector; ví dụ incident C2 của Isolation Forest không có `course` (root cause), incident C3 chỉ có `ai-worker`.
    - Đổi sang graph phải ra `incident-e1` phiên bản mới và chọn lại bước 2a.

    Đây là **lệch khỏi** blueprint mục 10.3 (gộp theo connected subgraph) và đảo hướng đã ghi ở overview tuần 16 ("đồ thị v2 thay tương quan theo thời gian"). Bách xác nhận hoặc đổi trước khi task-07 khai báo. Nếu giữ, độ lệch được ghi vào blueprint mục 10.3 và detection-validation-report-v1 mục 9 (tài liệu của phần phát hiện), không ghi trong tập ứng viên RCA.
  - **Trần điểm Isolation Forest theo service** (tồn đọng tuần 16): giữ thành giới hạn của E1, hoặc ra `detection-candidates.v3` (phân vị theo service) và chọn lại trên validation. Phải chốt trước freeze campaign tuần 19; không thuộc task tuần 17.
  - Detector nào nuôi incident cho RCA (đề xuất: fused, theo blueprint mục 9.7) được khai báo ở task-07.
- Quyết định đã chốt:
  - Giai đoạn tự bắt kịp: mọi task do Bách phụ trách, không collaborator; review/merge theo ngoại lệ Bách xác nhận (plan v0.4 mục 0.1, dòng "Nhân sự").
  - Không chạm split test: campaign tuần 19, RCA chính thức đo trên test ở tuần 20.
  - Proposed ranker "Hướng 1", evidence aggregation và pipeline một lệnh làm ở tuần 18; E6 (RCAEval RE2 đầy đủ) là Target, chỉ bắt đầu khi M4 đúng hạn. Tuần này chỉ chạy BARO trên một phần RE2 để kiểm adapter (protocol mục 15.2.1).
  - Thử nghiệm người (E7) là Target, không làm.
  - Tồn đọng mang từ tuần 16:
    - Trần điểm Isolation Forest theo service (quyết định ở trên).
    - Bộ ngưỡng tĩnh `loose` vượt triệu chứng C2/C4 với biên hẹp; delay C3 phụ thuộc lúc job AI đến (detection-validation-report-v1 mục 8.3, 9).
    - Export chờ tới `time_end` + 10 s; C2 ở cao điểm `healthy-spike` làm cạn pool `course` (từ tuần 15).
    - Chạy thử trên Windows (tuần 17–18).
    - Gate R điều kiện 5.

## Thứ tự thực hiện đề xuất

1. Task-01 và task-02 song song.
2. Task-03 khi graph và schema đã có; task-04, task-05 song song sau task-02; task-06 (cài RCAEval, kiểm RE2) chạy riêng vì nặng RAM.
3. Task-07: khai báo, merge vào `main`.
4. Task-08: chấm validation theo task-07, freeze config, báo cáo.

## Tiêu chí kết thúc tuần

- [ ] Các task ưu tiên cao có trạng thái và bằng chứng được cập nhật.
- [ ] Các task hoàn thành đã liên kết đến PR và bằng chứng DoD.
- [ ] Mọi lần chấm RCA trên validation chạy trên commit đã có tập ứng viên RCA của task-07 và được ghi trong ledger chấm validation.
- [ ] Gate R điều kiện 5 có bằng chứng của Bách (đóng ngoại lệ của tuần 13–17).
- [ ] Tồn đọng và việc chuyển sang tuần 18 đã được ghi rõ.
