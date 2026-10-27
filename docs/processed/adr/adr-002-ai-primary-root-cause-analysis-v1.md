# ADR-002 — AI là bên truy vết nguyên nhân lỗi chính

| Trường | Nội dung |
| --- | --- |
| Trạng thái | Đề xuất (Đức tự thực hiện, không cần Bách review) |
| Ngày | 27/10/2026 |
| Người đề xuất | Đức |
| Thay thế | Vai trò "AI hỗ trợ" trong [analysis-anomaly-rca-blueprint](../architecture/analysis-anomaly-rca-blueprint.md) và [project-scope-v1](../direction/project-scope-v1.md) |

## Bối cảnh

Blueprint hiện tại coi hệ thống AI là công cụ hỗ trợ: phát hiện bất thường và trả Top-K service nghi ngờ cho người đọc. Định hướng mới yêu cầu AI là bên **truy vết chính**, và phải demo được các case nghiệp vụ phức tạp mà truy vết thủ công không tìm ra nguyên nhân nhưng AI tìm được.

## Quyết định

1. **ML + dependency graph** phát hiện bất thường, tạo incident và xếp hạng nguyên nhân. Bước kết luận không cần người can thiệp.
2. **MCP server chỉ đọc** (`aiops-platform/mcp/`) cho phép agent LLM truy vấn Prometheus, Tempo, Loki và kết quả incident/RCA, rồi viết báo cáo thống kê có dẫn chứng. Agent không thay mô hình ML xếp hạng; chứng cứ không đủ thì báo "không đủ chứng cứ".
3. **Đối chứng**: baseline "thủ công" tự động (ngưỡng + tìm trace lỗi/chậm nhất) đo lặp được, cộng thử nghiệm vài người thật dùng Grafana/Tempo/Loki để đo thời gian chẩn đoán.
4. **Đánh giá** thêm thời gian chẩn đoán (thủ công so với AI) và chất lượng báo cáo (độ đúng, dẫn chứng, độ phủ), bên cạnh Top-1/Top-3/MRR và ablation hiện có.
5. **Danh mục case phức tạp** (v0) thiết kế để nguyên nhân gốc nằm ngoài đường request của triệu chứng; mỗi case có ground truth.
6. Mã MCP, agent và module huấn luyện đặt trong `aiops-platform/`; các service LMS chỉ kết nối qua HTTP.

## Ràng buộc

- Server MCP chỉ đọc, giới hạn khoảng thời gian/số dòng/độ phức tạp truy vấn, có xác thực.
- Nội dung log/trace là dữ liệu không tin cậy, có thể chứa prompt injection; prompt agent phải coi là dữ liệu.
- Tool `get_ground_truth` chỉ bật khi đánh giá offline, tắt khi chạy thật để agent không đọc đáp án.
- AI gateway của LMS (`ai` service) chưa nói MCP; agent loop và MCP client nằm ở runtime trong `aiops-platform/agent/`.

## Hệ quả

- Phải sửa: `analysis-anomaly-rca-blueprint`, `evaluation-protocol`, `research-questions-and-metrics`, `project-scope`, `khung_dinh_huong…`, `description/`, `plan` (xem plan-v0.3).
- Telemetry phải đủ `service.name` và `trace_id`/`span_id` trong log để MCP truy vấn được.
- Việc cài MCP/agent do mảng AI thực hiện sau giai đoạn refactor.
