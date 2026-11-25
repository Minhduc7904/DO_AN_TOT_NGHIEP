# Task tuần: Khai báo tập ứng viên còn mở của phần phát hiện (trước validation)

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_declare-detection-candidates-v2` |
| Tuần | `week-16_2026-11-15_to_2026-11-21` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 01/12/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `docs/week-16/task-05-declare-detection-candidates-v2` |

## Yêu cầu và phạm vi

### Cần thực hiện

[Evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1.2 yêu cầu không gian ứng viên của mỗi giá trị chọn trên validation phải được commit **trước** lần chạy validation đầu tiên dùng nó. Bước chọn window/persistence bằng robust z (luật chọn bước 1) đếm incident và báo động giả, nên đã cần quy tắc gộp điểm và tham số incident. Vì vậy task này phải xong trước **mọi** lần chấm validation, kể cả bước 1.

File config mới `detection-candidates.v2` (giữ nguyên v1) và mục 6.1.2 của protocol cập nhật, gồm:

- **Luật cố định** (không chọn trên validation):
  - quy tắc gộp z của nhiều feature thành điểm service và hướng z (task-01);
  - quy tắc quy feature edge/queue về service;
  - đường đi của `telemetry_silent` vào bốn loại điểm;
  - điều kiện fallback của điểm hợp nhất;
  - ràng buộc đặc trưng trace chỉ là tỉ lệ (mục 6.1.1 bảng F, hệ quả (c)).
- **Tham số incident:**
  - giá trị dùng ở bước 1 (merge gap, recovery, `correlation_window_seconds`);
  - luật chọn bộ tham số incident **dùng chung** cho cả bốn detector của E1, ví dụ chọn bằng robust z sau bước 1 rồi cố định, hoặc giữ cố định.
- **Ứng viên cho bước 2:**
  - ngưỡng và hyperparameter của Isolation Forest, cách xử lý service worker;
  - ngưỡng và trọng số của điểm hợp nhất, trọng số bằng nhau là một ứng viên bắt buộc (blueprint mục 9.7);
  - ngưỡng cố định của baseline ngưỡng tĩnh cho E1 (mục 17.8).
- **Luật chọn và luật hòa** cho từng detector sau khi window/persistence đã cố định, cùng định nghĩa báo động giả (mẫu số lấy từ evaluation config của task-04) và giới hạn 1 incident/giờ.
- **Lý do của từng ứng viên:** từ số đo của train và pilot (pilot làm lý do cho khoảng ứng viên, mục 6.1) hoặc từ tài liệu, không từ validation. Tổng số tổ hợp giữ nhỏ, có giải thích vì sao vừa với 6 run validation.
- Merge vào `main` trước khi task-06 chấm validation lần đầu.

### Không thực hiện

- Không đổi `detection-candidates.v1` (window, persistence, ngưỡng robust z, luật chọn).
- Không chọn giá trị cuối và không chạy detector nào trên validation.
- Không khai báo phần RCA (SimpleRCA, BARO, `base-manual-auto`, trọng số RCA): làm ở tuần 17–18.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: interface và tham số thực của task-01 và task-03; evaluation config của task-04 (mẫu số, đoạn cao điểm); số đo train/pilot; [detection-candidates-v1.json](../../../../../aiops-platform/training/configs/detection-candidates-v1.json).
- Người hoặc phần việc cần phối hợp: task-06 chỉ chấm validation từ commit có v2 trong lịch sử.
- Rủi ro/giả định:
  - Thêm ứng viên làm tăng nguy cơ chọn trúng nhiễu của 6 run validation; mặc định giữ mỗi tham số 2–3 giá trị.
  - Nếu cần đổi sau khi đã chấm validation thì ra v3, ghi lý do và thứ tự thời gian như mục 6.1.2 đã làm với v1.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| `detection-candidates-v2.json` | Config | `aiops-platform/training/configs/` |
| Protocol mục 6.1.2 cập nhật (luật cố định, tham số incident, ứng viên v2, luật chọn, lý do) | Docs | `docs/processed/architecture/evaluation-protocol-v1.md` |

## Definition of Done

- [x] Mọi giá trị "còn lại cho validation" thuộc phần phát hiện ở mục 6.1.2 có tập ứng viên trong v2, hoặc được khai báo là luật cố định có lý do.
- [x] Tham số incident dùng ở bước 1 và luật chọn tham số incident dùng chung cho E1 được ghi rõ.
- [x] Mỗi ứng viên có lý do từ train/pilot hoặc tài liệu; không trích số đo nào của validation.
- [x] Luật chọn và luật hòa cho từng detector ghi đủ; tổng số tổ hợp có ghi.
- [ ] PR được merge vào `main` trước lần chấm validation đầu tiên của task-06 (task-06 đối chiếu bằng ledger chấm validation và timeline PR).

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#103](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/103).
- Kết quả review: Chờ review. Đã review bằng agent riêng ba vòng và sửa các điểm nêu (xem mô tả PR).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — khai báo `detection-candidates.v2` ([config](../../../../../aiops-platform/training/configs/detection-candidates-v2.json), evaluation-protocol-v1 mục 6.1.3): luật cố định, hai luật thay v1 (thang đo `unit_floor.v2`, persistence theo khóa bằng chứng), ứng viên bước 2a/2b có `tie_rank` (28 tổ hợp, 27 lần chấm khác nhau), căn cứ incident/giờ trên 4 run train.
- Ghi chú/tồn đọng:
  - DoD cuối (PR merge trước lần chấm validation đầu tiên) được kiểm ở task-06 bằng ledger chấm validation.
  - v2 mô tả code ở PR task-01 đến task-04; cả năm PR phải nằm trên `main` trước task-06.
