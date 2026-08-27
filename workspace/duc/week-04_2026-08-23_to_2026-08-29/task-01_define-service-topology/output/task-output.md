# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-service-topology` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | Chưa được Đức cung cấp; hồ sơ được tạo hồi tố ngày 27/08/2026 |
| Hoàn thành thực tế | Chưa ghi — chờ Bách `APPROVED` và Đức finalization |
| Tổng thời lượng | Chưa được Đức cung cấp |
| Pull request | Chưa tạo |
| Người review | Bách |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Chuẩn hóa topology MVP gồm 6 business service và API Gateway.
- Lập service catalogue, dependency graph, architecture diagram và edge catalogue W1–W5.
- Đối chiếu topology với fault F1–F5, telemetry boundary và RCA candidate set service-level.
- Phân tách rõ MVP, Target, Stretch và quy tắc thay đổi topology bằng ADR.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Service catalogue và architecture diagram v1 | Docs | [service-catalogue-and-topology-v1.md](../../../../../docs/processed/architecture/service-catalogue-and-topology-v1.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Catalogue đủ trách nhiệm, data ownership và dependency | Đạt về nội dung | Mục 4 của artifact |
| Diagram đủ HTTP, async và infrastructure dependency | Đạt về nội dung | Mục 3 và 7 của artifact |
| Scope nhất quán backend blueprint | Đạt về nội dung | Mục 9–10 và kết quả đối chiếu canonical |
| Bách review node/edge quan sát | Chưa đạt | Mục 13 đang ghi `PENDING`; cần review thật trên PR |
| Artifact nằm đúng vị trí và mở được | Đạt trên nhánh task | Link sản phẩm ở trên |
| URL PR và `Chờ review` có trên PR head | Chưa đạt | Sẽ cập nhật sau khi PR được tạo |
| Approval và finalization trước merge | Chưa đạt | Chờ Bách `APPROVED` trên GitHub |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: không mở rộng scope; artifact được đưa từ thư mục gốc vào `docs/processed/architecture/`.
- Việc chưa hoàn thành hoặc trở ngại: chưa có review/approval của Bách; thời gian bắt đầu và tổng thời lượng chưa được Đức cung cấp.
- Bước tiếp theo: tạo PR, cập nhật URL và `Chờ review`, sau đó nhờ Bách review boundary telemetry/graph/RCA.

> `Hoàn thành thực tế` chỉ được ghi sau khi có `APPROVED` hợp lệ và Đức thực hiện finalization. Task chỉ canonically hoàn thành sau khi Đức merge PR vào `main`.
