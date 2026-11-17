# Khái niệm nền: những từ cần biết trước khi đọc các file khác

> **File này giải thích gì:** các khái niệm cơ bản về backend, hạ tầng và quan sát hệ thống (observability) xuất hiện khắp đồ án. Mỗi khái niệm có một phép so sánh đời thường và một ví dụ lấy từ chính testbed của nhóm. Các file khác trong bộ chỉ nhắc ngắn rồi link về đây.
>
> **Nguồn gốc (canonical):**
>
> - [`../architecture/backend-microservice-testbed-blueprint-v2.md`](../architecture/backend-microservice-testbed-blueprint-v2.md)
> - [`../architecture/service-catalogue-and-topology-v2.md`](../architecture/service-catalogue-and-topology-v2.md)
> - [`../architecture/dependency-resilience-policy-v2.md`](../architecture/dependency-resilience-policy-v2.md)
> - [`../architecture/http-and-event-contracts-v2.md`](../architecture/http-and-event-contracts-v2.md)
> - [`../../../lms/packages/observability/README.md`](../../../lms/packages/observability/README.md)
> - Cách giải thích tận dụng từ folder cũ [`../weekly-explanations/`](../weekly-explanations/) (tuần 5–10, viết cho testbed v1).
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge).

---

## Cách đọc file này

Không cần đọc một mạch. Khái niệm được chia thành 6 nhóm, từ "hệ thống được xây thế nào" tới "làm sao nhìn được bên trong nó":

| Nhóm | Khái niệm | Khi nào cần |
| --- | --- | --- |
| 1. Hệ thống được chia nhỏ | microservice, service, worker, API, request/response, HTTP status, gateway | Đọc kiến trúc testbed |
| 2. Nơi lưu dữ liệu | database, PostgreSQL, logical DB, migration, object storage (MinIO) | Đọc kiến trúc, case lỗi |
| 3. Gửi việc cho nhau | đồng bộ/bất đồng bộ, queue, RabbitMQ, command, outbox/inbox | Đọc W2, W4, W5, W6, W7 |
| 4. Khi có trục trặc | timeout, retry, circuit breaker | Đọc case lỗi và RCA |
| 5. Ai được làm gì | token, JWT, JWKS, service token, scope | Đọc W1 và case C6 |
| 6. Nhìn vào bên trong | telemetry, trace, span, metric, log, label, OpenTelemetry, Collector, Prometheus, Tempo, Loki, Grafana | Đọc observability và AI/RCA |
| 7. Chạy và thử | Docker, image, container, Compose, volume, port, k6, seed | Đọc hướng dẫn dựng stack |

---

# Nhóm 1 — Hệ thống được chia nhỏ

## 1.1. Microservice: một công ty chia thành nhiều phòng ban

Một ứng dụng nhỏ thường được viết thành **một khối** (monolith): mọi chức năng nằm chung một chương trình, chung một database. Khi ứng dụng lớn lên, người ta tách nó thành **nhiều chương trình nhỏ**, mỗi chương trình lo một mảng việc và tự giữ dữ liệu của mình. Mỗi chương trình nhỏ đó là một **service**, và kiểu kiến trúc này gọi là **microservice**.

Hình dung một công ty:

| Công ty | Hệ thống microservice |
| --- | --- |
| Phòng nhân sự, phòng đào tạo, phòng hành chính… | Các service `identity`, `course`, `media`… |
| Mỗi phòng có tủ hồ sơ riêng, phòng khác không tự ý mở | Mỗi service có database riêng, service khác không đọc trực tiếp |
| Muốn hỏi phòng khác thì gọi điện hoặc gửi công văn | Muốn lấy dữ liệu của service khác thì gọi API của nó |
| Lễ tân ở cửa đón khách rồi chỉ đường | `gateway` nhận mọi request từ bên ngoài rồi chuyển vào đúng service |

**Vì sao đồ án cần microservice?** Đề tài là "tìm nguyên nhân sự cố trong hệ thống microservice". Khi một phòng ban làm chậm, các phòng khác phải chờ theo, và khách thấy "cả công ty chậm". Câu hỏi khó là **phòng nào gây ra**. Đó chính là bài toán RCA (Root Cause Analysis, phân tích nguyên nhân gốc) mà đồ án giải.

## 1.2. Service và worker: quầy giao dịch và phòng xử lý phía sau

Trong testbed v2 có hai kiểu chương trình:

- **Service**: có "quầy giao dịch" (API) để nhận request và trả lời ngay. Ví dụ `course` nhận yêu cầu "tạo khóa học" và trả về khóa học vừa tạo.
- **Worker**: không có quầy, ngồi "phòng phía sau" nhận việc từ hàng đợi rồi làm dần. Ví dụ `media-worker` nhận việc "tạo ảnh thumbnail cho file vừa upload".

