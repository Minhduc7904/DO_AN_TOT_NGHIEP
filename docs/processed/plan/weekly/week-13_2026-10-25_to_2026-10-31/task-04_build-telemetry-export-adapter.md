# Task tuần: Adapter export telemetry theo run và cửa sổ thời gian

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_build-telemetry-export-adapter` |
| Tuần | `week-13_2026-10-25_to_2026-10-31` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 21/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-13/task-04-build-telemetry-export-adapter` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tạo gói Python đầu tiên của RCA engine (`aiops-platform/training/`, quản lý bằng uv) với lớp `telemetry/adapters`:

- Prometheus: lấy các metric cần cho feature (`lms_dependency_*`, HTTP server, process, RabbitMQ) bằng `query_range` theo cửa sổ `[start, end]` và bước cố định.
- Tempo: tìm trace theo cửa sổ rồi lấy từng trace **tuần tự**, có giới hạn số trace và khoảng nghỉ giữa các lần gọi vì Tempo bị giới hạn 512 MiB.
- Loki: lấy log theo `service_name` trong cửa sổ, phân trang theo thời gian khi chạm giới hạn dòng.
- CLI `export` ghi artifact theo run (Parquet cho bảng, JSON cho manifest) cùng manifest gồm `run_id`, cửa sổ UTC, truy vấn đã dùng, số bản ghi và cờ cắt bớt.

### Không thực hiện

- Không làm feature pipeline, detector hay ground truth (tuần 14 trở đi).
- Không lưu artifact telemetry vào Git.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: [analysis blueprint v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 3–4, [telemetry and ground-truth schema v1](../../../architecture/telemetry-and-ground-truth-schema-v1.md); một run thử từ task-02.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: retention 24 giờ, nên export ngay sau run; truy vấn Tempo dồn dập từng làm Tempo bị OOM (17/11/2026).

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Gói Python và adapter ba nguồn | Code | `aiops-platform/training/` |
| Unit test với HTTP giả lập ở tầng transport | Test | `aiops-platform/training/tests/` |
| Hướng dẫn chạy export | Docs | `aiops-platform/training/README.md` |

## Definition of Done

- [x] `uv run pytest` đạt; test không cần stack.
- [x] Export một run thử thật ra artifact có đủ ba modality và manifest; Tempo không bị khởi động lại trong lúc export.
- [x] Manifest ghi số trace bị cắt khi chạm giới hạn, không âm thầm bỏ.
- [x] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#77](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/77).
- Kết quả review: Chưa review (giai đoạn tự bắt kịp: review và merge theo ngoại lệ do Bách xác nhận).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 17/11/2026 — hoàn thành phần việc, mở PR #77, chuyển Chờ review.
- Ghi chú/tồn đọng: Run thử là `k6-level1-evidence-20261117` (PR #76). 4 worker chỉ có log probe nên modality log của worker trống sau khi lọc; task-05 báo là `not_instrumented`. CI GitHub bị khóa thanh toán; kiểm tra chạy cục bộ.
