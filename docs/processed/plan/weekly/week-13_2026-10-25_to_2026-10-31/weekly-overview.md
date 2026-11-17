# Tổng quan tuần 13 — Thiết kế workload theo hành vi người dùng và lớp export telemetry

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-13_2026-10-25_to_2026-10-31` |
| Nguồn plan canonical | [Plan v0.3 — Tuần 13](../../plan-v0.3-24-weeks.md#tuần-13--thiết-kế-workload-theo-hành-vi-người-dùng-và-lớp-export-telemetry) |
| Mục tiêu tuần | Thiết kế workload mức 1 + 2 có nguồn cho tham số; k6 mức 1 cho W1–W7; LLM stub và proxy chèn trễ chạy trong Compose; lớp export Prometheus/Tempo/Loki theo run và cửa sổ thời gian; data dictionary, schema chuẩn hóa v2 và kiểm tra chất lượng dữ liệu trên một run thử. |
| Trạng thái tuần | Đang thực hiện |

> Tuần canonical là 25/10/2026–31/10/2026. Kế hoạch được lập và thực hiện từ 17/11/2026 (tuần lịch 16) vì giai đoạn tái cấu trúc kéo dài; hạn task bên dưới là mốc bù tiến độ, không đổi phạm vi milestone.

> **Ngoại lệ Gate R (17/11/2026).** Plan v0.3 mục 1 quy định không bắt đầu tuần 13 khi Gate R chưa đạt. Tại thời điểm lập kế hoạch, Gate R đạt 5/6 điều kiện; còn điều kiện 5 (Bách tự dựng stack từ máy sạch theo README và giải thích W1–W7). Bách (người phụ trách) xác nhận bắt đầu tuần 13 trước khi điều kiện 5 đạt, sau khi được cảnh báo. Lý do chấp nhận rủi ro: điều kiện 5 là kiểm chứng hiểu biết của người thực hiện, không thay đổi testbed; LMS đã đóng băng theo ADR-006. Điều kiện 5 vẫn phải hoàn tất và ghi bằng chứng trước khi đóng tuần 13; Gate R không bị cắt.

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_design-user-behavior-workload](task-01_design-user-behavior-workload.md) | Tài liệu thiết kế workload mức 1 + 2 theo hành vi người dùng, có nguồn cho tham số | Bách | Không có | Cao | Chờ review |
| [task-02_build-k6-level-one-journeys](task-02_build-k6-level-one-journeys.md) | k6 mức 1: các hành trình W1–W7 trên dữ liệu seed | Bách | Không có | Cao | Đã giao |
| [task-03_add-llm-stub-and-latency-proxies](task-03_add-llm-stub-and-latency-proxies.md) | LLM stub chỉnh được độ trễ/lỗi và proxy chèn trễ trước MinIO, `course-postgres` trong Compose | Bách | Không có | Cao | Chờ review |
| [task-04_build-telemetry-export-adapter](task-04_build-telemetry-export-adapter.md) | Adapter export Prometheus, Tempo, Loki theo run và cửa sổ thời gian | Bách | Không có | Cao | Đã giao |
| [task-05_define-data-dictionary-and-quality-check](task-05_define-data-dictionary-and-quality-check.md) | Data dictionary, schema chuẩn hóa v2 và data-quality check trên một run thử | Bách | Không có | Cao | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: task-03 cung cấp LLM stub cho hành trình W6 của task-02; task-04 cần traffic thật từ task-02 để export một run thử; task-05 chạy kiểm tra chất lượng trên artifact của task-04. Task-01 độc lập về code nhưng là nguồn tham số cho k6 mức 2 ở tuần 14.
- Rủi ro: tuần canonical đã qua 17 ngày; Tempo giới hạn 512 MiB bị OOM khi truy vấn dồn dập nên adapter phải truy vấn tuần tự và giới hạn số trace; telemetry chỉ giữ 24 giờ nên export phải chạy ngay sau run; máy ~15 GB RAM nên không chạy k6 tải cao song song với build/test.
- Quyết định đã chốt: giai đoạn Bách tự bắt kịp tiến độ, mọi task do Bách phụ trách, không có collaborator; review và merge theo ngoại lệ do Bách xác nhận, ghi trung thực trong card. LMS đóng băng: proxy và LLM stub đặt trong `aiops-platform/faults/` bằng file Compose bổ sung, không sửa code LMS. Phân tích viết bằng Python (uv), workload viết bằng k6 theo [analysis blueprint v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md).

## Thứ tự thực hiện đề xuất

1. Task-03 trước để có LLM stub và proxy; task-01 chạy song song vì chỉ là tài liệu.
2. Task-02 sau task-03; chạy k6 mức 1 trên stack đầy đủ có file fault overlay.
3. Task-04 dùng một run k6 mức 1 làm run thử để export.
4. Task-05 chạy data-quality check trên artifact của task-04.

## Tiêu chí kết thúc tuần

- [ ] Các task ưu tiên cao có trạng thái và bằng chứng được cập nhật.
- [ ] Các task hoàn thành đã liên kết đến PR và bằng chứng DoD.
- [ ] Gate R điều kiện 5 có bằng chứng của Bách (ngoại lệ ở trên được đóng).
- [ ] Tồn đọng và việc chuyển sang tuần 14 đã được ghi rõ.
