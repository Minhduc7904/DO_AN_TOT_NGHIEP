# `@aiops-lms/ai`

## Trách nhiệm

Cổng (gateway) tới các LLM provider tương thích OpenAI chat-completions, và nơi **trích văn bản tài liệu và chạy job AI soạn bài** (R-08). Sở hữu `ai_db`: provider (loại, base URL, API key mã hóa), model, gắn model vào tác vụ (service binding), nhật ký gọi (`ai_invocations`, chỉ lưu số liệu: không nội dung prompt, không API key), `ai_documents` (văn bản trích xuất theo `media_id`) và `ai_jobs` (job `SYNTHESIZE_LESSON`/`GENERATE_QUIZ`), cùng outbox/inbox. Cổng 3009 (API) và 3011 (`ai-worker`).

Có hai bề mặt (ADR-004):

- **Public** `/api/v1/ai/**` (Gateway gọi, chỉ `admin`): CRUD provider, health check một/tất cả provider, CRUD model, `service-bindings` theo khóa tác vụ (`document-extraction`, `lesson-synthesis`, `quiz-authoring`) và `options`.
- **Internal** (audience `ai`, không qua Gateway):
  - `POST /internal/v1/ai/completions` (scope `ai:completion`): body `{task, messages, tools}`, `messages` có thể chứa phần ảnh/PDF base64; tra binding của `task`, giải mã API key, gọi provider. `ai-worker` dùng cùng use case nhưng gọi trong process.
  - `POST /internal/v1/ai/documents/sync` (`ai:document:write`), `POST …/documents/query` (`ai:document:read`): `course` gửi metadata tệp đính kèm; `ai` xếp hàng trích xuất hoặc trả trạng thái.
  - `POST /internal/v1/ai/jobs` (`ai:job:write`, 202), `GET …/jobs?lesson_id=` và `GET …/jobs/{job_id}?lesson_id=` (`ai:job:read`): `course` tạo/tra cứu job, truyền `requested_by` tường minh. `ai` không biết khóa học hay quyền.

Hai tiến trình dùng chung một image: `ai` (API, relay outbox) và `ai-worker` (`node dist/worker.js` hay `pnpm start:worker`, cổng 3011, chỉ `/health` `/ready`; consumer RabbitMQ).

Route và mã lỗi: [`http-and-event-contracts-v2.md` §4.7](../../../docs/processed/architecture/http-and-event-contracts-v2.md); sở hữu dữ liệu: [`data-ownership-and-fault-matrix-v2.md`](../../../docs/processed/architecture/data-ownership-and-fault-matrix-v2.md).

## Cấu trúc

```text
src/domain/                      loại provider, khóa tác vụ, trạng thái health, lỗi
src/application/ports/           repository, SecretProtector, ChatClient, ProviderProbe, Clock
src/application/use-cases/       providers/ models/ bindings/ options/ completions/ — mỗi use case một class
src/adapters/http/{public,internal,shared}
src/adapters/persistence/        Prisma repository
src/adapters/security/           AES-256-GCM (AesGcmSecretProtector)
src/adapters/provider/           client chat-completions và probe `GET /models` (fetch, không theo redirect)
src/application/use-cases/documents/  sync, query, extract (worker)
src/application/use-cases/jobs/       create, list, get, run (worker), prompt và tool của agent
src/adapters/clients/            course-http (ai-worker -> course), media-http (ai-worker -> media, byte)
src/adapters/documents/          DocxMarkdownExtractor
src/adapters/messaging/          OutboxRelayService (API), AiWorkerRunner (consumer)
src/worker.ts, worker.module.ts  entrypoint và module của ai-worker
```

## Luồng đáng chú ý

- **API key**: mã hóa AES-256-GCM bằng `AI_ENCRYPTION_KEY`, lưu `base64(nonce 12 byte | tag 16 byte | ciphertext)` với nonce ngẫu nhiên mỗi lần. API chỉ trả `api_key_hint` (`****` + 4 ký tự cuối). `PUT` không gửi `api_key` thì giữ key cũ. Ciphertext hỏng hoặc đổi khóa thì completion trả `409 AI_PROVIDER_KEY_UNREADABLE`.
- **Completion**: mọi loại provider đi qua cùng adapter chat-completions (Anthropic thêm header riêng; PDF gửi dạng `file` cho OpenAI-compatible, dạng `image_url` cho Gemini). Không retry; timeout mặc định 240 giây (`AI_COMPLETION_TIMEOUT_MS`). Không theo redirect để API key không sang host khác.
- **Lỗi provider** (không bao giờ lộ API key hay host trong response/log): provider 400/422 → `422 AI_PROVIDER_REJECTED_REQUEST` (thông điệp đã che); 401/403/429/5xx/phản hồi sai định dạng → `502 AI_PROVIDER_ERROR` với `details.reason`; hết thời gian → `504 DEPENDENCY_TIMEOUT`; không kết nối được → `503 DEPENDENCY_UNAVAILABLE`; tác vụ chưa gắn model → `409 AI_TASK_NOT_CONFIGURED`.
- **Health check**: `GET {base_url}/models` với timeout `AI_HEALTH_CHECK_TIMEOUT_MS`; kết quả `ONLINE`/`AUTH_FAILED`/`UNREACHABLE`/`ERROR`/`DISABLED`, không ghi DB.
- **Telemetry**: dependency `ai-postgres` và `ai-llm-provider` qua `observeDependency`; lần gọi lỗi cũng ghi `ai_invocations` (`FAILED` + mã lỗi).

