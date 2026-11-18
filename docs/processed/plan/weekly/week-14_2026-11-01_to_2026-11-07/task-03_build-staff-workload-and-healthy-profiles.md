# Task tuần: k6 mức 2 cho giảng viên, admin, job lịch và hai profile healthy

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_build-staff-workload-and-healthy-profiles` |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 22/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-14/task-03-build-staff-workload-and-healthy-profiles` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [workload-design-v1](../../../architecture/workload-design-v1.md) mục 5.7–5.8, 7.3–7.5, 8.1–8.2, 12.2:

- Máy trạng thái giảng viên (goal I1–I4: W2, W4 phía giảng viên, W6) và admin (A1/A2, đợt thông báo W5, job dọn media W7), dùng lại hàm thao tác ở `aiops-platform/load/journeys/`; bộ sinh số có seed theo `iterationInTest`.
- Giai đoạn `setup` (provider AI trỏ LLM stub, job dọn media có `retention_hours` ≥ 1, kho media).
- Hai profile có phiên bản: `normal-mixed` (ngày gần trung vị của đoạn xây) và `healthy-spike` (ngày cao điểm trước hạn quiz); mỗi profile ghép scenario học viên (task-02) với giảng viên/admin/job lịch.
- `workload-manifest.json` mỗi run (profile, seed, tham số, hash file phiên, hệ số chồng phiên, thời điểm UTC, tóm tắt).

### Không thực hiện

- Không làm pilot tìm `λ_knee` (tuần 15); chỉ chạy đủ để chứng minh profile chạy được và khỏe.
- Không làm ba profile healthy tùy chọn (mục 8.3).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-02; LLM stub (PR #75).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: đợt thông báo `ALL_STUDENTS` gửi ~1.000 email mỗi đợt; job dọn media không được xóa media vừa tạo.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Máy trạng thái giảng viên/admin, profile, manifest | Code | `aiops-platform/load/` |
| Một run mỗi profile trên stack đầy đủ | Bằng chứng | Mô tả PR |

## Definition of Done

- [ ] Mỗi profile chạy trọn trên stack khỏe; W1–W7 đều có request thành công; không có `unexpected_status`; tiêu chí "khỏe" mục 8.4 được báo cáo.
- [ ] `workload-manifest.json` đủ trường mục 11.2 và đủ để điền phần workload của `RunGroundTruth`.
- [ ] Unit test cho máy trạng thái giảng viên/admin (chuyển trạng thái theo bảng, seed tái lập).
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
