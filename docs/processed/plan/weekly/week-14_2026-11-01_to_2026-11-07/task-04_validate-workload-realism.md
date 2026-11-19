# Task tuần: Báo cáo kiểm chứng độ thực của workload

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_validate-workload-realism` |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 24/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-14/task-04-validate-workload-realism` (PR #89), `feat/week-14/task-04-realism-rerun` (PR #91, đo lại trên code cuối) |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [ADR-007](../../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 2 và [workload-design-v1](../../../architecture/workload-design-v1.md) mục 10.4:

- Công cụ đo trên traffic thật của run (log phía server, quy request về thao tác theo route mẫu) và trên hold-out Moodle cùng một bộ đại lượng: số thao tác/phiên, thời lượng phiên, think time (KS, báo D), tỉ lệ loại thao tác (Jensen–Shannon), dáng theo giờ (Pearson), tỉ số đỉnh/trung bình, index of dispersion và Hurst của số request mỗi phút (`[L-Feitelson]`).
- Ba run cùng thời lượng và cùng tổng số phiên học viên: (a) mức 1 tốc độ hằng; (b) mức 2 thuần (phiên sinh từ bảng giả định); (c) bán thực (mức 2+).
- Báo cáo kiểm chứng (docs) ghi số đo, ngưỡng chốt trước (JSD < 0,05; KS D < 0,1; trung vị lệch < ±10%), kết luận trung thực; ngưỡng không đổi sau khi xem kết quả.

### Không thực hiện

- Không chỉnh tham số bằng hold-out.
- Không kiểm chứng giảng viên/admin bằng log Moodle (không có dữ liệu; dùng mục 10.1–10.3).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 (hold-out, phiên mức 2 thuần), task-02, task-03 (profile chạy được); k6 mức 1 (PR #76).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: ba run dài tốn giờ máy, chạy lần lượt; nếu phải rút ngắn run thì cả ba nguồn rút như nhau và ghi rõ. Mức 1 không có khái niệm phiên nên một số đại lượng đo theo "phiên đăng nhập" của VU; ghi rõ cách quy đổi.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Công cụ đo và so sánh | Code | `aiops-platform/load/tools/` |
| Báo cáo kiểm chứng độ thực | Docs | `docs/processed/architecture/workload-realism-report-v1.md` |

## Definition of Done

- [ ] Ba run có `run_id`, manifest và số đo; bảng so sánh với hold-out cho cả ba nguồn.
- [ ] Ngưỡng ghi trước khi chạy; kết luận nêu nguồn nào đạt/không đạt, không đổi ngưỡng.
- [ ] Unit test cho các phép đo (KS, JSD, Pearson, dispersion, Hurst) trên dữ liệu biết trước đáp án.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#89](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/89); [#91](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/91) (đo lại trên code cuối).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp; CI GitHub bị khóa thanh toán, kiểm tra chạy cục bộ, kết quả trong PR). Không có review ngoài GitHub cho PR này. PR #89 được Bách (người phụ trách) merge ngày 18/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 19/11/2026 — chạy lại ba run trên code workload đã merge (`ba2d7da`, TTL token 600 s; run `w14-t04-*-r2`) và cập nhật báo cáo. 18/11/2026: đã merge PR #89; ghi nhận hậu kiểm, chuyển Hoàn thành.
- Ghi chú/tồn đọng: Báo cáo [workload-realism-report-v1](../../../architecture/workload-realism-report-v1.md) là lần đo pilot: chưa nguồn nào đạt đủ ngưỡng chốt trước (bán thực 5/7). Lần đo lại 19/11/2026 trên code cuối cho số đo gần như trùng pilot: bán thực đạt 6/7 (chỉ trung vị thời lượng lệch −42% không đạt; KS D thời lượng 0,099 sát ngưỡng), vẫn chưa được kết luận "giống thật". Bản pilot ghi nhầm mức 2 thuần đạt 2/7, đúng là 1/7; đã sửa trong báo cáo.
