# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-service-topology` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành trên branch task — sẵn sàng merge vào `main` |
| Bắt đầu thực tế | Chưa được Đức cung cấp; hồ sơ được tạo hồi tố ngày 27/08/2026 |
| Hoàn thành thực tế | 28/08/2026 — Bách đã gửi `APPROVED` trên GitHub và completion record đã được finalization trên branch task |
| Tổng thời lượng | Chưa được Đức cung cấp |
| Pull request | [PR #6](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/6) |
| Người review | Bách |
| Kết quả review | `APPROVED` — Bách (`bachmk`) |

## Báo cáo công việc đã làm

- Chuẩn hóa topology MVP gồm 6 business service và API Gateway.
- Lập service catalogue, dependency graph, architecture diagram và edge catalogue W1–W5.
- Đối chiếu topology với fault F1–F5, telemetry boundary và RCA candidate set service-level.
- Phân tách rõ MVP, Target, Stretch và quy tắc thay đổi topology bằng ADR.
- Bách đã review boundary telemetry/graph/RCA và gửi verdict `APPROVED` trên GitHub.

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
| Bách review node/edge quan sát | Đạt | Mục 13 ghi verdict `APPROVED` của Bách trên GitHub |
| Artifact nằm đúng vị trí và mở được | Đạt trên nhánh task | Link sản phẩm ở trên |
| URL PR và `Chờ review` có trên PR head | Đạt | PR #6 và metadata được commit/push trên nhánh task |
| Approval và finalization trước merge | Đạt trên branch task | GitHub ghi nhận `APPROVED` của Bách; completion metadata được cập nhật trên branch task |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: không mở rộng scope; artifact được đưa từ thư mục gốc vào `docs/processed/architecture/`.
- Việc chưa hoàn thành hoặc trở ngại: thời gian bắt đầu và tổng thời lượng chưa được Đức cung cấp; đây là giới hạn của hồ sơ hồi tố, không phải blocker DoD.
- Bước tiếp theo: Bách kiểm tra lại finalization metadata trước khi merge PR #6 vào `main` theo ngoại lệ workflow đã được chấp thuận.

> `Hoàn thành thực tế` được ghi sau khi GitHub có `APPROVED` hợp lệ và completion record đã finalization trên branch task. Task chỉ canonically hoàn thành sau khi PR merge vào `main`.
