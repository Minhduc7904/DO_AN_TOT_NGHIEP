# Task tuần: Chốt chiến lược dữ liệu bán thực và bằng chứng đóng góp của AI/RCA, rà soát tài liệu

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_adopt-semi-real-data-strategy` |
| Tuần | `week-13_2026-10-25_to_2026-10-31` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 18/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `docs/week-13/task-06-adopt-semi-real-data-strategy` |

## Yêu cầu và phạm vi

### Cần thực hiện

Task phát sinh sau khi xong phần việc tuần 13 (17/11/2026): Bách yêu cầu nghiên cứu kỹ (có tra cứu SOTA) hai điểm quyết định phản biện — (1) chứng minh AI/RCA đóng góp thực sự, (2) dữ liệu phải trông thực tế, không giả lập hoàn toàn — rồi cập nhật tài liệu cho khớp:

- ghi quyết định thành [ADR-007](../../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) (workload bán thực mức 2+, bộ bằng chứng E1–E8, đăng ký trước);
- lập [plan-v0.4](../../plan-v0.4-24-weeks.md) thay plan-v0.3 (khung 24 tuần và các mốc không đổi);
- rà soát toàn bộ tài liệu canonical và cập nhật chỗ lệch với ADR-007, trạng thái code tuần 13 và các phát hiện kỹ thuật;
- tạo danh mục tài liệu tham khảo [literature-matrix-v1](../../literature-matrix-v1.md); ghi reference (bài báo, URL) ở mọi đoạn dùng kết quả nghiên cứu, phục vụ viết báo cáo;
- đưa `docs/processed/explanations-v2/` lên Git (trước đây exclude cục bộ), rà soát lại, thêm thư mục `research-defense/` giải thích dễ hiểu phần nghiên cứu kèm tài liệu tải về (chỉ commit PDF có giấy phép mở vì repo public).

### Không thực hiện

- Không viết code workload mức 2+ hay baseline mới (tuần 14, 17).
- Không sửa tài liệu lịch sử đã có bản thay thế, `docs/raw/`, `workspace/duc/`.
- Không commit log Moodle hay PDF không có giấy phép phân phối lại.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01…task-05 tuần 13 (PR #75–#79); đề xuất [realism-and-ai-contribution-strategy-v1](../../../direction/realism-and-ai-contribution-strategy-v1.md).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: tài liệu mô tả trạng thái code của các PR tuần 13 chưa merge; PR này merge sau #78, #75, #76, #77, #79.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| ADR-007 | Docs | `docs/processed/adr/adr-007-semi-real-workload-and-ai-evidence-v1.md` |
| Plan v0.4 | Docs | `docs/processed/plan/plan-v0.4-24-weeks.md` |
| Literature matrix v1 | Docs | `docs/processed/plan/literature-matrix-v1.md` |
| Tài liệu canonical cập nhật | Docs | `docs/processed/architecture/`, `direction/`, README |
| Ghi chú giải thích v2 + thư mục nghiên cứu | Docs | `docs/processed/explanations-v2/`, `docs/processed/explanations-v2/research-defense/` |

## Definition of Done

- [x] ADR-007 và plan-v0.4 có hiệu lực; plan-v0.3 có banner "đã được thay thế".
- [x] Các tài liệu canonical chịu ảnh hưởng có banner ADR-007 và không còn đoạn mâu thuẫn đã biết.
- [x] Mọi đoạn dùng kết quả nghiên cứu có reference (khóa `[L-…]` + URL).
- [x] `explanations-v2/` được Git theo dõi, đã rà soát, có `research-defense/`; PDF commit đều có giấy phép mở.
- [x] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#80](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/80) (merge sau #78, #75, #76, #77, #81; #81 thay #79 bị merge nhầm vào nhánh task-04).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp). Finalization và merge theo ngoại lệ do Bách (người phụ trách) yêu cầu ngày 17/11/2026.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 17/11/2026 — finalization, chuyển Hoàn thành theo yêu cầu merge của Bách.
- Ghi chú/tồn đọng: Không có.
