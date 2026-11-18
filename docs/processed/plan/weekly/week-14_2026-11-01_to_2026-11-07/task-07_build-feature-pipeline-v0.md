# Task tuần: Feature pipeline v0

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-07_build-feature-pipeline-v0` |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 24/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-14/task-07-build-feature-pipeline-v0` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [telemetry-and-ground-truth-schema-v1](../../../architecture/telemetry-and-ground-truth-schema-v1.md) mục 11 và [analysis blueprint v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md):

- Đọc artifact export (Parquet, schema `telemetry.v2`) và sinh `ServiceWindowFeature`, `EdgeWindowFeature` theo cửa sổ 60 s, bước 15 s, cho 11 `service.name` và các cạnh đã biết.
- Counter tính theo tốc độ tăng, chuỗi xuất hiện giữa cửa sổ coi giá trị trước là 0; series đứng yên khi runtime ngừng (Collector giữ giá trị cuối ~5 phút, [telemetry-data-dictionary-v2](../../../architecture/telemetry-data-dictionary-v2.md) mục 8.2) phát hiện bằng counter không tăng và gắn cờ `telemetry_silent`.
- Đặc trưng không dùng nhãn hay thông tin fault (chống leakage cơ bản; kiểm đầy đủ ở tuần 15).

### Không thực hiện

- Không huấn luyện detector, không RCA.
- Không làm guard leakage đầy đủ và split dataset (tuần 15).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: export và data-quality (PR #77, #81); một run có fault từ task-05.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: cửa sổ ở biên run thiếu dữ liệu được đánh dấu, không bị bỏ âm thầm.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Module feature pipeline và lệnh CLI | Code | `aiops-platform/training/` |
| Bảng đặc trưng trên run thử có fault | Bằng chứng | Mô tả PR |

## Definition of Done

- [ ] Số cửa sổ và cột đặc trưng khớp mục 11.1–11.2; có data dictionary cho cột mới.
- [ ] Test cho cửa sổ trượt, tốc độ counter, chuỗi mới giữa cửa sổ, `telemetry_silent`.
- [ ] Chạy trên run thử có fault: đặc trưng của thành phần gốc lệch rõ trong cửa sổ fault so với trước fault.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#87](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/87).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp; CI GitHub bị khóa thanh toán, kiểm tra chạy cục bộ, kết quả trong PR). Có một vòng review bằng agent ngoài GitHub; các phát hiện đã sửa trong PR. PR #87 được Bách (người phụ trách) merge ngày 18/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 18/11/2026 — đã merge PR #87; ghi nhận hậu kiểm, chuyển Hoàn thành.
- Ghi chú/tồn đọng: Không có.
