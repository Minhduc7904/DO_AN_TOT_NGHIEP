# Hướng dẫn tự dựng testbed và hiểu 7 luồng W1–W7

> **File này giải thích gì:** cách tự dựng toàn bộ testbed (LMS + bộ quan sát) trên máy của bạn theo từng bước, cách tạo traffic cho từng luồng nghiệp vụ, cách tìm và đọc trace trong Grafana, và giải thích chi tiết 7 luồng W1–W7 kèm **trace thật** chụp từ stack. Đây là tài liệu để hoàn thành **điều kiện 5 của Gate R**: tự dựng stack từ máy sạch theo README và tự giải thích được W1–W7. Phần J (mới) hướng dẫn dùng thêm các công cụ của tuần 13: lớp gây lỗi, k6 mức 1, export và kiểm chất lượng telemetry.
>
> **Nguồn gốc (canonical):**
>
> - [`../../../README.md`](../../../README.md), [`../../../lms/README.md`](../../../lms/README.md), [`../../../docker-compose/README.md`](../../../docker-compose/README.md), [`../../../postman/README.md`](../../../postman/README.md)
> - [`../architecture/service-catalogue-and-topology-v2.md`](../architecture/service-catalogue-and-topology-v2.md) (mục 7: workflow view)
> - [`../../../lms/test/regression/`](../../../lms/test/regression/) (7 workflow), [`../../../lms/test/observability/support/flow-matrix.mjs`](../../../lms/test/observability/support/flow-matrix.mjs) (span bắt buộc của từng luồng)
> - [`../architecture/complex-case-catalogue-and-rca-result-v0.md`](../architecture/complex-case-catalogue-and-rca-result-v0.md) (case C1–C7)
> - [`../plan/plan-v0.4-24-weeks.md`](../plan/plan-v0.4-24-weeks.md) (Gate R, giữ nguyên từ plan v0.3)
> - Phần J: README của `aiops-platform/faults/` (PR #75), `aiops-platform/load/` (PR #76), `aiops-platform/training/` (PR #77, #79), đọc trên nhánh PR cho tới khi merge
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge). Mọi lệnh và trace ở phần A–I đã được chạy thật ngày 17/11/2026 trên một bản clone mới của `main` (commit `a4545fb`), theo đúng README; các commit sau đó trên `main` (PR #74) chỉ sửa tài liệu. Lệnh ở phần J chép từ README của các PR tuần 13 (đã chạy khi làm PR), chưa chạy lại trên `main` vì PR chưa merge.

---

## Cách dùng file này

Tổng thời gian dự kiến: **2–3 tiếng**, chia làm 3 chặng:

| Chặng | Việc | Thời gian ước lượng |
| --- | --- | --- |
| 1 | Phần A–C: chuẩn bị máy, dựng stack, kiểm tra stack sống | 30–60 phút (lần đầu build image lâu nhất) |
| 2 | Phần D–E: học cách tạo traffic và đọc trace | 20 phút |
| 3 | Phần F: đi qua W1–W7, mỗi luồng: chạy → mở trace → **tự giải thích bằng lời của mình** | 60–90 phút |
| (sau) | Phần J: lớp gây lỗi, k6 mức 1, export + kiểm chất lượng (cần merge PR #75–#79 trước; không thuộc Gate R) | 30–45 phút |

Các khái niệm như service, worker, trace, span, outbox, token… đã giải thích ở [`02-basic-concepts.md`](02-basic-concepts.md). Nếu gặp từ lạ, mở file đó.

Ký hiệu trong sơ đồ: `→` là gọi đồng bộ (HTTP, chờ trả lời); `⇒` là gửi command bất đồng bộ qua RabbitMQ; `[x]` là tên runtime.

---

# Phần A — Chuẩn bị máy

## A1. Yêu cầu

| Thứ cần có | Ghi chú |
| --- | --- |
| Docker Engine + Docker Compose v2 | Lệnh `docker compose version` phải chạy được |
| RAM | Stack đầy đủ (LMS + observability) có 21 container; thêm lớp gây lỗi (phần J) là 23. README khuyên cấp cho Docker khoảng **8 GB**. Máy 15 GB thì nên đóng bớt trình duyệt, Discord… khi chạy, và kiểm `free -h` trước lệnh nặng |
| Node.js `22.13.1` | Cài qua `nvm` |
| pnpm `11.19.0` | Đi kèm Node qua Corepack, không cài riêng |
| Cổng trống | Xem bảng ở A4 |

## A2. Kiểm tra Docker đang trỏ đúng chỗ

Trên máy của bạn có **hai** Docker: Docker Desktop và Docker Engine cài thẳng trên Linux. Nếu đang chọn Docker Desktop mà Desktop lại không chạy, mọi lệnh `docker` sẽ báo lỗi kiểu:

```text
failed to connect to the docker API at unix:///home/<bạn>/.docker/desktop/docker.sock
```

Cách xử lý:

```bash
docker context ls            # xem đang chọn context nào (dấu *)
docker context use default   # chuyển sang Docker Engine của Linux
docker ps                    # phải chạy được, không báo lỗi
```

(Hoặc mở Docker Desktop lên, nếu bạn muốn dùng Desktop.)

## A3. Cài đúng phiên bản Node và pnpm

Repo **ghim cứng** phiên bản: Node `22.13.1`, pnpm `11.19.0`. Sai phiên bản thì pnpm từ chối chạy với lỗi `ERR_PNPM_UNSUPPORTED_ENGINE`.

```bash
cd <thư-mục-repo>/lms
nvm install 22.13.1     # chỉ cần lần đầu
nvm use                 # đọc file lms/.nvmrc → chuyển sang 22.13.1
hash -r                 # bắt shell quên đường dẫn node cũ (nếu không, node --version có thể vẫn báo bản cũ)
node --version          # phải là v22.13.1
corepack enable         # bật Corepack để nó tự chọn đúng pnpm
pnpm --version          # phải là 11.19.0 khi đang đứng trong lms/
```

**Luôn chạy lệnh `pnpm` từ bên trong thư mục `lms/`.** Corepack chọn phiên bản pnpm theo file `lms/package.json`. Đứng ở thư mục gốc repo (không có `package.json`) thì nó dùng pnpm mặc định của máy (trên máy bạn là `9.15.9`) và sẽ bị chặn.

## A4. Các cổng sẽ bị chiếm

Kiểm tra không có chương trình nào khác đang dùng các cổng sau (`ss -ltn` để xem):

| Cổng | Thành phần | Cổng | Thành phần |
| --- | --- | --- | --- |
| `3000` | gateway | `5432` | PostgreSQL |
| `3001` | identity | `5672` / `15672` | RabbitMQ / trang quản trị RabbitMQ |
| `3003` | course | `9000` / `9001` | MinIO API / console |
| `3004` / `3005` | media / media-worker | `1025` / `8025` | Mailpit SMTP / giao diện Mailpit |
| `3006` / `3007` | notification / notification-worker | `4317` / `4318` | OTel Collector |
| `3009` / `3011` | ai / ai-worker | `9090` | Prometheus |
| `3018` / `3010` | scheduler / scheduler-worker | `3200` | Tempo |
| `3008` | **Grafana** (không phải scheduler) | `3100` | Loki |

`scheduler` bên trong mạng Docker dùng cổng `3008`, nhưng ra ngoài máy được đổi thành `3018`, vì `3008` đã dành cho Grafana.

Nếu một cổng đã bị chiếm, ví dụ Loki `3100`, đặt biến trước mọi lệnh compose: `LOKI_PORT=13100 docker compose ...`.

---

# Phần B — Dựng stack từng bước

Tất cả lệnh ở phần này chạy từ **thư mục gốc repo**, trừ khi ghi khác.

## B1. Lấy code mới nhất

```bash
git switch main
git pull --ff-only
```

## B2. Cài thư viện

```bash
cd lms
pnpm install --frozen-lockfile    # --frozen-lockfile: cài đúng phiên bản trong lockfile, không tự nâng cấp
cd ..
```

Kết quả mong đợi: dòng cuối dạng `Done in …s using pnpm v11.19.0`.

## B3. Tạo file cấu hình `.env`

```bash
cp docker-compose/.env.example docker-compose/.env
```

File `.env` chứa mật khẩu dùng thử (không phải bí mật thật) và được Git bỏ qua. Biến `COMPOSE_PROJECT_NAME=aiops-lms` quyết định tiền tố tên container, ví dụ `aiops-lms-course-1`.

## B4. Kiểm tra cấu hình Compose có hợp lệ không

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml config --quiet
```

Không in gì nghĩa là hợp lệ. File `compose.full.yaml` **ghép** LMS (`docker-compose/compose.yaml`) với bộ quan sát (`aiops-platform/observability/compose.yaml`).

## B5. Build và khởi động toàn bộ

```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml up --build -d --wait
```

Giải thích từng phần của lệnh:

| Phần | Nghĩa |
| --- | --- |
| `COMPOSE_PARALLEL_LIMIT=1` | Build từng image một, tránh tràn RAM (README khuyên khi máy hạn chế RAM) |
| `up` | Tạo và chạy container |
| `--build` | Build image từ code hiện tại trước khi chạy |
| `-d` | Chạy nền, trả lại terminal |
| `--wait` | Chỉ báo xong khi **mọi** container đã "healthy" (qua bài kiểm tra sức khỏe) |

Lần đầu trên máy chưa có cache, việc build image mất khá lâu (tải image nền, cài thư viện, biên dịch TypeScript). Các lần sau nhanh hơn nhiều nhờ cache.

Khi khởi động, mỗi service có database tự chạy `prisma migrate deploy` để tạo bảng, và `identity` tự tạo 3 tài khoản mẫu.

## B6. Xem trạng thái

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml ps
```

Phải thấy **21 thành phần**, tất cả `(healthy)`:

```text
LMS (11 runtime):  gateway, identity, course, media, media-worker, notification,
                   notification-worker, scheduler, scheduler-worker, ai, ai-worker
Hạ tầng LMS (5):   postgres, rabbitmq, minio, minio-init, mailpit
Quan sát (5):      otel-collector, prometheus, tempo, loki, grafana
```

`minio-init` là container phụ chạy một lần để tạo 5 bucket trong MinIO.

---

# Phần C — Kiểm tra stack sống và các trang quản trị

## C1. Ba lệnh kiểm tra nhanh

```bash
curl --fail http://localhost:3003/ready     # course: sẵn sàng, đã nối được PostgreSQL
curl --fail http://localhost:3001/health    # identity: còn sống (gọi thẳng, không qua gateway)
```

Kết quả mẫu của `/ready` (đã chạy thật):

```json
{"success":true,"data":{"status":"ok","checks":{"postgres":"ok"},...},"error":null,
 "meta":{"trace_id":"83b1d0fa8d44a3846736fed3b67bb8b8",...}}
```

Để ý trường `meta.trace_id`: **mọi response đều trả kèm `trace_id`**. Bạn dán mã này vào Grafana là ra trace của chính request đó (mục D2).

`/health` chỉ hỏi "chương trình còn sống không". `/ready` hỏi thêm "đã sẵn sàng phục vụ chưa" (nối được database chưa).

## C2. Thử một luồng thật: đăng nhập rồi tạo khóa học

```bash
login=$(curl --fail --silent --show-error -H 'content-type: application/json' \
  -d '{"email":"instructor@example.test","password":"example-password"}' \
  http://localhost:3000/api/v1/auth/instructor/login)
token=$(printf '%s' "$login" | node -e 'let t="";process.stdin.on("data",c=>t+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(t).data.access_token))')

curl --fail -H "Authorization: Bearer $token" -H 'content-type: application/json' \
  -d '{"name":"Khóa học thử"}' http://localhost:3000/api/v1/courses
curl --fail -H "Authorization: Bearer $token" http://localhost:3000/api/v1/courses
```

Kết quả: khóa học mới ở trạng thái `DRAFT`, có `instructor_id` là `22222222-2222-4222-8222-222222222222` (id cố định của tài khoản giảng viên mẫu).

Ba tài khoản mẫu (mật khẩu đều là `example-password`):

| Email | Vai trò | Cửa đăng nhập |
| --- | --- | --- |
| `admin@example.test` | admin | `POST /api/v1/auth/admin/login` |
| `instructor@example.test` | giảng viên | `POST /api/v1/auth/instructor/login` |
| `student@example.test` | học viên | `POST /api/v1/auth/student/login` |

Đăng nhập **sai cửa** (ví dụ học viên vào cửa giảng viên) sẽ bị từ chối.

## C3. Các trang quản trị nên mở thử

| Trang | Địa chỉ | Đăng nhập | Dùng để |
| --- | --- | --- | --- |
| **Grafana** | http://localhost:3008 | `admin` / `grafana-local-only` | Xem trace, metric, log (dùng nhiều nhất) |
| Mailpit | http://localhost:8025 | không cần | Xem email mà hệ thống "gửi" (W5) |
| RabbitMQ | http://localhost:15672 | `lms` / `lms-local-only` | Xem các queue, số message đang chờ |
| Prometheus | http://localhost:9090 | không cần | Gõ thẳng truy vấn metric |

**MinIO console (`9001`) hiện không mở được**, dù README có nhắc. Image MinIO đang dùng không còn giao diện web, chỉ còn API ở cổng `9000`. Đây là một điểm README cần sửa.

---

# Phần D — Tạo traffic và đọc trace

## D1. Cách tạo traffic cho từng luồng

Cách dễ nhất là chạy **chính file regression của luồng đó** lên stack đang chạy. Mỗi file là một kịch bản người dùng hoàn chỉnh. Chuẩn bị một lần:

```bash
cd lms
pnpm --filter @aiops-lms/contracts build     # build bộ schema mà regression dùng để kiểm response
export REGRESSION_GATEWAY_URL=http://127.0.0.1:3000
export REGRESSION_MAILPIT_URL=http://127.0.0.1:8025
```

Rồi chạy từng luồng, ví dụ W1:

```bash
node --test test/regression/auth-register-login.regression.mjs
```

| Luồng | File regression | Cần chuẩn bị thêm |
| --- | --- | --- |
| W1 | `auth-register-login.regression.mjs` | không |
| W2 | `course-authoring.regression.mjs` | không |
| W3 | `enroll-and-learn.regression.mjs` | không |
| W4 | `media-upload.regression.mjs` | không |
| W5 | `notification-batch-email.regression.mjs` | không |
| W6 | `ai-lesson.regression.mjs` | **provider AI giả** (mục F6) |
| W7 | `media-cleanup-scheduler.regression.mjs` | **khởi động lại `media` với thời gian giữ bằng 0** (mục F7) |

Ngoài ra có thể chạy bằng Postman/newman (`postman/README.md`), hoặc gõ `curl` tay như mục C2.

## D2. Tìm trace trong Grafana

Cách 1, theo `trace_id`: mọi response có `meta.trace_id`. Trong Grafana: menu trái **Explore** → chọn datasource **Tempo** → tab **TraceQL** → dán `trace_id` → **Run query**.

Cách 2, theo luồng: dùng truy vấn TraceQL "trace có đủ các service này". Mỗi luồng ở phần F có sẵn truy vấn, ví dụ W5:

```text
{ resource.service.name = "gateway" } && { resource.service.name = "notification" } && { resource.service.name = "notification-worker" } && { resource.service.name = "identity" }
```

Cách 3, theo tên span: `{ name = "POST /api/v1/auth/register" }`.

Bấm vào một trace để mở **biểu đồ thác nước** (waterfall): mỗi thanh ngang là một span, thanh càng dài thì càng tốn thời gian, thanh lùi vào trong là span con.

Từ một span, bấm biểu tượng **Logs for this span** để nhảy sang Loki và xem log của đúng span đó (Grafana đã cấu hình sẵn liên kết trace → log).

Dashboard có sẵn: **Dashboards → AIOps LMS — Service overview**, gồm 4 nhóm biểu đồ: RED theo service, RED theo route, dependency và hàng đợi (broker), trace lỗi và log lỗi gần đây.

**Lưu ý:** Tempo bị giới hạn 512 MB RAM và từng bị tắt vì hết bộ nhớ khi bị truy vấn hàng nghìn trace cùng lúc. Đừng chọn khoảng thời gian quá dài với giới hạn số trace quá lớn.

## D3. Đọc một cây span: 6 mẹo

Các cây span trong phần F được in theo dạng:

```text
tên span  [runtime] LOẠI  thời gian
  span con  [runtime] LOẠI  thời gian
```

1. **Span gốc của gateway luôn tên `POST /api/v1/*path`** (hoặc `GET`/`PATCH`…). `*path` nghĩa là "mọi đường dẫn", vì gateway chỉ chuyển tiếp. Muốn biết đường dẫn thật, nhìn span `SERVER` của service bên dưới, ví dụ `POST /api/v1/courses/:course_id/lessons`.
2. **Tên span CLIENT có dạng `<dependency_identity> <operation_name>`**, ví dụ `course-postgres lesson.create` = "`course` gọi `course-postgres`, thao tác tạo bài học". Bảng tra tên ở [`10-naming-cheatsheet.md`](10-naming-cheatsheet.md).
3. **`:course_id`, `:studentId`… là chỗ trống của mẫu đường dẫn**, không phải ID thật. Đây là cách giữ label metric không chứa ID (sửa ngày 17/11/2026).
4. **Span PRODUCER (gửi command) nằm *dưới* span ghi database**, ví dụ dưới `course-postgres lesson.create`. Lý do: command được ghi vào outbox **trong lúc** ghi database, kèm "số hồ sơ" `traceparent` lúc đó. Relay gửi command **sau**, có khi sau khi người dùng đã nhận response, nhưng vẫn gắn vào đúng chỗ trong trace.
5. **Span CONSUMER (worker xử lý) có thể kéo dài sau khi span gốc đã kết thúc.** Gateway trả lời trong 12 ms, nhưng worker gửi email mất thêm 140 ms. Trên waterfall, thanh của worker thò ra ngoài thanh gốc. Điều này bình thường với luồng bất đồng bộ.
6. **Span lấy token (`…-identity-token`) và JWKS (`…-identity-jwks`) chỉ thỉnh thoảng xuất hiện**, khi cache hết hạn và service phải xin lại. Phần lớn request không có chúng. Đây là lý do khi `identity` chết, lỗi xuất hiện **rải rác và muộn** (case C6).

---

# Phần E — Bản đồ chung của 7 luồng

```text
                           ┌──────────────────────── Người dùng (student / instructor / admin)
                           │
                           ▼
                       [gateway] ──── kiểm token người dùng (JWKS của identity)
       ┌──────────┬────────┼───────────┬──────────────┬─────────────┐
       ▼          ▼        ▼           ▼              ▼             ▼
  [identity]  [course]  [media]  [notification]  [scheduler]      [ai]
     W1       W2 W3 W6    W4 W7         W5            W7             W6
       ▲          │ ⇒       │ ⇒          │ ⇒            ┆ (đọc DB)      │ ⇒
       │          │  [media-worker]   [notification-  [scheduler-   [ai-worker]
       │          │       ▲              worker]        worker]        │
       │          └───────┘ (usage)   → identity       → media         → course, media,
       │                              → SMTP                           → nhà cung cấp LLM
       └── mọi service xin service token và tải JWKS từ identity
```

| ID | Luồng | Runtime tham gia | Đồng bộ / bất đồng bộ | Hạ tầng chạm tới |
| --- | --- | --- | --- | --- |
| **W1** | Đăng ký, đăng nhập | gateway, identity | đồng bộ | `identity-postgres` |
| **W2** | Soạn khóa học | gateway, course, media-worker | đồng bộ + 1 command | `course-postgres`, `media-postgres`, RabbitMQ |
| **W3** | Ghi danh và học | gateway, course | đồng bộ | `course-postgres` |
| **W4** | Upload media | gateway, media, media-worker | đồng bộ + 1 command | MinIO, `media-postgres`, RabbitMQ |
| **W5** | Thông báo hàng loạt + email | gateway, notification, notification-worker, identity | đồng bộ + chuỗi 2 command | `notification-postgres`, SMTP, RabbitMQ |
| **W6** | AI soạn bài, sinh quiz | gateway, course, media, ai, ai-worker, media-worker | đồng bộ + command + gọi ngược về course | `ai-postgres`, LLM, MinIO, RabbitMQ |
| **W7** | Dọn media không dùng | scheduler, scheduler-worker, media | đọc DB định kỳ + đồng bộ | `scheduler-postgres`, `media-postgres`, MinIO |

Từ W1 tới W7, độ phức tạp tăng dần. W3 đơn giản nhất (chỉ một service). W5 và W6 dài nhất, là "đất diễn" của các case lỗi khó.

---

# Phần F — Đi qua từng luồng

Mỗi luồng gồm: câu chuyện người dùng → đường đi → chạy thử → trace thật → đọc trace → điểm dễ hỏng và case liên quan → **tự giải thích** (phần bạn tự làm, có đáp án tham khảo để đối chiếu sau).

## F1. W1 — Đăng ký và đăng nhập

### Câu chuyện

Một sinh viên mở trang web, **đăng ký** tài khoản bằng email và mật khẩu, rồi **đăng nhập** để nhận "thẻ ra vào" (access token). Từ đó mọi thao tác khác đều trình thẻ này. Giảng viên và admin cũng đăng nhập như vậy nhưng qua cửa riêng.

### Đường đi

```text
Người dùng → [gateway] → [identity] → identity-postgres
                                       (đăng ký: tạo tài khoản + hồ sơ student trong MỘT transaction)
                                       (đăng nhập: tìm tài khoản theo email, kiểm mật khẩu, lưu refresh token)
```

Các thao tác chính trong kịch bản regression:

| Bước | Endpoint | Kết quả |
| --- | --- | --- |
| Đăng ký | `POST /api/v1/auth/register` | `201`; đăng ký trùng email → `409` |
| Đăng nhập học viên | `POST /api/v1/auth/student/login` | access token + refresh token |
| Xem tài khoản | `GET /api/v1/auth/me`, `GET /api/v1/students/me` | cùng một id |
| Đổi token | `POST /api/v1/auth/refresh` | token mới; dùng lại refresh token cũ → `401` (xoay vòng) |
| Sai mật khẩu / sai cửa / email lạ | `POST /api/v1/auth/<cửa>/login` | bị từ chối |
| Admin tạo giảng viên | `POST /api/v1/auth/accounts` | học viên gọi → `403` |
| Không token / token rác / tự khai danh tính | bất kỳ | không token → `401`; có token học viên mà tự khai là admin → vẫn `403` |

"Tự khai danh tính" là kẻ gian tự thêm header `x-principal-id`, `x-principal-role` để giả làm người khác. Gateway **xóa** các header này rồi tự điền lại từ token thật, nên không giả được.

### Chạy thử

```bash
node --test test/regression/auth-register-login.regression.mjs
```

Truy vấn TraceQL: `{ name = "POST /api/v1/auth/register" }` hoặc `{ name =~ "POST /api/v1/auth/.*/login" }`.

### Trace thật (17/11/2026)

Đăng nhập giảng viên, 5 span:

```text
POST /api/v1/*path                         [gateway]  SERVER  38.1ms
  gateway-identity POST                    [gateway]  CLIENT  37.2ms
    POST /api/v1/auth/instructor/login     [identity] SERVER  36.2ms
      identity-postgres account.find-by-email  [identity] CLIENT 1.3ms
      identity-postgres refresh-token.save     [identity] CLIENT 1.7ms
```

Đăng ký, 4 span:

```text
POST /api/v1/*path                         [gateway]  SERVER  38.1ms
  gateway-identity POST                    [gateway]  CLIENT  37.3ms
    POST /api/v1/auth/register             [identity] SERVER  36.4ms
      identity-postgres account.create-student  [identity] CLIENT 2.9ms
```

### Đọc trace

- Gần hết thời gian (~36 ms) nằm trong `identity`, nhưng hai lần gọi database chỉ tốn ~3 ms. Phần còn lại là **băm/kiểm mật khẩu** bằng thuật toán `scrypt`, một phép tính cố ý chậm để chống dò mật khẩu. Nó không có span riêng, nên trên trace là "khoảng trống" bên trong span `identity`.
- Đăng ký chỉ có **một** span database (`account.create-student`) dù tạo hai bản ghi (tài khoản + hồ sơ): cả hai nằm trong một transaction.

### Điểm dễ hỏng và case liên quan

- `identity` chết → đăng nhập lỗi **ngay** (`504` tại `gateway-identity`), nhưng các request khác còn chạy một thời gian rồi mới lỗi hàng loạt: **C6** (MVP).
- `identity` đổi khóa ký mà không giữ khóa cũ → sau khi cache JWKS 5 phút hết hạn, nhiều service trả `401` cùng lúc: **C7** (Target).

### Tự giải thích (phần của bạn)

Trả lời bằng lời của mình, rồi mới mở đáp án:

1. Vì sao đăng ký chỉ có một span database dù tạo hai bản ghi?
   <details><summary>Đáp án tham khảo</summary>Tài khoản và hồ sơ student được tạo trong cùng một transaction, được bọc chung trong một lời gọi <code>observeDependency</code> tên <code>account.create-student</code>.</details>
2. Nếu `identity-postgres` chậm thêm 2 giây, span nào dài ra? Người dùng thấy gì?
   <details><summary>Đáp án tham khảo</summary>Span <code>identity-postgres account.find-by-email</code> (hoặc <code>account.create-student</code>) dài ra, kéo theo span SERVER của identity, span <code>gateway-identity</code> và span gốc. Người dùng thấy đăng nhập/đăng ký chậm hơn khoảng 2 giây; chưa lỗi nếu chưa vượt timeout của gateway.</details>
3. Sau khi đăng nhập, khi học viên xem khóa học (W3), `identity` có tham gia không?
   <details><summary>Đáp án tham khảo</summary>Thường không: gateway kiểm token bằng JWKS đã cache, không hỏi identity. Identity chỉ xuất hiện khi gateway cần tải lại JWKS hoặc xin service token mới.</details>

---

## F2. W2 — Giảng viên soạn khóa học

### Câu chuyện

Giảng viên tạo khóa học (trạng thái `DRAFT`), thêm bài học, sắp xếp thứ tự, sửa nội dung bài học (viết bằng markdown, có thể chèn ảnh), tạo quiz, rồi **xuất bản** (`PUBLISHED`) để học viên thấy. Giảng viên còn xem thống kê và **xuất danh sách khóa học ra file CSV**.

### Đường đi

```text
Giảng viên → [gateway] → [course] → course-postgres
                            │
                            └─(outbox)⇒ RabbitMQ ⇒ [media-worker] → media-postgres
                                 command media.markdown-usage.synchronize
                                 "bài học này đang dùng những ảnh nào"
```

Vì sao lại có `media-worker`? Nội dung bài học có thể chứa ảnh (ảnh nằm ở `media`). `media` cần biết **ảnh nào đang được dùng ở đâu** (gọi là *usage*), để sau này không xóa nhầm ảnh đang dùng (W7). Mỗi khi bài học/khóa học/quiz được tạo hoặc sửa, `course` gửi command "đồng bộ usage" cho `media-worker`.

| Bước | Endpoint | Ghi chú |
| --- | --- | --- |
| Tạo khóa học | `POST /api/v1/courses` | `DRAFT`; học viên gọi → `403` |
| Thêm bài học | `POST /api/v1/courses/:course_id/lessons` | trùng thứ tự → `409` |
| Sắp xếp, sửa bài học | `PUT …/lessons/reorder`, `PATCH …/lessons/:lesson_id` | |
| Quiz | `…/lessons/:lesson_id/quizzes` | quiz `DRAFT`, sửa cây câu hỏi |
| Xuất bản | `PATCH /api/v1/courses/:course_id` | `PUBLISHED` |
| Tìm kiếm, tổng hợp, xuất CSV | `GET /api/v1/courses?search=…`, `GET /api/v1/courses/summary`, `GET /api/v1/courses/export` | CSV đọc từng khối 500 dòng |
| Xóa | `DELETE /api/v1/courses/:course_id` | sau đó `GET` → `404` |

### Chạy thử

```bash
node --test test/regression/course-authoring.regression.mjs
```

Truy vấn TraceQL: `{ resource.service.name = "gateway" } && { resource.service.name = "course" } && { resource.service.name = "media-worker" }`.

### Trace thật (17/11/2026): thêm bài học, 12 span

```text
POST /api/v1/*path                                   [gateway]      SERVER   6.1ms
  gateway-course POST                                [gateway]      CLIENT   5.2ms
    POST /api/v1/courses/:course_id/lessons          [course]       SERVER   4.3ms
      course-postgres course.find-by-id              [course]       CLIENT   0.8ms
      course-postgres lesson.create                  [course]       CLIENT   2.4ms
        lms.commands publish media.markdown-usage.synchronize   [course] PRODUCER 0.5ms
          media-worker--synchronize-markdown-media-usage-v1 process  [media-worker] CONSUMER 7.2ms
            media-postgres job.ensure                [media-worker] CLIENT   2.3ms
            media-postgres usage.list-by-group       [media-worker] CLIENT   0.8ms
            media-postgres media.find-many           [media-worker] CLIENT   0.7ms
            media-postgres usage.next-position       [media-worker] CLIENT   0.5ms
            media-postgres job.update                [media-worker] CLIENT   0.7ms
```

### Đọc trace

- Phần đồng bộ (gateway → course → database) chỉ ~6 ms. Người dùng nhận `201` ngay.
- Command được gửi **từ trong** `lesson.create` (mẹo 4 ở D3): command được ghi vào outbox cùng lúc với bài học.
- `media-worker` làm việc sau, trong 7 ms: kiểm/ghi "job" đồng bộ (để không xử lý trùng), đọc danh sách usage hiện có, tìm các media được nhắc trong markdown, ghi usage mới.
- Đây là **chuỗi bất đồng bộ** đầu tiên mà RCA phải hiểu: lỗi ở `media-worker` **không** làm giảng viên thấy lỗi. Nó chỉ làm usage bị thiếu, và hậu quả lộ ra **rất muộn** ở W7.

### Điểm dễ hỏng và case liên quan

- `course-postgres` chậm → mọi thao tác của `course` chậm, không có span lỗi: **C2** (MVP, bản viết lại theo ADR-006 là chèn trễ trên kết nối `course` → `course-postgres`).
- Đồng bộ usage chỉ gắn những media đã `READY`. Ảnh còn `PENDING` (W4 chưa xong) thì chưa được gắn usage: một mắt xích của **C4**.

### Tự giải thích

1. Nếu `media-worker` dừng hẳn, giảng viên có thấy lỗi khi thêm bài học không? Lỗi lộ ra ở đâu?
   <details><summary>Đáp án tham khảo</summary>Không thấy lỗi: course vẫn trả 201 vì command chỉ được ghi vào outbox. Command nằm chờ trong queue <code>media-worker--synchronize-markdown-media-usage-v1</code> (backlog tăng, thấy trên metric hàng đợi). Hậu quả: usage không được cập nhật, có thể làm job dọn media (W7) coi ảnh là "không dùng".</details>
2. Vì sao span PRODUCER lại là con của `course-postgres lesson.create` chứ không phải con của span SERVER?
   <details><summary>Đáp án tham khảo</summary>Vì command được ghi vào outbox trong lúc thao tác database đó đang chạy, và <code>traceparent</code> lưu trong phong bì là của span database lúc ấy. Relay gửi sau và nối span PRODUCER vào đúng span đó.</details>

---

## F3. W3 — Học viên ghi danh và học

### Câu chuyện

Học viên tìm khóa học đã xuất bản, **ghi danh**, mở bài học, đánh dấu tiến độ, làm quiz (bắt đầu lượt làm, lưu đáp án, nộp bài) và nhận điểm ngay.

### Đường đi

```text
Học viên → [gateway] → [course] → course-postgres
```

Toàn bộ nằm trong **một service**. Đây là luồng đơn giản nhất, dùng làm "luồng đối chứng".

| Bước | Endpoint | Ghi chú |
| --- | --- | --- |
| Chưa ghi danh | `GET /api/v1/courses/:course_id/lessons` | bị chặn |
| Ghi danh | `POST /api/v1/student/courses/:course_id/enrollments` | `201`; ghi danh lại → `409` |
| Tiến độ | `…/student/lessons/:lesson_id/progress` | chỉ tăng, không giảm |
| Xem quiz | `GET /api/v1/student/quizzes/:quiz_id` | chỉ thấy khi quiz `PUBLISHED`; ẩn đáp án đúng |
| Làm bài | `POST …/quizzes/:quiz_id/attempts` → `PUT …/attempts/:attempt_id/answers` → `POST …/attempts/:attempt_id/submit` | chấm điểm ngay trong `course` |

### Chạy thử

```bash
node --test test/regression/enroll-and-learn.regression.mjs
```

Truy vấn TraceQL: `{ name = "POST /api/v1/student/courses/:course_id/enrollments" }`.

### Trace thật (17/11/2026): ghi danh, 5 span

```text
POST /api/v1/*path                                       [gateway] SERVER 4.7ms
  gateway-course POST                                    [gateway] CLIENT 3.7ms
    POST /api/v1/student/courses/:course_id/enrollments  [course]  SERVER 2.8ms
      course-postgres course.find-by-id                  [course]  CLIENT 0.8ms
      course-postgres enrollment.create                  [course]  CLIENT 1.1ms
```

### Đọc trace

Ngắn, thẳng, chỉ hai service. Nếu luồng này chậm, nghi phạm gần như chắc chắn là `course` hoặc `course-postgres`. Nhưng hãy cẩn thận: W2, W3 và một phần W6 **dùng chung** `course-postgres`, nên một nguyên nhân làm **cả ba** luồng chậm cùng lúc.

### Điểm dễ hỏng và case liên quan

- **C2** (MVP): chèn trễ trên kết nối `course` → `course-postgres`. Mọi span `course-postgres …` dài ra đồng loạt, không có span lỗi. Đây là **case đối chứng dễ**: kỳ vọng cả RCA engine lẫn baseline truy vết thủ công đều tìm ra, để phép so sánh trung thực.

### Tự giải thích

1. Vì sao C2 được gọi là "case đối chứng dễ"?
   <details><summary>Đáp án tham khảo</summary>Vì nguyên nhân nằm ngay trên đường đi của request: mở trace là thấy span <code>course-postgres …</code> dài bất thường. Người truy vết thủ công cũng tìm ra nhanh. Case này giúp chứng minh phép so sánh không bị dựng lên để AI luôn thắng.</details>
2. Khi `course-postgres` chậm, metric nào tăng? Nhãn `operation_name` có ích gì?
   <details><summary>Đáp án tham khảo</summary><code>lms_dependency_duration_seconds</code> với <code>dependency_identity="course-postgres"</code> tăng; tăng <b>đồng loạt theo mọi</b> <code>operation_name</code> (find-by-id, enrollment.create, …), là dấu hiệu "database chậm" chứ không phải một truy vấn cụ thể chậm.</details>

---

## F4. W4 — Upload media

### Câu chuyện

Người dùng tải một ảnh lên (ví dụ ảnh bìa khóa học, ảnh trong bài học, avatar). Hệ thống lưu file, kiểm tra, tạo ảnh thu nhỏ (thumbnail), và cho phép đọc lại nội dung.

### Đường đi: upload qua 3 bước, file **không đi qua** `media`

```text
1) Xin phép:     Người dùng → [gateway] → [media] → media-postgres (tạo bản ghi PENDING)
                                             └→ MinIO (tạo "đường dẫn tải lên tạm" có hạn)
2) Tải file:     Người dùng ──────────────PUT file thẳng──────────────→ MinIO   (KHÔNG có trace)
3) Xác nhận:     Người dùng → [gateway] → [media] → MinIO (kiểm, băm, chép sang chỗ chính, xóa bản tạm)
                                             → media-postgres (READY... )
                                             └─(outbox)⇒ [media-worker] → MinIO (ghi thumbnail)
                                                                         → media-postgres
```

Vì sao file không đi qua `media`? File có thể lớn; đẩy thẳng vào kho (MinIO) đỡ tải cho service. `media` chỉ "cấp phiếu" và "nghiệm thu".

**Hệ quả cho RCA:** bước 2 (tải file vào MinIO) **không có span nào**, vì MinIO không gắn OpenTelemetry. Nếu bước này chậm, trace không cho thấy.

| Bước | Endpoint | Ghi chú |
| --- | --- | --- |
| Xin phép upload | `POST /api/v1/media/upload-intents` | trả đường dẫn tải lên tạm |
| Tải file | `PUT <đường dẫn tạm>` vào MinIO | không qua gateway |
| Xác nhận | `POST /api/v1/media/:media_id/upload-complete` | `media` tự nhận dạng loại file (MIME) |
| Đọc nội dung | `GET /api/v1/media/:media_id/content` | công khai qua gateway (không cần token), hỗ trợ đọc từng đoạn (Range); bảo vệ bằng id khó đoán; code đặt `Cache-Control: public, max-age=300` (trình duyệt được lưu đệm 5 phút); bản đầu ADR-006 và contracts v2 ghi nhầm `no-store`, đã đính chính ở PR #74 |
| Avatar | đặt avatar cho từng vai trò; `/api/v1/auth/me` trả `avatar_url` | |

### Chạy thử

```bash
node --test test/regression/media-upload.regression.mjs
```

Truy vấn TraceQL: `{ resource.service.name = "gateway" } && { resource.service.name = "media" } && { resource.service.name = "media-worker" }`.

### Trace thật (17/11/2026)

Bước 1, xin phép upload, 9 span:

```text
POST /api/v1/*path                                  [gateway]  SERVER 89.9ms
  gateway-identity-token POST /internal/v1/auth/service-token  [gateway] CLIENT 34.0ms
    POST /internal/v1/auth/service-token            [identity] SERVER 32.5ms
      identity-postgres service-client.find         [identity] CLIENT  0.8ms
  gateway-media POST                                [gateway]  CLIENT 54.5ms
    POST /api/v1/media/upload-intents               [media]    SERVER 52.4ms
      media-identity-jwks GET jwks                  [media]    CLIENT 12.9ms
      media-minio presign-upload                    [media]    CLIENT  0.5ms
      media-postgres media.create                   [media]    CLIENT 29.0ms
```

Bước 3, xác nhận upload, 23 span:

```text
POST /api/v1/*path                                       [gateway]      SERVER 16.7ms
  gateway-media POST                                     [gateway]      CLIENT 15.3ms
    POST /api/v1/media/:media_id/upload-complete         [media]        SERVER 14.1ms
      media-postgres media.find-by-id                    [media]        CLIENT  0.7ms
      media-minio stat-object                            [media]        CLIENT  0.8ms
      media-minio hash-object                            [media]        CLIENT  0.9ms
      media-minio get-object                             [media]        CLIENT  1.4ms
      media-minio copy-object                            [media]        CLIENT  2.7ms
      media-postgres media.update                        [media]        CLIENT  0.8ms
      media-postgres job.ensure                          [media]        CLIENT  2.5ms
      media-minio remove-object                          [media]        CLIENT  1.5ms
      lms.commands publish media.thumbnail.generate      [media]        PRODUCER 0.9ms
        media-worker--generate-media-thumbnail-v1 process  [media-worker] CONSUMER 16.7ms
          media-postgres media.find-by-id                [media-worker] CLIENT  0.9ms
          media-postgres media.update                    [media-worker] CLIENT  1.2ms
          media-minio get-object                         [media-worker] CLIENT  2.0ms
          media-postgres media.find-thumbnail            [media-worker] CLIENT  0.8ms
          media-minio put-object                         [media-worker] CLIENT  2.3ms
          media-postgres media.create                    [media-worker] CLIENT  1.3ms
          media-postgres usage.create                    [media-worker] CLIENT  1.7ms
          media-postgres media.update                    [media-worker] CLIENT  0.7ms
          media-postgres job.ensure                      [media-worker] CLIENT  1.6ms
          media-postgres job.update                      [media-worker] CLIENT  0.8ms
```

### Đọc trace

- Trace bước 1 có thêm hai span "thỉnh thoảng mới có" (mẹo 6 ở D3): gateway xin **service token** mới (`gateway-identity-token`, 34 ms) và `media` tải **JWKS** (`media-identity-jwks`, 13 ms). Đây là lần gọi đầu sau khi stack khởi động, cache còn trống.
- Bước 3 làm nhiều việc với MinIO: kiểm file có thật (`stat-object`), tính mã băm (`hash-object`), đọc vài byte đầu để nhận dạng loại file (`get-object`), chép từ chỗ tạm sang chỗ chính (`copy-object`), xóa bản tạm (`remove-object`).
- Thumbnail được tạo **sau**, trong `media-worker`: đọc ảnh gốc, ghi ảnh thu nhỏ (`put-object`), tạo bản ghi media cho thumbnail và usage nối thumbnail với ảnh gốc.

### Điểm dễ hỏng và case liên quan

- **C4** (MVP): chèn trễ hoặc ngắt kết nối `media` ↔ MinIO trong lúc upload/xác nhận. Media kẹt ở `PENDING`, usage chưa gắn (W2 chỉ gắn media `READY`). Khi job dọn dẹp (W7) chạy, media `PENDING` đã quá hạn upload (mặc định 900 giây) cộng 15 phút ân hạn bị coi là **upload bỏ dở**: chuyển `FAILED` với lý do `UPLOAD_ABANDONED` và object trong MinIO bị **xóa**. Lỗi lộ ra **muộn và ở `scheduler-worker`/`media`**, trong khi nguyên nhân là `media` ↔ MinIO.
- **C1** (Target): đợt thông báo khổng lồ ở W5 làm chậm `notification-worker`, tranh chấp tài nguyên dùng chung, khiến `upload-complete` của W4 chậm, dù `media` không có lỗi gì.

### Tự giải thích

1. Vì sao trace của W4 không cho biết việc tải file lên MinIO mất bao lâu?
   <details><summary>Đáp án tham khảo</summary>Vì người dùng PUT file thẳng vào MinIO qua đường dẫn tạm, không qua service nào có OpenTelemetry; MinIO không phát span. Chỉ bước xin phép và bước xác nhận có trace.</details>
2. Kể lại chuỗi C4 theo thứ tự thời gian, từ lúc MinIO chậm tới lúc ảnh bị xóa.
   <details><summary>Đáp án tham khảo</summary>MinIO chậm/ngắt → bước xác nhận upload lỗi hoặc treo → media kẹt PENDING → đồng bộ usage (W2) bỏ qua media chưa READY (job đồng bộ ghi PARTIAL_FAILED, không có span lỗi) → khi job dọn dẹp (W7) chạy sau hạn upload + 15 phút ân hạn, media bị coi là upload bỏ dở: FAILED <code>UPLOAD_ABANDONED</code>, object bị xóa → khóa học mất ảnh; triệu chứng lộ ở scheduler-worker/media, muộn so với lúc gây lỗi.</details>

---

## F5. W5 — Thông báo hàng loạt và email

### Câu chuyện

Admin gửi một thông báo cho **toàn bộ học viên** (một "đợt gửi", batch). Hệ thống lấy danh sách học viên, tạo từng mục gửi, gửi email cho từng người, ghi thông báo vào hộp thư trong ứng dụng (inbox), và cập nhật trạng thái đợt gửi. Ngoài ra có thông báo đơn lẻ cho một người.

### Đường đi: chuỗi bất đồng bộ dài nhất

```text
Admin → [gateway] → [notification] → notification-postgres (tạo đợt gửi)
                         └─(outbox)⇒ ① snapshot  ⇒ [notification-worker]
                                         → [identity] GET /internal/v1/students (lấy danh sách học viên)
                                         → notification-postgres (tạo các mục gửi)
                                         └─⇒ ② dispatch ⇒ [notification-worker]
                                                  → SMTP (Mailpit) gửi từng email
                                                  → notification-postgres (ghi inbox, đánh dấu thành công)
```

Hai command nối tiếp: **snapshot** ("chụp" danh sách người nhận tại thời điểm gửi) rồi **dispatch** ("phát" email). Mỗi command có queue riêng của `notification-worker`. Nếu thông báo có ảnh, `notification` còn gửi các command `media.notification-usage.*` cho `media-worker` để đăng ký usage của ảnh (riêng bước "hoàn tất" do `notification-worker` gửi).

| Bước | Endpoint | Ghi chú |
| --- | --- | --- |
| Thông báo đơn | `POST /api/v1/notifications` | vào inbox `UNREAD`, email tới Mailpit |
| Đợt gửi | `POST /api/v1/notification-batches` | học viên gọi → `403` |
| Inbox | đánh dấu đã đọc, đọc tất cả | |

### Chạy thử

```bash
node --test test/regression/notification-batch-email.regression.mjs
```

Sau đó mở Mailpit (http://localhost:8025) để thấy các email "đã gửi".

Truy vấn TraceQL: `{ resource.service.name = "gateway" } && { resource.service.name = "notification" } && { resource.service.name = "notification-worker" } && { resource.service.name = "identity" }`.

### Trace thật (17/11/2026): một đợt gửi 10 học viên, 53 span (rút gọn)

```text
POST /api/v1/*path                                           [gateway]             SERVER   12.4ms
  gateway-notification POST                                  [gateway]             CLIENT   11.4ms
    POST /api/v1/notification-batches                        [notification]        SERVER   10.4ms
      notification-postgres batch.create                     [notification]        CLIENT    6.2ms
      lms.commands publish notification.batch.snapshot       [notification]        PRODUCER  1.0ms
        notification-worker--snapshot-notification-batch-v1 process  [notification-worker] CONSUMER 45.9ms
          notification-postgres batch.find-by-id             [notification-worker] CLIENT    2.7ms
          notification-postgres batch.transition             [notification-worker] CLIENT    6.7ms
          notification-worker-identity GET /internal/v1/students     [notification-worker] CLIENT 6.2ms
            GET /internal/v1/students                        [identity]            SERVER    4.7ms
              identity-postgres student.list                 [identity]            CLIENT    3.2ms
          notification-postgres item.insert-many             [notification-worker] CLIENT   12.4ms
          notification-postgres item.count                   [notification-worker] CLIENT    6.4ms
          notification-postgres batch.transition             [notification-worker] CLIENT    1.7ms
          lms.commands publish notification.batch.dispatch   [notification-worker] PRODUCER 47.4ms
            notification-worker--dispatch-notification-batch-v1 process [notification-worker] CONSUMER 143.5ms
              notification-postgres batch.find-by-id / batch.transition / item.claim
              notification-smtp smtp.send     × 10 lần, mỗi lần ~50ms
              notification-postgres notification.create-for-batch + item.mark-success × 10
              notification-postgres item.count-by-status / batch.update / batch.transition
```

### Đọc trace

- Admin nhận trả lời sau **12 ms**, nhưng công việc thật kéo dài thêm **~190 ms** trong worker (snapshot 46 ms + dispatch 144 ms). Với 10 người thì nhẹ; với 100.000 người (kịch bản C1) thì kéo dài rất lâu.
- `identity` xuất hiện **giữa chừng**, được gọi bởi worker chứ không phải bởi admin. Nếu `identity` chậm, đợt gửi bị ảnh hưởng dù admin không hề gọi `identity`.
- Mỗi email là một span `notification-smtp smtp.send` (~50 ms). Đây là chỗ tốn thời gian nhất.
- Hai lượt PRODUCER → CONSUMER nối tiếp nhau trong **cùng một trace**: "số hồ sơ" `traceparent` đã đi qua RabbitMQ hai lần mà không đứt.

Thông báo đơn lẻ (19 span) còn cho thấy worker **xin service token** (`notification-worker-identity-token`) và gọi `GET /internal/v1/students/:studentId`, mẫu đường dẫn có tham số, đúng với bản sửa `operation_name`.

### Điểm dễ hỏng và case liên quan

- **C5** (Target): `identity-postgres` chậm đúng lúc worker lấy danh sách học viên → đợt gửi `PARTIAL_FAILED`, thiếu người nhận, **log không có lỗi**. Nguyên nhân ở `identity`, triệu chứng ở `notification`.
- **C1** (Target): đợt gửi rất lớn + `notification-worker` bị làm chậm → dồn hàng trong RabbitMQ, tranh chấp tài nguyên dùng chung, ảnh hưởng tới W4.
- `notification-worker` cũng cần service token: khi `identity` chết, worker lỗi **muộn hơn** gateway, vào thời điểm token **của chính nó** hết hạn (C6).

### Tự giải thích

1. Vì sao admin nhận "OK" rất nhanh dù việc gửi email chưa xong?
   <details><summary>Đáp án tham khảo</summary>Vì <code>notification</code> chỉ ghi đợt gửi và ghi command vào outbox rồi trả lời; việc lấy danh sách và gửi email do <code>notification-worker</code> làm sau qua hai command snapshot và dispatch.</details>
2. Ở C5, vì sao "log không có lỗi" mà đợt gửi vẫn thiếu người nhận? Truy vết thủ công sẽ dễ đi nhầm hướng nào?
   <details><summary>Đáp án tham khảo</summary>Vì việc chậm ở identity-postgres làm kết quả danh sách học viên bị thiếu/ngắt chứ không ném lỗi rõ ràng; người truy vết dễ nghi <code>notification-worker</code> hoặc SMTP (nơi thấy triệu chứng) thay vì identity.</details>
3. Đếm xem W5 chạm tới bao nhiêu runtime và bao nhiêu loại hạ tầng.
   <details><summary>Đáp án tham khảo</summary>4 runtime (gateway, notification, notification-worker, identity), cộng media-worker nếu thông báo có ảnh; hạ tầng: notification-postgres, identity-postgres, RabbitMQ, SMTP (Mailpit).</details>

---

## F6. W6 — AI soạn bài và sinh quiz

### Câu chuyện

Admin cấu hình **nhà cung cấp AI** (địa chỉ, khóa API, model) và gán cho từng loại việc. Giảng viên đính kèm tài liệu (ví dụ file TXT) vào bài học và yêu cầu **trích văn bản** từ tài liệu. Sau đó giảng viên yêu cầu AI **soạn nội dung bài học** hoặc **sinh quiz**. AI làm việc ở nền, và kết quả được ghi ngược vào bài học.

### Đường đi: có "vòng" course → ai → course

```text
Giảng viên → [gateway] → [course] → [media]  (tài liệu nào đang gắn với bài học)
                            └──→ [ai] → ai-postgres (tạo job)
                                   └─(outbox)⇒ ai.job.run ⇒ [ai-worker]
                                                  → [course]  lấy ngữ cảnh bài học (ai-context)
                                                  → nhà cung cấp LLM  (POST chat/completions)
                                                  → [course]  ghi kết quả (ai-content / ai-quizzes)
                                                        └─(outbox)⇒ [media-worker] (đồng bộ usage)

Trích văn bản: [course] → [ai] ⇒ ai.document.extract ⇒ [ai-worker] → [media] (đọc nội dung file) → trích → ai-postgres
```

`course` gọi `ai`, rồi `ai-worker` lại gọi **ngược** về `course`. Vòng này được chấp nhận vì một chiều là bất đồng bộ (`course` chỉ tạo job, không đứng chờ). Nhưng nó làm việc truy vết khó hơn: lỗi ở `ai-worker → course` có thể là do `course`, cũng có thể là do `ai-worker` giữ việc quá lâu.

Hai cấu hình thời gian quan trọng: `AI_COMPLETION_TIMEOUT_MS` (chờ LLM tối đa bao lâu) và `AI_WORKER_LEASE_MS` (worker "giữ chỗ" một job tối đa bao lâu). Lease phải lớn hơn timeout của LLM. Giá trị mặc định xem ở [`04-testbed-architecture.md`](04-testbed-architecture.md).

### Chạy thử: cần provider AI giả

Testbed không gọi AI thật khi thử. Dựng một **provider giả** (giả lập API kiểu OpenAI) trong cùng mạng Docker:

```bash
# Từ thư mục gốc repo
docker run -d --name aiops-lms-ai-provider --network aiops-lms_lms-network \
  -p 127.0.0.1:18081:8080 \
  -v "$PWD/lms/test/regression/support/fake-ai-provider.mjs:/app/provider.mjs:ro" \
  node:22.13.1-alpine node /app/provider.mjs

cd lms
REGRESSION_AI_PROVIDER_URL=http://aiops-lms-ai-provider:8080/v1 \
REGRESSION_AI_PROVIDER_STATS_URL=http://127.0.0.1:18081/__seen \
node --test test/regression/ai-lesson.regression.mjs
```

`aiops-lms_lms-network` là tên mạng Docker của stack (tiền tố là `COMPOSE_PROJECT_NAME`). Xong thì xóa provider: `docker rm -f aiops-lms-ai-provider`.

Nếu đang chạy lớp gây lỗi của tuần 13 (phần J), **không** dựng provider giả này (trùng cổng `18081`); dùng `llm-stub` có sẵn theo mục J1.

Truy vấn TraceQL: `{ resource.service.name = "gateway" } && { resource.service.name = "course" } && { resource.service.name = "ai" } && { resource.service.name = "ai-worker" }`.

### Trace thật (17/11/2026): tạo job sinh quiz, 37 span (rút gọn phần media-worker)

```text
POST /api/v1/*path                                                [gateway]   SERVER 26.2ms
  gateway-course POST                                             [gateway]   CLIENT 24.7ms
    POST /api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs    [course]    SERVER 23.1ms
      course-postgres course.find-by-id / lesson.find-in-course   [course]    CLIENT
      course-media GET /internal/v1/media/usages/by-owner         [course]    CLIENT  6.5ms
        GET /internal/v1/media/usages/by-owner                    [media]     SERVER  4.5ms
      course-ai POST /internal/v1/ai/jobs                         [course]    CLIENT 11.3ms
        POST /internal/v1/ai/jobs                                 [ai]        SERVER  9.3ms
          ai-postgres document.get-texts / job.create             [ai]        CLIENT
          lms.commands publish ai.job.run                         [ai]        PRODUCER 0.8ms
            ai-worker--run-ai-job-v1 process                      [ai-worker] CONSUMER 45.4ms
              ai-postgres job.claim                               [ai-worker] CLIENT  2.1ms
              ai-worker-course GET /internal/v1/courses/:courseId/lessons/:lessonId/ai-context  [ai-worker] CLIENT 2.7ms
                GET /internal/v1/courses/:course_id/lessons/:lesson_id/ai-context            [course]    SERVER 1.8ms
              ai-postgres document.get-texts / job.begin-step / binding.find-target           [ai-worker] CLIENT
              ai-llm-provider POST chat/completions               [ai-worker] CLIENT  2.2ms
              ai-postgres invocation.record                       [ai-worker] CLIENT  1.3ms
              ai-worker-course POST /internal/v1/courses/:courseId/lessons/:lessonId/ai-quizzes [ai-worker] CLIENT 29.0ms
                POST /internal/v1/courses/:course_id/lessons/:lesson_id/ai-quizzes           [course]    SERVER 27.4ms
                  course-postgres quiz.create                     [course]    CLIENT 22.4ms
                    lms.commands publish media.markdown-usage.synchronize   [course] PRODUCER
                      media-worker--synchronize-markdown-media-usage-v1 process  [media-worker] CONSUMER 7.5ms
              ai-postgres job.complete                            [ai-worker] CLIENT  1.8ms
```

### Đọc trace

- Một trace chạm **6 runtime**: gateway, course, media, ai, ai-worker, media-worker.
- `course` xuất hiện **hai lần ở hai vai**: đầu trace là bên nhận yêu cầu của giảng viên, cuối trace là bên được `ai-worker` gọi ngược để lấy ngữ cảnh và ghi quiz.
- Lời gọi LLM ở đây chỉ 2 ms vì là provider giả. Với AI thật, đây là span dài nhất (vài giây tới vài chục giây). Ở **C3**, chính span này bị làm chậm.
- Hai cách viết tham số trong cùng một trace: `:courseId` ở span CLIENT (mẫu do caller khai) và `:course_id` ở span SERVER (mẫu route của service nhận). Cả hai đều là mẫu, không có ID thật.

Trace trích văn bản tài liệu (34 span) còn cho thấy `course` xin service token **hai lần** trong cùng một request, và `ai-worker` đọc nội dung file qua `GET /internal/v1/media/:mediaId/content` → MinIO.

### Điểm dễ hỏng và case liên quan

- **C3** (MVP): provider LLM trả chậm hoặc lỗi ngắt quãng. Job AI chạy rất lâu (`RUNNING`), tài liệu lâu ở `EXTRACTING`; `course` thấy lỗi **muộn** ở cạnh `ai-worker → course`. Kết cục thật phụ thuộc tham số: đo ngày 17/11/2026 bằng LLM stub (PR #75), trễ 2000±500 ms thì job vẫn `COMPLETED` (lời gọi LLM trung bình 2,36 giây); lỗi 100% thì job `FAILED` với `AI_PROVIDER_ERROR`. `WORKER_INTERRUPTED` chỉ xuất hiện khi command được giao lại lúc job đã quá lease. Nguyên nhân gốc: `root_cause_service=ai`, thành phần `ai-llm-provider` (chủ sở hữu là `ai`, nhưng process thực sự gọi provider là `ai-worker`).

### Tự giải thích

1. Ở C3, giảng viên thấy gì và thấy khi nào? Vì sao không thấy lỗi ngay lúc bấm "tạo job"?
   <details><summary>Đáp án tham khảo</summary>Lúc bấm, course trả lời ngay (job đã được tạo và giao cho ai-worker qua RabbitMQ). Lỗi chỉ lộ ra sau đó: job đứng RUNNING lâu, rồi kết thúc <code>FAILED</code> với mã lỗi của lời gọi LLM (ví dụ <code>AI_PROVIDER_ERROR</code>), hoặc vẫn <code>COMPLETED</code> nếu chỉ chậm vừa phải; giảng viên chỉ thấy khi xem trạng thái job.</details>
2. Vì sao vòng `course → ai ⇒ ai-worker → course` làm truy vết thủ công khó hơn?
   <details><summary>Đáp án tham khảo</summary>Vì lỗi xuất hiện ở cạnh ai-worker → course, dễ khiến người truy vết nghi course; trong khi nguyên nhân có thể là ai-worker giữ job quá lâu vì LLM chậm. Một service đóng hai vai trong cùng trace, và thời điểm lỗi cách xa thời điểm gây lỗi.</details>

---

## F7. W7 — Dọn media không còn dùng

### Câu chuyện

Theo thời gian, kho media tích tụ file không ai dùng (ảnh đã gỡ khỏi bài học, upload dở dang). Admin tạo một **job định kỳ** `MEDIA_UNUSED_CLEANUP`. Đến giờ (hoặc khi admin bấm chạy tay), hệ thống tìm media không còn usage và quá thời gian giữ, rồi xóa khỏi MinIO và database.

### Đường đi: không bắt đầu từ người dùng

```text
Admin → [gateway] → [scheduler] → scheduler-postgres   (tạo job, tạo "lần chạy")

[scheduler-worker]  hỏi scheduler-postgres mỗi 1 giây: "có lần chạy nào đến hạn không?"
        └→ [media] POST /internal/v1/media/cleanup   (service token, scope media:cleanup)
                 → media-postgres: tìm media PENDING quá hạn, media READY không có usage
                 → khóa từng media, xóa usage, cập nhật trạng thái
                 → MinIO: xóa file gốc và thumbnail
```

Điểm khác các luồng trước: **không dùng RabbitMQ**. `scheduler-worker` tự **hỏi database định kỳ** (mỗi 1 giây theo `SCHEDULER_WORKER_POLL_MS=1000`). Vì vậy trace dọn dẹp **không nối** với trace của request admin bấm "chạy". Nó là một trace riêng, bắt đầu từ `scheduler-worker`.

Hai mốc thời gian bảo vệ dữ liệu: media `PENDING` chỉ bị dọn sau một khoảng ân hạn; media `READY` không có usage chỉ bị dọn khi quá **thời gian giữ** (`retention_hours`). Trên stack bình thường, thời gian giữ tối thiểu là **1 giờ** (`MEDIA_CLEANUP_MIN_RETENTION_HOURS=1`), nên không thể yêu cầu "dọn ngay".

### Chạy thử: phải hạ thời gian giữ tối thiểu xuống 0

Kịch bản regression tạo job với `retention_hours: 0` để dọn ngay. Trên stack bình thường yêu cầu này bị từ chối (đã thử ngày 17/11/2026: 2 bước kiểm tra fail). Khởi động lại riêng `media` với biến ghi đè:

```bash
# Từ thư mục gốc repo
MEDIA_CLEANUP_MIN_RETENTION_HOURS=0 docker compose --env-file docker-compose/.env \
  -f docker-compose/compose.full.yaml up -d --wait media

cd lms
node --test test/regression/media-cleanup-scheduler.regression.mjs
```

Biến môi trường gõ trên dòng lệnh **được ưu tiên hơn** giá trị trong `.env`. Muốn trả lại như cũ, chạy lại lệnh `up -d --wait media` không có biến đó.

Truy vấn TraceQL: `{ resource.service.name = "scheduler-worker" && name =~ "scheduler-worker-media.*" }`.

### Trace thật (17/11/2026): một lần dọn 4 media, 41 span (rút gọn)

```text
scheduler-worker-media POST /internal/v1/media/cleanup   [scheduler-worker] CLIENT 51.8ms   ← span GỐC
  POST /internal/v1/media/cleanup                        [media]            SERVER 49.5ms
    media-postgres media.list-stale-pending              [media]            CLIENT  5.7ms
    media-postgres media.list-unused-ready               [media]            CLIENT  2.6ms
    ── lặp lại cho mỗi media (4 lần) ──
    media-postgres media.lock-for-cleanup / usage.count-by-media / media.find-thumbnail
    media-postgres media.update / usage.list-by-owners / usage.delete-by-ids / media.update
    media-minio remove-object      (file gốc)
    media-minio remove-object      (thumbnail)
    ── hết vòng lặp ──
    media-postgres media.list-orphan-thumbnails          [media]            CLIENT  1.5ms
```

### Đọc trace

- **Span gốc là span CLIENT của `scheduler-worker`**, không có span "lần chạy job" bao ngoài. Đây là khoảng trống đã biết: `scheduler-worker` chưa có span gốc cho mỗi lần chạy, nên khó biết một lần chạy gồm những gì.
- Trước khi xóa, `media` **khóa** từng media và **đếm lại usage** (`usage.count-by-media`) để không xóa nhầm media vừa được gắn vào bài học.
- Ngoài trace dọn dẹp, `scheduler-worker` còn tạo **rất nhiều trace ngắn** cho mỗi lần hỏi database (mỗi giây). Đó là **trace nhiễu**, RCA engine phải lọc bỏ.

### Điểm dễ hỏng và case liên quan

- **C4** (MVP): đây là nơi **hậu quả** của C4 lộ ra. Media bị dọn "đúng luật" (nhánh `media.list-stale-pending`: `PENDING` quá hạn upload + ân hạn → `FAILED UPLOAD_ABANDONED`, xóa object) nhưng thực ra là do MinIO chậm ở W4 làm media không kịp `READY`. Người truy vết thủ công thấy job dọn dẹp xóa ảnh và dễ kết luận "lỗi ở job dọn dẹp". Lưu ý: nhánh "media `READY` không có usage" (`media.list-unused-ready`) là nhánh khác, chỉ xóa sau thời gian giữ (mặc định 168 giờ).

### Tự giải thích

1. Vì sao trace dọn dẹp không nối với request admin bấm "chạy job"?
   <details><summary>Đáp án tham khảo</summary>Vì request của admin chỉ ghi một "lần chạy" vào scheduler-postgres; scheduler-worker tự hỏi DB định kỳ rồi mới gọi media. Không có traceparent nào được chuyển từ request admin sang worker, và worker không có span gốc cho mỗi lần chạy.</details>
2. Ở C4, nơi thấy triệu chứng và nơi có nguyên nhân cách nhau bao xa (về service và về thời gian)?
   <details><summary>Đáp án tham khảo</summary>Triệu chứng: scheduler-worker/media xóa ảnh, lộ ra khi job dọn chạy (sau thời gian giữ, mặc định tính bằng giờ). Nguyên nhân: kết nối media ↔ MinIO lúc upload, xảy ra từ trước đó rất lâu; khác service, khác luồng, khác thời điểm.</details>

---

# Phần G — Dọn dẹp sau khi học xong

```bash
# Từ thư mục gốc repo
docker rm -f aiops-lms-ai-provider 2>/dev/null                                       # provider AI giả (nếu đã dựng)
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml down            # dừng, GIỮ dữ liệu
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml down --volumes  # dừng và XÓA SẠCH dữ liệu
```

Dùng `down` nếu mai muốn học tiếp với dữ liệu cũ; dùng `down --volumes` nếu muốn lần sau bắt đầu lại từ trạng thái sạch.

---

# Phần H — Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `failed to connect to the docker API at …/desktop/docker.sock` | Đang chọn Docker Desktop nhưng Desktop không chạy | `docker context use default` (A2) |
| `ERR_PNPM_UNSUPPORTED_ENGINE` | Chạy `pnpm` ngoài thư mục `lms/`, hoặc sai bản Node | `cd lms`, `nvm use`, `hash -r` (A3) |
| `node --version` vẫn báo bản cũ sau `nvm use` | Shell nhớ đường dẫn cũ | `hash -r` |
| `port is already allocated` | Cổng bị chương trình khác chiếm | Tắt chương trình đó hoặc đổi cổng qua biến, ví dụ `LOKI_PORT=13100` (A4) |
| Build báo `cannot allocate memory` | Build song song nhiều image, thiếu RAM | `COMPOSE_PARALLEL_LIMIT=1`, đóng bớt ứng dụng (B5) |
| Container báo lỗi bảng/database cũ | Volume còn dữ liệu từ testbed v1 | `down --volumes` rồi `up` lại |
| W6 fail ngay | Chưa dựng provider AI giả hoặc sai tên mạng Docker | F6 |
| W7 fail 2 bước | Thời gian giữ tối thiểu là 1 giờ | Khởi động lại `media` với `MEDIA_CLEANUP_MIN_RETENTION_HOURS=0` (F7) |
| Grafana không ra trace | Chưa có traffic, hoặc khoảng thời gian chọn sai | Chạy một regression, chọn "Last 15 minutes" |
| Tempo đột nhiên không trả lời | Tempo hết bộ nhớ (giới hạn 512 MB) khi bị truy vấn quá nhiều | Truy vấn ít trace hơn; `up -d --wait tempo` để chạy lại |
| `port is already allocated` ở cổng `18081` | Provider AI giả (F6) và `llm-stub` (J1) cùng dùng cổng này | Chỉ dùng một trong hai; khi có lớp fault thì dùng `llm-stub` |
| `fault-control.mjs` báo không kết nối được `127.0.0.1:8474` | Chưa ghép `compose.faults.yaml`, hoặc ghép sai thứ tự `-f` | Làm lại J1 |
| `aiops-training export` từ chối cửa sổ | Cửa sổ đã quá 24 giờ, kho telemetry đã xóa | Chạy run mới rồi export ngay |

---

# Phần I — Mẫu ghi chú bằng chứng cho Gate R, điều kiện 5

Sau khi đi hết các phần trên, ghi một file ngắn (ví dụ trong `workspace/bach/`) theo mẫu dưới. **Viết bằng lời của bạn**, không chép từ file này: mục đích là chứng minh *bạn* hiểu.

```markdown
# Bằng chứng Gate R, điều kiện 5

- Ngày thực hiện: …
- Máy/cách dựng: clone mới / pull `main` tại commit …; Docker context …; Node …; pnpm …
- Thời gian từ lúc bắt đầu tới khi 21 thành phần healthy: …
- Chỗ README thiếu hoặc sai mà tôi gặp: …

## W1 … W7 (mỗi luồng 3–6 câu)
- Luồng làm gì (góc nhìn người dùng):
- Đi qua runtime nào, cạnh nào đồng bộ, cạnh nào bất đồng bộ:
- Chạm hạ tầng nào:
- trace_id tôi đã mở trong Grafana:
- Nếu <một thành phần> hỏng thì triệu chứng hiện ở đâu, khi nào:
```

---

# Phần J — Mở rộng tuần 13: lớp gây lỗi, k6 mức 1, export và kiểm chất lượng

> **Cần merge trước.** `aiops-platform/faults/`, `load/`, `training/` hiện chỉ có trên nhánh của PR #75, #76, #77/#79 (chưa merge). Đợi các PR vào `main` (thứ tự dự kiến #78 → #75 → #76 → #77 → #79), rồi lấy code mới như B1. Phần này **không** thuộc điều kiện 5 của Gate R; làm sau khi đã quen phần A–F.

Trước mỗi bước nặng (dựng stack, chạy k6), kiểm `free -h`: cột `available` nên còn từ 4 GB. Không chạy k6 cùng lúc với build hay test.

## J1. Ghép lớp gây lỗi vào stack

Từ thư mục gốc repo:

```bash
docker compose --env-file docker-compose/.env \
  -f docker-compose/compose.full.yaml -f aiops-platform/faults/compose.faults.yaml up -d --wait
```

- File fault phải đứng **sau** `compose.full.yaml`: Compose tính đường dẫn tương đối theo thư mục của file đầu tiên. Mọi lệnh `ps`, `down` sau đó cũng phải kèm đủ hai `-f`.
- Kết quả: **23 container** healthy (21 cũ + `toxiproxy` + `llm-stub`).
- Thêm hai cổng trên loopback: `8474` (API điều khiển toxiproxy), `18081` (LLM stub).
- Không cần sửa LMS: file này chỉ đổi địa chỉ kết nối của `course` (PostgreSQL) và `media`, `media-worker` (MinIO) sang toxiproxy. Proxy luôn nằm trên đường đi, kể cả lúc không gây lỗi.

Kiểm nhanh (Node 22 như A3):

```bash
node aiops-platform/faults/fault-control.mjs status
```

Phải thấy ba proxy `course-to-postgres`, `media-to-minio`, `media-worker-to-minio` đang bật và cấu hình LLM stub (không trễ, không lỗi). Muốn chạy regression W6 bằng `llm-stub` thay cho provider giả của F6 (từ `lms/`, đã đặt biến ở D1):

```bash
REGRESSION_AI_PROVIDER_URL=http://llm-stub:8080/v1 \
REGRESSION_AI_PROVIDER_STATS_URL=http://127.0.0.1:18081/__seen \
node --test test/regression/ai-lesson.regression.mjs
```

## J2. Bật và tắt lỗi bằng `fault-control.mjs`

Từ thư mục gốc repo. Mỗi lệnh in **một dòng JSON** có `ts` (giờ UTC): đây là dấu vết thời điểm gây lỗi thật, sau này runner ghi vào nhật ký run làm `fault_start`/`fault_end`.

```bash
CLI=aiops-platform/faults/fault-control.mjs

node $CLI latency course-to-postgres 200          # C2: mỗi lượt trả lời từ PostgreSQL chậm thêm 200 ms
node $CLI latency media-to-minio 300 --jitter 50  # C4: MinIO chậm phía media
node $CLI disconnect media-worker-to-minio        # C4: cắt hẳn kết nối media-worker → MinIO
node $CLI reconnect media-worker-to-minio         # bật lại proxy đó
node $CLI clear                                   # gỡ mọi lỗi, bật lại mọi proxy

node $CLI llm set --latency-ms 30000 --jitter-ms 5000   # C3: provider chậm
node $CLI llm set --error-rate 0.3 --error-status 503   # C3: lỗi ngắt quãng (chuỗi lỗi theo seed)
node $CLI llm reset                                     # về mặc định
```

Thử một vòng: bật `latency course-to-postgres 200`, chạy regression W3 (F3), mở trace ghi danh. Mỗi span `course-postgres …` dài thêm khoảng 200 ms; số đo khi làm PR: `GET /api/v1/courses` từ trung vị 2 ms lên 204 ms. Xong thì `clear`. Lưu ý: bước người dùng tải tệp thẳng lên MinIO (W4 bước 2) **không** đi qua proxy, nên lỗi MinIO chỉ tác động phía `media`/`media-worker`.

C6 không dùng CLI này mà `docker pause` container `identity` như `tracing-smoke`; nhớ `docker unpause` sau đó.

## J3. Chạy k6 mức 1

Nạp dữ liệu seed profile `small` một lần (1 000 học viên, 10 giảng viên; mật khẩu `seed-password`):

```bash
cd lms
pnpm run seed:data -- --environment local --compose-env-file ../docker-compose/.env \
  --non-interactive --yes --profile small --seed 42
cd ..
```

Chạy (từ thư mục gốc repo; máy **không cần cài k6**, script chạy image `grafana/k6:1.3.0`):

```bash
aiops-platform/load/run-k6.sh level-1                               # 2 phút, 1 người dùng ảo mỗi hành trình
RUN_ID=thu-level1-r1 SEED=7 aiops-platform/load/run-k6.sh level-1    # tự đặt tên run và seed
```

- Mỗi hành trình W1–W7 là một nhóm người dùng ảo cố định, nghỉ đều 1–3 giây giữa hai thao tác.
- Kết quả: `aiops-platform/load/results/<RUN_ID>/k6-summary.json`, gồm `started_at`, `finished_at` (cửa sổ thời gian UTC của run), số lượt, số request, tỉ lệ lỗi ngoài mong đợi, p95 của từng hành trình, `thresholds_ok`.
- Số đo khi làm PR: 7/7 hành trình, 737 request, 0 lỗi ngoài mong đợi.
- Dữ liệu do k6 tạo không bị xóa sau run; mỗi đợt thông báo hàng loạt gửi khoảng 1 000 email vào Mailpit.
- W7 trong k6 dùng thời gian giữ 168 giờ (`W7_RETENTION_HOURS`), nên **không** cần hạ `MEDIA_CLEANUP_MIN_RETENTION_HOURS` như F7.

## J4. Export telemetry và kiểm chất lượng

Cần [uv](https://docs.astral.sh/uv/) (repo dùng 0.12.5) và Python 3.12. Chạy **ngay sau run**, vì kho telemetry chỉ giữ 24 giờ:

```bash
cd aiops-platform/training
uv sync                                                              # lần đầu: tạo môi trường Python
uv run aiops-training export --k6-summary ../load/results/<RUN_ID>/k6-summary.json
uv run aiops-training quality artifacts/<RUN_ID>
```

- `export` lấy cửa sổ từ `started_at`/`finished_at` của k6, cộng thêm 30 giây cuối vì telemetry tới trễ; ghi `artifacts/<RUN_ID>/` gồm `metrics.parquet`, `spans.parquet`, `logs.parquet`, `manifest.json`. Run 2 phút mất khoảng 1–2 phút export (tải trace tuần tự để Tempo không bị quá tải).
- `quality` ghi `quality-report.json`, in mỗi runtime một dòng và trả `pass`/`partial`/`fail`. Run khỏe nên ra `pass`; log của 4 worker hiện `not_instrumented` là bình thường.
- Ý nghĩa từng file và từng cờ: [`05-observability.md`](05-observability.md) mục 10.

---

## Tóm tắt

- Dựng stack: `docker context` đúng → Node `22.13.1` + pnpm `11.19.0` (chạy trong `lms/`) → `pnpm install` → `.env` → `compose.full.yaml up --build -d --wait` → 21 thành phần healthy.
- Mọi response có `meta.trace_id`; dán vào Grafana (Explore → Tempo) để xem trace của chính request đó.
- W1, W3 đơn giản, đồng bộ; W2, W4 có một command bất đồng bộ; W5, W6 là chuỗi dài nhiều runtime; W7 không đi qua RabbitMQ mà dùng worker hỏi database định kỳ, và trace không nối với request của admin.
- Trace thật xác nhận: `traceparent` đi qua RabbitMQ không đứt (W5 qua hai lần); `operation_name` dùng mẫu đường dẫn, không có ID.
- Những nơi trace "mù": file tải thẳng vào MinIO (W4), thời gian băm mật khẩu (W1), mỗi lần chạy job của `scheduler-worker` (W7).
- Case MVP gắn với luồng: C2 ↔ W2/W3, C3 ↔ W6, C4 ↔ W4 → W2 → W7, C6 ↔ mọi luồng qua token của `identity`.
- Khi chạy thử phải nhớ hai điều kiện riêng: provider AI giả cho W6, `MEDIA_CLEANUP_MIN_RETENTION_HOURS=0` cho W7.
- Tuần 13 (phần J, cần merge PR #75–#79): ghép `compose.faults.yaml` sau `compose.full.yaml` (23 container), bật/tắt lỗi bằng `fault-control.mjs`, chạy `run-k6.sh level-1`, rồi `aiops-training export` và `quality` ngay sau run.

## Câu hỏi tự kiểm tra

1. Kể tên 21 thành phần theo 3 nhóm.
   <details><summary>Đáp án</summary>11 runtime LMS (gateway, identity, course, media, media-worker, notification, notification-worker, scheduler, scheduler-worker, ai, ai-worker); 5 hạ tầng LMS (postgres, rabbitmq, minio, minio-init, mailpit); 5 thành phần quan sát (otel-collector, prometheus, tempo, loki, grafana).</details>

2. Vì sao span gốc của gateway luôn là `POST /api/v1/*path`?
   <details><summary>Đáp án</summary>Vì gateway khai một route "bắt mọi đường dẫn" để chuyển tiếp; tên span lấy theo mẫu route nên là <code>*path</code>. Đường dẫn cụ thể nằm ở span SERVER của service bên dưới.</details>

3. Luồng nào không dùng RabbitMQ mà vẫn có worker? Worker đó nhận việc bằng cách nào?
   <details><summary>Đáp án</summary>W7: <code>scheduler-worker</code> tự hỏi <code>scheduler-postgres</code> mỗi giây để tìm lần chạy đến hạn, rồi gọi HTTP sang <code>media</code>.</details>

4. Ở luồng nào `identity` bị gọi bởi một worker, không phải bởi người dùng?
   <details><summary>Đáp án</summary>W5: <code>notification-worker</code> gọi <code>GET /internal/v1/students</code> (và <code>/students/:studentId</code> cho thông báo đơn). Ngoài ra các worker gọi HTTP sang service khác (<code>notification-worker</code>, <code>scheduler-worker</code>, <code>ai-worker</code>) đều gọi identity để xin service token; <code>media-worker</code> thì không.</details>

5. Một ảnh bị xóa khỏi khóa học. Kể 3 nơi bạn sẽ nhìn theo thứ tự, và vì sao.
   <details><summary>Đáp án</summary>(1) Trace dọn dẹp của scheduler-worker → media, để xác nhận ảnh bị job dọn xóa; (2) lịch sử ảnh đó ở W4: có kẹt PENDING không, span media-minio lúc upload-complete có chậm/lỗi không; (3) trace đồng bộ usage ở W2: media-worker có gắn usage cho ảnh không. Đây chính là chuỗi C4.</details>

6. Vì sao C6 làm lỗi xuất hiện "rải rác" ở nhiều service, mỗi nơi một thời điểm?
   <details><summary>Đáp án</summary>Vì mỗi service/worker có service token riêng, xin vào thời điểm khác nhau, sống 600 giây và tự làm mới ở 50% thời hạn; khi identity chết, mỗi bên lỗi khi token của chính nó hết hạn.</details>

7. Khi ghép lớp gây lỗi, vì sao `compose.faults.yaml` phải đứng sau `compose.full.yaml`, và stack có bao nhiêu container?
   <details><summary>Đáp án</summary>Compose tính đường dẫn tương đối theo thư mục của file đầu tiên (<code>docker-compose/</code>); bind mount trong file fault viết theo quy ước đó, và file sau ghi đè địa chỉ kết nối của <code>course</code>, <code>media</code>, <code>media-worker</code>. Stack có 23 container: 21 cũ cộng <code>toxiproxy</code> và <code>llm-stub</code>.</details>

8. Vì sao phải export telemetry ngay sau khi chạy k6?
   <details><summary>Đáp án</summary>Prometheus, Tempo, Loki của testbed chỉ giữ dữ liệu 24 giờ; lệnh export từ chối cửa sổ đã quá 24 giờ. Export đọc cửa sổ từ <code>started_at</code>/<code>finished_at</code> trong <code>k6-summary.json</code>.</details>
