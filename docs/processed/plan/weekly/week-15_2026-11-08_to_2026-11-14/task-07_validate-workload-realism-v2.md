# Task tuần: Kiểm chứng độ thực v2 — tiêu chí theo dao động tự nhiên, đăng ký trước

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-07_validate-workload-realism-v2` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 21/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-07-validate-workload-realism-v2` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [workload-realism-report-v1](../../../architecture/workload-realism-report-v1.md) mục 5 và 8, [ADR-007](../../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 2 và 4. Lần đo `r2` (19/11/2026): bán thực đạt 6/7 tiêu chí v1, trượt trung vị thời lượng phiên (−42%), KS D thời lượng 0,099 sát ngưỡng 0,1; hai nửa của chính log Moodle cũng lệch trung vị −37%.

- **Đăng ký tiêu chí v2 trước khi chấm:** tiêu chí "nằm trong dao động tự nhiên của dữ liệu thật" — nhiều nhóm ngày thật của phần xây làm phân phối tham chiếu, nguồn đạt khi không lệch hold-out nhiều hơn 95% nhóm ngày thật (xét cả bảy đại lượng cùng lúc). Tài liệu đăng ký và mã chấm được push lên nhánh của task trước khi chấm bất kỳ run nào theo v2, để thời điểm commit trên GitHub chứng minh tiêu chí có trước kết quả. Ghi rõ v2 được nghĩ ra sau khi xem pilot. Tiêu chí v1 giữ nguyên và vẫn được báo cáo.
- **Không chạy nhiều seed trên cùng kế hoạch:** đổi `workload_seed` chỉ đổi cách gán tài khoản, phiên phát lại vẫn từ cùng file kế hoạch (r1 và r2 khác code và TTL mà KS D thời lượng chỉ đổi 0,101 → 0,099), nên không đo được dao động. Dao động thật nằm ở nhóm ngày log, và v2 đã đưa nó vào phân phối tham chiếu.
- Chấm ba run `r2` theo v1 và v2 (ghi là chấm sau khi xem dữ liệu).
- **Bằng chứng chính:** chấm phần traffic học viên của mọi run train/validation của dataset v0 (task-04) theo v1 và v2; báo tỉ lệ run đạt.
- Công cụ `validate-realism.mjs` chấm được cả v1 và v2, có test.
- Báo cáo kết luận theo cả v1 và v2; chỉ được viết "giống thật" nếu đạt điều kiện của phiên bản tiêu chí tương ứng.

### Không thực hiện

- Không đổi tiêu chí v1, không xóa số đo cũ.
- Không đổi tiêu chí v2 sau khi xem kết quả; muốn đổi thì viết v3 theo cùng quy trình.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: báo cáo độ thực v1 và run `r2` (PR #89, #91); run dataset v0 (task-04) cho bằng chứng chính.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: không cần run riêng; run dataset dùng TTL 60 s (khác `r2` 600 s), ghi khác biệt trong báo cáo. Task kết thúc sau task-04.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Tiêu chí v2 (đăng ký trước) | Docs | `docs/processed/architecture/workload-realism-criteria-v2.md` |
| Bộ chấm có phiên bản tiêu chí | Code | `aiops-platform/load/tools/` |
| Báo cáo độ thực theo v1 và v2, trên run dataset v0 | Docs | `docs/processed/architecture/` |

## Definition of Done

- [x] Commit tiêu chí v2 đã push có thời điểm trước run đầu tiên của task.
- [x] Ba run `r2` và mọi run train/validation của dataset v0 được chấm theo v1 và v2.
- [x] Báo cáo có bảng theo v1 và v2, tỉ lệ run đạt v2, kết luận trung thực.
- [x] Test cho bộ chấm v1/v2 đạt.
- [x] PR mở vào `main`; URL PR ghi vào card. (PR #98 xếp chồng trên PR #97 vì bằng chứng chính cần dataset v0; sẽ vào `main` khi các PR trước được merge.)

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#98](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/98) (mở xếp chồng trên PR #97; đổi base sang `main` sau khi PR #97 merge).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp). Đã review bằng agent riêng; các phát hiện đã sửa trong PR (xem mô tả PR). CI GitHub đạt trước khi merge. PR #98 được Bách (người phụ trách) merge ngày 25/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — đã merge PR #98; ghi nhận hậu kiểm, chuyển Hoàn thành. 24/11/2026 — chấm 10 run train/validation của dataset v0 theo v1 và v2 ([báo cáo](../../../architecture/workload-realism-report-v1.md) mục 11–12). Kết quả: 10/10 run đạt v2 (4/4 nhóm ngày khác nhau), 0/10 đạt v1. Được viết "traffic học viên bán thực `normal-mixed` giống thật theo v2", kèm bốn giới hạn ở mục 12: (1) với bán thực, v2 chỉ kiểm bộ phát và nhóm ngày; (2) dáng theo giờ của nhóm validation nằm ngoài dải; (3) 1/4 ngày của mỗi nhóm đã nằm trong kế hoạch `r2`; (4) chỉ có 2 nhóm ngày độc lập, và phép so với nguồn đơn giản là chấm sau khi xem dữ liệu. `healthy-spike` đạt v2 nhưng chưa viết "giống thật", vì chưa có run mức 1 và mức 2 thuần ở profile này. Trước đó (19/11/2026): tiêu chí v2 và mã chấm được push ở commit `602230b` (15:18 +07) trước khi chấm. Chấm lại `r2`: bán thực đạt v2 (điểm 0,490, `tau` 0,986), mức 2 thuần và mức 1 không đạt (mục 10).
- Ghi chú/tồn đọng:
  - Nhánh gộp task-04 để có dataset v0, nên PR xếp chồng lên PR task-04.
  - Bổ sung sau khi hoàn thành (25/11/2026, theo yêu cầu của Bách; trạng thái giữ `Hoàn thành`): run mức 1 và mức 2 thuần ở `healthy-spike`, cấu hình và luật đăng ký trước ở commit `53b9f9a`. Cả hai có điểm v2 1,000 > 0,919, nên được viết "traffic học viên bán thực `healthy-spike` giống thật theo tiêu chí v2" kèm giới hạn ([báo cáo](../../../architecture/workload-realism-report-v1.md) mục 11, phần bổ sung, và mục 12). Nhánh `feat/week-15/task-07-healthy-spike-simple-sources`, PR riêng (cách dùng nhánh bổ sung giống PR #90 của task-03 tuần 14).
  - 19/11/2026 — đổi cách làm: bỏ 3 run nhiều seed trên cùng kế hoạch (không đo được dao động), thay bằng tiêu chí v2 lấy mốc từ dao động của nhóm ngày thật và chấm trên run dataset v0.
