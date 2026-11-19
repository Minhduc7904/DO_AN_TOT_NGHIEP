# Task tuần: Pilot tìm `λ_knee` và chốt mức tải hai profile healthy

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_find-load-knee-and-freeze-profiles` |
| Tuần | `week-15_2026-11-08_to_2026-11-14` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 21/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-15/task-02-find-load-knee-and-freeze-profiles` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [workload-design-v1](../../../architecture/workload-design-v1.md) mục 8.4 và [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 6.1 (pilot được chốt workload rate):

- Scenario k6 tìm điểm gãy: chỉ scenario học viên pha `normal`, tốc độ đến không đổi trong mỗi bậc, tăng 0,2 phiên/s mỗi 3 phút cho tới khi vi phạm một tiêu chí "khỏe" của mục 8.4. Tốc độ cuối còn khỏe là `λ_knee`. Phiên lấy từ phần xây của log Moodle như mức 2+, cùng cách gán tài khoản theo phiên.
- Công cụ chấm tiêu chí "khỏe" theo cửa sổ 60 s (p95 Gateway, tỉ lệ phản hồi ngoài danh sách mong đợi, phiên bỏ ngang, `dropped_iterations`, CPU/bộ nhớ container, `unexpected_status`), đưa script chấm của task-03 tuần 14 vào repo thay vì để ngoài.
- Chốt mức tải: đỉnh `normal-mixed` ≤ 0,35 × `λ_knee`, đỉnh `healthy-spike` ≤ 0,8 × `λ_knee` (đổi sang cùng đơn vị phiên bắt đầu/s); nếu vượt thì hạ hệ số chồng phiên `k` cho cả hai profile; nếu còn dư nhiều thì ghi lại, không tự tăng. Đo RAM k6 ở đỉnh spike (còn trống < 4 GB thì hạ).
- Ghi kết quả: `λ_knee`, tiêu chí bị vi phạm đầu tiên, service/tài nguyên gây gãy, mức tải đã chốt và phiên bản profile (`normal-mixed@v…`, `healthy-spike@v…`) vào workload-design-v1 và README `load/`.

### Không thực hiện

- Không đổi tiêu chí "khỏe" sau khi xem kết quả; không tối ưu hiệu năng LMS (ADR-006 đóng băng testbed).
- Không chạy run dataset.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: profile và bộ phát mức 2+ (task-02/03 tuần 14, PR #85, #88, #90).
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: điểm gãy có thể do chính máy (CPU host, k6) thay vì stack; phải phân biệt và ghi rõ. Tốc độ đến không đổi khác dáng tải thật, nên `λ_knee` chỉ là cận trên an toàn. Chạy trên stack có lớp fault (TTL 60 s) như run thí nghiệm.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Scenario tìm điểm gãy và công cụ chấm tiêu chí "khỏe" | Code | `aiops-platform/load/` |
| `λ_knee`, mức tải đã chốt và phiên bản profile | Docs | workload-design-v1 mục 8.4; README `load/` |

## Definition of Done

- [ ] Có run tìm điểm gãy với `run_id`, bậc tải, tiêu chí bị vi phạm và nguyên nhân (stack hay máy).
- [ ] Đỉnh hai profile được kiểm theo 0,35/0,8 × `λ_knee`; quyết định giữ hoặc hạ `k` có số đo đi kèm; phiên bản profile được ghi.
- [ ] Công cụ chấm tiêu chí "khỏe" nằm trong repo, có unit test trên dữ liệu biết trước đáp án.
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