## Tài liệu và job AI (R-08)

- **Command** (`lms/contracts/src/commands/ai.ts`, catalogue §6.3): `ai.document.extract` (producer `ai` khi `documents/sync`, `media` khi tệp có cờ `extract_text` thành `READY`; queue `ai-worker--extract-ai-document-v1`) và `ai.job.run` (producer `ai`; queue `ai-worker--run-ai-job-v1`). Mỗi job/tài liệu đúng một command, ghi vào outbox cùng transaction với bản ghi.
- **Lease, không self-enqueue**: tính đúng đắn đến từ máy trạng thái + lease (`UPDATE … WHERE status=…`), không từ inbox. Command giao lại khi bản ghi đang xử lý còn lease là no-op; job `RUNNING` quá lease (`AI_WORKER_LEASE_MS`, mặc định 10 phút, gia hạn trước mỗi lượt gọi model) thành `FAILED`/`WORKER_INTERRUPTED` và không chạy lại (tránh tạo trùng quiz/ghi đè lần hai). Tài liệu `PROCESSING` quá lease chỉ được phục hồi khi `documents/sync` được gọi lại (hết 3 lần thì `FAILED`/`EXTRACTION_INTERRUPTED`). Kết quả cuối được ghi cùng `inbox_states` nên command đã xong bị khử trùng; command vào `<queue>.error` thì `onFault` đặt `FAILED`.
- **Trích xuất**: TXT/MD đọc thẳng, DOCX qua `DocxMarkdownExtractor`, PDF/ảnh qua provider (task `document-extraction`). Byte lấy từ `media` (`GET /internal/v1/media/{id}/content`, scope `media:content:read`, ≤ 15 MB). Văn bản > 300.000 ký tự bị cắt kèm ghi chú.
- **Job**: đọc `ai-context` của `course`, vòng agent tối đa 6 lượt với một tool (`save_lesson_content` hoặc `create_quiz`) gọi `PUT …/ai-content` / `POST …/ai-quizzes` của `course` dưới danh nghĩa `requested_by`; dữ liệu quiz sai (400) được trả lại model. Tổng văn bản ≤ 150.000 ký tự. Mỗi `(lesson_id, job_type)` có tối đa một job `PENDING|RUNNING` (partial unique index `ai_jobs_one_active`).
- **Vòng phụ thuộc** `course → ai → course`: chiều ngược do `ai-worker` gọi bất đồng bộ; telemetry `dependency_identity=ai-worker-course` / `ai-worker-media`.
- Orphan: xóa media/bài học không xóa `ai_documents`/`ai_jobs` (chưa có retention).

## Cấu hình

Biến môi trường `AI_*` ở [`env.schema.ts`](src/config/env.schema.ts) (`validateEnvironment` cho API, `validateWorkerEnvironment` cho `ai-worker`), ví dụ ở [`.env.example`](.env.example). API cần `AI_RABBITMQ_URL`/`AI_OUTBOX_*`; worker thêm `SERVICE_CLIENT_ID/SECRET`, `AI_COURSE_BASE_URL`, `AI_MEDIA_BASE_URL`, `AI_WORKER_*`. `AI_ENCRYPTION_KEY` bắt buộc (base64 của đúng 32 byte); thiếu hoặc sai độ dài thì service từ chối khởi động. Sinh khóa: `openssl rand -base64 32`.

## Chạy test

```bash
pnpm --filter @aiops-lms/ai build
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/ai/jest.config.ts   # unit
pnpm run test:ai:e2e   # cần AI_DATABASE_URL (đã migrate, DB tạm vì e2e TRUNCATE các bảng ai_*) và RabbitMQ (AI_RABBITMQ_URL, mặc định 127.0.0.1:55672)
```

E2E dựng HTTP stub cho provider, `course` và `media`, chạy cả API lẫn `ai-worker` với PostgreSQL và RabbitMQ thật (hai spec chạy tuần tự vì dùng chung DB và queue).
