# Task tuần: LLM stub và proxy chèn trễ trong Compose

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_add-llm-stub-and-latency-proxies` |
| Tuần | `week-13_2026-10-25_to_2026-10-31` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 19/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-13/task-03-add-llm-stub-and-latency-proxies` |

## Yêu cầu và phạm vi

### Cần thực hiện

Chuẩn bị cơ chế gây lỗi cho các case MVP cần proxy hoặc stub, trong module `aiops-platform/faults/`:

- LLM stub tương thích OpenAI chat-completions, chạy trong Compose; độ trễ, độ dao động và tỉ lệ lỗi chỉnh được lúc đang chạy qua endpoint điều khiển; lỗi ngẫu nhiên dùng bộ sinh số có seed (C3).
- Proxy TCP chèn trễ đặt trước `course-postgres` (kết nối của `course`, C2) và trước MinIO (kết nối phía server của `media`, `media-worker`, C4); bật/tắt độ trễ lúc đang chạy.
- File Compose bổ sung ghép vào `compose.full.yaml`, không sửa code LMS; một CLI nhỏ để bật/tắt/xem trạng thái fault.

### Không thực hiện

- Không làm fault manifest, ground truth hay lịch bật/tắt theo run (tuần 14).
- Không đổi cơ chế C6 (`docker pause identity` đã chạy ở `tracing-smoke`).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: [ADR-006](../../../adr/adr-006-trim-project-scope-v1.md) (C2 viết lại thành trễ `course` → `course-postgres`), [case catalogue v0](../../../architecture/complex-case-catalogue-and-rca-result-v0.md) C3/C4.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: proxy luôn nằm trên đường đi kể cả ở run healthy để hai loại run có cùng topology mạng; độ trễ nền của proxy phải đo và ghi lại.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Compose overlay (proxy + LLM stub) | Config | `aiops-platform/faults/compose.faults.yaml` |
| LLM stub | Code | `aiops-platform/faults/llm-stub/` |
| CLI điều khiển fault | Code | `aiops-platform/faults/fault-control.mjs` |
| Hướng dẫn và bằng chứng | Docs | `aiops-platform/faults/README.md` |

## Definition of Done

- [x] Stack đầy đủ cộng overlay lên healthy; regression W1–W7 vẫn đạt qua proxy và LLM stub.
- [x] Bật trễ trên `course-postgres` làm `lms_dependency_duration_seconds{dependency_identity="course-postgres"}` tăng tương ứng; tắt thì trở lại.
- [x] Bật trễ trên MinIO làm span/metric `media-minio` tăng; bật trễ hoặc lỗi LLM stub làm `ai-llm-provider` chậm hoặc lỗi.
- [x] Unit test cho LLM stub (điều khiển, lỗi có seed) và CLI chạy được.
- [x] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#75](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/75).
- Kết quả review: Chưa review (giai đoạn tự bắt kịp: review và merge theo ngoại lệ do Bách xác nhận).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 17/11/2026 — hoàn thành phần việc, mở PR #75, chuyển Chờ review.
- Ghi chú/tồn đọng: CI GitHub bị khóa thanh toán; kiểm tra tương ứng chạy cục bộ, kết quả trong PR. Lịch bật/tắt fault theo run và fault manifest thuộc tuần 14.
