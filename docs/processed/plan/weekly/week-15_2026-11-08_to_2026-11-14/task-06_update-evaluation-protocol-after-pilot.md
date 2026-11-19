# Task tuần: Cập nhật evaluation protocol bằng số đo pilot và chốt E7

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_update-evaluation-protocol-after-pilot` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 29/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `docs/week-15/task-06-update-evaluation-protocol-after-pilot` |

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

- [ ] Mọi placeholder pilot được phép chốt ở mục 6.1 có giá trị và `run_id` nguồn, hoặc ghi lý do vẫn để mở.
- [ ] Tập giá trị để validation chọn được khai báo trước khi chạy validation.
- [ ] Quyết định đưa E7 ra khỏi kế hoạch được ghi trong protocol và plan v0.4 kèm lý do.
- [ ] Tài liệu liên quan không còn giá trị mâu thuẫn với bản đã chốt.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 19/11/2026 — lập card.
- Ghi chú/tồn đọng:
