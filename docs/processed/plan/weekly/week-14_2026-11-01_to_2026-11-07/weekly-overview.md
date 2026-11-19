# Tổng quan tuần 14 — Workload bán thực (mức 2+), fault manifest và ground truth

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Nguồn plan canonical | [Plan v0.4 — Tuần 14](../../plan-v0.4-24-weeks.md#tuần-14--workload-bán-thực-mức-2-fault-manifest-và-ground-truth) |
| Mục tiêu tuần | Phát lại phiên học viên thật từ log Moodle (mức 2+) và mức 2 cho giảng viên/admin/job lịch; hai profile healthy bắt buộc; báo cáo kiểm chứng độ thực so với hold-out và hai nguồn tải đơn giản; fault manifest cho C2, C3, C4, C6; `RunGroundTruth` tối thiểu có validation; feature pipeline v0. |
| Trạng thái tuần | Đang thực hiện — sáu task đã hoàn thành và merge (PR #83–#87, #89; bảng task ở PR #82); task-03 chờ review PR thứ hai (hai profile cả ngày đã đạt tiêu chí khỏe mục 8.4); Gate R điều kiện 5 vẫn mở (ngoại lệ ở dưới) |

> Tuần canonical là 01/11/2026–07/11/2026. Kế hoạch được lập ngày 18/11/2026 (tuần lịch 17) để bù tiến độ; hạn task bên dưới là mốc bù tiến độ, không đổi phạm vi milestone.

> **Ngoại lệ Gate R kéo dài sang tuần 14 (18/11/2026).** Tuần 13 vẫn ở `Chờ xử lý` vì Gate R điều kiện 5 (Bách tự dựng stack theo README và giải thích W1–W7) chưa có bằng chứng trên `main`. Bách (người phụ trách) yêu cầu tiếp tục tuần 14. Lý do và rủi ro giống ngoại lệ tuần 13: điều kiện 5 kiểm chứng hiểu biết của người thực hiện, không thay đổi testbed. Điều kiện 5 vẫn phải có bằng chứng trước khi đóng tuần 13; Gate R không bị cắt.

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_build-moodle-session-tools](task-01_build-moodle-session-tools.md) | Công cụ tải log Moodle, cắt phiên, ánh xạ sự kiện, chia hold-out và sinh phiên từ chuỗi Markov | Bách | Không có | Cao | Hoàn thành |
| [task-02_build-k6-student-replay](task-02_build-k6-student-replay.md) | k6 mức 2+: phát lại phiên học viên theo đường cong giờ, có phản ứng với phản hồi và nhật ký thao tác | Bách | Không có | Cao | Hoàn thành |
| [task-03_build-staff-workload-and-healthy-profiles](task-03_build-staff-workload-and-healthy-profiles.md) | k6 mức 2 cho giảng viên, admin, job lịch; hai profile healthy và `workload-manifest.json` | Bách | Không có | Cao | Chờ review |
| [task-04_validate-workload-realism](task-04_validate-workload-realism.md) | Báo cáo kiểm chứng độ thực: ba nguồn tải so với hold-out Moodle theo ngưỡng chốt trước | Bách | Không có | Cao | Hoàn thành |
| [task-05_build-fault-manifest](task-05_build-fault-manifest.md) | Fault manifest và bộ bật/tắt theo lịch cho C2, C3, C4, C6 | Bách | Không có | Cao | Hoàn thành |
| [task-06_define-run-ground-truth](task-06_define-run-ground-truth.md) | `RunGroundTruth` tối thiểu, validation đối chiếu fault với telemetry, triệu chứng và đường lan của 4 case | Bách | Không có | Cao | Hoàn thành |
| [task-07_build-feature-pipeline-v0](task-07_build-feature-pipeline-v0.md) | Feature pipeline v0: cửa sổ 60 s bước 15 s, đặc trưng service và cạnh, xử lý series đứng yên | Bách | Không có | Cao | Hoàn thành |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: task-02 đọc file phiên của task-01; task-03 ghép scenario học viên của task-02 vào profile; task-04 cần task-01 (hold-out, phiên sinh từ bảng giả định) và task-03 (profile chạy được); task-06 dùng dấu vết thời điểm của task-05; task-07 chạy trên artifact export (tuần 13) của một run có fault từ task-05.
- Rủi ro: máy ~15 GB RAM và swap đã dùng nhiều, nên mỗi lúc chỉ chạy một run k6; run 48 phút cho ba nguồn tải tốn nhiều giờ máy; telemetry chỉ giữ 24 giờ nên export ngay sau run; log Moodle là dữ liệu bên thứ ba (CC BY 4.0) nên không commit CSV và file phiên.
- Quyết định đã chốt: giữ cách làm của giai đoạn tự bắt kịp (mọi task do Bách phụ trách, không collaborator, review/merge theo ngoại lệ Bách xác nhận); công cụ xử lý log viết bằng Node (`.mjs`, không phụ thuộc ngoài) để chạy cùng job test `aiops-platform` trong CI; "mức 2 thuần" của học viên là phiên sinh từ bảng chuyển giả định (workload-design-v1 mục 5.4) và phát bằng cùng bộ phát với mức 2+, để hai nguồn chỉ khác nhau ở nguồn phiên.

## Thứ tự thực hiện đề xuất

1. Task-01 và task-05 song song (không phụ thuộc nhau).
2. Task-02 rồi task-03; chạy thử ngắn trên stack đầy đủ có fault overlay.
3. Task-06 dùng dấu vết của task-05 trên một run thử có fault.
4. Task-04: chạy ba nguồn tải lần lượt (chạy nền khi làm task-07).
5. Task-07 trên artifact export của run có fault.

## Tiêu chí kết thúc tuần

- [x] Các task ưu tiên cao có trạng thái và bằng chứng được cập nhật.
- [x] Các task hoàn thành đã liên kết đến PR và bằng chứng DoD.
- [ ] Gate R điều kiện 5 có bằng chứng của Bách (đóng ngoại lệ của tuần 13 và tuần 14).
- [ ] Tồn đọng và việc chuyển sang tuần 15 đã được ghi rõ. Đã biết: task-03 (merge PR thứ hai); chạy lại kiểm chứng độ thực trên code cuối (task-04); Gate R điều kiện 5.
