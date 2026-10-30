# Postman v2 cho LMS

Bộ request chạy được qua Gateway cho stack LMS v2, tương ứng bảy workflow của regression
(`lms/test/regression/`). Mọi request đi qua Gateway (`gateway_url`); collection tự tạo dữ liệu bằng
chính các request, không phụ thuộc dữ liệu seed hay khóa học có sẵn.

| File | Vai trò |
| --- | --- |
| `lms-v2.postman_collection.json` | Collection 90 request, 224 assertion, chia thư mục theo workflow |
| `lms-v2.postman_environment.json` | Biến môi trường: `gateway_url`, `mailpit_url`, tài khoản bootstrap, `ai_provider_url` |
| `fixtures/sample-note.txt` | Tệp mẫu cho request upload trực tiếp lên MinIO (kích thước và SHA-256 khớp collection) |

## Chạy bằng newman

Từ thư mục `lms/` (cần Docker; lệnh dựng stack sạch, chạy collection rồi dọn stack):

```bash
cd lms
pnpm run test:postman
```

Lệnh dùng project `aiops-lms-test-postman` và `docker-compose/.env.example`; thêm `--keep` để giữ stack sau khi chạy (`pnpm run test:postman -- --keep`). Dừng các project Compose khác đang dùng cùng host port trước khi chạy.

Chạy trên stack đã có sẵn (`gateway_url` và `mailpit_url` đổi qua `--env-var`):

```bash
cd postman
../lms/node_modules/.bin/newman run lms-v2.postman_collection.json \
  --environment lms-v2.postman_environment.json --working-dir .
```

`--working-dir` bắt buộc để request upload tìm thấy `fixtures/sample-note.txt`.

## Chạy trong Postman

Import collection và environment, chọn environment `LMS v2 - Local`, trỏ `Working Directory` của Postman tới thư mục `postman/` (Settings → General), rồi chạy cả collection bằng Collection Runner **theo thứ tự**: các thư mục sau dùng token và id do các thư mục trước lưu vào collection variables. Chạy riêng lẻ từng request chỉ đúng khi các biến cần thiết đã có.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `00` Đăng nhập tài khoản khởi tạo | Token admin và instructor từ tài khoản bootstrap của `identity` |
| `01 auth-register-login` | Đăng ký, ba cửa đăng nhập, refresh xoay vòng, phân quyền, từ chối `x-principal-*` tự khai |
| `02 course-authoring` | Khóa học, bài học (thứ tự), quiz, xuất bản, tìm kiếm, tổng hợp, export CSV |
| `03 enroll-and-learn` | Ghi danh, tiến độ, làm quiz và chấm điểm (1.5/3.5) |
| `04 media-upload` | Presigned POST thẳng lên MinIO, `upload-complete`, nội dung công khai, Range, usage |
| `05 notification-batch-email` | Thông báo đơn, đợt gửi hàng loạt, email trong Mailpit, inbox |
| `06 media-cleanup-scheduler` | Job `MEDIA_UNUSED_CLEANUP`, run, chạy lặp cùng `idempotency_key` |
| `07 ai-config` | Provider và model AI (không gán task, không gọi model thật) |
| `08 health` | `GET /ready` của Gateway |

Quy ước chung của collection:

- Script ở cấp collection kiểm mọi response JSON có đủ bốn khóa `success`, `data`, `error`, `meta` và `meta.trace_id`.
- Request chờ bất đồng bộ (email, đợt gửi, run scheduler) tự gọi lại chính nó mỗi giây, tối đa 30–120 lần, rồi mới báo lỗi.
- `run_id` được sinh lại ở request đầu tiên của mỗi lần chạy nên email và tên dữ liệu không trùng giữa các lần.
- Đọc nội dung đầy đủ của luồng AI (trích xuất tài liệu, soạn bài, sinh quiz) cần provider LLM; luồng này chỉ chạy trong regression với provider giả.
- Job dọn media dùng `retention_hours=0`, nên `MEDIA_CLEANUP_MIN_RETENTION_HOURS=0` phải được đặt cho `media` (`pnpm run test:postman` đã đặt; trên stack tự dựng, mặc định `1` làm run kết thúc `FAILED` với `MEDIA_CLEANUP_REJECTED`).