Mỗi worker chạy **cùng mã nguồn (cùng image)** với service chủ của nó, chỉ khởi động ở chế độ khác: `media` có `media-worker`, `notification` có `notification-worker`, `scheduler` có `scheduler-worker`, `ai` có `ai-worker`. Tổng cộng có **7 service + 4 worker = 11 chương trình đang chạy**, gọi chung là **11 runtime**.

Vì sao tách worker? Có những việc lâu (gửi 500 email, gọi AI soạn bài mất cả phút). Nếu bắt người dùng đứng chờ ở quầy thì request sẽ quá hạn. Tách ra worker thì quầy trả lời ngay "đã nhận việc", còn worker làm dần ở phía sau.

## 1.3. API, request, response, endpoint

- **API** là "cửa sổ giao dịch" mà một service mở ra cho người khác dùng.
- **Request** là "tờ yêu cầu" gửi vào cửa đó, **response** là "tờ trả lời".
- **Endpoint** là **một ô cửa cụ thể**, gồm *phương thức* và *đường dẫn*, ví dụ `POST /api/v1/courses` (tạo khóa học) hay `GET /api/v1/courses` (xem danh sách khóa học).

Phương thức hay gặp:

| Phương thức | Nghĩa | Ví dụ trong testbed |
| --- | --- | --- |
| `GET` | Lấy dữ liệu, không thay đổi gì | `GET /api/v1/auth/me` (xem thông tin tài khoản đang đăng nhập) |
| `POST` | Tạo mới hoặc ra lệnh | `POST /api/v1/auth/student/login` (đăng nhập) |
| `PUT` / `PATCH` | Sửa | sửa bài học, sắp xếp thứ tự bài học |
| `DELETE` | Xóa | xóa khóa học |

Testbed có **hai mặt API** tách bạch:

- `/api/v1/...`: **mặt công khai**, người dùng (qua `gateway`) gọi.
- `/internal/v1/...`: **mặt nội bộ**, chỉ các service gọi nhau, phải có service token (mục 5.3).

## 1.4. HTTP status code: con dấu trên tờ trả lời

Mỗi response có một **mã trạng thái** (status code) ba chữ số. Chỉ cần nhớ nhóm đầu:

| Nhóm | Nghĩa | Mã hay gặp trong testbed |
| --- | --- | --- |
| `2xx` | Thành công | `200` OK, `201` đã tạo, `202` đã nhận việc (làm sau) |
| `4xx` | **Người gọi** sai | `400` dữ liệu sai, `401` chưa đăng nhập/token sai, `403` không đủ quyền, `404` không tìm thấy, `409` xung đột (ví dụ email đã tồn tại) |
| `5xx` | **Bên trả lời** gặp sự cố | `503` `DEPENDENCY_UNAVAILABLE` (một dịch vụ phụ thuộc không dùng được), `504` `DEPENDENCY_TIMEOUT` (dịch vụ phụ thuộc trả lời quá hạn) |

Điểm quan trọng cho RCA: **`4xx` thường là lỗi nghiệp vụ bình thường** (ví dụ học viên nhập sai mật khẩu), không phải sự cố hệ thống. **`5xx` mới là dấu hiệu sự cố.** RCA engine phải phân biệt hai loại này, nếu không sẽ báo động giả.

## 1.5. Gateway: lễ tân ở cửa

`gateway` là **cửa vào duy nhất** từ bên ngoài. Nó:

1. nhận request của người dùng (cổng `3000`);
2. kiểm tra token đăng nhập (người dùng là ai, vai trò gì);
3. chuyển request tới đúng service bên trong (`identity`, `course`, `media`…);
4. trả lời của service được chuyển nguyên vẹn lại cho người dùng.

Vì mọi request đều đi qua `gateway`, đây là nơi **thấy triệu chứng đầu tiên** khi có sự cố ("trang web báo lỗi 504"). Nhưng `gateway` gần như không bao giờ là **nguyên nhân**. Vì vậy trong đánh giá RCA, `gateway` **không nằm trong danh sách nghi phạm** (candidate set chỉ gồm 10 runtime còn lại).

---

# Nhóm 2 — Nơi lưu dữ liệu

## 2.1. Database, PostgreSQL và "logical DB": một tòa chung cư

**Database** (cơ sở dữ liệu) là nơi lưu dữ liệu lâu dài: tài khoản, khóa học, bài học, điểm số… Testbed dùng **PostgreSQL 17**.

Testbed chỉ chạy **một** máy chủ PostgreSQL (một container), nhưng bên trong chia thành **6 database riêng** (gọi là *logical DB*): `identity_db`, `course_db`, `media_db`, `notification_db`, `scheduler_db`, `ai_db`.

Hình dung **một tòa chung cư**:

- Tòa nhà = một máy chủ PostgreSQL.
- Mỗi căn hộ = một logical DB.
- Mỗi căn có **chìa khóa riêng** (mỗi DB một tài khoản đăng nhập riêng, ví dụ `course_user`). `course` không có chìa vào căn của `identity`.

Vì sao làm vậy? Để giữ đúng nguyên tắc "mỗi phòng ban một tủ hồ sơ" mà vẫn tiết kiệm máy. Hệ quả cho RCA: nếu **cả tòa nhà** bị chậm (ổ đĩa, CPU của máy chủ PostgreSQL), mọi service đều thấy DB chậm cùng lúc. Đây là kiểu "dùng chung tài nguyên" mà RCA phải cẩn thận khi kết luận.

`gateway` là service duy nhất **không có database**. Worker dùng chung DB với service chủ (ví dụ `media-worker` dùng `media_db`).

## 2.2. Migration: bản vẽ sửa nhà có đánh số

**Migration** là các file mô tả "thay đổi cấu trúc bảng" (thêm bảng, thêm cột…), đánh số theo thứ tự. Khi một service khởi động, nó chạy `prisma migrate deploy` để áp các migration chưa áp. Nhờ vậy một database trống được dựng đúng cấu trúc mà không ai phải gõ tay.

`Prisma` là thư viện mà các service dùng để làm việc với PostgreSQL.

## 2.3. Object storage (MinIO): kho chứa đồ có mã phiếu

File (ảnh, video, PDF, tài liệu) không lưu trong PostgreSQL mà trong **object storage**. Testbed dùng **MinIO** (giống dịch vụ Amazon S3 nhưng chạy cục bộ). MinIO chia thành 5 "ngăn" (bucket): `images`, `videos`, `documents`, `audios`, `other`.

Hình dung **kho gửi đồ**: bạn gửi đồ, nhận một mã phiếu; muốn lấy lại thì đưa mã phiếu. Service `media` giữ "sổ ghi chép" (trong `media_db`) cho biết mã nào ứng với file nào, của ai, đang được bài học nào dùng.

Điểm đặc biệt: khi upload, người dùng **gửi file thẳng vào MinIO** qua một đường dẫn tạm do `media` cấp, chứ không đi qua `media`. Chi tiết ở luồng W4.

---

# Nhóm 3 — Gửi việc cho nhau

## 3.1. Đồng bộ và bất đồng bộ: gọi điện và gửi thư

Có hai cách để service A nhờ service B làm việc:

| | Đồng bộ (synchronous) | Bất đồng bộ (asynchronous) |
| --- | --- | --- |
| So sánh | **Gọi điện**: A gọi, đứng chờ B trả lời rồi mới làm tiếp | **Gửi thư**: A bỏ thư vào hòm, làm việc khác; B đọc thư và làm khi rảnh |
| Trong testbed | Gọi HTTP, ví dụ `course` hỏi `ai` "tạo job AI cho bài học này" | Gửi **command** qua RabbitMQ, ví dụ `notification` giao cho `notification-worker` "gửi đợt thông báo này" |
| Ưu điểm | Biết kết quả ngay | Không bắt người dùng chờ; B tạm hỏng thì thư vẫn nằm đợi |
| Nhược điểm | B chậm thì A chậm theo | Lỗi xảy ra **muộn và ở chỗ khác**, khó truy vết hơn |

Trong sơ đồ của bộ tài liệu này, `→` là gọi đồng bộ, `⇒` là gửi command bất đồng bộ.

Nhược điểm của cách bất đồng bộ chính là lý do đồ án quan tâm: khi lỗi xảy ra trong worker, người dùng đã nhận "OK" từ lâu. Triệu chứng hiện ra ở nơi khác, vào lúc khác. Truy vết thủ công vì thế tốn công hơn.

## 3.2. Queue và RabbitMQ: bưu điện

**Queue** (hàng đợi) là "hòm thư" giữ các message (thư) theo thứ tự cho tới khi có người lấy ra xử lý. **RabbitMQ** là phần mềm "bưu điện" quản lý các hòm thư đó.

Cách testbed dùng RabbitMQ:

- Mọi command được gửi tới một "bưu cục" chung tên `lms.commands` (gọi là *exchange*).
- Bưu cục chia thư vào đúng **hòm của worker nhận**, ví dụ hòm `notification-worker--snapshot-notification-batch-v1`. Tên hòm bắt đầu bằng tên worker sở hữu nó.
- Mỗi hòm có thêm một **hòm "thư lỗi"** cùng tên kèm đuôi `.error`. Thư xử lý thất bại nhiều lần sẽ bị chuyển sang đây để người vận hành xem, thay vì mất đi hoặc chặn cả hàng.
- Worker xử lý thư lỗi thì thử lại tối đa 5 lần (mỗi lần cách 1 giây) rồi mới chuyển sang `.error`.

RabbitMQ là "bưu điện", **không phải kho lưu trữ**: thư đã xử lý xong là biến mất.

## 3.3. Command: một yêu cầu "hãy làm việc này"

Testbed v2 gửi **command** (mệnh lệnh), không gửi *event* (thông báo "việc đã xảy ra"). Mỗi command có tên và một queue riêng của worker nhận, ví dụ `media.thumbnail.generate` (queue `media-worker--generate-media-thumbnail-v1`), `notification.batch.snapshot` (queue `notification-worker--snapshot-notification-batch-v1`) hay `ai.job.run` (queue `ai-worker--run-ai-job-v1`). Danh sách đầy đủ ở `lms/contracts/src/commands/`. Mỗi command đi kèm một "phong bì" (envelope) chứa:

- mã message duy nhất;
- ai gửi (service, phiên bản);
- `traceparent`: "số hồ sơ" để nối trace của người gửi với trace của người nhận (mục 6.3). Nhờ trường này, trace **không bị đứt** khi đi qua RabbitMQ.

## 3.4. Outbox và inbox: sổ thư đi và sổ thư đến

Có một vấn đề tinh tế: service vừa phải **lưu dữ liệu vào DB** vừa phải **gửi command vào RabbitMQ**. Nếu lưu DB xong mà gửi thư thất bại (RabbitMQ đang hỏng), dữ liệu và thư sẽ lệch nhau.

Cách giải quyết là **outbox** ("sổ thư đi"):

```text
1. Service ghi dữ liệu + ghi "thư cần gửi" vào bảng outbox  ← cùng một lần lưu, hoặc cả hai, hoặc không gì cả
2. Một vòng lặp chạy nền (relay) đọc sổ thư đi, gửi thư vào RabbitMQ
3. Gửi được → đánh dấu đã gửi; gửi lỗi → hẹn thử lại sau
```

Nhờ vậy request của người dùng **không bao giờ báo lỗi chỉ vì RabbitMQ đang hỏng**: thư vẫn nằm trong sổ, khi RabbitMQ sống lại sẽ được gửi.

Phía nhận có **inbox** ("sổ thư đến"): worker ghi lại mã của mọi thư đã xử lý. Nếu bưu điện lỡ giao **trùng** một thư, worker nhìn sổ thấy đã làm rồi thì bỏ qua. Tính chất "xử lý lặp lại không bị trùng" này rất quan trọng, vì RabbitMQ không cam kết mỗi thư chỉ giao đúng một lần.

---

# Nhóm 4 — Khi có trục trặc

## 4.1. Timeout: chờ tối đa bao lâu

**Timeout** là thời gian chờ tối đa khi gọi một dịch vụ khác. Quá thời gian đó thì bỏ cuộc và báo lỗi `DEPENDENCY_TIMEOUT` (`504`).

Không đặt timeout thì một dịch vụ treo sẽ kéo **mọi** request đang chờ nó treo theo, giống một cuộc gọi không ai nghe mà bạn cứ cầm máy mãi. Trong testbed, **mỗi cạnh gọi HTTP có biến timeout riêng**, ví dụ `AI_COURSE_TIMEOUT_MS` cho `ai-worker` gọi `course`.

## 4.2. Retry: gọi lại

**Retry** là tự động gọi lại khi lần trước lỗi. Nghe thì có lợi, nhưng nếu dịch vụ đang quá tải thì retry làm nó **quá tải thêm**, và làm dữ liệu quan sát bị "nhân bản" khó đọc. Vì vậy:

- **Gọi HTTP giữa các service: không retry.** Lỗi một lần là báo lỗi ngay.
- **Worker xử lý command: có retry** (5 lần, cách 1 giây), vì việc chạy nền không có người đứng chờ.
- **Relay của outbox: thử lại** cho tới khi gửi được.

## 4.3. Circuit breaker: cầu dao tự ngắt

**Circuit breaker** giống **cầu dao điện**: khi phát hiện dịch vụ đích lỗi liên tục (mặc định 3 lần liên tiếp), "cầu dao" **ngắt**. Trong một khoảng thời gian (mặc định 5 giây), mọi lời gọi tới dịch vụ đó bị từ chối ngay tại chỗ (`503`), không thèm gọi thật. Hết khoảng đó, cho **một** lời gọi thử; thử được thì đóng cầu dao lại.

Lợi ích: không dồn thêm tải vào dịch vụ đang ốm, và người dùng nhận lỗi nhanh thay vì chờ timeout.

**Hệ quả quan trọng cho RCA:** khi cầu dao ngắt, request **không đi tới** dịch vụ đích, nên trong trace **không có span nào của dịch vụ đích**. Người truy vết thủ công nhìn trace sẽ thấy lỗi "ở bên gọi" và dễ kết luận sai. Span lúc đó có thuộc tính `circuit_breaker_open=true`, là manh mối cần biết để đọc.

---

# Nhóm 5 — Ai được làm gì

## 5.1. Token và JWT: thẻ ra vào có hạn

Khi đăng nhập thành công, `identity` cấp cho người dùng một **access token**, giống **thẻ ra vào tòa nhà**: trên thẻ ghi bạn là ai, vai trò gì, hết hạn lúc nào. Mỗi lần gọi API, người dùng đưa thẻ trong header `Authorization: Bearer <token>`.

Token trong testbed là **JWT** (JSON Web Token): một chuỗi chứa thông tin + **chữ ký** của `identity`. Chữ ký giúp bất kỳ ai cũng kiểm tra được thẻ là thật mà **không cần hỏi lại `identity`**.

- Token người dùng sống 3600 giây (1 giờ). Kèm theo là **refresh token** (24 giờ) để đổi lấy token mới mà không phải đăng nhập lại; mỗi lần đổi, refresh token cũ bị hủy (xoay vòng).
- Có **ba cửa đăng nhập** riêng: `/api/v1/auth/student/login`, `/api/v1/auth/instructor/login`, `/api/v1/auth/admin/login`.
- Chữ ký dùng thuật toán **EdDSA** (khóa Ed25519): `identity` giữ khóa bí mật để ký, mọi người dùng khóa công khai để kiểm tra.

## 5.2. JWKS: bảng mẫu chữ ký công khai

Để kiểm tra chữ ký, các service cần **khóa công khai** của `identity`. `identity` công bố khóa đó ở endpoint `GET /.well-known/jwks.json` (**JWKS** = JSON Web Key Set, "bộ khóa công khai").

Mỗi service tải JWKS về và **giữ trong bộ nhớ đệm 5 phút** (cache), không hỏi lại mỗi request. Nếu không tải được bản mới, service tiếp tục dùng bản cũ đang có.

## 5.3. Service token: thẻ nhân viên giữa các phòng ban

Không chỉ người dùng mà **các service gọi nhau cũng phải trình thẻ**. Mỗi service có một tài khoản dịch vụ (client id + secret, ví dụ `COURSE_CLIENT_SECRET`), dùng để xin `identity` cấp **service token** qua `POST /internal/v1/auth/service-token`.

- Service token sống mặc định **600 giây** (`IDENTITY_SERVICE_TOKEN_TTL_SECONDS=600`).
- Service tự **làm mới token ở nền** khi đã dùng được 50% thời hạn (khoảng 300 giây).
- Nếu xin token mới bị lỗi, service **tạm dùng token cũ còn hạn**.
- Token có **scope** (phạm vi quyền), ví dụ `media:cleanup` cho phép `scheduler-worker` gọi job dọn media. Gọi sai scope thì bị `403`.

**Vì sao đây là "điểm lỗi chung có chủ đích" (ADR-004)?** Mọi cạnh nội bộ đều cần token do `identity` cấp. Khi `identity` chết, các service **chưa lỗi ngay** vì còn token cũ. Chúng lần lượt lỗi khi token hết hạn, mỗi service một thời điểm. Triệu chứng xuất hiện **muộn**, **rải rác** và **ở chỗ khác** (`gateway-identity-token` chứ không phải `identity`). Đây là case **C6**, một ví dụ điển hình mà truy vết thủ công dễ đi nhầm hướng.

---

# Nhóm 6 — Nhìn vào bên trong hệ thống

## 6.1. Observability và telemetry: camera gắn trong hệ thống

**Observability** (khả năng quan sát) là mức độ ta hiểu được bên trong hệ thống chỉ bằng dữ liệu nó phát ra. Dữ liệu đó gọi là **telemetry**. RCA engine của đồ án **không đọc code, không vào tận máy**: nó chỉ "nhìn" được hệ thống qua telemetry. Telemetry thiếu hay sai thì AI cũng mù.

Có ba loại telemetry, giống ba loại thiết bị theo dõi bệnh nhân:

| Loại | So sánh | Trả lời câu hỏi |
| --- | --- | --- |
| **Metric** | Máy đo nhịp tim: con số theo thời gian | "Có gì bất thường không? Từ lúc nào?" |
| **Trace** | Camera theo dõi hành trình **một** request | "Request này đi qua đâu, chặng nào chậm/lỗi?" |
| **Log** | Sổ nhật ký: từng dòng ghi chép | "Chính xác đã xảy ra chuyện gì?" |

## 6.2. Trace và span: hành trình và từng chặng

Một **trace** là toàn bộ hành trình của một request. Nó gồm nhiều **span**, mỗi span là **một chặng công việc** có thời điểm bắt đầu, độ dài và trạng thái (thành công/lỗi). Span lồng vào nhau thành cây:

```text
POST /api/v1/*path                                              [gateway]   SERVER
 └─ gateway-course POST                                         [gateway]   CLIENT
     └─ POST /api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs  [course] SERVER
         ├─ course-postgres lesson.find-in-course               [course]    CLIENT
         └─ course-ai POST /internal/v1/ai/jobs                 [course]    CLIENT
             └─ POST /internal/v1/ai/jobs                       [ai]        SERVER
                 └─ lms.commands publish ai.job.run             [ai]        PRODUCER
                     └─ ai-worker--run-ai-job-v1 process        [ai-worker] CONSUMER
```

(Đây là phần đầu của một trace thật chụp ngày 17/11/2026, đã lược bớt span; trace đầy đủ ở hướng dẫn W6. Span gốc của gateway luôn tên `/api/v1/*path` vì gateway chỉ chuyển tiếp mọi đường dẫn.)

Bốn **loại span** (span kind) cần biết:

| Loại | Nghĩa | Ví dụ |
| --- | --- | --- |
| `SERVER` | "Tôi đang **nhận** một request" | span của `course` khi nhận `POST /api/v1/courses` |
| `CLIENT` | "Tôi đang **gọi** ra ngoài" (service khác, DB, MinIO, SMTP, LLM) | `course-postgres course.find-by-id` |
| `PRODUCER` | "Tôi đang **gửi** command vào RabbitMQ" | `lms.commands publish …` |
| `CONSUMER` | "Tôi đang **xử lý** command lấy từ RabbitMQ" | span của `notification-worker` khi gửi đợt thông báo |

Mỗi trace có một **`trace_id`** (32 ký tự hex), mỗi span có **`span_id`** (16 ký tự hex). Đây là "sợi chỉ" nối dữ liệu: một dòng log có `trace_id` thì tìm ra được trace tương ứng.

## 6.3. Trace context: số hồ sơ đi theo request

Để các service ghép span vào **cùng một** trace, "số hồ sơ" phải được chuyển theo request. Chuẩn W3C quy định số hồ sơ nằm trong header **`traceparent`**. Gọi HTTP thì `traceparent` nằm trong header của request; gửi command thì `traceparent` nằm trong header của message và trong phong bì command (mục 3.3).

Nếu một bước quên chuyển số hồ sơ, trace **bị đứt làm hai**. Người truy vết sẽ không thấy được mối liên hệ nhân quả giữa hai nửa.

## 6.4. Metric và label: bảng số liệu có nhiều cột phân loại

Một **metric** là một con số được đếm hoặc đo liên tục, ví dụ "số request", "thời gian xử lý". Mỗi metric có các **label** (nhãn) để chia nhóm, ví dụ:

```text
lms_dependency_request_count_total{
  service_name="course",                 ← ai gọi
  dependency_identity="course-postgres", ← gọi tới đâu
  operation_name="course.find-by-id",    ← thao tác gì
  status="ok"                            ← kết quả
} = 1532
```

Ba nhóm metric chính của testbed:

- **RED** của mỗi runtime: **R**ate (số request), **E**rrors (số lỗi), **D**uration (thời gian xử lý): `http_server_request_count`, `http_server_request_duration`, …
- **Dependency** của mỗi cạnh gọi ra ngoài: `lms_dependency_request_count`, `lms_dependency_error_count`, `lms_dependency_duration`.
- **Hàng đợi RabbitMQ**: số thư đang chờ trong từng queue, số consumer.

**Quy tắc vàng: label không được chứa ID.** Mỗi giá trị khác nhau của label tạo thêm **một dãy số liệu riêng**. Nếu label chứa mã người dùng hay mã khóa học thì mỗi người, mỗi khóa học sinh ra một dãy, và Prometheus phình to tới mức chậm hoặc sập. Hiện tượng "nhãn có quá nhiều giá trị khác nhau" này gọi là **high cardinality**. Vì vậy `operation_name` dùng **mẫu đường dẫn** như `GET /internal/v1/students/:studentId`, chứ không dùng đường dẫn thật chứa mã học viên. Đây là một lỗi đã được sửa ngày 17/11/2026 trong Gate R.

## 6.5. Log có cấu trúc

Mỗi runtime ghi log dạng **JSON một dòng**, các trường có tên cố định, ví dụ:

```json
{"timestamp":"2026-11-17T07:05:45.060Z","level":"INFO","message":"HTTP POST /internal/v1/auth/service-token 200",
 "service.name":"identity","trace_id":"f91aef06ac5e89a0a7b6b7e56c93c0ce","span_id":"3f2f87eae8e776de",
 "event":"http.server.request","http_route":"/internal/v1/auth/service-token","http_status_code":200}
```

"Có cấu trúc" nghĩa là máy đọc và lọc được theo từng trường. Log lỗi khi gọi ra ngoài có `event="dependency.failure"`, kèm `dependency_identity` và `error_type`. Mật khẩu, token và thông tin cá nhân bị che trước khi ghi.

## 6.6. Bộ công cụ quan sát: OpenTelemetry, Collector, Prometheus, Tempo, Loki, Grafana

```text
11 runtime LMS (mỗi runtime có OpenTelemetry SDK bên trong)
        │  gửi trace + metric + log qua giao thức OTLP (HTTP, cổng 4318)
        ▼
OTel Collector  ── trạm trung chuyển, phân loại và chuyển tiếp
        │
        ├── metric ──► Prometheus  (kho số liệu theo thời gian, cổng 9090)
        ├── trace  ──► Tempo       (kho trace, cổng 3200)
        └── log    ──► Loki        (kho log, cổng 3100)
                         ▲
Grafana (cổng 3008) ─────┘  màn hình xem cả ba kho, nhảy qua lại giữa log ↔ trace ↔ metric
```

| Công cụ | Vai trò, so sánh |
| --- | --- |
| **OpenTelemetry (OTel)** | "Tiêu chuẩn chung + bộ thư viện" để code phát ra trace/metric/log theo một định dạng thống nhất |
| **OTel Collector** | "Trạm bưu chính trung chuyển": nhận mọi telemetry, lọc, gắn thêm thông tin, chuyển tới đúng kho |
| **Prometheus** | Kho lưu **metric**, truy vấn bằng ngôn ngữ PromQL |
| **Tempo** | Kho lưu **trace**, tìm theo `trace_id` hoặc truy vấn TraceQL |
| **Loki** | Kho lưu **log**, truy vấn bằng LogQL; chỉ đánh chỉ mục theo `service_name` |
| **Grafana** | "Màn hình điều khiển": vẽ biểu đồ, xem trace, đọc log, có liên kết nhảy từ log sang trace |

Bộ công cụ này nằm ở `aiops-platform/observability/`, **tách riêng** khỏi LMS. LMS chỉ biết "gửi telemetry tới `otel-collector:4318`".

---

# Nhóm 7 — Chạy và thử

## 7.1. Docker, image, container, volume, port

| Khái niệm | So sánh | Trong testbed |
| --- | --- | --- |
| **Image** | "Hộp cơm đóng gói sẵn": chương trình + mọi thứ nó cần | `aiops-lms-course`, `postgres:17.6-alpine` |
| **Container** | "Hộp cơm đang được hâm nóng và ăn": một bản đang chạy của image | container `course`, container `postgres` |
| **Volume** | "Tủ lạnh" giữ dữ liệu khi container bị xóa | volume lưu dữ liệu PostgreSQL, Tempo, Loki… |
| **Port** | "Số cửa" để đi vào container từ máy của bạn | `3000` gateway, `3008` Grafana, `8025` Mailpit |
| **Docker** | Phần mềm chạy container | Docker Engine trên máy |

`docker compose ... down --volumes` **đổ hết tủ lạnh**: xóa sạch dữ liệu để bắt đầu lại từ đầu. Chỉ dùng khi chắc chắn không cần giữ dữ liệu.

## 7.2. Docker Compose: bản nhạc cho cả dàn nhạc

**Docker Compose** đọc một file YAML mô tả **nhiều container cùng lúc**: container nào, chạy image nào, biến môi trường nào, phụ thuộc container nào, khi nào coi là "khỏe" (healthcheck). Một lệnh `docker compose up` dựng cả dàn.

Testbed có ba file Compose chính, cộng một file "ghép thêm" của tuần 13:

- `docker-compose/compose.yaml`: chỉ LMS (11 runtime + PostgreSQL, RabbitMQ, MinIO, Mailpit).
- `aiops-platform/observability/compose.yaml`: chỉ bộ quan sát.
- `docker-compose/compose.full.yaml`: **ghép cả hai**. Đây là file dùng khi muốn xem trace/metric/log, tổng cộng 21 thành phần.
- `aiops-platform/faults/compose.faults.yaml` (PR #75, chưa merge): **lớp gây lỗi**, ghép **sau** `compose.full.yaml` bằng thêm một `-f`. Nó thêm `toxiproxy` (proxy chèn trễ) và `llm-stub` (nhà cung cấp AI giả), nâng stack lên 23 container. Hình dung như lắp thêm "van điều chỉnh" vào vài đường ống có sẵn mà không sửa máy. Cách dùng ở [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md) phần J.

## 7.3. Biến môi trường và file `.env`

Mỗi container đọc cấu hình từ **biến môi trường**, ví dụ `IDENTITY_SERVICE_TOKEN_TTL_SECONDS=600`. Các giá trị mặc định cho máy cá nhân nằm trong `docker-compose/.env.example`; bạn chép thành `.env` để dùng. Mật khẩu trong đó chỉ dùng thử ở máy, không phải bí mật thật.

## 7.4. Seed, workload và k6

- **Seed** là nạp sẵn dữ liệu mẫu vào database (tài khoản, khóa học…) để hệ thống "có gì mà chạy". Testbed tự tạo 3 tài khoản mẫu khi khởi động (`admin@example.test`, `instructor@example.test`, `student@example.test`, mật khẩu `example-password`), và có công cụ seeder nạp dữ liệu số lượng lớn.
- **Workload** là traffic giả lập người dùng đang dùng hệ thống. Không có workload thì "camera không quay được gì".
- **k6** là công cụ viết script đóng vai nhiều người dùng gửi request. Mức 1 (mỗi luồng W1–W7 một chuỗi thao tác cố định) đã viết ở tuần 13 (PR #76, chưa merge), chạy bằng image Docker nên máy không cần cài k6. Tuần 14 dùng k6 để **phát lại phiên học viên thật** từ log Moodle (mức 2+) và mô phỏng hành vi giảng viên/admin (mức 2), không chỉ "bắn request đều đều". Xem [`09-cases-and-workload.md`](09-cases-and-workload.md) mục 4.
- **Hai chữ "seed" khác nhau:** *dữ liệu seed* là dữ liệu nạp sẵn vào database; *workload seed* là số khởi tạo bộ sinh số ngẫu nhiên của k6 (cùng seed thì cùng chuỗi thao tác).

---

## Tóm tắt

- Testbed là một LMS chia thành **7 service + 4 worker** (11 runtime); service có API trả lời ngay, worker làm việc nền nhận từ RabbitMQ.
- Mỗi service có **database riêng** trong một máy chủ PostgreSQL chung (6 logical DB); file lưu ở **MinIO**.
- Gọi **đồng bộ** = HTTP (chờ trả lời, có timeout, có circuit breaker, không retry); gọi **bất đồng bộ** = command qua RabbitMQ (có outbox/inbox, có retry, có queue `.error`).
- `4xx` là lỗi người gọi (thường bình thường), `5xx` mới là dấu hiệu sự cố.
- Người dùng và cả các service đều phải có **token** do `identity` ký; service token sống 600 giây và tự làm mới ở nền, nên khi `identity` chết thì lỗi đến **muộn và rải rác**.
- Telemetry gồm **metric** (con số), **trace/span** (hành trình request) và **log** (nhật ký), nối với nhau bằng `trace_id`.
- Label của metric **không được chứa ID**.
- Telemetry đi: runtime → OTel Collector → Prometheus/Tempo/Loki → xem bằng Grafana.

## Câu hỏi tự kiểm tra

1. Vì sao `gateway` không nằm trong danh sách nghi phạm của RCA?
   <details><summary>Đáp án</summary>Vì gateway là nơi thấy triệu chứng đầu tiên (mọi request đi qua nó) nhưng không có fault nào có nguyên nhân gốc ở gateway; candidate set gồm 10 runtime còn lại.</details>

2. Khác nhau giữa service và worker là gì? Kể tên 4 worker.
   <details><summary>Đáp án</summary>Service có API trả lời request ngay; worker không có API công khai, nhận command từ RabbitMQ và làm việc nền. Bốn worker: <code>media-worker</code>, <code>notification-worker</code>, <code>scheduler-worker</code>, <code>ai-worker</code>.</details>

3. Outbox giải quyết vấn đề gì?
   <details><summary>Đáp án</summary>Vấn đề "lưu DB xong nhưng gửi thư vào RabbitMQ thất bại" làm dữ liệu và message lệch nhau. Outbox ghi thư cần gửi vào DB cùng lúc với dữ liệu, rồi relay gửi dần; RabbitMQ hỏng thì thư vẫn nằm đợi.</details>

4. Khi circuit breaker đang ngắt, trace của request trông khác gì so với bình thường?
   <details><summary>Đáp án</summary>Không có span nào của dịch vụ đích vì request bị chặn ngay ở bên gọi; span CLIENT ở bên gọi lỗi <code>503</code> và có thuộc tính <code>circuit_breaker_open=true</code>.</details>

5. Vì sao khi `identity` chết, các service khác không lỗi ngay lập tức?
   <details><summary>Đáp án</summary>Vì chúng còn service token đã xin trước đó (sống 600 giây) và JWKS đã cache; chúng chỉ lỗi khi token hết hạn mà không xin được token mới, mỗi service một thời điểm.</details>

6. Vì sao `operation_name` phải là mẫu đường dẫn như `/students/:studentId` chứ không phải đường dẫn thật?
   <details><summary>Đáp án</summary>Vì <code>operation_name</code> là label của metric; mỗi giá trị khác nhau tạo một dãy số liệu riêng. Đưa ID vào label làm số dãy tăng không giới hạn (high cardinality), làm Prometheus phình to.</details>

7. `trace_id` dùng để làm gì?
   <details><summary>Đáp án</summary>Là mã chung của mọi span trong một request; dùng để gom các span thành một trace và để nối log với trace (log có <code>trace_id</code> thì tìm ra trace tương ứng).</details>

8. `docker compose down --volumes` khác `docker compose down` thế nào?
   <details><summary>Đáp án</summary><code>down</code> chỉ dừng và xóa container; <code>down --volumes</code> xóa luôn volume, tức toàn bộ dữ liệu (database, telemetry). Dùng khi muốn bắt đầu lại từ trạng thái sạch.</details>
