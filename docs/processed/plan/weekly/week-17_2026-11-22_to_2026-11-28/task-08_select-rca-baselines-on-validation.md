# Task tuần: Chạy RCA baseline trên validation, chọn tham số và freeze config

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-08_select-rca-baselines-on-validation` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 05/12/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-17/task-08-select-rca-baselines-on-validation` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.2, 9.2, 15.2, 15.2.1, 15.4, 18, 20.3, 20.6 và bàn giao tuần 17 của plan v0.4 ("kết quả RCA baseline trên validation", "graph artifact", "Top-K harness"):

- **Chặn và ghi chép:**
  - Chỉ chấm validation từ commit chứa merge commit của PR task-07 trên `main`.
  - Mọi lần chấm ghi vào ledger chấm validation (cùng cơ chế với `select-detectors` của tuần 16: chặn code chưa commit, chặn chấm lại, kiểm sha256 đầu vào).
- **Chạy trên 4 fault run validation**, với incident của detector nuôi RCA mà task-07 khai báo:
  - Max anomaly, Earliest anomaly, Graph-aware simple, ngưỡng tĩnh;
  - `base-manual-auto`, SimpleRCA, BARO;
  - mốc constant và random.
- **Chọn tham số** của từng baseline theo luật của task-07, freeze `rca_config_version` từng baseline kèm lineage (detector/incident config, graph config, candidate set, tập ứng viên RCA).
- **Báo cáo** `rca-baseline-validation-report-v1.md`:
  - Top-1/Top-3/MRR/Average Rank theo case và gộp, coverage, end-to-end, so với mốc constant/random;
  - số artifact và thời gian tới kết luận của `base-manual-auto` (E4);
  - graph artifact của từng run validation và coverage graph;
  - số đếm và mẫu số; ghi rõ đây là số để chọn, không phải kết luận (validation 4 fault run).
- **Error analysis ban đầu:** với mỗi run mà baseline xếp sai, ghi service được chọn, bằng chứng và giả thuyết. Ví dụ: owner khác `service.name` (C3 `ai-worker`/`ai`, C4 `media-worker`/`media`), triệu chứng ở `gateway`, cạnh xác thực tần suất thấp (C6), vòng `course → ai → course`.
- Script tái lập toàn bộ bảng bằng một lệnh, và một lượt tái lập vào thư mục riêng.

### Không thực hiện

- Không chấm split test; không đổi tập ứng viên sau khi xem kết quả (buộc đổi thì ra phiên bản mới và ghi thứ tự thời gian).
- Không làm proposed ranker hay pipeline một lệnh (tuần 18).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 đến task-07 trên `main`; incident và anomalies validation của tuần 16.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định:
  - Top-1 trên 4 run chỉ có 5 mức. Nhiều baseline sẽ hòa; luật hòa khai báo trước quyết định.
  - Nếu một baseline đúng 4/4 (dự kiến `base-manual-auto` mạnh ở C2–C4), báo cáo nguyên trạng.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Ledger chấm validation RCA, prediction và evaluation artifact | Data | `aiops-platform/training/evaluations/rca-validation-v1/` |
| Config RCA đã freeze của từng baseline | Config | `aiops-platform/training/configs/` |
| Báo cáo kết quả RCA baseline trên validation và error analysis | Docs | `docs/processed/architecture/rca-baseline-validation-report-v1.md` |

## Definition of Done

- [ ] Ledger chấm validation được commit; lần chấm đầu tiên chạy trên commit chứa merge commit của PR task-07 trên `main`.
- [ ] Mọi baseline và hai mốc tham chiếu có `RcaIncidentResult` hợp lệ cho cả 4 fault run validation; bảng Top-K, coverage, end-to-end tái lập bằng một lệnh.
- [ ] Tham số được chọn đúng luật của task-07; config freeze có version và lineage.
- [ ] Số artifact và thời gian của `base-manual-auto` (E4) có trong báo cáo.
- [ ] Error analysis liệt kê từng run bị xếp sai của từng baseline.
- [ ] Không có lần chấm nào trên test; lượt tái lập cho kết quả giống lượt chính.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
