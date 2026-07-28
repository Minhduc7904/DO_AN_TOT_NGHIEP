# Review: microsoft/multi-agent-reference-architecture

> **Mục đích:** Ghi chú tham khảo kiến trúc cho đồ án “Hệ thống Multi-Agent tự triển khai, thích nghi theo tài nguyên, hỗ trợ phát triển backend NestJS theo Clean Architecture”. Đây là tài liệu review; không phải đặc tả bắt buộc hay kết quả thực nghiệm của đồ án.

| Thuộc tính | Giá trị |
| --- | --- |
| Repository | [microsoft/multi-agent-reference-architecture](https://github.com/microsoft/multi-agent-reference-architecture) |
| Tổ chức | Microsoft |
| Loại tài liệu | Hướng dẫn kiến trúc tham chiếu cho hệ thống multi-agent cấp doanh nghiệp |
| Giấy phép | MIT |
| Ngày tham khảo | 28/07/2026 |
| Mức độ liên quan | **Cao** — định hướng kiến trúc, điều phối, quan sát, đánh giá và bảo mật |

## 1. Tóm tắt repository

Repository trình bày một kiến trúc khái niệm kèm hướng dẫn thực hành để thiết kế hệ thống multi-agent có khả năng mở rộng, quản trị và vận hành an toàn. Trọng tâm không phải xây một agent đơn lẻ, mà là cách điều phối các agent chuyên biệt, kiểm soát vòng đời của chúng và đánh giá toàn hệ thống.

Các chủ đề chính gồm:

- Building blocks: orchestrator, agent chuyên biệt, agent registry và memory.
- Các lựa chọn thiết kế, giao tiếp agent, knowledge layer và MCP.
- Observability, evaluation, security và governance.
- Một reference architecture có thể chứa agent cục bộ hoặc từ xa.

**Nhận định:** Đây là nguồn tốt để tham chiếu các quyết định kiến trúc cấp hệ thống. Tuy nhiên, nó không phải là framework triển khai hoàn chỉnh, cũng không cung cấp benchmark chuyên cho NestJS/Clean Architecture hay cơ chế routing theo VRAM và ngân sách GPU.

## 2. Kiến trúc tham chiếu của Microsoft

Luồng chính trong kiến trúc của repository:

```text
User Application
  → Orchestrator
  → Classifier / Router
  → Agent Registry
  → Supervisor
  → Specialized Agents
  → Tool / Knowledge / MCP integrations
  → Persistent state, history and observability
```

Các thành phần quan trọng:

| Thành phần | Vai trò theo repository | Ý nghĩa với đồ án |
| --- | --- | --- |
| **Orchestrator** | Điều phối request, giữ context, quản lý vòng đời và recovery. | Phù hợp với `Agent Graph Orchestrator` dùng LangGraph.js. |
| **Classifier** | Phân loại yêu cầu và routing theo mức chi phí tăng dần, từ NLU/SLM đến LLM. | Có thể mở rộng thành `Task Complexity Estimator` và policy chọn profile `ECONOMY`/`BALANCED`/`QUALITY`/`RECOVERY`. |
| **Supervisor** | Phân rã task, giao việc, theo dõi tiến độ, tổng hợp kết quả. | Tương ứng vai trò Planner/Architect hoặc controller ở tác vụ phức tạp. |
| **Specialized agents** | Agent được tổ chức theo năng lực có ý nghĩa, không phải từng tool call nhỏ lẻ. | Hỗ trợ việc giữ năm agent của đồ án: Planner, Retriever, Implementer, Tester/Debugger và Architecture Reviewer. |
| **Agent Registry** | Nguồn dữ liệu agent, capability, trạng thái, phiên bản và metadata. | Hữu ích khi đồ án cần mở rộng động agent; MVP có thể thay bằng registry tĩnh qua cấu hình. |
| **State & history** | Lưu hội thoại, trạng thái runtime, audit trail và versioning. | Cần cho `Run Manager`, trace, retry, tái lập thí nghiệm và phân tích lỗi. |
| **MCP / Integration layer** | Chuẩn hoá kết nối tool, kiểm soát xác thực, policy và logging. | Hữu ích nếu sau này tách các tool đọc repo/chạy test thành MCP server; chưa cần thiết cho MVP nội bộ. |

## 3. Các nguyên tắc nên kế thừa

### 3.1. Orchestrator là điểm kiểm soát trung tâm

Repository khuyến nghị luồng giao tiếp đi qua orchestrator để dễ quan sát và kiểm soát; không nên cho nhiều specialized agent giao tiếp trực tiếp nếu không thật sự cần thiết. Với đồ án, đây là lựa chọn hợp lý:

- LangGraph giữ state chung của một lần chạy.
- Controller quyết định topology và ngân sách.
- Agent trả output có schema cho controller thay vì tự ý gọi agent khác.
- Chỉ cho phép giao tiếp trực tiếp khi có lý do đo đạc rõ ràng.

Điều này giảm độ phức tạp khi truy vết lỗi, tính chi phí GPU và giới hạn số vòng lặp.

### 3.2. Agent phải được định nghĩa theo năng lực, không theo tool

Một agent nên đại diện cho một năng lực kết dính; ví dụ `Architecture Reviewer` có nhiệm vụ đánh giá dependency direction và ranh giới Clean Architecture, chứ không phải một agent “chạy ESLint”. Các tool như `rg`, TypeScript compiler, Jest và Prisma là năng lực mà agent sử dụng.

Nguyên tắc này giúp tránh phân mảnh topology và tránh làm router phải chọn giữa quá nhiều agent gần như giống nhau.

### 3.3. Routing phân tầng theo chi phí

Reference architecture gợi ý phân loại từ cơ chế rẻ đến đắt hơn, và fallback khi độ tin cậy không đủ. Đồ án có thể cụ thể hoá nguyên tắc này thành:

1. Rule/heuristic nhanh dựa trên loại task, số file dự kiến, schema change và kết quả vòng trước.
2. Chọn profile ban đầu cùng model nhỏ khi task đơn giản.
3. Escalate lên model mạnh hoặc thêm Planner/Reviewer khi build, test, hidden test hoặc architecture check thất bại.
4. Dừng khi vượt giới hạn vòng lặp, thời gian hoặc GPU budget.

Phần bổ sung của đồ án so với reference architecture là đưa **free VRAM, GPU utilization, queue length, latency và GPU-hour budget** vào chính sách routing.

### 3.4. Quan sát phải phục vụ đánh giá

Repository phân biệt rõ:

- **Observability:** thu thập logs, metrics và traces; đặc biệt là action của agent, tool call, model invocation, latency và failure/recovery.
- **Evaluation:** sử dụng dữ liệu đó để kết luận hệ thống có đạt tiêu chí thành công hay không.

Vì vậy mỗi run của đồ án nên có `run_id` và lưu tối thiểu: task ID, commit repo, profile được chọn, model/revision, prompt version, agent trace, tool call, retry reason, token input/output, latency, GPU metrics, kết quả build/lint/test/architecture check và patch cuối cùng.

### 3.5. Ưu tiên đánh giá xác định được cho coding agent

Reference architecture nêu code-based evaluation là phù hợp khi có tiêu chí kiểm tra được bằng chương trình. Đây là cơ sở tốt cho hướng đánh giá của đồ án:

- Public/hidden tests, build, lint, type-check và Prisma validation là thước đo chính.
- Static rules và dependency analysis đo Architecture Compliance Score.
- LLM-as-a-judge chỉ nên bổ sung cho các khía cạnh khó định lượng, không thay thế kiểm thử xác định được.

## 4. Áp dụng vào kiến trúc đồ án

| Hạng mục đồ án | Cách áp dụng từ reference | Quyết định đề xuất |
| --- | --- | --- |
| Resource-Adaptive Controller | Kế thừa classifier + routing + fallback. | **Triển khai MVP** bằng rule-based policy có decision log. |
| Agent Graph Orchestrator | Kế thừa mô hình điều phối tập trung. | **Triển khai MVP** bằng LangGraph.js; giới hạn retry và context. |
| Các agent chuyên biệt | Kế thừa nguyên tắc capability cohesion. | **Triển khai MVP** với 5 agent đã xác định trong plan. |
| Agent registry | Kế thừa metadata/capability/version. | Dùng **registry tĩnh** trong config trước; registry động là mở rộng. |
| Conversation/state store | Kế thừa persistent state và audit trail. | Lưu run state, trace và artifact qua PostgreSQL/Redis. |
| MCP integration | Kế thừa ranh giới tool rõ ràng và policy enforcement. | Để **giai đoạn mở rộng**; MVP có thể gọi tool nội bộ trong sandbox. |
| Observability | Kế thừa logs + metrics + traces cho agentic system. | **Bắt buộc**: Prometheus/Grafana và trace theo `run_id`. |
| Security & governance | Kế thừa least privilege, audit, versioning và rollback. | **Bắt buộc** cho sandbox: không privileged, không Docker socket, network tắt mặc định, không có secret. |

## 5. Những điểm không nên sao chép nguyên trạng

1. **Không chọn Semantic Kernel chỉ vì reference sử dụng nó làm ví dụ.** Đồ án đã định hướng NestJS và LangGraph.js; giá trị cần kế thừa là pattern, không phải framework.
2. **Không xây agent registry động quá sớm.** Với tập agent cố định của MVP, cấu hình tĩnh dễ kiểm soát hơn và đủ cho so sánh thực nghiệm.
3. **Không biến mỗi thao tác thành một agent.** Chạy test, đọc file hay parse AST nên là tool trong agent phù hợp.
4. **Không dùng LLM-as-a-judge làm metric chính.** Các tác vụ sinh mã cần ưu tiên build/test/architecture rules để tái lập.
5. **Không coi kiến trúc enterprise là baseline thực nghiệm.** Đây là tài liệu thiết kế; các baseline của luận văn vẫn phải là Single-Agent, Fixed Multi-Agent và Adaptive Multi-Agent được cài đặt trên cùng benchmark.

## 6. Khoảng trống mà đồ án cần đóng góp

Reference architecture cung cấp khung tổng quát, còn đồ án cần hiện thực và đánh giá các điểm sau:

| Khoảng trống | Đóng góp dự kiến của đồ án |
| --- | --- |
| Routing theo hạ tầng | Policy chọn model/topology từ độ khó task, VRAM, GPU utilization, queue và ngân sách. |
| Tác vụ lập trình chuyên biệt | Benchmark NestJS Clean Architecture với task, patch, public/hidden tests và architecture rules. |
| Kiểm tra kiến trúc | Static analysis cho dependency direction, repository port/adapter, controller logic và NestJS module wiring. |
| Đo trade-off | So sánh quality, latency, GPU cost và compliance giữa những baseline giống điều kiện. |
| An toàn khi sửa code | Sandbox Docker không privileged, giới hạn tài nguyên và lưu audit trail cho mỗi run. |

## 7. Hành động tham khảo cụ thể

- Dùng sơ đồ component của reference architecture để rà soát ranh giới giữa controller, orchestrator, registry, state và tool layer.
- Thiết kế schema `AgentProfile`/`AgentCapability` ngay từ đầu, dù registry chỉ là file config ở MVP.
- Chuẩn hoá `RunTrace` và `DecisionLog` trước khi chạy benchmark đầu tiên.
- Đưa các failure mode vào benchmark: routing sai, agent output sai schema, tool thất bại, test thất bại lặp, vi phạm kiến trúc và vượt ngân sách.
- Tạo checklist security cho Docker sandbox và tool invocation trước khi cho Implementer sửa repository.

## 8. Kết luận

`microsoft/multi-agent-reference-architecture` là tài liệu tham khảo **rất phù hợp về thiết kế cấp hệ thống**. Nó củng cố lựa chọn dùng orchestrator trung tâm, agent chuyên biệt theo capability, routing/fallback, registry, observability và evaluation.

Giá trị nghiên cứu riêng của đồ án nằm ở việc biến các nguyên tắc này thành một coding-agent platform **self-hosted**, **resource-adaptive** và **đo lường được** cho NestJS Clean Architecture — đặc biệt là policy routing theo GPU và bộ benchmark/evaluation chuyên biệt.

## Nguồn đọc chính

- [Repository và README](https://github.com/microsoft/multi-agent-reference-architecture)
- [Reference Architecture](https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/reference-architecture/Reference-Architecture.md)
- [Building Blocks](https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/building-blocks/Building-Blocks.md)
- [Agent Registry](https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/agent-registry/Agent-Registry.md)
- [Observability](https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/observability/Observability.md)
- [Evaluation](https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/evaluation/Evaluation.md)
- [Security](https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/security/Security.md)
