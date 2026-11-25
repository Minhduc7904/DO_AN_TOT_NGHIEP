# Task tuần: Baseline đã công bố SimpleRCA

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_build-simplerca-baseline` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 30/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-17/task-05-build-simplerca-baseline` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 15.2.1 (SimpleRCA; Fang et al. 2025, [arXiv 2510.04711](https://arxiv.org/abs/2510.04711), `[L-Fang2025]`) và [analysis-anomaly-rca-blueprint-v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 12.6 (baseline 5):

- **Luật, theo mô tả của protocol:**
  - Đoạn tham chiếu là cửa sổ khỏe ngay trước incident trong cùng run.
  - Metric alert khi `|x − mean_ref| > k_sigma × std_ref` hoặc `x > P95_ref`.
  - Trace alert khi P95 latency của service trong cửa sổ incident ≥ `m × P95_ref`.
  - Log alert đếm log của service khớp danh sách từ khóa lỗi cố định.
  - Điểm service là tổng số cảnh báo; hòa theo tie-break mục 18.1.
- **Đầu vào:** artifact đã lọc nhiễu (mục 8.5), cửa sổ incident do detector khai báo (không dùng `fault_start`). Ánh xạ tín hiệu về service bằng `service.name` (metric broker theo tiền tố queue như mục 4.1); hạ tầng không là candidate.
- **Đầu ra:** `RcaIncidentResult`, `analyst_kind = simplerca_baseline`, ranking đủ 10 candidate.
- **Tham số mặc định theo bài gốc:** `k_sigma` 3, `m` 3. Không gian chọn (`k_sigma` ∈ {2, 3}, `m` ∈ {2, 3}, đoạn tham chiếu ∈ {5, 10} phút) khai báo lại ở task-07.
- **Đối chiếu với mã/bài của tác giả:** ghi rõ từng chỗ bản cài khác bài gốc, như ngưỡng nào áp cho loại metric nào, danh sách từ khóa, cách xử lý cửa sổ không có dữ liệu.

### Không thực hiện

- Không mở rộng luật ngoài mô tả của bài (không thêm graph hay điểm học từ train).
- Không chọn tham số trên validation (task-08), không chấm test.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: schema và harness (task-02), export telemetry, incident record của tuần 16.
- Người hoặc phần việc cần phối hợp: task-07 khai báo không gian tham số.
- Rủi ro/giả định: đoạn tham chiếu 10 phút phải nằm trọn trong phần khỏe trước incident. Với lịch fault mặc định (fault ở giây 1080, warm-up 360 s) đủ chỗ; khi không đủ thì ghi luật xử lý, không âm thầm rút ngắn.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| SimpleRCA, lệnh chạy, test | Code | `aiops-platform/training/src/aiops_training/rca/` |
| Config mặc định và danh sách từ khóa cố định | Config | `aiops-platform/training/configs/` |
| Ghi chú khác biệt so với bài gốc | Docs | README `aiops-platform/training` hoặc protocol mục 15.2.1 |

## Definition of Done

- [ ] Ba loại cảnh báo tính đúng trên chuỗi dựng tay (gồm std bằng 0, cửa sổ không có dữ liệu, đoạn tham chiếu không đủ dài).
- [ ] Xuất `RcaIncidentResult` hợp lệ; ranking tất định, hòa theo tie-break.
- [ ] Danh sách chỗ khác bài gốc được ghi kèm nguồn đối chiếu.
- [ ] Chạy được trên run pilot; test, lint đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
