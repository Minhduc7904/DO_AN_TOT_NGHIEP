# Task tuần: Khai báo tập ứng viên RCA trước validation (`rca-candidates.v1`)

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-07_declare-rca-candidates-v1` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 02/12/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `docs/week-17/task-07-declare-rca-candidates-v1` |

## Yêu cầu và phạm vi

### Cần thực hiện

[Evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1.2 ("Còn lại cho validation") yêu cầu không gian ứng viên của từng giá trị RCA phải được commit trong versioned config **trước** lần chạy validation đầu tiên dùng nó. Task này làm cho phần RCA việc mà task-05 tuần 16 đã làm cho phần phát hiện. File `rca-candidates.v1` và protocol cập nhật gồm:

- **Đầu vào chung của mọi baseline:**
  - Detector và incident nuôi RCA (một trong bốn detector đã freeze ở `detector-e1.v1`; đề xuất fused, có lý do).
  - Cửa sổ phân tích lấy từ incident (`estimated_start_time`/`detected_at`).
  - Artifact đã lọc nhiễu.
  - Candidate set `service-candidates.v1`.
- **Luật cố định:** bảng quy về chủ sở hữu (task-01), tie-break (mục 18.1), policy điểm thiếu (mục 18.2), seed của random ranking. Danh sách từ khóa lỗi và luật P95 của SimpleRCA được khai báo cố định có lý do: mục 9.2 coi chúng là tham số chọn được, còn mục 15.2.1 cố định chúng.
- **Không gian chọn của từng baseline:**
  - SimpleRCA: `k_sigma` ∈ {2, 3}, `m` ∈ {2, 3}, đoạn tham chiếu ∈ {5, 10} phút (mục 15.2.1).
  - BARO: độ dài dữ liệu trước/sau ∈ {5, 10} phút.
  - `base-manual-auto`: ngưỡng "chậm", số trace tối đa, quy ước đếm artifact (mục 15.2, 15.4).
  - Graph-aware simple: `max_path_length` ∈ {…} và hệ số lan truyền ∈ {…} của luật cố định ở task-03 (blueprint mục 17.5).
  - Ngưỡng tĩnh: bộ ngưỡng lấy từ `detector-e1.v1`, cố định.
- **Luật chọn và luật hòa** trên 4 fault run validation, ví dụ Top-1 nhiều nhất, rồi MRR, rồi `tie_rank` khai báo trước, kèm lý do. Ghi tổng số tổ hợp và vì sao vừa với validation nhỏ.
- **Lý do của từng ứng viên:** từ bài gốc, tài liệu hoặc số đo train/pilot; không từ validation.
- Ghi rõ incident nuôi RCA dùng `incident-e1` nào. Quyết định về tương quan incident bằng graph là của phần phát hiện, ghi ở blueprint mục 10.3 và detection-validation-report-v1, không ở tập ứng viên RCA.
- Merge vào `main` trước lần chấm RCA đầu tiên trên validation của task-08.

### Không thực hiện

- Không khai báo trọng số và ngưỡng của proposed ranker "Hướng 1" và ngưỡng `insufficient_evidence`; làm ở tuần 18 (phiên bản sau của tập ứng viên).
- Không chạy baseline nào trên validation.
- Không đổi `detector-e1.v1`, `incident-e1.v1`.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: interface và tham số thực của task-01 đến task-06; protocol mục 6.1.2, 15.2, 15.2.1, 15.4, 18.
- Người hoặc phần việc cần phối hợp: Bách xác nhận quyết định về tương quan incident; task-08 chỉ chấm từ commit có tập ứng viên này trong lịch sử.
- Rủi ro/giả định:
  - Validation chỉ có 4 fault run, nên nhiều tổ hợp sẽ hòa. Giữ không gian nhỏ và luật hòa toàn phần.
  - Đổi sau khi đã chấm validation thì ra phiên bản mới, ghi lý do và thứ tự thời gian.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| `rca-candidates-v1.json` | Config | `aiops-platform/training/configs/` |
| Protocol mục 6.1.2 và mục mới cho tập ứng viên RCA | Docs | `docs/processed/architecture/evaluation-protocol-v1.md` |

## Definition of Done

- [ ] Mọi giá trị RCA "còn lại cho validation" thuộc phạm vi tuần 17 có tập ứng viên, hoặc được khai báo là luật cố định có lý do.
- [ ] Detector nuôi RCA, cửa sổ phân tích và candidate set ghi rõ.
- [ ] Luật chọn, luật hòa và tổng số tổ hợp ghi đủ; không trích số đo nào của validation.
- [ ] PR được merge vào `main` trước lần chấm RCA đầu tiên của task-08 (đối chiếu bằng ledger và timeline PR).

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
