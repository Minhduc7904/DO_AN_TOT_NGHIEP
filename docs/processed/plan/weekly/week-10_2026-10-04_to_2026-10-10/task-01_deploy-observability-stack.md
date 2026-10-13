# Task tuần: Dựng observability stack trong Compose

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_deploy-observability-stack` |
| Tuần | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách góp ý nhu cầu query/retention |
| Ưu tiên | Cao |
| Hạn dự kiến | 18/10/2026 — mốc bù tiến độ |
| Nhánh thực hiện | `feat/week-10/task-01-deploy-observability-stack` |

## Yêu cầu và phạm vi

### Cần thực hiện

Bổ sung OTel Collector, Prometheus, Tempo, Loki và Grafana vào topology Docker Compose hiện tại. Cấu hình Collector nhận OTLP HTTP/gRPC, định tuyến traces/metrics/logs tới backend phù hợp, dùng endpoint nội bộ Compose thay cho `127.0.0.1`, có healthcheck, volume/config tối thiểu và version image được pin. Cập nhật tài liệu để một checkout sạch có thể khởi động, kiểm tra health và truy cập các UI/query endpoint.

### Không thực hiện

- Không hoàn thiện toàn bộ instrumentation service, structured logging hoặc dashboard nghiệp vụ; thuộc task-02 đến task-05.
- Không dựng Kubernetes, production HA, authentication/SSO, TLS hoặc long-term storage.
- Không mở public port không cần thiết và không ghi credential thật vào repository.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: Compose Testbed MVP trên `main`; `lms/packages/observability`; telemetry schema và backend blueprint canonical.
- Người hoặc phần việc cần phối hợp: Bách xác nhận nhu cầu query/retention tối thiểu; chưa chặn việc dựng stack cơ sở.
- Rủi ro/giả định: image/config version không tương thích có thể làm stack khởi động nhưng không ingest; smoke test phải chứng minh dữ liệu đi qua Collector tới backend, không chỉ kiểm tra container running.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Compose services và config cho observability stack | Config | `docker-compose/compose.yaml`, `docker-compose/observability/` |
| Hướng dẫn khởi động, healthcheck và endpoint | Docs | `docker-compose/README.md`, `.env.example` liên quan |
| Smoke test ingest tối thiểu | Test | `lms/test/` hoặc script kiểm chứng phù hợp |

## Definition of Done

- [ ] Compose config hợp lệ và khởi động healthy OTel Collector, Prometheus, Tempo, Loki và Grafana bằng image version đã pin.
- [ ] Service gửi OTLP tới hostname Collector nội bộ Compose; Collector có pipeline traces, metrics và logs, không dùng `127.0.0.1` giữa container.
- [ ] Smoke test gửi/nhận telemetry mẫu và chứng minh Prometheus, Tempo, Loki đều query được dữ liệu qua endpoint thật.
- [ ] Config không chứa credential production; port, volume, retention/resource limit MVP và cách tắt stack được tài liệu hóa.
- [ ] Kiểm tra Compose phù hợp và `pnpm run ci:verify` pass hoặc PR ghi rõ failure baseline ngoài phạm vi kèm bằng chứng.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 13/10/2026 — lập task bù tiến độ W10.
- Ghi chú/tồn đọng: Có thể bắt đầu sau khi tạo input workspace; giữ diff task chỉ gồm hạ tầng/config/tài liệu/smoke test của stack.
