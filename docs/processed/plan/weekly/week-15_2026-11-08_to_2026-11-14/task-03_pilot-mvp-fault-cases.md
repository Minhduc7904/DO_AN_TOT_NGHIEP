# Task tuần: Pilot 4 case MVP và chốt cường độ, thời lượng fault

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_pilot-mvp-fault-cases` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 25/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-03-pilot-mvp-fault-cases` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [plan v0.4 tuần 15](../../plan-v0.4-24-weeks.md#tuần-15--experiment-runner-pilot-và-dataset-v0), [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 5.2, 5.3, 6.1, 7.3, 8.4 và [case catalogue v0](../../../architecture/complex-case-catalogue-and-rca-result-v0.md):

- Chạy qua runner (task-01), seed pilot (1–999), profile `normal-mixed` ở mức tải đã chốt (task-02):
  - một run healthy pilot;
  - mỗi case C2, C3, C4, C6 một fault run với lịch mặc định của fault manifest;
  - mỗi case thêm một fault run có cửa sổ fault trùng cao điểm tải (`--align-peak`), ít nhất một run trên profile `healthy-spike`.
- Với từng case, kiểm năm điều kiện vào campaign (mục 5.2) và ghi `case_verification_status`:
  - triệu chứng ngoài đường request của nguyên nhân quan sát được thật (ví dụ C4 lộ ở `scheduler-worker`, C6 lỗi `gateway-identity-token` sau khoảng yên lặng);
  - tín hiệu bắt buộc của bảng 8.4 có mặt; thiếu thì ghi limitation;
  - `RunGroundTruth` hợp lệ và `verification_checks` đạt;
  - đo độ trễ từ `fault_start` tới triệu chứng đầu tiên (mục 7.3).
- Sửa đến khi chuỗi nhân quả chạy thật; nếu không được thì mô tả lại case theo cái đo được hoặc loại khỏi nhóm "case phức tạp", ghi lý do vào ledger (plan v0.4 mục 8), không âm thầm bỏ. Trường hợp đã biết: C3 có thể thiếu job AI trong cửa sổ fault → tăng tỉ lệ goal I3 hoặc số phiên giảng viên **cho mọi run** (workload-design-v1 mục 8.5), không chỉ fault run.
- Chốt và version hóa (fault manifest v2): cường độ, thời lượng fault active (lớn hơn độ trễ triệu chứng + window + persistence), warm-up, recovery, slot cao điểm.
- Quyết định có cần profile healthy đối chứng `upload media peak healthy` (C4) và `AI job healthy` (C3) (workload-design-v1 mục 8.3) theo số đo pilot; ghi lý do.

### Không thực hiện

- Không chạy run validation/test; pilot run không dùng cho metric cuối (mục 6.1).
- Không làm C1, C5, C7 (Target, ngoài phạm vi tuần) và không sửa code LMS.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 (runner), task-02 (mức tải); fault manifest v1 (task-05 tuần 14).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: khoảng 10 run pilot × gần 1,5 giờ máy mỗi run; nếu sửa case phải chạy lại thì thêm run. Độ trễ lộ của C4 có thể dài hơn cửa sổ run 48 phút cho phép; khi đó ghi giới hạn và cân nhắc dời slot fault.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Fault manifest v2 với tham số đã chốt sau pilot | Code | `aiops-platform/faults/manifests/` |
| Báo cáo pilot: mỗi case chuỗi nhân quả, tín hiệu, độ trễ triệu chứng, quyết định | Docs | `docs/processed/architecture/fault-pilot-report-v1.md` |
| Run pilot trong ledger | Bằng chứng | Ledger của runner; mô tả PR |

## Definition of Done

- [x] Mỗi case có fault run pilot ở lịch mặc định và ở cao điểm; mỗi run có `RunGroundTruth` và dòng ledger.
- [x] Mỗi case có `case_verification_status` theo năm điều kiện mục 5.2, kèm bằng chứng (truy vấn, số đo) hoặc lý do loại/mô tả lại.
- [x] Độ trễ triệu chứng của từng case được đo; thời lượng fault active đã chốt lớn hơn độ trễ đó cộng window và persistence.
- [x] Fault manifest v2 có tham số đã chốt và test; quyết định về profile đối chứng có lý do.
- [x] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#95](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/95).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp). Đã review bằng agent riêng; các phát hiện đã sửa trong PR (xem mô tả PR). CI GitHub đạt trước khi merge. PR #95 được Bách (người phụ trách) merge ngày 25/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — đã merge PR #95; ghi nhận hậu kiểm, chuyển Hoàn thành. 23/11/2026 — chạy xong 9 run pilot (20/11 và 23/11), chốt fault manifest v2, hoàn tất [báo cáo pilot](../../../architecture/fault-pilot-report-v1.md).
- Kết quả: cả 4 case `case_verification_status = run`; C3 tăng thời lượng fault lên 900 s; C4 bỏ chuỗi job dọn media khỏi mô tả; không thêm profile healthy đối chứng.
- Sửa môi trường trong lúc pilot: Tempo 1,5 GiB (OOM khi export), tắt tự nâng plugin của Grafana, tiêu chí bộ nhớ mục 8.4 đo bằng `anon` của cgroup; bộ đo triệu chứng `aiops-training symptoms`.
- Ghi chú/tồn đọng:
  - C2 ở cao điểm `healthy-spike` làm cạn pool `course` (75–81% request lỗi 504); dataset v0 không đặt fault trên profile spike nên chưa ảnh hưởng.
  - Trace `truncated` ở mọi run (16/129 truy vấn chạm giới hạn) là giới hạn đã biết của export.
