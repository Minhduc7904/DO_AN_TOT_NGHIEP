# Checklist Gate M3 (tuần 15)

> **Task:** [`task-08_verify-gate-m3`](task-08_verify-gate-m3.md).
>
> **Trạng thái:** checklist viết và push **trước** run đầu tiên của Gate (23/11/2026). Cột kết quả điền sau khi chạy; không sửa tiêu chí sau khi đã chạy.
>
> **Ngoại lệ một người:** plan v0.4 tuần 15 yêu cầu hai thành viên đổi case cho nhau, đều chạy, reset, export và xác nhận ground truth độc lập. Trong giai đoạn Bách tự bắt kịp (plan v0.4 mục 0.1, dòng "Nhân sự"), Gate do một người làm: dựng lại từ môi trường sạch chỉ theo runbook, và xác nhận ground truth bằng một công cụ độc lập với code ground truth. Đây là ngoại lệ, không phải Gate M3 đầy đủ.

## Cách làm

- **Môi trường sạch:** worktree mới `wt-w15-t08`, tạo từ nhánh task-03 (`eeeb714`, có fault manifest v2), không có `node_modules`, `.venv`, `docker-compose/.env`, dữ liệu Moodle hay kế hoạch phiên. Chỉ làm theo [experiment runbook](../../../../../aiops-platform/experiments/README.md#runbook) và các tài liệu nó trỏ tới.
- **Stack sạch:** mỗi run, runner tự `docker compose down --volumes` rồi `up --build -d --wait` stack đầy đủ cùng lớp fault, nạp lại dữ liệu seed `small`/42 (runbook, bảng bước). Không dùng stack đang chạy sẵn, không dùng run của task-03/task-04 làm bằng chứng.
- **Run:** mỗi case C2, C3, C4, C6 một fault run, spec ở `aiops-platform/experiments/specs/gate-m3/` (split `pilot`, seed 31–34, `normal-mixed`, lịch mặc định của fault manifest v2).
- **Xác nhận ground truth độc lập:** ngay sau mỗi run, trước khi run sau reset stack, chạy `aiops-platform/experiments/verify-raw-ground-truth.mjs <run>`. Công cụ viết bằng JavaScript, không gọi `aiops_training` (code ground truth bằng Python), truy vấn thẳng Prometheus/Tempo/Loki và ghi truy vấn cùng số đo vào `raw-verification.json` của run.

## Checklist

| # | Mục kiểm | Tiêu chí đạt | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- |
| 1 | Chuẩn bị theo runbook mục 1 | `cp docker-compose/.env.example docker-compose/.env`, `uv sync`, `pnpm install --frozen-lockfile` chạy không lỗi | | |
| 2 | Dữ liệu phiên Moodle dựng lại từ nguồn công khai | `fetch-moodle-log.sh` khớp md5 + sha256; `moodle-to-sessions.mjs`, `build-replay-plan.mjs` cho kế hoạch có sha256 trùng `plan_sha256` trong ledger của các run trước | | |
| 3 | Preflight | `free -h` available ≥ 4 GB trước mỗi run; runner không từ chối | | |
| 4 | Reset sạch mỗi run | `reset.json` ghi `down --volumes`, `up --build --wait` thành công, fingerprint stack có đủ service | | |
| 5 | Dữ liệu seed | `seed-report.json` có; gate thực thi không có `seed_data_failed` | | |
| 6 | Run C2 | `status = completed`; gate thực thi `pass`; chất lượng `pass`/`partial`; `RunGroundTruth` `valid` với `verification_checks` đạt | | |
| 7 | Run C3 | như mục 6 | | |
| 8 | Run C4 | như mục 6 | | |
| 9 | Run C6 | như mục 6 | | |
| 10 | Export và quality report | Mỗi run có `telemetry/` (metrics, spans, logs Parquet, `manifest.json`, `quality-report.json`) | | |
| 11 | Ground truth khớp nhật ký fault | `fault_start`/`fault_end` lệch `ts` của `fault.activate`/`fault.deactivate` thành công ≤ 1 ms; thành phần gốc trùng `fault.scheduled` và fault manifest v2 (cả 4 run) | | |
| 12 | Ground truth khớp telemetry thô | Mọi kiểm Prometheus/Tempo/Loki của `verify-raw-ground-truth.mjs` đạt ở cả 4 run (latency thành phần gốc ≥ 2 × trước fault và lệch đầu tiên nằm trong cửa sổ fault với C2/C3/C4; CPU `identity` đứng yên, lỗi token của gateway tăng, span và log lỗi token chỉ có trong fault với C6) | | |
| 13 | Ledger | Mỗi run có `run.started` và `run.finished` | | |
| 14 | Runbook | Mọi bước thiếu/sai phát hiện khi làm được sửa trong runbook và ghi ở mục dưới | | |

**Gate M3 (ngoại lệ một người) đạt** khi mục 1–13 đạt. Run không đạt vì lỗi môi trường được chạy lại bằng spec mới (`replacement_for_run_id`) và ghi lại; không chạy lại vì kết quả kiểm ground truth.

## Sửa runbook

(điền khi làm)

## Kết quả

(điền sau khi chạy)
