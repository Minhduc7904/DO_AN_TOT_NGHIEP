# KẾ HOẠCH ĐỒ ÁN TỐT NGHIỆP

## 1. Tên đề tài đề xuất

### Tên hiện tại

**Thiết kế và đánh giá hệ thống Self-hosted Multi-Agent thích nghi tài nguyên, hỗ trợ phát triển backend NestJS theo Clean Architecture bằng các mô hình ngôn ngữ mã nguồn mở.**

### Tên nên chỉnh cho chuẩn học thuật

**Thiết kế và đánh giá hệ thống Multi-Agent tự triển khai, thích nghi theo tài nguyên, hỗ trợ phát triển backend NestJS theo Clean Architecture bằng các mô hình ngôn ngữ trọng số mở.**

Cụm **“trọng số mở – open-weight”** chính xác hơn “mã nguồn mở” khi nói về LLM. Tuy nhiên, các model Qwen được đề xuất trong đồ án hiện dùng giấy phép Apache 2.0, nên vẫn tương đối thuận lợi cho nghiên cứu và triển khai.

---

# 2. Định hướng nghiên cứu

## 2.1. Bài toán

Các coding agent hiện nay thường gặp ba vấn đề:

1. Luôn sử dụng cùng một model cho mọi tác vụ, dù tác vụ chỉ là thêm một DTO hay phải refactor cả module.
2. Luôn chạy cùng một topology agent, dẫn đến tác vụ đơn giản cũng phải qua Planner, Coder, Tester và Reviewer.
3. Không phản ứng với tình trạng GPU, VRAM, hàng đợi, giới hạn thời gian hoặc ngân sách còn lại.

Hệ thống trong đề tài cần tự quyết định:

* Dùng model nhỏ hay model mạnh.
* Chạy một agent hay nhiều agent.
* Có cần Planner, Tester hoặc Architecture Reviewer hay không.
* Cho phép bao nhiêu vòng sửa lỗi.
* Truy xuất bao nhiêu file từ codebase.
* Khi nào cần chuyển sang model mạnh hơn.
* Khi nào phải dừng để tránh agent chạy vòng lặp vô tận.

Nghiên cứu về LLM routing cho thấy việc định tuyến linh hoạt giữa model mạnh và model yếu có thể cải thiện cân bằng giữa chi phí và chất lượng; RouteLLM báo cáo mức giảm chi phí hơn hai lần trong một số thử nghiệm mà không làm giảm đáng kể chất lượng. Các nghiên cứu sau đó còn mô hình hóa routing như contextual bandit dưới ràng buộc ngân sách.

## 2.2. Điểm mới của đề tài

Đề tài nên tập trung vào ba đóng góp chính:

### Đóng góp 1 — Resource-Adaptive Agent Controller

Xây dựng bộ điều khiển tự lựa chọn:

* Model.
* Topology agent.
* Số vòng phản hồi.
* Context budget.
* Mức concurrency.

Dựa trên:

* Độ khó của yêu cầu.
* Quy mô repository.
* Số file dự kiến bị tác động.
* VRAM khả dụng.
* GPU utilization.
* Độ dài hàng đợi.
* Ngân sách GPU còn lại.
* Kết quả build/test của vòng trước.

### Đóng góp 2 — Bộ kiểm tra Clean Architecture cho NestJS

Hệ thống không chỉ kiểm tra code chạy được mà còn kiểm tra:

* Domain có import NestJS, Prisma hoặc infrastructure hay không.
* Application có phụ thuộc trực tiếp repository implementation hay không.
* Controller có chứa business logic hay không.
* Repository port và adapter có được tách đúng không.
* Use case có đúng trách nhiệm không.
* Module NestJS có đăng ký provider và dependency injection đúng không.
* Có vi phạm dependency direction không.

NestJS hỗ trợ module, dependency injection, custom provider và override provider trong testing, rất phù hợp để mô hình hóa port–adapter và kiểm thử kiến trúc.

### Đóng góp 3 — Bộ benchmark chuyên biệt cho NestJS Clean Architecture

Tạo một tập tác vụ có:

* Yêu cầu đầu vào.
* Repository tại một commit cố định.
* Bộ test công khai.
* Bộ test ẩn.
* Các luật kiến trúc.
* Patch chuẩn tham khảo.
* Mức độ khó.
* Kết quả kỳ vọng.

Đây là phần giúp đồ án có giá trị nghiên cứu thay vì chỉ là một ứng dụng demo.

---

# 3. Phạm vi đề tài

## 3.1. Các tác vụ được hỗ trợ

Hệ thống tập trung vào năm nhóm:

1. **Phát triển chức năng mới**

   * Tạo entity, DTO, use case.
   * Tạo repository port và adapter.
   * Tạo controller và module wiring.
   * Tạo Prisma migration.

2. **Sửa lỗi**

   * Đọc issue.
   * Tìm vị trí lỗi.
   * Viết patch.
   * Chạy test và sửa lại.

3. **Refactor theo Clean Architecture**

   * Tách business logic khỏi controller hoặc infrastructure.
   * Chuyển service lớn thành use case.
   * Đảo chiều dependency bằng interface/token.

