# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_publish-grade-completed-event` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 08/10/2026 |
| Hoàn thành thực tế | 08/10/2026 — finalization theo ngoại lệ do Đức xác nhận |
| Tổng thời lượng | Không có giờ bắt đầu/kết thúc chính xác để tổng kết; thực hiện trong ngày 08/10/2026 |
| Pull request | [#33](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/33) |
| Người review | Subagent AI theo chỉ định của Đức (thay Bách) |
| Kết quả review | Review nội bộ vòng 1, 2 blocking đã sửa; **chưa có verdict GitHub `APPROVED`** |

## Báo cáo công việc đã làm

- Khởi tạo hồ sơ task, chuyển card và `weekly-overview.md` sang `Đang thực hiện`. Timeline/JSON chờ đồng bộ bằng Windows PowerShell: `tools/sync-plan-json-and-timeline.ps1` không chạy được trên Linux (đã biết từ task-04); Đức chỉ thị tiếp tục, không sửa tay JSON/timeline và không commit timeline sinh lại.
- **Publication state bền vững trong `grades`** (không có outbox riêng): migration idempotent trong một transaction thêm `event_id uuid UNIQUE NOT NULL`, `publish_status` (`pending`/`published`, CHECK), `publish_attempts` (CHECK `>= 0`), `last_publish_error_code`, `published_at` và index một phần cho row `pending`. Grade có sẵn trước migration (kể cả seed) được backfill `event_id`, `published`, `published_at = completed_at` và không bị phát lại. Grade mới được insert cùng `event_id` UUID ổn định và `pending`.
- **Request flow**: `POST /api/v1/grades` validate Submission, insert grade + `event_id` + `pending`, publish ngay một lần; broker confirm thì đánh dấu `published` và trả `201`. Publish lỗi/timeout thì grade vẫn tồn tại, `publish_attempts` tăng, lưu `last_publish_error_code` hữu hạn (`BROKER_UNAVAILABLE`, `PUBLISH_TIMEOUT`, `PUBLISH_NACKED`, `EVENT_INVALID`), request trả `503 DEPENDENCY_UNAVAILABLE` ("Grade đã được lưu nhưng event chưa publish; hệ thống sẽ tự thử lại"). `GET` vẫn đọc được, `POST` lại cùng Submission vẫn `409`.
- **Publisher RabbitMQ** (`amqplib 2.2.0`, có sẵn TypeScript definitions): confirm channel; assert exchange `lms.events` (topic, durable); routing key `grade.completed`; message persistent, `application/json`, `message-id = event_id`; timeout confirm `GRADING_PUBLISH_CONFIRM_TIMEOUT_MS`; connection/channel lỗi hoặc timeout được bỏ và tạo lại ở lần publish sau; broker chưa sẵn sàng không làm Grading fail khi khởi động; đóng channel/connection ở shutdown; không log URL/credential. Event được dựng và validate bằng `gradeCompletedEventSchema`, headers bằng `createGradeCompletedRabbitMqHeaders` (không sửa contract v1). `event_id`, `occurred_at`, payload không đổi giữa các retry; `correlation` theo từng attempt.
- **Trace context**: mỗi attempt tạo span `PRODUCER` `lms.events publish`, inject `traceparent`/`tracestate` vào RabbitMQ headers và dùng đúng giá trị đó cho `correlation` của envelope. Khi telemetry tắt (không có span hợp lệ) sinh `traceparent` mới không sampled vì contract bắt buộc trường này.
- **Coordinator + worker**: `GradePublicationCoordinator` coalesce publish cùng `event_id` trong một process (request path và worker không publish đồng thời) và tăng `publish_attempts` trước mỗi attempt. `PendingGradeEventWorker` chạy sau Nest bootstrap, mỗi `GRADING_EVENT_RETRY_INTERVAL_MS` lấy tối đa `GRADING_EVENT_RETRY_BATCH_SIZE` grade `pending` theo `completed_at`, `id`, publish tuần tự, không chạy chồng vòng, dừng vòng khi broker lỗi, retry không giới hạn, dừng timer và chờ vòng đang chạy khi shutdown.
- **Telemetry**: dependency identity `grading-rabbitmq`; span attributes `messaging.system`, `messaging.operation.type`, `messaging.destination.name`, `messaging.rabbitmq.destination.routing_key`, `dependency_identity`; metrics `grading.messaging.publish.count`, `.error.count`, `.duration`, gauge `grading.messaging.pending.count`; label hữu hạn, `event_id` chỉ ở span.
- **Cấu hình/Compose/CI**: 5 biến môi trường mới có validation (URL `amqp(s)://`, confirm 500–30000 ms, interval 1000–60000 ms, batch 1–100); Compose truyền RabbitMQ URL có credential từ `.env` và thêm `rabbitmq` vào `depends_on` của Grading; Dockerfile đóng gói `@aiops-lms/contracts`; CI thêm service RabbitMQ 4.1.4, chạy `test:grading:rabbitmq` và kiểm tra event trên queue tạm trong smoke Compose. Không thêm Notification, consumer hay DLQ.

### Quyết định/điều chỉnh so với kế hoạch

- Dùng callback confirm theo từng message thay vì `waitForConfirms()` (hàm này chờ mọi message đang chờ, kể cả của event khác); `publish()` trả `false` chỉ báo backpressure nên không chờ `drain` riêng, timeout confirm đã bao trùm.
- `event_id` đặt `NOT NULL` (kế hoạch chỉ ghi `UNIQUE`) sau backfill để bảo đảm toàn vẹn.
- Chỉ vi phạm `unique(submission_id)` được map thành `409`; vi phạm unique khác (`id`, `event_id`) là lỗi hệ thống. Phát hiện khi test `event_id` trùng.
- Repository/publisher đóng ở `onApplicationShutdown` (thay `onModuleDestroy`) để worker dừng ở `onModuleDestroy` trước khi pool PostgreSQL và connection RabbitMQ đóng.
- Worker dừng vòng khi gặp lỗi broker (các row còn lại sẽ lỗi tương tự) nhưng tiếp tục khi chỉ một event `EVENT_INVALID`.
- `test:w5:postgres` giờ cần RabbitMQ (`GRADING_RABBITMQ_URL`) và kiểm chứng thêm: event ở queue tạm, cùng trace với request qua Gateway, producer span là con của span Grading server.
- Giới hạn đã biết: Grading chỉ assert exchange. Nếu publish khi chưa có queue nào bind `grade.completed`, broker bỏ message nhưng Grading vẫn đánh dấu `published` (không dùng `mandatory`); Notification (task-02) phải declare/bind queue trước khi trông đợi event. Ngoài ra duplicate cùng `event_id` có thể xảy ra (confirm timeout, ghi `published` lỗi, nhiều instance).

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Publisher, coordinator, worker, publication state, migration, telemetry | Code | [lms/services/grading/src/](../../../../../lms/services/grading/src/) |
| Test unit, PostgreSQL, RabbitMQ, telemetry | Code | [lms/services/grading/test/](../../../../../lms/services/grading/test/), [lms/test/w5-postgres-workflow.e2e-spec.ts](../../../../../lms/test/w5-postgres-workflow.e2e-spec.ts) |
| Compose/CI/Dockerfile wiring, README | Config / Docs | [docker-compose/compose.yaml](../../../../../docker-compose/compose.yaml), [.github/workflows/ci.yml](../../../../../.github/workflows/ci.yml), [lms/services/grading/Dockerfile](../../../../../lms/services/grading/Dockerfile), [lms/services/grading/README.md](../../../../../lms/services/grading/README.md) |

## Đối chiếu Definition of Done

Bằng chứng chạy cục bộ ngày 08/10/2026 với Node 22.13.1, pnpm 11.19.0 (không tắt engine check), PostgreSQL `postgres:17.6-alpine`, RabbitMQ `rabbitmq:4.1.4-management-alpine` và Redis `redis:8.2.1-alpine` tạm bằng Docker (đã dọn sau khi chạy).

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Publish đúng `grade.completed` v1 với event ID, occurred time, producer, payload, trace context | Đạt | `test/unit/grade-completed-event.factory.spec.ts` (schema strict v1, header = correlation, từ chối thiếu/thừa field); `test/rabbitmq-integration.mjs` (consumer tạm nhận: exchange `lms.events`, routing key `grade.completed`, `delivery_mode=2`, JSON hợp lệ, `traceparent` header = `correlation.traceparent` = producer span); compose smoke: event nhận đúng trên queue bind `grade.completed`. |
| Failure/retry không tạo grade hoặc event ID trùng; có test duplicate/failure | Đạt | `test/postgres-integration.mjs` (retry nhiều lần cùng `event_id`, đếm grade không đổi, published → không phát lại, grade lịch sử không bị republish, `event_id` UNIQUE); `test/rabbitmq-integration.mjs` (broker chết → grade lưu + pending, POST lại `409`, broker bật lại → worker publish cùng `event_id`, hai lần publish cùng `event_id` nhận diện là một event logic); `test/unit/grade-publication.coordinator.spec.ts`, `grading.service.spec.ts`, `grading.controller.spec.ts` (503, GET 200, POST lại 409). |
| Span/metrics/logs có dependency identity, operation, error semantics; headers tương thích | Đạt | `test/telemetry/messaging.telemetry-test.mjs` và `test/rabbitmq-integration.mjs` (span PRODUCER, `grading-rabbitmq`, lỗi `timeout`/`unavailable`/`invalid`, metric publish count/error/duration, gauge pending giảm 1 → 0 sau recovery, không lộ credential/principal/event_id ở metric); `test:w5:postgres` (producer span cùng trace Gateway → Grading); log chỉ chứa ID kỹ thuật và mã lỗi (compose: không có `amqp://` hay mật khẩu trong log Grading). |
| Integration test RabbitMQ thật pass; config/health/CI cập nhật | Đạt | `pnpm run test:grading:rabbitmq` (3 lần liên tiếp pass); `test:grading:postgres`; Compose healthy kể cả `grading`; smoke dừng/bật RabbitMQ (xem bên dưới); CI có service RabbitMQ và bước kiểm tra queue. Lưu ý: workflow CI chưa chạy trên GitHub, chỉ kiểm chứng lệnh tương đương cục bộ. |
| URL/số PR và `Chờ review` đã commit/push | Đạt | PR [#33](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/33); transition này được commit/push vào PR head. |
| PR đúng quy tắc, `APPROVED`, completion metadata | Đạt theo ngoại lệ | PR [#33](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/33) dùng template. Bách không thể review; Đức chỉ định subagent AI review (vòng 1, [comment](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/33#issuecomment-6055895978)) và xác nhận finalization dù chưa có GitHub `APPROVED`; completion metadata được commit/push vào PR #33. Không ghi nhận đây là GitHub approval. |

### Compose smoke (project riêng `task05-smoke`, Redis đổi sang cổng 16379)

1. Student bị `403` khi chấm; instructor tạo grade `201`; tạo lại `409`; queue bind `grade.completed` nhận 1 message với `event_name=grade.completed`, `schema_version=1`, `delivery_mode=2`, `traceparent` header trùng `correlation.traceparent`.
2. Dừng RabbitMQ: `POST` Submission mới trả `503 DEPENDENCY_UNAVAILABLE` sau ~3.0 s (đúng confirm timeout), `GET` grade trả `200`, `POST` lại trả `409`; DB ghi `pending`, `publish_attempts=2`, `last_publish_error_code=PUBLISH_TIMEOUT`.
3. Bật lại RabbitMQ: trong ~6 s worker publish, row chuyển `published` (`publish_attempts=3`, error code xóa, `published_at` có giá trị), vẫn đúng 1 grade, queue nhận đúng 1 message cùng `event_id` với DB.

### Cổng kiểm chứng đã chạy (kết quả thực)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm install --frozen-lockfile` | Đạt (lockfile định dạng Prettier; diff chỉ thêm `amqplib` và link `@aiops-lms/contracts` cho Grading) |
| `pnpm run format:check`, `build`, `lint` (`--max-warnings=0`) | Đạt |
| `pnpm run test` | Đạt (không cần RabbitMQ; Grading 79 unit test, Notification 4, gateway 9, các telemetry test đạt) |
| `pnpm run test:grading:postgres`, `test:grading:rabbitmq` | Đạt |
| `pnpm run test:w1:postgres`, `test:course:postgres`, `test:enrollment:postgres`, `test:submission:postgres`, `test:w2:postgres`, `test:w3:postgres`, `test:w5:postgres` | Đạt |
| `pnpm run ci:verify` | Đạt |
| `docker compose --env-file docker-compose/.env.example -f docker-compose/compose.yaml config --quiet` | Đạt |

## Vòng review nội bộ vòng 1

- Reviewer: subagent AI, theo chỉ định của Đức thay Bách (Bách không còn tham gia review). Đây là review nội bộ, **không phải** GitHub `APPROVED`; nhận xét đăng tại [PR #33](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/33#issuecomment-6055895978). Sau vòng review này, Đức xác nhận finalization theo ngoại lệ.
- Phạm vi: đối chiếu event mapping/schema v1, topology, confirm publish, migration/publication state, request flow, worker/shutdown, telemetry, config, Compose/CI và test với `git diff main...HEAD`.
- Verdict đề xuất sau khi sửa: `APPROVED` (chờ GitHub review thật khi có PR).

| # | Mức | Vị trí | Finding | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Blocking | `rabbitmq-grade-completed.publisher.ts` (`open`) | Chỉ bước `connect` có timeout. Nếu broker nhận kết nối nhưng không trả lời `createConfirmChannel`/`assertExchange`, promise mở session treo vô hạn: request POST, vòng worker và shutdown bị giữ. | Bao toàn bộ bước dựng session bằng timeout `GRADING_PUBLISH_CONFIRM_TIMEOUT_MS`, quá hạn thì `PUBLISH_TIMEOUT` và đóng connection. |
| 2 | Blocking | `rabbitmq-grade-completed.publisher.ts` (`invalidate`, shutdown) | `connection.close()` chờ close-ok của broker; khi mạng treo (không có phản hồi) socket không được giải phóng, mỗi chu kỳ retry 5 s rò thêm một connection; shutdown cũng chờ vô hạn. | Thêm `forceClose`: đóng êm rồi sau 1 s hủy socket kèm lỗi để amqplib dừng heartbeat. Shutdown chờ đóng êm có giới hạn 1 s. (Hủy socket không kèm lỗi để lại heartbeat timer, giữ process ~3 phút; đã phát hiện và sửa khi test.) |
| 3 | Non-blocking | `test/rabbitmq-integration.mjs` | Chưa có test cho timeout ở giai đoạn confirm sau khi session đã mở (mạng treo) và cho việc không rò socket. | Thêm kịch bản 5d: proxy nuốt dữ liệu, POST nhận `PUBLISH_TIMEOUT` đúng ngưỡng, grade giữ `pending`, socket treo bị hủy về 0, mở lại thì worker publish cùng `event_id`. |
| 4 | Ghi nhận, không sửa | Lịch sử commit | 3 commit `feat` đầu không tự compile riêng lẻ (theo implementer báo). | Không viết lại lịch sử theo chỉ thị; trạng thái cuối nhánh build đạt. |
| 5 | Ghi nhận, không sửa | `docker-compose/compose.yaml` | RabbitMQ user/password nhúng vào URL không URL-encode; mật khẩu có ký tự đặc biệt trong `.env` sẽ làm URL sai. | Giá trị mặc định/ví dụ an toàn; để ngoài phạm vi task-05. |

Các mục đã kiểm tra và không có lỗi: event mapping dùng `gradeCompletedEventSchema` và `createGradeCompletedRabbitMqHeaders`, `event_id`/`occurred_at`/payload ổn định giữa retry, `correlation` khớp `traceparent` header; exchange `lms.events` topic durable, chỉ assert exchange, persistent, `application/json`, tương thích exchange/routing key của Notification skeleton; callback confirm theo từng message, không đánh dấu `published` khi chưa có confirm, channel đóng thì callback nhận lỗi; migration idempotent trong một transaction, backfill `published` không phát lại; `23505` chỉ map `409` cho `grades_submission_id_key`; `publish_attempts` tăng trước attempt; worker tuần tự, không chồng vòng, shutdown dừng worker trước pool và connection; metric label hữu hạn, `event_id` không ở metric; không lộ URL/credential trong log, span, metric; validation config đúng khoảng; không có Notification consumer/DLQ; không đụng `workspace/bach/`, `docs/raw/`, contract v1.

Kiểm chứng sau khi sửa (08/10/2026, Node 22.13.1, pnpm 11.19.0; PostgreSQL 17.6, RabbitMQ 4.1.4, Redis 8.2.1 tạm bằng Docker, đã dọn): `pnpm install --frozen-lockfile`, `format:check`, `build`, `lint`, `test`, `test:w1/course/enrollment/submission/grading/w2/w3/w5:postgres`, `test:grading:rabbitmq` (có kịch bản 5d, ~7 s) và `ci:verify` đều đạt; `docker compose config --quiet` đạt. Compose smoke chạy lại (project `task05rev`, Redis cổng 16379): POST `201` khi broker sống; dừng RabbitMQ thì POST `503` sau ~3.0 s với đúng message, GET `200`, POST lại `409`; bật lại thì worker publish (`published`, `publish_attempts=2`), queue durable nhận đúng message cùng `event_id` với DB, log Grading không chứa URL/mật khẩu. Card giữ nguyên trạng thái trong vòng review; finalization ghi ở commit sau.

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: không đổi phạm vi; các điều chỉnh kỹ thuật nằm ở mục "Quyết định/điều chỉnh so với kế hoạch".
- Việc chưa hoàn thành hoặc trở ngại: không có blocker substantive; GitHub chưa có `APPROVED` từ thành viên còn lại (Đức yêu cầu bỏ qua theo ngoại lệ); timeline/JSON chờ đồng bộ bằng Windows PowerShell; CI GitHub chưa chạy; Bách chưa kiểm tra tương thích consumer.
- Bước tiếp theo: Đức merge PR #33 theo ngoại lệ; Notification task-02 phải declare/bind queue `grade.completed` và deduplicate theo `event_id`; đồng bộ timeline bằng Windows PowerShell.
