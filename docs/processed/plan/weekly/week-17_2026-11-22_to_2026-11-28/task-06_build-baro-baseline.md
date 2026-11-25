# Task tuần: Baseline đã công bố BARO qua RCAEval

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_build-baro-baseline` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 02/12/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-17/task-06-build-baro-baseline` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 15.2.1 (BARO; Pham, Ha, Zhang, FSE 2024, [arXiv 2405.09330](https://arxiv.org/abs/2405.09330), `[L-BARO]`) và mục 15.7:

- **Dùng mã BARO trong RCAEval** (MIT, [GitHub](https://github.com/phamquiluan/RCAEval), `[L-RCAEval]`), ghim phiên bản. Cài trong nhóm dependency tùy chọn để không làm nặng môi trường chính. Ghi license và nguồn.
- **Adapter:** đọc `metrics.parquet` của export thành ma trận chuỗi thời gian theo service, đúng định dạng RCAEval cần. Chỉ dùng metric như bản gốc; "multi-source BARO" của RCAEval chỉ là diagnostic.
- **Kiểm adapter trước khi dùng trên testbed:** chạy BARO của RCAEval trên **một phần nhỏ** RE2, ví dụ một hệ thống và vài case. Đối chiếu kết quả với số đã công bố và ghi chênh lệch. Đây cũng là bước đầu của E6 (Target), chỉ làm phần nhỏ.
- **Đầu ra:** `RcaIncidentResult`, `analyst_kind = baro_baseline`, ranking đủ 10 candidate. Điểm service là điểm lớn nhất trong các metric của service; cửa sổ do detector khai báo.
- **Tham số:** giữ mặc định của RCAEval. Không gian chọn (độ dài dữ liệu trước/sau ∈ {5, 10} phút) khai báo lại ở task-07.
- Số đo thời gian/RAM của BARO trên một run testbed và trên phần RE2 đã chạy.

### Không thực hiện

- Không làm E6 đầy đủ (Target, chỉ khi M4 đúng hạn).
- Không sửa thuật toán BARO; khác biệt do adapter phải ghi rõ.
- Không chọn tham số trên validation (task-08), không chấm test.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: schema và harness (task-02), `metrics.parquet` của export (PR #77), incident record của tuần 16.
- Người hoặc phần việc cần phối hợp: task-07 khai báo không gian tham số.
- Rủi ro/giả định:
  - RCAEval có nhiều dependency và RE2 lớn. Chỉ tải phần cần, kiểm `free -h` trước, mỗi lúc một lệnh nặng.
  - Nếu kết quả trên phần RE2 lệch xa số công bố thì ghi lại, kiểm adapter trước khi dùng trên testbed; không chỉnh tham số để khớp số.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Adapter BARO, lệnh chạy, test | Code | `aiops-platform/training/src/aiops_training/rca/` |
| Kết quả kiểm trên phần RE2 so với số công bố | Docs | README `aiops-platform/training` hoặc protocol mục 15.2.1 |

## Definition of Done

- [ ] RCAEval được ghim phiên bản trong nhóm dependency tùy chọn; license và nguồn có ghi.
- [ ] Adapter có test trên ma trận metric dựng tay (service thiếu metric, cửa sổ ngắn).
- [ ] BARO chạy trên phần RE2 đã chọn; kết quả và chênh lệch so với số công bố được ghi.
- [ ] Xuất `RcaIncidentResult` hợp lệ trên run pilot; số đo thời gian/RAM có ghi; test, lint đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