4. **Sinh và sửa test**

   * Unit test cho use case.
   * Integration test cho repository.
   * E2E test cho API.

5. **Review kiến trúc và chất lượng code**

   * Phát hiện dependency sai tầng.
   * Phát hiện thiếu transaction.
   * Phát hiện logic trùng lặp.
   * Kiểm tra lint, type-check và test.

## 3.2. Ngoài phạm vi chính

Không nên đưa các phần sau vào core scope:

* Fine-tune LLM từ đầu.
* Tạo IDE extension hoàn chỉnh.
* Tự động deploy production.
* Hỗ trợ mọi framework backend.
* Tự merge code vào nhánh chính không cần người duyệt.
* Huấn luyện một foundation model mới.
* Multi-node Kubernetes.

Fine-tuning có thể để thành mục mở rộng. Giá trị chính của đồ án nằm ở **agent orchestration, resource adaptation và evaluation**, không phải huấn luyện model.

---

# 4. Câu hỏi nghiên cứu

## RQ1

**Hệ thống Multi-Agent thích nghi tài nguyên có tăng tỷ lệ hoàn thành tác vụ so với hệ thống Single-Agent sử dụng model nhỏ hay không?**

## RQ2

**Hệ thống thích nghi có giảm chi phí GPU và thời gian xử lý so với Multi-Agent cấu hình cố định hay không?**

## RQ3

**Việc bổ sung Architecture Reviewer có làm giảm vi phạm Clean Architecture trong code được sinh ra hay không?**

## RQ4

**Những đặc trưng nào của tác vụ có ảnh hưởng lớn nhất đến quyết định lựa chọn model và topology agent?**

Các đặc trưng dự kiến:

* Loại tác vụ.
* Số file liên quan.
* Kích thước context.
* Số module bị tác động.
* Có thay đổi schema hay không.
* Có cần transaction hay không.
* Kết quả build/test ở vòng trước.

## RQ5

**Khi tài nguyên GPU bị giới hạn, chiến lược nào mang lại tỷ lệ “tác vụ thành công trên mỗi GPU-hour” cao nhất?**

---

# 5. Giả thuyết nghiên cứu

* **H1:** Adaptive Multi-Agent đạt tỷ lệ hoàn thành cao hơn Single-Agent chạy model nhỏ.
* **H2:** Adaptive Multi-Agent sử dụng ít GPU-second hơn Fixed Multi-Agent trong các tác vụ đơn giản.
* **H3:** Architecture Reviewer làm tăng Architecture Compliance Score.
* **H4:** Cơ chế escalation chỉ chuyển sang model mạnh khi thất bại giúp giảm chi phí mà vẫn giữ chất lượng gần với cấu hình luôn dùng model mạnh.
* **H5:** Kết hợp static analysis, build và hidden tests đáng tin cậy hơn việc chỉ dùng LLM-as-a-Judge.

---

# 6. Kiến trúc hệ thống đề xuất

```text
Developer / Web Dashboard / CLI
                │
                ▼
        NestJS Control API
                │
        Task Queue + Run Manager
                │
                ▼
   Resource-Adaptive Controller
       │              │
       │              ├── Resource Monitor
       │              │   ├── Free VRAM
       │              │   ├── GPU utilization
       │              │   ├── Queue length
       │              │   └── Budget remaining
       │              │
       │              └── Task Complexity Estimator
       │
       ▼
   Agent Graph Orchestrator
       ├── Planner / Architect
       ├── Repository Retriever
       ├── Implementer
       ├── Tester / Debugger
       └── Architecture Reviewer
                │
                ▼
        Model Gateway / Router
          ├── Small model
          └── Strong model
                │
                ▼
          vLLM GPU Server
                │
                ▼
       Ephemeral Docker Sandbox
          ├── Repository clone
          ├── npm run build
          ├── npm run lint
          ├── npm test
          ├── Prisma validation
          └── Architecture checker
                │
                ▼
        Patch + Evaluation Report
```

LangGraph phù hợp để biểu diễn quy trình agent dưới dạng graph có state chung, persistence và các nhánh xử lý động. Supervisor pattern cũng là một kiến trúc phổ biến trong đó một agent điều phối các agent chuyên biệt.

vLLM phù hợp làm inference server vì cung cấp API tương thích OpenAI, hỗ trợ continuous batching, quantization, distributed serving và metrics tương thích Prometheus.

---

# 7. Vai trò các agent

## 7.1. Task Analyzer

Nhiệm vụ:

* Phân loại yêu cầu.
* Ước lượng độ khó.
* Xác định module có liên quan.
* Xác định khả năng cần migration, transaction hoặc external service.
* Đề xuất topology agent ban đầu.

Đầu ra dạng JSON có schema cố định:

```json
{
  "taskType": "FEATURE",
  "difficulty": "MEDIUM",
  "estimatedFiles": 8,
  "requiresMigration": true,
  "requiresArchitectureReview": true,
  "recommendedProfile": "BALANCED"
}
```

