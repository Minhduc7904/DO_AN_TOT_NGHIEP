# Task tuần: Incident lifecycle và incident record

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_build-incident-lifecycle` |
| Tuần | `week-16_2026-11-15_to_2026-11-21` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 30/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-16/task-03-build-incident-lifecycle` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [analysis-anomaly-rca-blueprint-v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 6.5, 6.6, 10, 17.4 và [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 3.3, 6.1.2, 7.1, 17.2–17.3:

- Module `aiops_training/incident/`: máy trạng thái `NORMAL → SUSPECTED → OPEN → RECOVERING → RESOLVED`, xác định hoàn toàn theo config.
  - Trigger theo persistence trên chuỗi cửa sổ **có dữ liệu** liên tiếp: cửa sổ null không tính là vượt ngưỡng và không làm đứt chuỗi (luật `skip_without_breaking_chain`).
  - Có recovery, merge gap và gộp bất thường của nhiều service thành một incident có `affected_services` (ví dụ C6).
- `detected_at` = `window_end` của cửa sổ hoàn tất persistence cộng độ trễ thu thập của modality chậm nhất mà detector dùng (metric 10 s, mục 6.1.2).
- `estimated_start_time` theo blueprint mục 10.4 (cửa sổ bất thường đầu tiên của chuỗi); ghi rõ cách lấy.
- Lifecycle chỉ bỏ cửa sổ có cờ `warmup` của feature. Việc lọc theo evaluation interval (mục 7.1) là của harness (task-04). Lifecycle không đọc mốc nào từ `RunGroundTruth`.
- Đầu vào là chuỗi điểm/cờ của **bất kỳ** detector nào ở task-01, để E1 chỉ đổi detector (mục 17.8).
- Tương quan tạm thời theo khoảng thời gian và danh sách service cố định của testbed v2; đồ thị phụ thuộc v2 thay vào ở tuần 17.
- Incident record (blueprint mục 6.5):
  - Gồm `incident_id` **xác định** (sinh từ `run_id`, detector, config và cửa sổ mở; không dùng UUID ngẫu nhiên, vì mục 17.4 dùng nó để phá hòa), `detected_at`, `estimated_start_time`, `affected_services`, `first_symptom`, `trigger_reason`.
  - Kèm phiên bản detector/incident config và lineage tới feature, baseline, model.
  - Timeline tối thiểu: mỗi sự kiện trỏ tới evidence (service, feature, cửa sổ, điểm).
- CLI chạy từ thư mục run ra incident record.

### Không thực hiện

- Không làm RCA, đồ thị phụ thuộc v2 hay evidence extraction (tuần 17–18).
- Không chọn persistence, merge gap, recovery hay cửa sổ tương quan: task-05 khai báo, task-06 chọn.
- Không tính `late_tolerance`: giá trị lấy duy nhất từ `detection-candidates-v1.json` và dùng ở harness.
- Không đọc ground truth.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: interface đầu ra của task-01; `configs/detection-candidates-v1.json` (cặp window/persistence).
- Người hoặc phần việc cần phối hợp: task-04 đọc incident record; task-05 khai báo tham số incident.
- Rủi ro/giả định:
  - C3 và C4 lộ triệu chứng muộn (C3 tới 275–305 s). Merge gap quá nhỏ làm một fault thành nhiều incident (FP); quá lớn thì gộp nhầm hai sự kiện độc lập.
  - C6 làm nhiều service cùng lỗi một lúc, nên phải ra một incident chứ không phải nhiều incident.
  - Một incident mở trước fault rồi hấp thụ cửa sổ fault qua merge gap phải ra FP + FN theo mục 17.2; lifecycle không được tách nó ra theo mốc fault.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Máy trạng thái incident, tương quan tạm thời, incident record, CLI, test | Code | `aiops-platform/training/src/aiops_training/incident/`, `tests/` |
| Schema incident record, quy tắc `detected_at`, `estimated_start_time`, `incident_id` | Docs | README `training/`; blueprint mục 6.5, 10 nếu cần cập nhật |

## Definition of Done

- [x] Unit test cho mọi chuyển trạng thái, persistence có cửa sổ null, recovery, merge gap, nhiều service cùng lúc, incident mở trước fault và kéo dài qua fault; chạy hai lần cùng input cho cùng output, kể cả `incident_id`.
- [x] `detected_at` đúng với 4 cặp window/persistence của `detection-candidates.v1` (test).
- [x] Incident record có đủ trường ở trên cùng lineage; không trường nào lấy từ ground truth.
- [x] Chạy hết chuỗi feature → detector → incident trên run pilot (một run khỏe, một fault run mỗi case có sẵn).
- [x] `uv run pytest` và `ruff` đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chờ review. Đã review bằng agent riêng bốn vòng và sửa các điểm nêu (xem mô tả PR).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — module `incident/`: máy trạng thái theo service, persistence theo từng khóa bằng chứng với `max_chain_gap_seconds`, recovery, gộp theo merge gap và cửa sổ tương quan, `incident-record.v1`; chạy hết chuỗi trên 4 fault run pilot (mỗi case một run) và 1 run pilot khỏe (README training, mục Incident).
- Ghi chú/tồn đọng:
  - Thêm ngoài card: `max_chain_gap_seconds` (ngăn hai sự kiện đơn lẻ trên cạnh thưa cộng thành một chuỗi), khai báo ở `detection-candidates.v2`.
  - Tương quan chỉ theo thời gian; đồ thị v2 thay ở tuần 17 (phải tăng `incident_config_version`).
