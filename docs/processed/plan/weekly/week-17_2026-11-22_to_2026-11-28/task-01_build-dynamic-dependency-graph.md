# Task tuần: Dynamic dependency graph v2 và graph validation

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_build-dynamic-dependency-graph` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 28/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-17/task-01-build-dynamic-dependency-graph` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [analysis-anomaly-rca-blueprint-v1](../../../architecture/analysis-anomaly-rca-blueprint-v1.md) mục 11 và 17.5, [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 11 (RQ2), [service-catalogue-and-topology-v2](../../../architecture/service-catalogue-and-topology-v2.md) mục 4–6. Module `graph/` trong `aiops-platform/training` dựng graph theo run và cửa sổ từ `spans.parquet` của export:

- **Năm loại cạnh** (nguồn theo blueprint mục 11.1: span trace và metric `lms_dependency_*` trong `metrics.parquet`):
  - `sync`: span CLIENT/SERVER cùng trace và `lms_dependency_*` với `dependency_identity` dạng `<caller>-<callee>`.
  - `async`: PRODUCER → CONSUMER cùng `trace_id`, nối theo queue đích, quy PRODUCER về chủ sở hữu command bằng queue/command catalogue, không bằng `service.name` của span (protocol mục 4.1).
  - `dependency`: tới PostgreSQL, MinIO, SMTP, LLM provider.
  - `auth`: `<caller>-identity-token`, `<caller>-identity-jwks`, từ span CLIENT và `lms_dependency_*` (cạnh tần suất thấp nên metric là nguồn chính khi cửa sổ không có trace).
  - `shared-resource` và `scheduler → scheduler-worker`: chỉ lấy từ topology thiết kế, đánh dấu "thiết kế".
- **Bảng quy về chủ sở hữu** identity → candidate (blueprint mục 11.3), dùng chung cho các baseline RCA.
- **Trọng số baseline** `normalized_call_count`. Graph không giả định DAG: vòng `course → ai → course` và cạnh tự lặp `notification-worker → notification-worker` được giữ.
- **Graph artifact có version** (`graph_config_version`, sha256), tham chiếu được bằng `graph_ref` trong `RcaIncidentResult`; hạ tầng nằm trong evidence graph, không phải node candidate.
- **Graph validation** (blueprint mục 11.6) so với cạnh `e01–e29` của catalogue v2:
  - cạnh ngoài catalogue, self-loop sai, caller/callee đảo chiều;
  - async không nối được PRODUCER/CONSUMER, hoặc quy PRODUCER về sai owner;
  - trace sampling làm mất cạnh; graph rời bất thường;
  - cạnh nhiễu từ `/ready` và thăm dò của `scheduler-worker`;
  - dependency edge xuất hiện đúng workflow;
  - coverage theo cạnh và theo run, tách cạnh chỉ có trong thiết kế.

  Chạy trên run train và pilot; ghi coverage và các cạnh thiếu, ví dụ `media → identity` (`e12`), có thể chưa kích hoạt.
- Lệnh CLI dựng graph và chạy validation; số đo thời gian/RAM trên một run.

### Không thực hiện

- Không dùng graph thiết kế thay graph động trong phép so sánh chính (protocol mục 11); graph thiết kế chỉ để validation và cạnh không có trong trace.
- Không đổi tương quan incident sang graph (xem quyết định cần chốt ở overview).
- Không học trọng số cạnh hay prior theo loại cạnh (Target, blueprint mục 11.4).

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: export telemetry của dataset v0 và pilot (tuần 15), catalogue v2 mục 4–6, command catalogue trong contracts v2.
- Người hoặc phần việc cần phối hợp: task-03 dùng graph cho Graph-aware simple; task-04 dùng bảng quy về chủ sở hữu.
- Rủi ro/giả định:
  - Trace run validation `healthy-spike` là mẫu 52,5%: cạnh tần suất thấp có thể mất; ghi thành coverage.
  - Graph validation dùng run train/pilot; chạy trên validation chỉ để xác nhận implementation (protocol mục 6.2), không chọn gì.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Module `graph/`, lệnh dựng graph và graph validation, test | Code | `aiops-platform/training/src/aiops_training/graph/` |
| Graph config có version và bảng quy về chủ sở hữu | Config | `aiops-platform/training/configs/` |
| Kết quả graph validation trên run train/pilot (coverage, cạnh thiếu, cạnh lạ) | Docs | README `aiops-platform/training` hoặc blueprint mục 11.6 |

## Definition of Done

- [ ] Schema graph hỗ trợ đủ năm loại cạnh; graph dựng được cho mọi run train và pilot, kèm báo loại cạnh quan sát được ở từng run (run có thể không có lời gọi auth trong cửa sổ); cạnh thiết kế đánh dấu riêng; artifact có `graph_config_version` và sha256.
- [ ] Async edge quy về owner theo queue/command, có test với trace dựng tay (gồm vòng `course → ai → course` và self-loop hợp lệ).
- [ ] Graph validation chạy trên run train/pilot, báo coverage theo cạnh `e01–e29`, liệt kê cạnh thiếu và cạnh ngoài catalogue kèm giải thích.
- [ ] Bảng quy về chủ sở hữu có test cho mọi loại identity của blueprint mục 11.3.
- [ ] Không có node hạ tầng nào trong candidate; test, lint đạt; số đo thời gian/RAM có ghi.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
