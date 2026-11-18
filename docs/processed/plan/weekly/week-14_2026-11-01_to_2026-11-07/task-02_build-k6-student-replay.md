# Task tuần: k6 mức 2+ — phát lại phiên học viên

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_build-k6-student-replay` |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 21/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-14/task-02-build-k6-student-replay` |

## Yêu cầu và phạm vi

### Cần thực hiện

Scenario học viên của k6 phát lại từng phiên trong file phiên (task-01), theo [workload-design-v1](../../../architecture/workload-design-v1.md) mục 7.7, 11, 13:

- Nạp file phiên bằng `SharedArray`; mỗi iteration phát một phiên; thao tác gọi API qua thư viện của `aiops-platform/load/` (PR #76).
- Lịch bắt đầu phiên lấy từ ngày được chọn trong log: nén một ngày còn 48 phút, chồng phiên với hệ số `k` ghi vào manifest. Quyết định khi làm (18/11/2026): dùng **giờ bắt đầu thật** của log ở độ phân giải 30 s thay vì sinh Poisson trong mỗi "giờ" như plan v0.4 — giữ quá trình đến thật (Poisson của `[L-PaxsonFloyd]` là mô hình xấp xỉ quá trình đến thật); độ dao động (index of dispersion, Hurst) được đo ở task-04. Think time giữ như log (kẹp trần theo tham số, có ghi).
- Gán cố định người dùng Moodle → tài khoản seed và khóa Moodle → khóa seed theo `workload_seed`.
- Phản ứng với phản hồi (mục 6): thử lại 5xx có backoff, đăng nhập lại khi 401, bỏ ngang khi quá kiên nhẫn hoặc lỗi liên tiếp; ghi `end_reason`.
- Nhật ký thao tác `actions.jsonl` và `sessions.jsonl` theo mục 11.2.

### Không thực hiện

- Không làm giảng viên/admin/job lịch và profile ghép (task-03).
- Không kiểm chứng độ thực (task-04).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 (file phiên); k6 mức 1 (PR #76).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: phiên dài hơn run bị cắt ở cuối (`end_reason = run_end`); iteration bị k6 bỏ (`dropped_iterations`) làm lệch ánh xạ iteration → phiên, nên run có `dropped_iterations > 0` không dùng làm dữ liệu thí nghiệm.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Scenario phát lại phiên học viên và thư viện phản ứng/nhật ký | Code | `aiops-platform/load/` |
| Run thử ngắn trên stack đầy đủ | Bằng chứng | Mô tả PR |

## Definition of Done

- [ ] Run thử phát phiên thật trên stack khỏe: không có `unexpected_status`, mọi trạng thái đã ánh xạ đều có request thành công.
- [ ] Cùng `workload_seed` cho cùng kế hoạch phiên (hash trùng); seed khác cho kế hoạch khác.
- [ ] `actions.jsonl`, `sessions.jsonl` đủ trường mục 11.2.
- [ ] Unit test cho lịch arrival theo giờ bắt đầu thật, gán tài khoản, phản ứng phản hồi.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 18/11/2026 — lập card.
- Ghi chú/tồn đọng:
