# Task tuần: Data dictionary, schema chuẩn hóa v2 và data-quality check

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_define-data-dictionary-and-quality-check` |
| Tuần | `week-13_2026-10-25_to_2026-10-31` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 22/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-13/task-05-define-data-dictionary-and-quality-check` |

## Yêu cầu và phạm vi

### Cần thực hiện

- Data dictionary của artifact export (task-04): từng bảng, từng cột, kiểu, đơn vị, nguồn telemetry gốc, giá trị hợp lệ.
- Schema chuẩn hóa v2 theo topology v2: 11 `service.name`, candidate set 10, dependency identity, cách quy span/log/metric về service và cạnh.
- Data-quality check trên artifact của một run: độ phủ 11/11 runtime theo từng modality, modality bị thiếu, cờ `telemetry_silent` khi một runtime im lặng quá ngưỡng trong cửa sổ; xuất báo cáo JSON và bảng tóm tắt dễ đọc.

### Không thực hiện

- Không làm feature pipeline (tuần 14) hoặc chống leakage (tuần 15).
- Không sửa telemetry của LMS.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-04 (artifact và manifest); [telemetry and ground-truth schema v1](../../../architecture/telemetry-and-ground-truth-schema-v1.md); [service catalogue v2](../../../architecture/service-catalogue-and-topology-v2.md).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: span bị mất khi `docker pause` (case catalogue quy ước 5) phải được báo là im lặng, không coi là lỗi dữ liệu.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Data dictionary và schema chuẩn hóa v2 | Docs | `docs/processed/architecture/telemetry-data-dictionary-v2.md` |
| Data-quality check | Code | `aiops-platform/training/` (module `telemetry/validation`) |
| Báo cáo chất lượng trên run thử | Bằng chứng | Mô tả PR (artifact không commit) |

## Definition of Done

- [x] Data dictionary phủ mọi cột của artifact export, khớp code.
- [x] Data-quality check có unit test cho đủ phủ, thiếu modality và `telemetry_silent`.
- [x] Chạy trên run thử từ task-04: báo cáo nêu độ phủ từng runtime và mọi cờ phát sinh.
- [x] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#81](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/81) (thay [#79](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/79): #79 lỡ merge vào nhánh task-04 sau khi #77 đã vào `main`, nên thay đổi chưa tới `main`).
- Kết quả review: Chưa review (giai đoạn tự bắt kịp: review và merge theo ngoại lệ do Bách xác nhận).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 17/11/2026 — hoàn thành phần việc, mở PR #79, chuyển Chờ review.
- Ghi chú/tồn đọng: #79 merge nhầm vào nhánh task-04 (không tới `main`); thay bằng #81. `phase_coverage` và độ phủ theo workflow cần nhật ký thao tác k6 mức 2 và fault manifest (tuần 14). CI GitHub bị khóa thanh toán; kiểm tra chạy cục bộ.
