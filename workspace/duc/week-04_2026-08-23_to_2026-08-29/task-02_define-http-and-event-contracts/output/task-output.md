# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_define-http-and-event-contracts` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | Chưa được Đức cung cấp; hồ sơ được tạo hồi tố ngày 27/08/2026 |
| Hoàn thành thực tế | Chưa ghi — chờ Bách `APPROVED` và Đức finalization |
| Tổng thời lượng | Chưa được Đức cung cấp |
| Pull request | Chưa tạo |
| Người review | Bách |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Thiết kế HTTP contract tối thiểu cho W1–W5 theo service ownership.
- Chốt common error envelope, versioning, timeout/retry và trace/correlation convention.
- Thiết kế event `grade.completed` v1 với producer, consumer, envelope, payload, compatibility và duplicate/failure expectation.
- Lập traceability từ contract sang topology, telemetry/evaluation requirement và contract tests tuần 5.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| HTTP contract và event schema v1 | Docs | [http-and-event-contracts-v1.md](../../../../../docs/processed/architecture/http-and-event-contracts-v1.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Contract đủ workflow, request/response/error và ownership | Đạt về nội dung | Mục 3–10 và 16 của artifact |
| Event đủ schema/correlation/failure/retry expectation | Đạt về nội dung | Mục 11–13 của artifact |
| Không vi phạm cross-service source/data ownership | Đạt về nội dung | Mục 15 của artifact và kết quả đối chiếu backend blueprint |
| Bách review HTTP flow và async event | Chưa đạt | Mục 21 đang ghi `PENDING`; cần review thật trên PR |
| Artifact nằm đúng vị trí và mở được | Đạt trên nhánh task | Link sản phẩm ở trên |
| URL PR và `Chờ review` có trên PR head | Chưa đạt | Sẽ cập nhật sau khi PR được tạo |
| Approval và finalization trước merge | Chưa đạt | Chờ Bách `APPROVED` trên GitHub |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: không mở rộng scope; artifact được đưa từ thư mục gốc vào `docs/processed/architecture/`.
- Việc chưa hoàn thành hoặc trở ngại: chưa có review/approval của Bách; task-01/topology v1 cần được merge trước hoặc cùng thứ tự dependency; thời gian bắt đầu và tổng thời lượng chưa được Đức cung cấp.
- Bước tiếp theo: tạo PR, cập nhật URL và `Chờ review`, sau đó nhờ Bách review W4 Submit và event `grade.completed`.

> `Hoàn thành thực tế` chỉ được ghi sau khi có `APPROVED` hợp lệ và Đức thực hiện finalization. Task chỉ canonically hoàn thành sau khi Đức merge PR vào `main`.