## 7.2. Planner / Architect

Nhiệm vụ:

* Đọc cấu trúc codebase.
* Xác định layer bị tác động.
* Tạo kế hoạch sửa file.
* Xác định interface, entity, use case và adapter.
* Không trực tiếp sửa code.

## 7.3. Implementer

Nhiệm vụ:

* Thực hiện patch.
* Tuân theo plan.
* Chỉ được sửa file trong workspace.
* Không được tự push hoặc merge.
* Không được truy cập production secret.

## 7.4. Tester / Debugger

Nhiệm vụ:

* Chạy build, lint và test.
* Phân tích lỗi.
* Trả về lỗi rút gọn cho Implementer.
* Không gửi toàn bộ log dài vào context khi không cần thiết.

## 7.5. Architecture Reviewer

Nhiệm vụ:

* Kiểm tra dependency direction.
* Kiểm tra quy ước dự án.
* Kiểm tra business rule bị đặt sai tầng.
* Kiểm tra repository abstraction.
* Kiểm tra module/provider registration.
* Chỉ yêu cầu sửa những lỗi có bằng chứng cụ thể.

---

# 8. Cơ chế thích nghi tài nguyên

## 8.1. Trạng thái đầu vào

Mỗi lần ra quyết định, controller nhận:

```text
Task features:
- task type
- difficulty
- repository size
- estimated related files
- context token estimate
- test failure count
- architecture violation count

Resource features:
- free VRAM
- GPU utilization
- active requests
- queue length
- time budget
- GPU-hour budget remaining
```

## 8.2. Không gian hành động

Controller có thể chọn:

* Model nhỏ hoặc model mạnh.
* Single-Agent hoặc Multi-Agent.
* Có hoặc không có Planner.
* Có hoặc không có Reviewer.
* Retrieval top-k từ 5 đến 30 chunks.
* Context giới hạn 8K, 16K hoặc 32K.
* Từ 0 đến 2 vòng sửa lỗi.
* Số request chạy đồng thời.

## 8.3. Các profile vận hành

| Profile    | Topology                                 | Model               | Dùng cho                         |
| ---------- | ---------------------------------------- | ------------------- | -------------------------------- |
| `ECONOMY`  | Implementer → Test                       | Model nhỏ           | DTO, mapping, CRUD đơn giản      |
| `BALANCED` | Planner → Implementer → Test             | Nhỏ, có escalation  | Chức năng mức trung bình         |
| `QUALITY`  | Planner → Implementer → Test → Reviewer  | Model mạnh cho code | Refactor, transaction, migration |
| `RECOVERY` | Debugger → Strong Implementer → Reviewer | Model mạnh          | Build/test thất bại nhiều lần    |

## 8.4. Chính sách escalation

Chuyển sang model mạnh hơn khi:

* Build thất bại sau một lần sửa.
* Test ẩn thất bại.
* Architecture Compliance Score dưới ngưỡng.
* Không tìm thấy file liên quan.
* Patch ảnh hưởng quá nhiều module.
* Model nhỏ trả về output không đúng schema.
* Tool call vượt quá giới hạn nhưng chưa tạo được patch.

## 8.5. Hàm mục tiêu

Controller cố gắng tối đa hóa:

```text
Utility =
    Quality Score
    - α × Normalized Latency
    - β × GPU Cost
    - γ × Resource Failure
    - δ × Architecture Violations
```

Không cần huấn luyện reinforcement learning ngay từ đầu.

Nên triển khai hai phiên bản:

* **RAC-H:** controller dựa trên rule và threshold.
* **RAC-L:** controller học từ log thực nghiệm bằng classification hoặc contextual bandit.

RAC-H là phần bắt buộc để bảo đảm đồ án hoàn thành. RAC-L là phần nghiên cứu nâng cao.

---

# 9. Lựa chọn model

## Model nhỏ

### Qwen2.5-Coder-7B-Instruct

Dùng cho:

* Phân tích task.
* Sinh code đơn giản.
* Viết test.
* Review nhanh.
* Tác vụ `ECONOMY`.

### Qwen2.5-Coder-14B-Instruct

Dùng làm model trung bình nếu GPU đủ VRAM.

Cả bản 7B và 14B đều có model card chính thức và thuộc dòng model chuyên code của Qwen.

## Model mạnh

### Qwen3-Coder-30B-A3B-Instruct

Model có:

* Khoảng 30.5 tỷ tham số tổng.
* Khoảng 3.3 tỷ tham số được kích hoạt.
* Kiến trúc Mixture-of-Experts.
* Context gốc lên tới 262.144 token.
* Apache 2.0.

Tuy nhiên, đồ án chỉ nên benchmark context 16K–32K để kiểm soát KV cache, latency và chi phí.

## Khuyến nghị cấu hình GPU

* **24 GB VRAM:** model 7B/14B hoặc model 30B đã quantize với context giới hạn.
* **48 GB VRAM:** an toàn hơn cho model 30B, context lớn và chạy nhiều request.
* Không lấy context tối đa của model làm context mặc định. Context càng dài thì KV cache và latency càng tăng.

