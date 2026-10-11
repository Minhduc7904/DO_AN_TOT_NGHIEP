# Input task

## Thông tin chung

| Trường               | Nội dung                                                       |
| -------------------- | -------------------------------------------------------------- |
| Mã task              | `task-01_standardize-dependency-resilience`                    |
| Tên task             | Chuẩn hóa resilience cho dependency HTTP                       |
| Người phụ trách      | Đức                                                            |
| Tuần thực hiện       | `week-09_2026-09-27_to_2026-10-03`                             |
| Trạng thái           | Chờ review                                                     |
| Ngày tạo             | 11/10/2026                                                     |
| Thời gian dự kiến    | 11–12/10/2026                                                  |
| Nhánh thực hiện      | `refactor/week-09/task-01-standardize-dependency-resilience`   |
| Pull request dự kiến | [#35](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/35) |

## Mục tiêu và phạm vi

### Task cần làm gì?

Chuẩn hóa policy timeout, retry, error mapping và telemetry cho các dependency HTTP hiện có tại Gateway, Enrollment, Submission và Grading. Giữ retry HTTP tắt, chốt timeout mặc định/range, phân biệt timeout `504` với unavailable `503`, và chứng minh mỗi request chỉ gọi `fetch` một lần.

### Phạm vi không thực hiện

- Không thay đổi business contract hoặc thêm endpoint LMS.
- Không thêm retry HTTP, shared resilience library mới hay retry topology messaging.
- Không thay đổi circuit breaker Enrollment; chỉ tài liệu hóa rõ nó không phải retry.
- Không sửa `workspace/bach/`.

## Sản phẩm dự kiến

| Sản phẩm                                         | Loại          | Vị trí hoặc link dự kiến                                         |
| ------------------------------------------------ | ------------- | ---------------------------------------------------------------- |
| Policy resilience HTTP canonical v1              | Docs          | `docs/processed/architecture/dependency-resilience-policy-v1.md` |
| Timeout, mapping và Gateway dependency telemetry | Code / Config | `lms/services/{gateway,enrollment,submission,grading}/`          |
| Kiểm thử mapping, single-fetch và cardinality    | Test          | Unit/telemetry test của bốn service                              |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: HTTP/event contract v1, data ownership/fault matrix v1, code W6–W8 đã merge.
- Người cần phối hợp: Không có; review dùng agent độc lập theo ngoại lệ Đức đã xác nhận.
- Rủi ro hoặc giả định: path/resource ID chỉ được phép trên span khi cần chẩn đoán, không được đưa vào metric label; business `404` phải giữ semantics hiện hành.

## Definition of Done

- [ ] Policy v1 ghi rõ retry HTTP tắt, timeout Gateway 5.000 ms, Enrollment/Submission/Grading 3.000 ms và range 100–60.000 ms.
- [ ] Local timeout hoặc upstream `504` map `DEPENDENCY_TIMEOUT`/504; network error hoặc upstream 5xx khác map `DEPENDENCY_UNAVAILABLE`/503; business error/404 giữ semantics.
- [ ] Gateway có dependency identity hữu hạn, client span và metric count/error/duration; metric label không chứa path động, principal hoặc resource ID.
- [ ] Test chứng minh mỗi outbound request chỉ gọi `fetch` một lần, không retry hoặc duplicate write; timeout/error/cardinality assertions pass.
- [ ] `format:check`, build, lint, unit test, `test:telemetry`, `ci:verify`, `git diff --check` và Compose config pass.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review.
- [ ] Finalization ghi trung thực review AI và xác nhận ngoại lệ của Đức; không giả verdict GitHub.
