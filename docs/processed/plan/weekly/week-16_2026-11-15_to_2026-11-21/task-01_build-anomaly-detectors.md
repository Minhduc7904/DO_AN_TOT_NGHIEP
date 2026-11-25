# Task tuần: Detector baseline và điểm hợp nhất đa nguồn

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_build-anomaly-detectors` |
| Tuần | `week-16_2026-11-15_to_2026-11-21` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 28/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-16/task-01-build-anomaly-detectors` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [analysis-anomaly-rca-blueprint-v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 6.4, 9, 17.3 và [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1.1 (bảng F), 6.1.2, 9.1, 17.8:

- Module `aiops_training/anomaly/` gồm ba detector **cùng interface đầu ra**: điểm bất thường và cờ vượt ngưỡng theo (cửa sổ, service), ghi thành `AnomalyRecord` (blueprint mục 6.4). Đầu vào riêng từng detector:
  - **Ngưỡng tĩnh** (blueprint mục 9.1): giá trị feature thô (error rate, latency p95, tín hiệu dependency), ngưỡng đọc từ config, không hard-code. Đây là baseline E1 và đối chứng phát hiện cho RQ6, mô phỏng cảnh báo vận hành thủ công.
  - **Robust z-score:** z của baseline v1 (`features/baseline.py`), cùng thang đo khi MAD = 0 đã chốt ở mục 6.1.2. Quy tắc gộp z của nhiều feature thành điểm service và hướng z (một phía hay trị tuyệt đối, theo từng feature) phải viết thành code và tài liệu; task-05 khai báo nó là luật cố định.
  - **Isolation Forest** (blueprint mục 9.4): fit chỉ trên cửa sổ sau warm-up của 4 run train khỏe (khoảng 167 cửa sổ 60 s mỗi run). Fit riêng cho từng độ dài cửa sổ của `detection-candidates.v1` (30 s và 60 s), chọn theo `window_s` và thư mục feature; model 30 s fit khi task-02 đã có feature 30 s. Scaler fit trên cùng dữ liệu đó. Artifact ghi danh sách và thứ tự feature, scaler, hyperparameter, seed, `run_id` train, code commit, config version. Ghi quyết định cho service worker (vector con hoặc detector riêng) và quy tắc điền giá trị thiếu.
- **Quy về service:** quy tắc gán feature edge/queue cho service của `AnomalyRecord` (phía gọi, dependency hay consumer) ghi rõ và dùng chung cho mọi detector.
- **`telemetry_silent`:** tín hiệu riêng, không đi qua robust z (mục 6.1.2). Nó đi vào cả bốn loại điểm theo **cùng một cách**, để E1 chỉ đổi detector.
- **Cửa sổ không dữ liệu:** đặc trưng null không tính là vượt ngưỡng (luật `skip_without_breaking_chain`, áp ở task-03).
- **Điểm hợp nhất M/T/L** (blueprint mục 9.7):
  - Ghi rõ điểm modality lấy từ đâu (ví dụ max robust z của feature thuộc modality đó).
  - Đưa về thang so sánh được; trọng số đọc từ config, mặc định trọng số bằng nhau.
  - Lưu cả điểm thành phần lẫn điểm hợp nhất.
  - Chỉ fallback khi modality thật sự không có dữ liệu: worker không có HTTP/log, hoặc cửa sổ dưới ngưỡng số span tối thiểu. Không đổi cách chạy theo chất lượng export của run.
- **Ràng buộc với trace** (bảng F, hệ quả (c)): đặc trưng trace dùng trong detector chỉ là tỉ lệ, không dùng `span_count` hay số đếm tuyệt đối.
- CLI chạy detector trên thư mục feature của một run và ghi `AnomalyRecord` cùng lineage (feature manifest, baseline, model, config).
- Kiểm code chạy đúng trên run pilot (một run khỏe, ít nhất một fault run).

### Không thực hiện

- Không chọn ngưỡng hay hyperparameter: tập ứng viên khai báo ở task-05, chọn ở task-06.
- Không làm feature cửa sổ 30 s (task-02), incident (task-03) hay evaluation (task-04).
- Không chạy trên split test; không làm change-point (Target) hay deep model (Stretch).
- Không chọn hay chỉnh giá trị nào dựa trên kết quả của run pilot.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: feature pipeline v1 và `baselines/dataset-v0.json` (task-05 tuần 15, PR #100); feature và baseline 30 s của task-02 (cho model và điểm 30 s); dataset manifest v0 (task-04 tuần 15, PR #97); `configs/detection-candidates-v1.json` (task-06 tuần 15, PR #99).
- Người hoặc phần việc cần phối hợp: task-03 dùng interface đầu ra; task-05 khai báo ứng viên cho tham số của các detector này.
- Rủi ro/giả định:
  - Train chỉ có 4 run khỏe, nên Isolation Forest có ít mẫu cho mỗi nhóm service.
  - Feature có giá trị null hợp lệ (không có lời gọi, không áp dụng); cách điền không được làm lộ thông tin của fault.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Ba detector, điểm hợp nhất, `AnomalyRecord`, CLI, test | Code | `aiops-platform/training/src/aiops_training/anomaly/`, `tests/` |
| Mô tả detector, artifact model, quy tắc gộp, quy về service, `telemetry_silent`, fallback | Docs | README `training/` (cách chạy); blueprint mục 9 (thiết kế đã cài) |

## Definition of Done

- [x] Ba detector và điểm hợp nhất có unit test: cửa sổ null, MAD = 0, thiếu modality, worker, `telemetry_silent` cho cả bốn loại điểm; `uv run pytest` và `ruff` đạt.
- [x] Isolation Forest fit chỉ từ cửa sổ sau warm-up của run train khỏe; artifact có đủ trường ở blueprint mục 9.4; fit lại cùng seed cho cùng kết quả (test).
- [x] Không đặc trưng trace nào trong detector là số đếm tuyệt đối (test hoặc kiểm danh sách feature).
- [x] Isolation Forest có model cho cả cửa sổ 30 s và 60 s, artifact ghi `window_s`; cả bốn loại điểm chạy được ở cả hai độ dài cửa sổ trên ít nhất một run train khỏe và (60 s) một fault run pilot; ghi thời gian và RAM.
- [x] Không code nào của detector đọc ground truth (kiểm bằng test hoặc `check-leakage`).

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#105](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/105).
- Kết quả review: Chờ review. Đã review bằng agent riêng ba vòng và sửa các điểm nêu (xem mô tả PR).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — module `anomaly/` (ngưỡng tĩnh, robust z, Isolation Forest, fused; `AnomalyRecord` `anomaly-record.v2` có khóa bằng chứng), lệnh `fit-iforest`, `detect`; chạy trên run train ở cửa sổ 30 s và 60 s, và hết chuỗi trên 4 fault run pilot + 1 run pilot khỏe (README training, mục Detector).
- Ghi chú/tồn đọng:
  - Review phát hiện luật cửa sổ không dữ liệu theo service gần như không kích hoạt (`log_error_rate` luôn có giá trị) và thang đo baseline cỡ sai số dấu phẩy động; sửa bằng khóa bằng chứng (task-01, task-03) và luật thang đo v2 (task-02); khai báo ở `detection-candidates.v2` (task-05).
  - Phần `tie_rank` và chọn ngưỡng thuộc task-04, task-06.
