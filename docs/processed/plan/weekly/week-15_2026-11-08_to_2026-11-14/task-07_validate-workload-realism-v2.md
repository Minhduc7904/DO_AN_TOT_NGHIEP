# Task tuần: Kiểm chứng độ thực v2 — đăng ký tiêu chí trước, nhiều seed

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-07_validate-workload-realism-v2` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 21/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-07-validate-workload-realism-v2` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [workload-realism-report-v1](../../../architecture/workload-realism-report-v1.md) mục 5 và 8, [ADR-007](../../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 2 và 4. Lần đo `r2` (19/11/2026): bán thực đạt 6/7 tiêu chí v1, trượt trung vị thời lượng phiên (−42%), KS D thời lượng 0,099 sát ngưỡng 0,1; hai nửa của chính log Moodle cũng lệch trung vị −37%.

- **Đăng ký tiêu chí v2 trước khi chạy:** viết phiên bản tiêu chí mới cho thời lượng phiên kèm lý do (ví dụ chỉ dùng KS D, hoặc lấy mốc là độ lệch giữa phần xây và hold-out của log), commit và push lên nhánh của task trước run đầu tiên, để thời điểm commit trên GitHub chứng minh tiêu chí có trước kết quả. Ghi rõ lý do được rút ra sau khi xem pilot. Tiêu chí v1 giữ nguyên và vẫn được báo cáo.
- **Nhiều seed:** ít nhất 3 run bán thực (mức 2+) `normal-mixed` với seed khác nhau, TTL token 600 s như `r2`; báo khoảng tin cậy hoặc dao động giữa seed cho các đại lượng có ngưỡng, nhất là KS D thời lượng.
- Công cụ `validate-realism.mjs` chấm được cả v1 và v2 (ngưỡng có phiên bản trong code), có test.
- Báo cáo kết luận theo cả v1 và v2; chỉ được viết "giống thật" nếu đạt điều kiện của phiên bản tiêu chí tương ứng.

### Không thực hiện

- Không đổi tiêu chí v1, không xóa số đo cũ.
- Không chọn tiêu chí v2 sau khi xem kết quả của các run mới.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: báo cáo độ thực v1 và run `r2` (PR #89, #91).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: mỗi run 48 phút; đổi TTL phải tạo lại `identity` nên không chạy chồng với run thí nghiệm (TTL 60 s); trả TTL 60 s sau khi xong.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Tiêu chí v2 (đăng ký trước) | Docs | `docs/processed/architecture/workload-realism-report-v1.md` hoặc báo cáo v2 |
| Bộ chấm có phiên bản tiêu chí | Code | `aiops-platform/load/tools/` |
| Báo cáo độ thực theo v1 và v2, nhiều seed | Docs | `docs/processed/architecture/` |

## Definition of Done

- [ ] Commit tiêu chí v2 đã push có thời điểm trước run đầu tiên của task.
- [ ] Ít nhất 3 run bán thực với seed khác nhau có `run_id`, manifest, `dropped_iterations` 0.
- [ ] Báo cáo có bảng theo v1 và v2, dao động giữa seed, kết luận trung thực.
- [ ] Test cho bộ chấm v1/v2 đạt.
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