vLLM hỗ trợ nhiều phương thức quantization nhằm giảm memory footprint, nhưng cần benchmark chất lượng, tốc độ và khả năng tương thích trên đúng GPU sử dụng.

---

# 10. Công cụ dành cho coding agent

## Repository exploration

* `git`
* `ripgrep`
* `find`
* AST parser hoặc `ts-morph`
* TypeScript compiler API
* Dependency graph generator

## Kiểm tra chất lượng

* TypeScript compiler.
* ESLint.
* Jest.
* Supertest.
* Prisma validate.
* Prisma migrate diff.
* Dependency Cruiser hoặc ESLint boundaries.
* Custom Clean Architecture rules.

## Sandbox

Mỗi task chạy trong Docker container tạm thời:

* Không mount Docker socket.
* Không chạy privileged.
* Tắt network mặc định.
* Chỉ mount workspace cần thiết.
* Giới hạn CPU, RAM và timeout.
* Secret không được đưa vào container.
* Sau khi chạy xong phải xóa container.

Docker mặc định không áp dụng giới hạn tài nguyên cho container, vì vậy hệ thống phải chủ động đặt giới hạn CPU và memory để tránh một tác vụ làm ảnh hưởng toàn host.

---

# 11. Thiết kế bộ benchmark NestCleanBench

## 11.1. Quy mô đề xuất

Tối thiểu:

* 30 task cho MVP.
* 40 task cho bản khuyến nghị.
* 50 task nếu còn thời gian.

## 11.2. Phân bố 40 task

| Nhóm                            | Số task |
| ------------------------------- | ------: |
| Thêm chức năng                  |       8 |
| Sửa bug                         |       8 |
| Refactor Clean Architecture     |       8 |
| Sinh/sửa test                   |       8 |
| Review và sửa vi phạm kiến trúc |       8 |

Trong mỗi nhóm:

* 3 task dễ.
* 3 task trung bình.
* 2 task khó.

## 11.3. Nguồn repository

Nên sử dụng:

* Một repository NestJS nhỏ được tự xây dựng.
* Một repository trung bình có Prisma và database.
* Một snapshot riêng từ dự án thực tế của bạn đã loại bỏ secret và dữ liệu nhạy cảm.

Repository private hoặc tự xây dựng giúp giảm nguy cơ model đã nhìn thấy đáp án trong dữ liệu huấn luyện.

## 11.4. Cấu trúc một task

```yaml
id: FEATURE_001
title: Add create tuition payment use case
type: FEATURE
difficulty: MEDIUM

repository:
  commit: abc123

requirements:
  - Create application use case
  - Add repository port
  - Implement Prisma adapter
  - Add unit tests
  - Domain layer must not import NestJS or Prisma

publicTests:
  - npm run build
  - npm run lint
  - npm test -- create-tuition-payment

hiddenTests:
  - architecture dependency checks
  - transaction rollback check

limits:
  maxMinutes: 15
  maxAgentRounds: 3
```

## 11.5. Benchmark công khai bổ sung

Có thể dùng một tập nhỏ từ SWE-bench Multilingual để đánh giá khả năng tổng quát trên JavaScript/TypeScript. SWE-bench đánh giá agent bằng cách yêu cầu tạo patch giải quyết issue thực tế, còn evaluation harness sử dụng Docker để tái tạo môi trường nhất quán.

Không nên dùng SWE-bench làm benchmark duy nhất vì nó không kiểm tra trực tiếp quy ước Clean Architecture của NestJS.

---

# 12. Chỉ số đánh giá

## 12.1. Functional Success Rate

Task được xem là thành công khi:

* Build thành công.
* Public tests pass.
* Hidden tests pass.
* Không xuất hiện lỗi runtime nghiêm trọng.

## 12.2. Architecture Compliance Score

Thang điểm 100:

| Tiêu chí                      | Điểm |
| ----------------------------- | ---: |
| Dependency direction đúng     |   25 |
| Domain độc lập framework      |   20 |
| Repository port/adapter đúng  |   15 |
| Business logic đúng tầng      |   15 |
| Module và DI wiring đúng      |   10 |
| Testability                   |   10 |
| Naming và project conventions |    5 |

## 12.3. Code Quality Score

Đánh giá:

* Lint errors.
* Type errors.
* Test coverage.
* Cyclomatic complexity.
* Duplicate code.
* Patch size.
* Số file bị sửa ngoài phạm vi.

## 12.4. Resource Metrics

Thu thập:

* Total input tokens.
* Total output tokens.
* GPU-second.
* Peak VRAM.
* Mean GPU utilization.
* Time to first token.
* End-to-end latency.
* Số lần model được gọi.
* Số vòng agent.
* Số lần retry.
* Số OOM hoặc timeout.

vLLM cung cấp endpoint metrics tương thích Prometheus và các metric ở mức engine/request, phù hợp để ghi nhận throughput, latency và token usage.

## 12.5. Cost per Successful Task

```text
Cost per successful task =
    Tổng chi phí GPU của cấu hình
    /
    Số task hoàn thành thành công
```

