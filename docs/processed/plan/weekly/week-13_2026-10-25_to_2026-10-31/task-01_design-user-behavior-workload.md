# Task tuần: Thiết kế workload mức 1 + 2 theo hành vi người dùng

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_design-user-behavior-workload` |
| Tuần | `week-13_2026-10-25_to_2026-10-31` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 19/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `docs/week-13/task-01-design-user-behavior-workload` |

## Yêu cầu và phạm vi

### Cần thực hiện

Viết tài liệu thiết kế workload v1 theo gợi ý của giảng viên (mức 1 + 2), đủ để tuần 14 cài k6 mức 2 mà không phải đoán tham số:

- **User Profile:** student (chăm chỉ, nước rút trước hạn, xem lướt rồi bỏ dở), instructor (soạn bài, upload, dùng AI soạn bài), admin (gửi thông báo hàng loạt); tỉ lệ trong quần thể, mức kiên nhẫn, thời gian có sẵn.
- **Goal:** ví dụ hoàn thành bài trước hạn, ôn quiz, xem lướt khóa học.
- **Behavior Model:** máy trạng thái trên các thao tác W1–W7; xác suất chuyển phụ thuộc mục tiêu và trạng thái; thời gian nghỉ theo phân phối log-normal.
- **System Response → Update User State:** retry có backoff khi 5xx, bỏ ngang khi chờ quá mức kiên nhẫn, đăng nhập lại khi 401.
- **Nhịp tải:** số phiên bắt đầu theo đường cong trong ngày (nén một ngày còn 30–60 phút chạy), có cao điểm trước hạn quiz.
- Bảng tham số kèm nguồn (tài liệu, nghiên cứu hành vi học trực tuyến công khai); tham số không có nguồn ghi rõ là giả định của đề tài kèm lý do.
- Hai profile healthy bắt buộc (normal mixed traffic, healthy high-load spike) và cách kiểm chứng phân phối sinh ra.

### Không thực hiện

- Không cài k6 mức 2 (tuần 14); không làm mức 3 (mô phỏng theo dữ liệu thật) làm phần chính.
- Không thêm thao tác LMS mới; chỉ dùng API đang có trên `main` (LMS đóng băng theo ADR-006).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: [plan v0.3 tuần 13–14](../../plan-v0.3-24-weeks.md), [service catalogue v2 mục 7](../../../architecture/service-catalogue-and-topology-v2.md), [evaluation protocol v1 mục 5.4](../../../architecture/evaluation-protocol-v1.md), [analysis blueprint v1 mục 18](../../../architecture/analysis-anomaly-rca-blueprint-v1.md).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: số liệu công khai về hành vi học trực tuyến không khớp hoàn toàn LMS của đề tài; mọi phép quy đổi phải ghi rõ.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Tài liệu thiết kế workload v1 | Docs | `docs/processed/architecture/workload-design-v1.md` |

## Definition of Done

- [ ] Tài liệu có đủ năm phần User Profile, Goal, Behavior Model, System Response → Update User State, nhịp tải.
- [ ] Mọi thao tác trong máy trạng thái ánh xạ được tới endpoint có thật trên `main`.
- [ ] Mỗi tham số có nguồn kiểm chứng được hoặc được đánh dấu là giả định kèm lý do.
- [ ] Có định nghĩa hai profile healthy bắt buộc và tiêu chí kiểm chứng phân phối traffic.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 17/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
