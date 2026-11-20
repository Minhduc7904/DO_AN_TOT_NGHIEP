# Task tuần: Pilot tìm `λ_knee` và chốt mức tải hai profile healthy

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_find-load-knee-and-freeze-profiles` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 21/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-02-find-load-knee-and-freeze-profiles` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [workload-design-v1](../../../architecture/workload-design-v1.md) mục 8.4 và [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1 (pilot được chốt workload rate):

- Scenario k6 tìm điểm gãy: chỉ scenario học viên pha `normal`, tốc độ đến không đổi trong mỗi bậc, tăng 0,2 phiên/s mỗi 3 phút cho tới khi vi phạm một tiêu chí "khỏe" của mục 8.4. Tốc độ cuối còn khỏe là `λ_knee`. Phiên lấy từ phần xây của log Moodle như mức 2+, cùng cách gán tài khoản theo phiên.
- Công cụ chấm tiêu chí "khỏe" theo cửa sổ 60 s (p95 Gateway, tỉ lệ phản hồi ngoài danh sách mong đợi, phiên bỏ ngang, `dropped_iterations`, CPU/bộ nhớ container, `unexpected_status`), đưa script chấm của task-03 tuần 14 vào repo thay vì để ngoài.
- Chốt mức tải: đỉnh `normal-mixed` ≤ 0,35 × `λ_knee`, đỉnh `healthy-spike` ≤ 0,8 × `λ_knee` (đổi sang cùng đơn vị phiên bắt đầu/s); nếu vượt thì hạ hệ số chồng phiên `k` cho cả hai profile; nếu còn dư nhiều thì ghi lại, không tự tăng. Đo RAM k6 ở đỉnh spike (còn trống < 4 GB thì hạ).
- Ghi kết quả: `λ_knee`, tiêu chí bị vi phạm đầu tiên, service/tài nguyên gây gãy, mức tải đã chốt và phiên bản profile (`normal-mixed@v…`, `healthy-spike@v…`) vào workload-design-v1 và README `load/`.

### Không thực hiện

- Không đổi tiêu chí "khỏe" sau khi xem kết quả; không tối ưu hiệu năng LMS (ADR-006 đóng băng testbed).
- Không chạy run dataset.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: profile và bộ phát mức 2+ (task-02/03 tuần 14, PR #85, #88, #90).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: điểm gãy có thể do chính máy (CPU host, k6) thay vì stack; phải phân biệt và ghi rõ. Tốc độ đến không đổi khác dáng tải thật, nên `λ_knee` chỉ là cận trên an toàn. Chạy trên stack có lớp fault (TTL 60 s) như run thí nghiệm.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Scenario tìm điểm gãy và công cụ chấm tiêu chí "khỏe" | Code | `aiops-platform/load/` |
| `λ_knee`, mức tải đã chốt và phiên bản profile | Docs | workload-design-v1 mục 8.4; README `load/` |

## Definition of Done

- [x] Có run tìm điểm gãy với `run_id`, bậc tải, tiêu chí bị vi phạm và nguyên nhân (stack hay máy).
- [x] Đỉnh hai profile được kiểm theo 0,35/0,8 × `λ_knee`; quyết định giữ hoặc hạ `k` có số đo đi kèm; phiên bản profile được ghi.
- [x] Công cụ chấm tiêu chí "khỏe" nằm trong repo, có unit test trên dữ liệu biết trước đáp án.
- [x] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#94](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/94)
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp; CI GitHub bị khóa thanh toán, unit test `load/` 55/55 chạy cục bộ, kết quả trong PR). Không có review ngoài GitHub; đã review bằng agent riêng. Bách (người phụ trách) xác nhận merge ngày 20/11/2026, card chuyển `Hoàn thành` trên chính nhánh của PR #94 trước khi merge.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 20/11/2026 — finalization, gộp `main` sau khi merge PR #93 (unit test `load/` 55/55, `experiments/` 15/15), merge PR #94. 19/11/2026: xong hai run tìm điểm gãy, chốt mức tải, mở PR.
- Kết quả:
  - `w15-t02-knee-r1` (0,2 → 5,0 phiên/s, 25 bậc, 1.000 học viên): LMS khỏe ở mọi bậc (p95 Gateway 37–40 ms, phản hồi ngoài mong đợi ≤ 0,24%, 0 iteration bị bỏ). Tiêu chí bị vi phạm đầu tiên: **bộ nhớ Grafana** 93–99% giới hạn 512 MiB ở bậc 1–8 (nguyên nhân `system`, stack observability, không ai mở UI). Nâng Grafana lên 768 MiB; tiêu chí giữ nguyên.
  - `w15-t02-knee-r2` (4,0 → 5,6 phiên/s, 9 bậc, 1.500 học viên để không dùng chung tài khoản): cả 9 bậc khỏe; Grafana cao nhất 74%.
  - `λ_knee` ≥ 5,6 phiên/s (cận dưới; điểm gãy thật của stack chưa tới, giới hạn đo là RAM của k6, ~4 GB cho ~1.260 VU).
  - `normal-mixed` đỉnh 1,18 ≤ 1,96; `healthy-spike` đỉnh 4,3 ≤ 4,48 → **giữ `k` = 4**; chốt `normal-mixed@v1` = `moodle-normal-mixed-k4-v1`, `healthy-spike@v1` = `moodle-healthy-spike-k4-v1`. RAM k6 ở đỉnh spike lấy từ run `w14-t03-healthy-spike-r4` (3,07 GiB, máy còn ≥ 5,1 GB).
  - Ghi ở workload-design-v1 mục 7.1, 8.1, 8.2, 8.4 và README `load/`.
- Thay đổi khác: scenario knee là một `ramping-arrival-rate` (mỗi bậc một scenario làm k6 dựng 11.948 VU); `health-check --steps` (bậc chưa chạy hết không chấm, bậc không có dữ liệu ghi `no_data`); VU dựng sẵn của giảng viên 30/60 và admin 6/10 (nguyên nhân thật của iteration bị bỏ ở run C2 task-01); tóm tắt knee tách phiên chồng tài khoản thật (`accounts_overlapping`) khỏi phiên chỉ thiếu khoảng đệm 30 s (`accounts_within_gap`).
- Review bằng agent riêng: sửa bộ chấm (OOM gán theo thời điểm, CPU của k6 so với số core máy, nguyên nhân `mixed`, cờ `lambda_knee_lower_bound`, đối soát iteration bị bỏ, `--sample-s`), tách `SharedArray` tài khoản để VU không giữ bản sao cả mảng (knee và profile), sửa vài số lệch nhỏ trong tài liệu.
- Ghi chú/tồn đọng: run tìm điểm gãy là pilot, không thuộc dataset. Ở task-03: kiểm VU học viên còn đủ khi fault làm phiên dài ra; kiểm lại bộ nhớ Grafana trên run dài ~50 phút (r2 chỉ 29 phút, Grafana còn tăng chậm cuối run).