Đây nên là metric trung tâm vì nó phản ánh trực tiếp hiệu quả của “thích nghi tài nguyên”.

## 12.6. Human Evaluation

Hai người có kinh nghiệm NestJS chấm ẩn danh theo các tiêu chí:

* Code dễ đọc.
* Patch phù hợp yêu cầu.
* Dễ bảo trì.
* Đúng convention.
* Có thể merge sau khi chỉnh sửa ít.

LLM-as-a-Judge chỉ nên là metric phụ, không dùng làm nguồn kết luận duy nhất.

---

# 13. Thiết kế thực nghiệm

## 13.1. Các cấu hình so sánh

| Mã   | Cấu hình                                        |
| ---- | ----------------------------------------------- |
| `B0` | Single-Agent + model nhỏ                        |
| `B1` | Single-Agent + model mạnh                       |
| `B2` | Fixed Multi-Agent + model mạnh cho tất cả agent |
| `P1` | Adaptive Multi-Agent với rule-based controller  |
| `P2` | Adaptive Multi-Agent với learned router         |

`P2` có thể bỏ nếu thời gian không đủ.

## 13.2. Ablation study

Chạy thêm các biến thể:

* Không có Repository Retrieval.
* Không có Architecture Reviewer.
* Không có model routing.
* Không thay đổi topology.
* Không dùng resource telemetry.
* Không có escalation.
* Không giới hạn số vòng agent.

Ablation giúp chứng minh phần nào của hệ thống thực sự tạo ra cải thiện.

## 13.3. Số lần chạy

Khuyến nghị:

```text
40 task
× 4 cấu hình chính
× 3 lần lặp
= 480 lượt chạy
```

Nếu chi phí cao:

```text
30 task
× 4 cấu hình
× 2 lần lặp
= 240 lượt chạy
```

Cần pin:

* Model revision.
* Docker image.
* Prompt version.
* Agent graph version.
* Temperature.
* Seed khi framework hỗ trợ.
* Repository commit.

## 13.4. Phân tích thống kê

* Báo cáo mean, median và standard deviation.
* Sử dụng bootstrap confidence interval 95%.
* So sánh paired task results giữa các cấu hình.
* Dùng Wilcoxon signed-rank cho latency và cost nếu dữ liệu không phân phối chuẩn.
* Với success/failure có thể sử dụng McNemar test.
* Không chỉ báo cáo một con số trung bình chung.

---

# 14. Kế hoạch triển khai 16 tuần

## Giai đoạn 1 — Khóa đề tài và câu hỏi nghiên cứu

### Thời gian: Tuần 1

### Các bước

1. Chốt tên đề tài.
2. Chốt năm nhóm tác vụ.
3. Viết problem statement.
4. Xác định RQ1–RQ5.
5. Xác định baseline và proposed method.
6. Chốt tiêu chí “thành công”.
7. Loại bỏ fine-tuning khỏi core scope.

### Sản phẩm bàn giao

* Đề cương 3–5 trang.
* Scope document.
* Research questions.
* Danh sách thuật ngữ.
* Risk register ban đầu.

### Điều kiện hoàn thành

Giảng viên có thể đọc và trả lời rõ:

* Hệ thống giải quyết vấn đề gì?
* Điểm mới nằm ở đâu?
* Đánh giá bằng gì?
* So sánh với baseline nào?

---

## Giai đoạn 2 — Khảo sát tài liệu và thiết kế lý thuyết

### Thời gian: Tuần 2–3

### Các bước

1. Nghiên cứu LLM-based Multi-Agent.
2. Nghiên cứu supervisor, planner–executor và reviewer pattern.
3. Nghiên cứu model routing.
4. Nghiên cứu inference serving và quantization.
5. Nghiên cứu coding-agent benchmark.
6. Định nghĩa Clean Architecture rules cho NestJS.
7. Viết taxonomy về tác vụ backend.

Các survey về LLM Multi-Agent nhấn mạnh các thành phần như agent profiling, communication, coordination và evaluation; đồng thời chỉ ra các thách thức về khả năng mở rộng, độ tin cậy và chi phí.

### Sản phẩm bàn giao

* Literature review 10–15 trang.
* Bảng so sánh framework.
* Bảng so sánh model.
* Danh sách architecture rules.
* Thiết kế thí nghiệm sơ bộ.

### Điều kiện hoàn thành

Mỗi lựa chọn kỹ thuật phải có lý do:

* Vì sao dùng Multi-Agent?
* Vì sao dùng vLLM?
* Vì sao chọn hai mức model?
* Vì sao cần adaptive controller?
* Vì sao static tests là metric chính?

---

## Giai đoạn 3 — Xây dựng hạ tầng self-host

### Thời gian: Tuần 3–4

### Các bước

1. Tạo GPU environment.
2. Deploy vLLM.
3. Deploy model nhỏ.
4. Test quantization.
5. Tạo OpenAI-compatible model gateway.
6. Thu thập Prometheus metrics.
7. Thiết lập log experiment.
8. Benchmark token/s, VRAM và latency.
9. Xây Docker sandbox.

