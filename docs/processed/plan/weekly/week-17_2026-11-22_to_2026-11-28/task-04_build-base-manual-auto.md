# Task tuần: Baseline thủ công tự động (`base-manual-auto`) và nhật ký thao tác cho E4

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_build-base-manual-auto` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 01/12/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-17/task-04-build-base-manual-auto` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [ADR-006](../../../adr/adr-006-trim-project-scope-v1.md) mục 3.2, [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 15.2 và 15.4, [analysis-anomaly-rca-blueprint-v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 12.6 (baseline 4). Baseline mô phỏng SRE, chạy offline trên artifact đã export (`spans.parquet`, `metrics.parquet`, `logs.parquet`):

- **Luật:**
  - Bắt đầu từ cùng cửa sổ incident do detector khai báo (`detected_at`/`estimated_start_time`, không dùng `fault_start`).
  - Lấy các trace lỗi/chậm nhất trong cửa sổ.
  - Đi theo span CLIENT lỗi hoặc chậm **sâu nhất**, kể cả qua cạnh async/auth sang service khác.
  - Kết luận service sở hữu span đó (quy về candidate bằng bảng chủ sở hữu của task-01).
- **Chỉ dùng tín hiệu người thủ công có:** RED metric theo service, trace lỗi/chậm, log theo `trace_id`. Không dùng mô hình đã học, graph model, điểm bất thường học từ train hay ground truth.
- **Nhật ký thao tác cho E4:** mỗi trace mở, mỗi truy vấn PromQL (một panel), mỗi truy vấn LogQL là một artifact. Đếm theo loại tới khi ra kết luận, ghi "kết luận đúng ở artifact thứ mấy" (do evaluator tính). Ghi thời gian chạy `T_base`.
- **Đầu ra:** `RcaIncidentResult`, `analyst_kind = manual_baseline_auto`, ranking đủ 10 candidate; service không chạm trace nào xếp sau theo tie-break.
- **Tham số** (ngưỡng "chậm", số trace xem tối đa, cách chuyển span thành ranking, cách đếm artifact) ghi trong config; không gian ứng viên khai báo ở task-07.

### Không thực hiện

- Không gọi Tempo/Prometheus/Loki thật; mọi "truy vấn" là thao tác trên artifact đã export, đếm theo quy ước đã ghi.
- Không chọn tham số trên validation (task-08), không chấm test.
- Không làm thử nghiệm người (E7, Target).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: schema `RcaIncidentResult` và harness (task-02), bảng chủ sở hữu (task-01), incident record của tuần 16, export telemetry.
- Người hoặc phần việc cần phối hợp: task-07 khai báo không gian tham số; task-08 chạy trên validation.
- Rủi ro/giả định:
  - Đây là baseline mạnh, gần TraceRCA. Ở C2–C4 span lỗi/chậm của nguyên nhân thường nằm ngay trong trace, nên baseline có thể đúng hết; kết quả được báo cáo nguyên trạng (protocol mục 15.1).
  - C6 dừng `identity`: span tới `identity` có thể không có SERVER phía sau; luật phải kết luận theo callee của span CLIENT lỗi.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| `base-manual-auto`, nhật ký thao tác, lệnh chạy, test | Code | `aiops-platform/training/src/aiops_training/rca/` |
| Config mặc định (`rca_config_version`) và quy ước đếm artifact | Config | `aiops-platform/training/configs/` |

## Definition of Done

- [ ] Baseline đi theo span CLIENT lỗi/chậm sâu nhất qua cạnh sync, async và auth trên trace dựng tay, có test cho từng loại cạnh và cho callee không có span SERVER (C6).
- [ ] Nhật ký thao tác đếm đúng `N_trace`, `N_metric_query`, `N_log_query` theo quy ước đã ghi; có test.
- [ ] Không đọc ground truth hay `fault_start` (test kiểm import như harness tuần 16).
- [ ] Xuất `RcaIncidentResult` hợp lệ (đủ 10 candidate); chạy được trên run pilot; test, lint đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
