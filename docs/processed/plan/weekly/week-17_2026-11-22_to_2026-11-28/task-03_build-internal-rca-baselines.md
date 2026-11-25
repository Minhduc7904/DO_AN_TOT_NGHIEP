# Task tuần: Baseline RCA nội bộ (Max anomaly, Earliest anomaly, Graph-aware simple) và ngưỡng tĩnh

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_build-internal-rca-baselines` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 30/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-17/task-03-build-internal-rca-baselines` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [analysis-anomaly-rca-blueprint-v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 12.6–12.7 và [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 11, 15.2 (đoạn cuối), 16, 18.1–18.2. Bốn baseline cùng đầu vào là incident record và bảng điểm bất thường của detector đã freeze (`detector-e1.v1`, `incident-e1.v1`), xuất `RcaIncidentResult` đủ 10 candidate:

- **Max anomaly:** xếp service theo điểm bất thường lớn nhất trong cửa sổ incident.
- **Earliest anomaly:** xếp theo thời điểm bất thường sớm nhất (onset ước lượng).
- **Graph-aware simple:** điểm bất thường cộng quan hệ trên graph của task-01, chỉ cạnh sync (luật lan truyền hoặc centrality đơn giản). Đây là phía "graph-aware" trong so sánh RQ2 với "severity-only", nên mọi thứ khác giữ như Max anomaly (protocol mục 11).
- **Ngưỡng tĩnh:** xếp service theo số tín hiệu vượt ngưỡng cố định (bộ ngưỡng của `detector-e1.v1`), có trong bảng chính E2 (protocol mục 15.2).

Áp dụng chung:

- Quy tín hiệu về candidate bằng bảng chủ sở hữu của task-01.
- Tie-break theo mục 18.1; policy cho candidate không có điểm (mục 18.2); deterministic (blueprint mục 12.7).
- `evidence[]` truy ngược được về artifact telemetry; `model.graph_ref`, `model.config_ref` ghi đủ lineage.
- Tham số còn mở (ví dụ luật lan truyền của Graph-aware simple) đưa vào tập ứng viên của task-07, không chọn ở task này.

### Không thực hiện

- Không cài proposed ranker "Hướng 1" (tuần 18).
- Không chọn tham số trên validation (task-08) và không chấm test.
- Không dùng ground truth hay `fault_start` trong baseline.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: graph và bảng chủ sở hữu (task-01), schema và harness (task-02), anomalies và incident của tuần 16.
- Người hoặc phần việc cần phối hợp: task-07 khai báo tham số còn mở; task-08 chạy trên validation.
- Rủi ro/giả định:
  - Điểm bất thường của các detector khác thang đo. Baseline dùng đúng detector nuôi RCA mà task-07 khai báo, không trộn.
  - Max/Earliest anomaly dễ chọn `gateway` hoặc service triệu chứng (blueprint mục 12.1); `gateway` không là candidate nên phải quy về service phía sau theo luật đã ghi.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Bốn baseline, lệnh chạy, test | Code | `aiops-platform/training/src/aiops_training/rca/` |
| Config mặc định của từng baseline (`rca_config_version`) | Config | `aiops-platform/training/configs/` |

## Definition of Done

- [ ] Bốn baseline xuất `RcaIncidentResult` hợp lệ theo harness của task-02 (đủ 10 candidate, tie-break đúng).
- [ ] Test trên incident và điểm dựng tay cho từng baseline, gồm hòa điểm, candidate không có điểm, vòng trên graph.
- [ ] Graph-aware simple chỉ khác Max anomaly ở thành phần graph (test kiểm khi tắt graph thì ranking trùng Max anomaly).
- [ ] Chạy end-to-end trên run pilot (không phải validation) để kiểm code chạy đúng; test, lint đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