### Sản phẩm bàn giao

* Inference server hoạt động.
* Dashboard GPU.
* Script deploy.
* Docker image đã pin version.
* Báo cáo profiling model.

### Điều kiện hoàn thành

Có thể chạy một request hoàn chỉnh và ghi lại:

* Token input/output.
* Latency.
* GPU utilization.
* Peak VRAM.
* Model revision.

---

## Giai đoạn 4 — Xây dựng benchmark

### Thời gian: Tuần 4–6

### Các bước

1. Chọn 2–3 repository.
2. Freeze commit.
3. Viết 30–40 task.
4. Viết public tests.
5. Viết hidden tests.
6. Viết architecture rules.
7. Gắn nhãn difficulty.
8. Chạy thử task bằng tay.
9. Loại bỏ task mơ hồ hoặc không tái tạo được.

### Sản phẩm bàn giao

* NestCleanBench phiên bản 1.
* Task manifest.
* Docker evaluation harness.
* Hidden test storage.
* Báo cáo phân bố task.

### Điều kiện hoàn thành

Mỗi task phải:

* Chạy lại được.
* Có expected behavior rõ ràng.
* Có ít nhất một phương án giải đúng.
* Không phụ thuộc dịch vụ production.
* Hoàn thành thủ công trong thời gian hợp lý.

---

## Giai đoạn 5 — Xây Single-Agent baseline

### Thời gian: Tuần 6–7

### Các bước

1. Tạo repository retrieval.
2. Tạo tool đọc file.
3. Tạo tool tìm kiếm code.
4. Tạo tool sửa file.
5. Tạo tool chạy build/test.
6. Tạo patch output.
7. Chạy baseline model nhỏ.
8. Chạy baseline model mạnh.
9. Ghi toàn bộ metric.

### Sản phẩm bàn giao

* Baseline `B0`.
* Baseline `B1`.
* Kết quả trên 10 task thử nghiệm.
* Danh sách failure mode.

### Điều kiện hoàn thành

Single-Agent có thể:

* Nhận task.
* Đọc repository.
* Tạo patch.
* Chạy test.
* Trả kết quả và metrics.

---

## Giai đoạn 6 — Xây Fixed Multi-Agent

### Thời gian: Tuần 8–9

### Các bước

1. Xây graph state.
2. Xây Planner.
3. Xây Implementer.
4. Xây Tester.
5. Xây Reviewer.
6. Xây cơ chế retry.
7. Xây context summarization.
8. Xây giới hạn vòng lặp.
9. Chạy baseline `B2`.

### Sản phẩm bàn giao

* Fixed Multi-Agent workflow.
* Agent trace viewer.
* Prompt registry.
* Báo cáo so sánh sơ bộ với Single-Agent.

### Điều kiện hoàn thành

Có thể quan sát rõ:

* Agent nào đang chạy.
* Model nào được gọi.
* Tool nào được sử dụng.
* Vì sao task bị retry.
* Vì sao task bị dừng.

---

## Giai đoạn 7 — Xây Resource-Adaptive Controller

### Thời gian: Tuần 10–11

### Các bước

1. Xây Task Complexity Estimator.
2. Xây Resource Monitor.
3. Định nghĩa profile `ECONOMY`, `BALANCED`, `QUALITY`.
4. Xây model routing.
5. Xây topology routing.
6. Xây escalation.
7. Xây budget guard.
8. Xây fallback khi GPU thiếu VRAM.
9. Chạy `P1` trên tập development.

### Sản phẩm bàn giao

* Adaptive Controller.
* Decision log.
* Rule configuration.
* Dashboard hiển thị lý do routing.

### Điều kiện hoàn thành

Mỗi quyết định phải giải thích được:

```text
Selected QUALITY profile because:
- task difficulty = HIGH
- schema change = true
- estimated files = 12
- free VRAM = 41 GB
- budget remaining = 62%
```

---

## Giai đoạn 8 — Learned Router tùy chọn

### Thời gian: Tuần 11–12

### Các bước

1. Thu thập dữ liệu từ các lượt chạy trước.
2. Tạo feature vector.
3. Gắn nhãn model/topology tốt nhất.
4. Huấn luyện classifier hoặc contextual bandit đơn giản.
5. So sánh với rule-based routing.
6. Phân tích feature importance.

### Sản phẩm bàn giao

* Learned router `P2`.
* Dataset routing.
* Báo cáo accuracy và utility.

### Điều kiện hoàn thành

Chỉ triển khai giai đoạn này khi `P1` và evaluation harness đã ổn định.

---

## Giai đoạn 9 — Thực nghiệm chính thức

### Thời gian: Tuần 12–13

### Các bước

1. Freeze toàn bộ source code.
2. Freeze prompt và model revision.
3. Chạy các baseline.
4. Chạy proposed method.
5. Chạy các ablation.
6. Theo dõi lỗi hạ tầng.
7. Kiểm tra dữ liệu thiếu.
8. Chạy lại các lượt không hợp lệ.
9. Xuất CSV/JSON kết quả.

