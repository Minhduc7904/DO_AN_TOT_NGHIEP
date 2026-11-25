# Task tuần: Cập nhật evaluation protocol bằng số đo pilot và chốt E7

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_update-evaluation-protocol-after-pilot` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 29/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-06-update-evaluation-protocol-after-pilot` (bảng task ghi tiền tố `docs/`; nhánh tạo với `feat/` vì có file cấu hình ứng viên `aiops-platform/training/configs/`) |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1 và [ADR-007](../../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md):

- Thay các placeholder "chưa kiểm chứng" bằng số đo của task-02, task-03, task-04, mỗi giá trị trỏ về `run_id` pilot đã đo: phase duration (warm-up, pre-fault, fault active, recovery), workload rate và phiên bản profile, cường độ và thời gian active tối thiểu của từng case, độ trễ triệu chứng/khoảng yên lặng (mục 7.3, gồm C6 với TTL 60 s), timeout margin, độ trễ thu thập theo modality, ngưỡng data-quality, luật lọc nhiễu, slot cao điểm, case nào đủ điều kiện vào campaign (mục 5.2).
- Ghi rõ giá trị nào vẫn để validation chọn (window/persistence trong tập ứng viên, threshold) và tập ứng viên đã khai báo.
- **Ghi quyết định E7 (Target) vào protocol:** Bách xác nhận ngày 19/11/2026 không có người tham gia ngoài hai thành viên nhóm. Hai thành viên đã xây testbed và biết case, ground truth nên không làm người tham gia hợp lệ (kết quả sẽ thiên lệch). Theo mục 15.3, E7 ra khỏi kế hoạch; ghi quyết định, lý do vào evaluation-protocol mục 15.3 và cập nhật plan v0.4 (mục 7, M5) cho nhất quán. RQ6 dựa trên E1, E2, E4 với `base-manual-auto`.
- Cập nhật các tài liệu trỏ tới giá trị vừa chốt (workload-design-v1, telemetry-and-ground-truth-schema-v1, README `faults/`) cho nhất quán.

### Không thực hiện

- Không đụng tới test set, không freeze campaign manifest (tuần 19), không đổi metric hay tiêu chí đã chốt trước.
- Không chọn giá trị bằng kết quả detector/RCA.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-02, task-03 (số đo pilot), task-04 (dataset v0), task-07 (kết luận độ thực v2).
- Người hoặc phần việc cần phối hợp: không có (quyết định E7 đã có từ Bách).
- Rủi ro/giả định: protocol v1 dài (~150 KB); cập nhật theo mục, có bảng "giá trị đã chốt sau pilot" để tránh sót.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Evaluation protocol cập nhật sau pilot (phiên bản mới hoặc mục ghi nhận cập nhật) | Docs | `docs/processed/architecture/evaluation-protocol-v1.md` |
| Quyết định E7 | Docs | evaluation-protocol mục 15.3; plan v0.4 nếu đổi phạm vi |

## Definition of Done

- [x] Mọi placeholder pilot được phép chốt ở mục 6.1 có giá trị và `run_id` nguồn, hoặc ghi lý do vẫn để mở.
- [x] Tập giá trị để validation chọn được khai báo trước khi chạy validation. (Tập này được chốt trước mọi fault run validation và trước mọi feature hay detector trên validation. Hai run healthy validation đã chạy trước đó, và luật nhận (2) của bảng F được đặt sau khi xem thống kê export của run `healthy-spike`; protocol mục 6.1.1 ghi rõ việc này.)
- [x] Quyết định đưa E7 ra khỏi kế hoạch được ghi trong protocol và plan v0.4 kèm lý do.
- [x] Tài liệu liên quan không còn giá trị mâu thuẫn với bản đã chốt.
- [x] PR mở vào `main`; URL PR ghi vào card. (PR #99 xếp chồng trên PR #97; sẽ vào `main` khi các PR trước được merge.)

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#99](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/99) (mở xếp chồng trên PR #97; đổi base sang `main` sau khi PR #97 merge).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp). Đã review bằng agent riêng; các phát hiện đã sửa trong PR (xem mô tả PR). CI GitHub đạt trước khi merge. PR #99 được Bách (người phụ trách) merge ngày 25/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — đã merge PR #99; ghi nhận hậu kiểm, chuyển Hoàn thành. 24/11/2026 — [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md):
  - Mục 6.1.1: bảng giá trị chốt sau pilot, mỗi giá trị kèm `run_id` nguồn. Bảng F là luật nhận run `partial`, khớp bộ kiểm `eligibility.v1` của task-04.
  - Mục 6.1.2: tập ứng viên và luật chọn trên validation, commit 23/11/2026 (cuối cùng 21:20 +07), trước mọi fault run validation và trước khi tính feature hay chạy detector trên run validation.
  - Mục 27: các giá trị còn mở và lý do.
  - Quyết định đưa E7 ra khỏi kế hoạch được ghi trong protocol và plan v0.4.
  - Các dòng chờ kết quả đã điền số của dataset v0 (task-04) và độ thực v2 (task-07).
- Ghi chú/tồn đọng:
  - Nhánh gộp task-04 (dataset manifest, eligibility), nên PR xếp chồng lên PR task-04.
  - Hai run healthy validation (09:18Z và 12:33Z ngày 23/11) chạy trước thời điểm chốt cuối 14:20Z. Luật (2) của bảng F (nhận run healthy bỏ trace vì ngân sách) được đặt sau khi xem thống kê export của run `healthy-spike`. Đây là luật chất lượng dữ liệu, không chọn theo kết quả phát hiện; protocol ghi rõ thứ tự này.
  - Tài liệu liên quan đã sửa cho khớp: blueprint mục 7.1 và config mẫu (giá trị minh họa, trỏ về mục 6.1.2), E7 trong blueprint, plan v0.4 và protocol. Trạng thái ngưỡng silent trong data dictionary mục 10 được cập nhật ở PR task-05 (cùng file).
