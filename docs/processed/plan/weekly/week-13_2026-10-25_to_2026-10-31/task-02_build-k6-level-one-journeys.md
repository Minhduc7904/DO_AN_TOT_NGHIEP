# Task tuần: k6 mức 1 cho các hành trình W1–W7

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_build-k6-level-one-journeys` |
| Tuần | `week-13_2026-10-25_to_2026-10-31` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 20/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-13/task-02-build-k6-level-one-journeys` |

## Yêu cầu và phạm vi

### Cần thực hiện

Dựng module workload `aiops-platform/load/` bằng k6. Mức 1: mỗi hành trình W1–W7 làm các thao tác cơ bản qua Gateway trên dữ liệu seed (R-10) và tài khoản bootstrap:

- W1 đăng nhập/đăng ký, W2 soạn khóa học, W3 ghi danh và học (tiến độ, làm quiz), W4 upload media trực tiếp MinIO, W5 thông báo đơn và hàng loạt, W6 AI soạn bài qua LLM stub, W7 dọn media theo lịch.
- Cấu hình bằng biến môi trường (thời lượng, số người dùng ảo, tỉ lệ hành trình, seed); chạy bằng image `grafana/k6` có version cố định nên máy không cần cài k6.
- Gắn tag `journey` và `run_id` cho request k6; ghi tóm tắt kết quả JSON theo run để task-04 đối chiếu cửa sổ thời gian.

### Không thực hiện

- Không làm máy trạng thái người dùng, profile, thời gian nghỉ log-normal (k6 mức 2, tuần 14).
- Không gây lỗi; không sửa code LMS.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: regression W1–W7 (`lms/test/regression/`) làm nguồn thao tác; seeder R-10; task-03 cho LLM stub (W6).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: upload trực tiếp MinIO dùng presigned POST tới `MINIO_PUBLIC_URL` (`localhost:9000`), nên container k6 chạy `--network host`; media của dòng seed không có object nên W4 luôn upload tệp thật.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Script k6 mức 1 và thư viện dùng chung | Code | `aiops-platform/load/` |
| Hướng dẫn chạy | Docs | `aiops-platform/load/README.md` |

## Definition of Done

- [ ] Một lệnh chạy k6 mức 1 trên stack đầy đủ; cả bảy hành trình có request thành công, tỉ lệ lỗi HTTP không mong đợi bằng 0 trên stack khỏe.
- [ ] Trace của mỗi hành trình xuất hiện trong Tempo (kiểm bằng TraceQL theo route).
- [ ] Tóm tắt run JSON có `run_id`, thời điểm bắt đầu/kết thúc UTC và số request theo hành trình.
- [ ] README ghi lệnh chạy, biến môi trường và giới hạn tài nguyên.
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