### Sản phẩm bàn giao

* Raw experimental data.
* Agent traces.
* GPU metrics.
* Patch outputs.
* Error logs.

### Điều kiện hoàn thành

Không chỉnh prompt hoặc controller sau khi đã nhìn thấy kết quả test chính thức, trừ khi bắt đầu một experiment version mới.

---

## Giai đoạn 10 — Phân tích kết quả

### Thời gian: Tuần 14

### Các bước

1. Tính success rate.
2. Tính compliance score.
3. Tính latency.
4. Tính GPU-second.
5. Tính cost/successful-task.
6. Phân tích theo difficulty.
7. Phân tích failure case.
8. Chạy statistical tests.
9. Trả lời từng research question.

### Biểu đồ cần có

* Success rate theo cấu hình.
* Chi phí trên mỗi task thành công.
* Latency theo độ khó.
* VRAM peak theo model.
* Tỷ lệ routing sang model mạnh.
* Architecture Compliance Score.
* Pareto frontier giữa quality và cost.
* Confusion matrix của Task Complexity Estimator.

### Sản phẩm bàn giao

* Notebook phân tích.
* Bảng kết quả.
* Biểu đồ.
* Phần Discussion.

---

## Giai đoạn 11 — Hoàn thiện sản phẩm và luận văn

### Thời gian: Tuần 15

### Các bước

1. Viết Methodology.
2. Viết System Design.
3. Viết Experimental Setup.
4. Viết Results.
5. Viết Discussion.
6. Viết Limitations.
7. Hoàn thiện dashboard.
8. Viết README.
9. Tạo deployment guide.

### Sản phẩm bàn giao

* Luận văn bản nháp hoàn chỉnh.
* Source code.
* Dataset.
* Docker Compose.
* Video demo sơ bộ.

---

## Giai đoạn 12 — Chuẩn bị bảo vệ

### Thời gian: Tuần 16

### Các bước

1. Làm slide.
2. Chuẩn bị demo offline.
3. Chuẩn bị dữ liệu chạy sẵn.
4. Tạo kịch bản khi GPU cloud lỗi.
5. Luyện trả lời phản biện.
6. Kiểm tra citation.
7. Kiểm tra khả năng tái tạo.
8. Chốt video demo dự phòng.

### Demo đề xuất

1. Gửi một task CRUD đơn giản.
2. Hệ thống chọn profile `ECONOMY`.
3. Gửi một task refactor phức tạp.
4. Hệ thống chọn `QUALITY`.
5. Model nhỏ thất bại.
6. Controller escalation sang model mạnh.
7. Tester chạy test.
8. Reviewer phát hiện vi phạm dependency.
9. Agent sửa lại.
10. Dashboard hiển thị chi phí tiết kiệm so với Fixed Multi-Agent.

---

# 15. Công nghệ đề xuất

| Thành phần                | Công nghệ                                    |
| ------------------------- | -------------------------------------------- |
| Control plane             | NestJS                                       |
| Agent orchestration       | LangGraph.js                                 |
| Database                  | PostgreSQL + Prisma                          |
| Queue                     | Redis + BullMQ                               |
| Inference                 | vLLM                                         |
| Model API                 | OpenAI-compatible API                        |
| Model nhỏ                 | Qwen2.5-Coder-7B/14B                         |
| Model mạnh                | Qwen3-Coder-30B-A3B                          |
| Repository retrieval      | AST + lexical search + embedding             |
| Vector storage            | pgvector hoặc Qdrant                         |
| Sandbox                   | Docker                                       |
| Metrics                   | Prometheus + Grafana                         |
| GPU metrics               | NVIDIA SMI/DCGM                              |
| Experiment analysis       | Python, Pandas, Matplotlib                   |
| Static architecture check | ESLint rules + ts-morph + Dependency Cruiser |

Để tránh đồ án quá nhiều service, phiên bản đầu có thể dùng:

* PostgreSQL + pgvector.
* Một NestJS service.
* Một Redis.
* Một vLLM server.
* Docker sandbox.

Không cần Kubernetes.

---

# 16. Chi phí dự kiến

## 16.1. Giả định

* Có sẵn VPS CPU chạy API, database và queue.
* Thuê GPU theo giờ.
* Dùng A5000 cho phát triển.
* Dùng A40 cho model mạnh và thí nghiệm chính.
* Thời gian đồ án khoảng bốn tháng.

RunPod hiện niêm yết RTX A5000 24 GB ở mức từ khoảng **$0.27/giờ**, A40 48 GB khoảng **$0.44/giờ** và RTX 4090 24 GB khoảng **$0.69/giờ**. Giá thực tế có thể thay đổi theo loại cloud và tình trạng máy.

## 16.2. Ngân sách tối thiểu

| Hạng mục                |      Khối lượng |         Chi phí |
| ----------------------- | --------------: | --------------: |
| A5000 phát triển        | 120 giờ × $0.27 |          $32.40 |
| A40 thí nghiệm          | 100 giờ × $0.44 |          $44.00 |
| Storage, snapshot       |        Dự phòng |          $20.00 |
| Network và chi phí khác |        Dự phòng |          $15.00 |
| Tổng trước dự phòng     |                 |         $111.40 |
| Dự phòng 30%            |                 |          $33.42 |
| **Tổng dự kiến**        |                 | **Khoảng $145** |

