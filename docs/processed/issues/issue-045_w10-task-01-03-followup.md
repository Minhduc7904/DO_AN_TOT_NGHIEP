# Issue #45: W10: blocker cho task-05 và tồn đọng sau review task-01/02/03

> Nguồn: [issue #45 trên GitHub](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/45). Ticket này tóm tắt trạng thái xử lý; chi tiết báo lỗi nằm ở issue gốc.

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Issue GitHub | [#45](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/45) |
| Trạng thái | Đã fix |
| Mức độ | Chặn (1 hạng mục chặn task-05), còn lại không chặn |
| Nhãn GitHub | `bug`, `documentation` |
| Người báo | bachmk |
| Ngày mở | 22/10/2026 |
| Người xử lý | Theo PR fix |
| Nhánh fix | `fix/week-10/task-03-export-service-metrics-followup` |
| PR fix | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) (`Closes #45`) |

## Mô tả

Review độc lập W10 task-01/02/03 (PR #41, #42, #43) cho thấy về kỹ thuật cả ba task đạt DoD, nhưng có một blocker cho task-05: series metric của broker RabbitMQ mang `service.name=notification` cùng `service.version` và `service.instance.id` giả, trái schema telemetry. Kèm theo là các tồn đọng về shutdown, credential Grafana và hồ sơ.

## Hạng mục và trạng thái

Trạng thái lấy từ mô tả [PR #46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) (mục "Sau thay đổi"). Chưa tự kiểm lại từng dòng code khi lập ticket.

| Mã | Hạng mục | Trạng thái | PR |
| --- | --- | --- | --- |
| 01 | **Blocker task-05:** series broker RabbitMQ gắn identity giả của Notification (`otel-collector.yaml`) | Đã fix | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| 02 | GitGuardian fail khi merge PR #41: fallback `grafana-local-only` trong `compose.yaml` | Đã fix (bỏ fallback, bắt buộc `GRAFANA_ADMIN_PASSWORD`) | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| 03 | Shutdown app và telemetry chạy song song (`main.ts` của 8 runtime) | Đã fix (`app.close().finally(() => telemetry.shutdown())`) | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| 04 | Mô tả PR #42, #43 vỡ template; checkbox CI head chưa cập nhật | Đã fix (sửa mô tả trên GitHub) | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| 05 | Text mất khoảng trắng trong tài liệu vận hành và hồ sơ task-01..03 | Đã fix | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| 06 | Trích dẫn CI task-01, ghi nhận review task-02, đóng góp collaborator, trễ hạn | Đã fix (mục "Hậu kiểm theo issue #45" trong hồ sơ task-01..03) | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| 07 | Ghi chú cho task-04: log processor/exporter dùng transport chung, `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`, kiểm Loki theo `trace_id` | Chưa xác minh (thuộc phạm vi task-04; PR [#47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47)) | — |
| 08 | Ghi chú cho task-05: `tracesToLogsV2`/`derivedFields`, loại `submission-storage` và `/health` khỏi panel | Chưa xác minh (thuộc phạm vi task-05; PR [#49](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/49)) | — |

## Còn lại hoặc ngoài phạm vi

- Đánh dấu false positive cho incident GitGuardian trên dashboard GitGuardian: cần người có quyền workspace GitGuardian, không thể làm trong repository (theo mục "Kiểm tra đã chạy" của PR #46).
- Hạng mục 07 và 08 được giao cho task-04/05, không thuộc PR #46.

## Lịch sử trạng thái

| Ngày | Trạng thái | Ghi chú |
| --- | --- | --- |
| 22/10/2026 | Chưa fix | Issue được mở |
| 23/10/2026 | Đã fix | Issue đóng bởi PR #46 |