Với tỷ giá thị trường quanh 26.300 VND/USD ngày 28/07/2026, $145 tương đương khoảng **3,8 triệu đồng**; tỷ giá thanh toán thẻ thực tế có thể cao hơn.

## 16.3. Các mức ngân sách

| Mức           |                   Chi phí | Phù hợp                                   |
| ------------- | ------------------------: | ----------------------------------------- |
| Tối thiểu     |                  $100–150 | 30 task, ít lượt lặp                      |
| Khuyến nghị   |                  $180–280 | 40 task, 3 lần lặp, có ablation           |
| Thoải mái     |                  $300–500 | Nhiều model, nhiều benchmark và profiling |
| Mua GPU riêng | Không khuyến nghị ban đầu | Vốn đầu tư lớn, khó nâng cấp              |

Nếu phải thuê thêm VPS CPU, dự trù khoảng **$10–20/tháng**, tương đương thêm $40–80 cho bốn tháng.

---

# 17. Rủi ro và phương án xử lý

| Rủi ro                         | Cách xử lý                                                    |
| ------------------------------ | ------------------------------------------------------------- |
| Scope quá rộng                 | Khóa năm loại task và hai model                               |
| Model 30B không đủ VRAM        | Quantize, giảm context hoặc dùng A40                          |
| Agent chạy vòng lặp            | Giới hạn round, timeout và GPU budget                         |
| Code agent chạy lệnh nguy hiểm | Docker sandbox, network off, không privileged                 |
| Kết quả không tái tạo          | Pin model, prompt, image và commit                            |
| Benchmark quá dễ               | Chia ba mức difficulty và dùng hidden tests                   |
| Benchmark bị leakage           | Dùng private/synthetic repository                             |
| LLM reviewer thiên vị          | Static check và hidden tests là metric chính                  |
| Chi phí vượt ngân sách         | Chạy development set trước, chỉ chạy full khi hệ thống freeze |
| Multi-Agent không tốt hơn      | Đây vẫn là kết quả nghiên cứu hợp lệ nếu phân tích rõ         |
| Demo phụ thuộc internet        | Chuẩn bị video và kết quả chạy sẵn                            |

---

# 18. MVP bắt buộc

Đồ án được xem là hoàn thành ở mức MVP khi có:

1. Hai model với hai mức tài nguyên.
2. Single-Agent baseline.
3. Fixed Multi-Agent baseline.
4. Rule-based Resource-Adaptive Controller.
5. Ít nhất 30 task NestJS.
6. Docker sandbox.
7. Build, lint, test và architecture checker.
8. GPU, token, latency và cost metrics.
9. So sánh ít nhất bốn cấu hình.
10. Báo cáo cost per successful task.

## Phần mở rộng

* Learned router.
* Contextual bandit.
* Qwen3-Coder-Next.
* Energy consumption.
* LoRA fine-tuning.
* IDE extension.
* Human feedback online.
* Tự động học convention từ repository.

---

# 19. Tiêu chí “Definition of Done”

Hệ thống cuối cùng phải chứng minh được chuỗi xử lý:

```text
Nhận yêu cầu
→ phân tích độ khó
→ đọc trạng thái tài nguyên
→ chọn model và agent topology
→ phân tích repository
→ tạo patch
→ chạy trong sandbox
→ test chức năng
→ kiểm tra Clean Architecture
→ sửa lỗi nếu cần
→ trả patch và báo cáo tài nguyên
```

Luận văn phải trả lời được:

* Adaptive system có tốt hơn baseline không?
* Tốt hơn về chất lượng, chi phí hay cả hai?
* Trong trường hợp nào Multi-Agent gây lãng phí?
* Trong trường hợp nào model nhỏ là đủ?
* Reviewer có thực sự cải thiện kiến trúc không?
* Giới hạn của hệ thống là gì?

---

# 20. Việc cần làm trong 7 ngày đầu

## Ngày 1

* Chốt tên đề tài.
* Chốt scope.
* Viết problem statement.

## Ngày 2

* Viết research questions.
* Chốt baseline.
* Chốt các metric.

## Ngày 3

* Chọn model nhỏ và model mạnh.
* Chọn GPU target 24 GB và 48 GB.

## Ngày 4

* Phác thảo kiến trúc.
* Định nghĩa agent roles.
* Định nghĩa adaptive profiles.

## Ngày 5

* Tạo repository đồ án.
* Tạo thư mục tài liệu.
* Tạo experiment registry.

## Ngày 6

* Deploy model nhỏ bằng vLLM.
* Chạy benchmark latency và VRAM đầu tiên.

## Ngày 7

* Viết ba task benchmark mẫu:

  * Một task dễ.
  * Một task trung bình.
  * Một task khó.
* Trình bày đề cương phiên bản đầu với giảng viên.
