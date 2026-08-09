# Đề tài đồ án tốt nghiệp: Hệ thống Multi-Agent CLI hỗ trợ xử lý issue phần mềm

## 1. Tên đề tài

### Tên đề tài đề xuất

**Nghiên cứu, thiết kế và đánh giá hệ thống Multi-Agent dựa trên mô hình ngôn ngữ lớn hỗ trợ xử lý issue trong các dự án phần mềm backend thông qua giao diện dòng lệnh**

### Một số tên thay thế

1. **Thiết kế và đánh giá hệ thống Multi-Agent CLI hỗ trợ phân tích, chỉnh sửa, kiểm thử và review mã nguồn backend**
2. **Nghiên cứu ảnh hưởng của cơ chế phối hợp Multi-Agent đối với hiệu quả xử lý issue trong dự án phần mềm backend**
3. **Xây dựng hệ thống coding agent đa tác tử hỗ trợ xử lý yêu cầu thay đổi trong repository phần mềm**
4. **Thiết kế hệ thống Multi-Agent dựa trên mô hình ngôn ngữ lớn hỗ trợ tự động hóa quy trình xử lý issue phần mềm**

### Tên khuyến nghị sử dụng

> **Nghiên cứu, thiết kế và đánh giá hệ thống Multi-Agent dựa trên mô hình ngôn ngữ lớn hỗ trợ xử lý issue trong các dự án phần mềm backend thông qua giao diện dòng lệnh**

Tên này thể hiện đầy đủ bốn yếu tố chính:

- Có nội dung nghiên cứu và đánh giá.
- Có sản phẩm hệ thống cụ thể.
- Sử dụng mô hình Multi-Agent dựa trên LLM.
- Tập trung vào xử lý issue trong dự án backend.
- Giao diện sử dụng chính là CLI, phù hợp với đặc trưng của coding agent.

---

## 2. Tóm tắt đề tài

Đề tài nghiên cứu, thiết kế và xây dựng một hệ thống Multi-Agent sử dụng mô hình ngôn ngữ lớn để hỗ trợ xử lý issue trong các repository phần mềm backend đã tồn tại.

Người dùng tương tác với hệ thống thông qua giao diện dòng lệnh. Hệ thống nhận đầu vào gồm repository, issue, cấu hình môi trường và giới hạn thực thi. Sau đó, các agent phối hợp để thực hiện chuỗi công việc:

1. Phân tích issue.
2. Khảo sát cấu trúc repository.
3. Xác định các file và module liên quan.
4. Lập kế hoạch thay đổi.
5. Chỉnh sửa mã nguồn.
6. Sinh hoặc cập nhật test.
7. Chạy build, lint và test trong môi trường cô lập.
8. Review code diff.
9. Sửa lặp khi test hoặc review không đạt.
10. Xuất patch, báo cáo và số liệu thực nghiệm.

Hệ thống không chỉ hướng tới việc tạo ra một coding assistant có khả năng chỉnh sửa mã nguồn, mà còn đóng vai trò như một nền tảng thực nghiệm để so sánh Single-Agent và Multi-Agent trong cùng điều kiện.

Trọng tâm nghiên cứu của đề tài là:

> Đánh giá liệu việc phân tách trách nhiệm và phối hợp nhiều agent có giúp cải thiện tỷ lệ hoàn thành issue, giảm regression và nâng cao chất lượng bản vá so với một agent duy nhất hay không; đồng thời đo lường phần chi phí bổ sung về token, thời gian và độ phức tạp vận hành.

---

## 3. Bối cảnh và động cơ thực hiện

Trong quá trình bảo trì và phát triển phần mềm, lập trình viên thường phải thực hiện một chuỗi công việc phức tạp khi xử lý một issue:

- Đọc và làm rõ yêu cầu.
- Tìm hiểu codebase.
- Xác định luồng xử lý liên quan.
- Xác định phạm vi thay đổi.
- Chỉnh sửa code.
- Viết hoặc cập nhật test.
- Chạy công cụ kiểm tra.
- Phân tích lỗi.
- Review bản vá.
- Sửa lại nếu phát hiện regression hoặc thay đổi ngoài phạm vi.

Các mô hình ngôn ngữ lớn hiện nay có khả năng đọc mã nguồn, phân tích yêu cầu, sinh code và sử dụng công cụ. Tuy nhiên, coding agent vẫn thường gặp các vấn đề:

- Hiểu sai issue.
- Chọn sai file cần sửa.
- Thay đổi quá nhiều file.
- Tạo patch đúng cú pháp nhưng sai hành vi.
- Không kiểm tra được tác động tới chức năng cũ.
- Tuyên bố test thành công dù chưa thực sự chạy.
- Lặp lại cùng một lỗi qua nhiều vòng.
- Tiêu thụ nhiều token và thời gian.
- Không kiểm soát được command mà agent muốn thực thi.
- Khó tái hiện đầy đủ quá trình ra quyết định.
- Khó đánh giá khách quan hiệu quả của hệ thống.

Một hướng tiếp cận phổ biến là chia quy trình cho nhiều agent có vai trò khác nhau, ví dụ Planner, Developer, Tester và Reviewer. Tuy nhiên, việc tăng số lượng agent không đảm bảo hiệu quả tự động tăng. Multi-Agent có thể tạo ra các vấn đề mới:

- Thông tin bị mất hoặc sai lệch giữa các agent.
- Chi phí token cao hơn.
- Thời gian xử lý dài hơn.
- Workflow phức tạp hơn.
- Agent sau lặp lại giả định sai của agent trước.
- Reviewer tạo nhiều nhận xét nhưng không giúp sửa task.
- Hệ thống không hội tụ sau nhiều vòng.

Do đó, đề tài không đặt giả định rằng Multi-Agent luôn tốt hơn Single-Agent. Thay vào đó, đề tài xây dựng một hệ thống có thể đo lường và kiểm chứng giả thuyết này bằng thực nghiệm.

---

## 4. Phát biểu bài toán

### 4.1. Đầu vào

Hệ thống nhận:

- Đường dẫn repository Git cục bộ hoặc URL repository.
- Branch hoặc commit gốc.
- Issue dưới dạng văn bản tự nhiên hoặc file Markdown.
- Acceptance criteria.
- Các command hợp lệ:
  - Build.
  - Lint.
  - Test.
  - Format.
- Cấu hình workflow:
  - Single-Agent.
  - Multi-Agent cơ bản.
  - Multi-Agent đầy đủ.
- Mô hình LLM.
- Token budget.
- Time limit.
- Số vòng lặp tối đa.
- Chính sách phê duyệt của người dùng.
- Chính sách thực thi command.
- Cấu hình sandbox.

### 4.2. Quá trình xử lý

Hệ thống:

1. Chuẩn bị bản sao repository trong Git worktree hoặc thư mục tạm.
2. Khảo sát cấu trúc dự án.
3. Phân tích issue.
4. Xác định file liên quan.
5. Lập kế hoạch.
6. Tạo và áp dụng patch.
7. Chạy build, lint và test.
8. Review diff.
9. Sửa lại khi cần.
10. Đánh giá kết quả cuối.
11. Ghi lại toàn bộ artifact và metrics.

### 4.3. Đầu ra

Hệ thống xuất:

- Kế hoạch xử lý issue.
- Danh sách file liên quan.
- Patch cuối cùng.
- Danh sách file thay đổi.
- Test được thêm hoặc cập nhật.
- Kết quả build, lint và test.
- Báo cáo review.
- Báo cáo lỗi nếu thất bại.
- Token đã sử dụng.
- Thời gian xử lý.
- Số lần gọi mô hình.
- Số tool call.
- Số vòng lặp.
- Event log.
- Báo cáo tổng hợp ở dạng Markdown và JSON.

---

## 5. Mục tiêu đề tài

## 5.1. Mục tiêu tổng quát

Thiết kế, xây dựng và đánh giá một hệ thống Multi-Agent hoạt động qua CLI, sử dụng mô hình ngôn ngữ lớn và các công cụ thực thi có kiểm soát để hỗ trợ xử lý issue trong dự án phần mềm backend.

## 5.2. Mục tiêu cụ thể

### Mục tiêu về hệ thống

- Xây dựng ứng dụng CLI tiếp nhận repository và issue.
- Xây dựng cơ chế phân tích repository.
- Xây dựng các agent có vai trò rõ ràng.
- Xây dựng Orchestrator quản lý workflow.
- Xây dựng Tool Gateway để kiểm soát quyền sử dụng công cụ.
- Xây dựng Docker sandbox hoặc môi trường thực thi cô lập.
- Áp dụng và quản lý code patch bằng Git.
- Chạy build, lint và test thực tế.
- Ghi nhận exit code, stdout, stderr và thời gian thực thi.
- Hỗ trợ vòng lặp sửa code sau khi test hoặc review thất bại.
- Lưu toàn bộ trạng thái và artifact.
- Hỗ trợ chạy task đơn lẻ và chạy benchmark hàng loạt.
- Xuất báo cáo có thể đọc bởi con người và xử lý tự động.

### Mục tiêu về nghiên cứu

- So sánh Single-Agent và Multi-Agent trên cùng bộ task.
- Đo Task Success Rate.
- Đo hidden-test pass rate.
- Đo regression rate.
- Đo token, thời gian và số lần gọi LLM.
- Phân tích lợi ích của Testing Agent và Reviewer Agent.
- Phân tích ảnh hưởng của số vòng lặp.
- Phân tích hiệu quả theo độ khó và loại task.
- Đánh giá sự đánh đổi giữa chất lượng và chi phí.
- Xác định trường hợp Multi-Agent thực sự mang lại lợi ích.

---

## 6. Phạm vi đề tài

## 6.1. Phạm vi công nghệ

Đề tài ưu tiên các dự án backend có stack tương đối đồng nhất:

- TypeScript.
- Node.js.
- NestJS hoặc Express.
- Jest.
- ESLint.
- PostgreSQL.
- Prisma hoặc TypeORM.

Trong phiên bản MVP, có thể chỉ sử dụng một repository NestJS được chuẩn hóa để giảm độ phức tạp môi trường.

## 6.2. Các nhóm task chính

### Nhóm 1: Sửa lỗi logic và validation

Ví dụ:

- Thiếu kiểm tra field bắt buộc.
- Kiểm tra sai điều kiện.
- Trả sai mã lỗi.
- Validate dữ liệu không đầy đủ.
- Không xử lý trường hợp null hoặc undefined.
- Sai điều kiện kiểm tra trạng thái.

### Nhóm 2: Thay đổi API nhỏ

Ví dụ:

- Thêm field vào response.
- Thêm field vào DTO.
- Bổ sung endpoint đơn giản.
- Thay đổi mapping dữ liệu.
- Bổ sung filter hoặc query parameter.
- Cập nhật mã trạng thái HTTP.

### Nhóm 3: Sửa lỗi truy vấn hoặc xử lý dữ liệu

Ví dụ:

- Query thiếu điều kiện.
- Mapping sai field.
- Truy vấn lấy dư hoặc thiếu dữ liệu.
- Xử lý phân trang sai.
- Không kiểm tra dữ liệu tồn tại.
- Cập nhật sai bản ghi.

### Nhóm 4: Viết hoặc cập nhật test

Ví dụ:

- Bổ sung unit test cho nhánh chưa được kiểm tra.
- Cập nhật test sau khi API thay đổi.
- Thêm test cho edge case.
- Sửa test bị lỗi do logic cũ.
- Thêm regression test cho bug.

### Nhóm 5: Refactor có giới hạn

Ví dụ:

- Tách một hàm dài.
- Tách logic khỏi controller sang service.
- Giảm lặp code.
- Cải thiện cấu trúc nhưng giữ nguyên hành vi.

## 6.3. Giới hạn phạm vi MVP

Phiên bản bắt buộc nên giới hạn:

- Một ngôn ngữ chính: TypeScript.
- Một framework chính: NestJS.
- Một test framework chính: Jest.
- Một repository hoặc tối đa hai repository.
- Task thay đổi không quá khoảng năm file.
- Không phụ thuộc dịch vụ ngoài.
- Không truy cập production.
- Không tự động deploy.
- Không tự động merge vào branch chính.
- Không cho agent truy cập credential.
- Không hỗ trợ mọi loại issue.
- Không hỗ trợ frontend trong phạm vi chính.
- Không huấn luyện LLM từ đầu.

## 6.4. Phần không thuộc phạm vi chính

- Xây dựng IDE hoàn chỉnh.
- Xây dựng hệ thống web nhiều người dùng.
- Xây dựng dashboard realtime phức tạp.
- Hỗ trợ mọi ngôn ngữ lập trình.
- Tự động triển khai production.
- Tự động tạo và merge pull request mà không cần kiểm soát.
- Cho agent truy cập tự do vào shell host.
- Tự động thay đổi hạ tầng cloud.
- Fine-tune mô hình ngôn ngữ lớn.
- Huấn luyện mô hình từ đầu.
- Thay thế hoàn toàn lập trình viên.

---

## 7. Định hướng sản phẩm: CLI-first

## 7.1. Lý do lựa chọn CLI

Coding agent cần tương tác nhiều với:

- File system.
- Git.
- Build tool.
- Test runner.
- Linter.
- Docker.
- Process và command hệ thống.
- Log.
- Code diff.

CLI là hình thức phù hợp vì:

- Hoạt động trực tiếp trong môi trường phát triển.
- Dễ tích hợp vào terminal.
- Dễ chạy trong CI.
- Dễ chạy benchmark hàng loạt.
- Dễ tự động hóa bằng script.
- Không cần xây frontend và backend API riêng.
- Giảm đáng kể phạm vi triển khai.
- Phù hợp với cách hoạt động của nhiều coding agent hiện nay.
- Dễ quan sát tool call, log và trạng thái workflow.

## 7.2. Hai chế độ hoạt động

### Chế độ tương tác

Dùng để demo hoặc hỗ trợ lập trình viên.

Ví dụ:

```text
Repository: example-api
Issue: Fix duplicate email validation
Workflow: multi-agent-full
Model: configured-model

[PLANNING] Analyzing issue...
[PLANNING] Found 4 related files.
[PLANNING] Plan generated.

Approve plan? [Y/n]

[IMPLEMENTING] Applying patch...
[TESTING] Running npm test...
[REVIEWING] Reviewing final diff...
```

Người dùng có thể phê duyệt tại các điểm:

- Sau kế hoạch.
- Trước khi áp dụng patch.
- Trước khi chạy command đặc biệt.
- Trước khi hoàn tất.

### Chế độ không tương tác

Dùng cho thực nghiệm và CI.

```bash
multi-agent run \
  --config ./tasks/task-001.yaml \
  --non-interactive
```

Đặc điểm:

- Không yêu cầu nhập liệu giữa chừng.
- Dùng cấu hình cố định.
- Có tiêu chí dừng rõ ràng.
- Xuất kết quả JSON.
- Trả exit code phù hợp.
- Có thể chạy bằng script.
- Bảo đảm tính tái lập.

---

## 8. Kiến trúc tổng thể

```text
┌──────────────────────────────────────────────────────────────┐
│                         CLI Application                      │
│  run | status | inspect | resume | report | experiment      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  Task Controller / Orchestrator              │
│  - State machine                                             │
│  - Routing                                                   │
│  - Budget control                                            │
│  - Retry and stop conditions                                 │
│  - Human approval                                            │
└──────────────┬───────────────┬──────────────┬────────────────┘
               │               │              │
               ▼               ▼              ▼
       ┌────────────┐   ┌────────────┐  ┌────────────┐
       │  Planning  │   │ Developer  │  │  Testing   │
       │   Agent    │   │   Agent    │  │   Agent    │
       └────────────┘   └────────────┘  └────────────┘
                                               │
                                               ▼
                                        ┌────────────┐
                                        │ Reviewer   │
                                        │   Agent    │
                                        └────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                         Tool Gateway                         │
│ Repository | Search | File | Patch | Git | Test | Shell     │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 Policy and Sandbox Execution                 │
│ Whitelist | Path guard | Timeout | CPU/RAM | Network policy  │
│ Docker sandbox | Git worktree | Process isolation            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│             State Store, Artifact Store, Metrics             │
│ SQLite | JSONL | Patch | Test log | Review | Report          │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Các thành phần chính

## 9.1. CLI Application

CLI là điểm vào chính của hệ thống.

Nhiệm vụ:

- Đọc tham số dòng lệnh.
- Đọc file cấu hình.
- Kiểm tra repository.
- Khởi tạo task.
- Hiển thị tiến trình.
- Nhận phê duyệt từ người dùng.
- Hiển thị diff và kết quả test.
- Xuất báo cáo.
- Điều khiển experiment runner.

Các command đề xuất:

```bash
multi-agent init
multi-agent run
multi-agent status
multi-agent inspect
multi-agent resume
multi-agent cancel
multi-agent report
multi-agent experiment
multi-agent config
multi-agent doctor
```

## 9.2. Task Controller

Task Controller quản lý vòng đời của một task.

Nhiệm vụ:

- Tạo task ID.
- Nạp cấu hình.
- Chuẩn bị repository.
- Khởi động Orchestrator.
- Theo dõi trạng thái.
- Ghi artifact.
- Xử lý lỗi cấp hệ thống.
- Kết thúc và trả exit code.

## 9.3. Orchestrator

Orchestrator điều phối các agent và tool.

Nhiệm vụ:

- Quản lý state machine.
- Chuyển dữ liệu giữa các agent.
- Chọn agent tiếp theo.
- Quản lý số vòng lặp.
- Theo dõi token budget.
- Theo dõi time limit.
- Theo dõi tool-call budget.
- Phát hiện trạng thái lặp.
- Phát hiện patch không thay đổi.
- Phát hiện lỗi lặp lại.
- Yêu cầu người dùng phê duyệt.
- Ghi event.
- Xử lý retry khi agent trả sai schema.

Orchestrator không trực tiếp sinh code. Nó chịu trách nhiệm kiểm soát workflow.

## 9.4. Planning Agent

Nhiệm vụ:

- Phân tích issue.
- Trích xuất mục tiêu.
- Trích xuất acceptance criteria.
- Xác định các giả định.
- Khảo sát cấu trúc repository.
- Xác định module liên quan.
- Xác định file liên quan.
- Xác định rủi ro.
- Xây dựng kế hoạch triển khai.
- Đề xuất test cần có.

Planning Agent không chỉnh sửa code.

Đầu ra:

```json
{
  "schemaVersion": "1.0",
  "summary": "Tóm tắt issue",
  "requirements": [],
  "acceptanceCriteria": [],
  "relatedFiles": [
    {
      "path": "src/users/users.service.ts",
      "reason": "Chứa logic kiểm tra email",
      "confidence": 0.93
    }
  ],
  "implementationSteps": [],
  "requiredTests": [],
  "risks": [],
  "assumptions": []
}
```

## 9.5. Developer Agent

Nhiệm vụ:

- Đọc issue gốc.
- Đọc kế hoạch.
- Đọc file liên quan.
- Xác định thay đổi tối thiểu.
- Sinh patch.
- Giải thích thay đổi.
- Cập nhật patch dựa trên lỗi test.
- Cập nhật patch dựa trên review.
- Hạn chế thay đổi ngoài phạm vi.

Developer Agent không được trực tiếp chạy shell tùy ý. Mọi tool call phải đi qua Tool Gateway.

Đầu ra:

```json
{
  "schemaVersion": "1.0",
  "summary": "Mô tả thay đổi",
  "changedFiles": [],
  "patch": "...",
  "assumptions": [],
  "knownLimitations": [],
  "requestedToolCalls": []
}
```

## 9.6. Testing Agent

Nhiệm vụ suy luận:

- Đọc acceptance criteria.
- Xác định test case.
- Đề xuất hoặc sinh test.
- Phân tích kết quả build.
- Phân tích kết quả lint.
- Phân tích test failure.
- Xác định regression.
- Đưa phản hồi cho Developer Agent.

Testing Agent không tự tuyên bố test pass. Kết quả pass/fail phải đến từ Test Runner.

Đầu ra:

```json
{
  "schemaVersion": "1.0",
  "testPlan": [],
  "testsAdded": [],
  "buildAnalysis": {},
  "lintAnalysis": {},
  "testAnalysis": {},
  "regressions": [],
  "recommendations": [],
  "decision": "PASS | FAIL | NEEDS_REVISION"
}
```

## 9.7. Reviewer Agent

Nhiệm vụ:

- Đọc issue và acceptance criteria.
- Review diff cuối.
- Kiểm tra logic.
- Kiểm tra phạm vi thay đổi.
- Kiểm tra backward compatibility.
- Kiểm tra code convention.
- Kiểm tra test coverage ở mức hợp lý.
- Kiểm tra lỗi bảo mật cơ bản.
- Phát hiện code smell.
- Đưa ra approve hoặc request changes.

Đầu ra:

```json
{
  "schemaVersion": "1.0",
  "decision": "APPROVE | REQUEST_CHANGES",
  "criticalIssues": [],
  "warnings": [],
  "outOfScopeChanges": [],
  "securityRisks": [],
  "testConcerns": [],
  "suggestions": []
}
```

## 9.8. Tool Gateway

Tool Gateway là lớp trung gian giữa agent và môi trường thực thi.

Nhiệm vụ:

- Nhận yêu cầu tool call từ agent.
- Kiểm tra schema.
- Kiểm tra quyền.
- Kiểm tra path.
- Kiểm tra command.
- Gửi yêu cầu tới sandbox.
- Chuẩn hóa kết quả.
- Ghi log.
- Trả kết quả về agent.

Các nhóm tool:

### Repository tools

- `list_tree`
- `read_project_config`
- `detect_language`
- `detect_framework`
- `find_test_commands`
- `find_build_commands`

### Search tools

- `search_text`
- `search_symbol`
- `find_references`
- `find_files`
- `read_snippet`

### File tools

- `read_file`
- `read_files`
- `write_file`
- `create_file`
- `delete_file`
- `list_directory`

### Patch tools

- `generate_diff`
- `validate_patch`
- `apply_patch`
- `revert_patch`
- `show_diff`

### Git tools

- `git_status`
- `git_diff`
- `git_log`
- `git_show`
- `git_reset`
- `create_worktree`
- `remove_worktree`

### Verification tools

- `run_build`
- `run_lint`
- `run_test`
- `run_typecheck`
- `run_formatter_check`
- `run_static_analysis`

### Shell tools

- Chỉ cho phép command đã được định nghĩa trong cấu hình.
- Không cung cấp shell tự do trong MVP.

## 9.9. Sandbox Executor

Sandbox Executor thực thi command trong môi trường cô lập.

Yêu cầu:

- Container riêng cho mỗi task hoặc mỗi run.
- Giới hạn CPU.
- Giới hạn RAM.
- Timeout.
- Giới hạn kích thước output.
- Không mount credential.
- Không mount Docker socket.
- Chỉ mount worktree cần thiết.
- Chặn truy cập host filesystem.
- Tắt network mặc định.
- Chỉ bật network khi setup dependency thực sự cần.
- Ghi exit code.
- Ghi stdout và stderr.
- Kill process khi timeout.
- Dọn container sau khi kết thúc.

## 9.10. State Store

State Store lưu trạng thái có cấu trúc:

- Task metadata.
- Workflow state.
- Agent runs.
- Iteration.
- Token usage.
- Tool calls.
- Errors.
- Stop reason.
- Metrics.

SQLite phù hợp cho CLI vì:

- Không cần server riêng.
- Dễ truy vấn.
- Dễ backup.
- Dễ dùng trong thí nghiệm.
- Có thể kết hợp với artifact file.

## 9.11. Artifact Store

Artifact Store lưu file đầu ra:

- Prompt.
- Agent output.
- Plan.
- Patch.
- Test log.
- Review.
- Metrics.
- Final report.
- Event log.

Cấu trúc đề xuất:

```text
.agent-runs/
└── task-001/
    ├── task.json
    ├── config.json
    ├── state.json
    ├── events.jsonl
    ├── repository.json
    ├── plan.json
    ├── iterations/
    │   ├── 01/
    │   │   ├── developer-output.json
    │   │   ├── patch.diff
    │   │   ├── build-result.json
    │   │   ├── lint-result.json
    │   │   ├── test-result.json
    │   │   └── review-result.json
    │   └── 02/
    ├── final.patch
    ├── final-report.md
    └── metrics.json
```

## 9.12. Metrics Collector

Nhiệm vụ:

- Ghi input token.
- Ghi output token.
- Ghi tổng token.
- Ghi số lần gọi LLM.
- Ghi số tool call.
- Ghi thời gian agent.
- Ghi thời gian command.
- Ghi số vòng lặp.
- Ghi số file thay đổi.
- Ghi kích thước patch.
- Ghi trạng thái test.
- Ghi stop reason.
- Ghi chi phí API nếu có.

## 9.13. Experiment Runner

Experiment Runner chạy nhiều task theo cấu hình.

Nhiệm vụ:

- Nạp danh sách task.
- Nạp danh sách workflow.
- Chạy nhiều lần mỗi task.
- Reset repository.
- Tạo sandbox độc lập.
- Thu metrics.
- Tổng hợp kết quả.
- Xuất CSV hoặc JSON.
- Tạo báo cáo Markdown.
- Hỗ trợ resume khi experiment bị gián đoạn.

---

## 10. State machine của workflow

## 10.1. Các trạng thái chính

```text
CREATED
  ↓
VALIDATING_INPUT
  ↓
PREPARING_REPOSITORY
  ↓
ANALYZING_REPOSITORY
  ↓
PLANNING
  ↓
WAITING_FOR_PLAN_APPROVAL
  ↓
IMPLEMENTING
  ↓
APPLYING_PATCH
  ↓
TESTING
  ├── FAIL → REVISING
  │           ↓
  │       APPLYING_PATCH
  │           ↓
  │         TESTING
  │
  └── PASS → REVIEWING
              ├── REQUEST_CHANGES → REVISING
              └── APPROVE → FINAL_EVALUATION
                                  ↓
                              COMPLETED
```

## 10.2. Các trạng thái kết thúc

- `COMPLETED`
- `FAILED`
- `CANCELLED`
- `TIMEOUT`
- `BUDGET_EXCEEDED`
- `MAX_ITERATIONS_REACHED`
- `SANDBOX_ERROR`
- `INVALID_CONFIGURATION`
- `INVALID_AGENT_OUTPUT`
- `NO_PROGRESS`
- `EVALUATION_FAILED`

## 10.3. Tiêu chí dừng thành công

Task được hoàn thành khi:

- Patch được áp dụng hợp lệ.
- Build thành công.
- Lint đạt hoặc không có lỗi mới nghiêm trọng.
- Public tests pass.
- Test cũ không bị hỏng.
- Reviewer approve.
- Không có thay đổi nghiêm trọng ngoài phạm vi.
- Không vượt budget.
- Không vượt time limit.

Hidden tests có thể được chạy ở bước final evaluation và không cho agent truy cập.

## 10.4. Tiêu chí dừng thất bại

Workflow dừng khi:

- Vượt số vòng lặp tối đa.
- Vượt token budget.
- Vượt time limit.
- Sandbox lỗi không thể khôi phục.
- Agent liên tục trả output sai schema.
- Patch không thay đổi qua nhiều vòng.
- Cùng một lỗi lặp lại quá số lần cho phép.
- Không còn hành động hợp lệ.
- Người dùng hủy task.
- Repository không thể build hoặc setup từ trạng thái ban đầu.

---

## 11. Quy trình xử lý một issue

## Bước 1: Khởi tạo task

Người dùng chạy:

```bash
multi-agent run \
  --repo ./example-api \
  --issue ./issues/task-001.md \
  --workflow multi-agent-full \
  --config ./configs/default.yaml
```

CLI:

- Kiểm tra đường dẫn.
- Đọc issue.
- Đọc cấu hình.
- Tạo task ID.
- Tạo thư mục artifact.
- Ghi task metadata.

## Bước 2: Kiểm tra repository

Hệ thống kiểm tra:

- Repository có phải Git repository không.
- Working tree có sạch không.
- Commit gốc có tồn tại không.
- Build command có hợp lệ không.
- Test command có hợp lệ không.
- Dependency có sẵn không.
- Docker có hoạt động không.
- Disk có đủ không.

## Bước 3: Tạo môi trường cô lập

Hệ thống:

- Tạo Git worktree.
- Checkout base commit.
- Tạo sandbox.
- Mount worktree.
- Áp dụng resource limit.
- Thiết lập network policy.
- Chạy preflight test nếu cần.

## Bước 4: Phân tích repository

Hệ thống thu thập:

- Cây thư mục.
- File cấu hình.
- Package manager.
- Framework.
- Build command.
- Test command.
- Cấu trúc module.
- Danh sách test.
- Quy ước code.

## Bước 5: Lập kế hoạch

Planning Agent:

- Đọc issue.
- Đọc acceptance criteria.
- Sử dụng search tools.
- Xác định file liên quan.
- Tạo kế hoạch.
- Tạo danh sách test.
- Nêu rủi ro.

Trong chế độ tương tác, người dùng có thể duyệt kế hoạch.

## Bước 6: Chỉnh sửa mã nguồn

Developer Agent:

- Đọc file liên quan.
- Sinh patch.
- Gửi patch cho Tool Gateway.
- Tool Gateway validate.
- Sandbox áp dụng patch.
- Hệ thống ghi diff.

## Bước 7: Sinh hoặc cập nhật test

Testing Agent:

- Phân tích acceptance criteria.
- Đề xuất test.
- Tạo test nếu cần.
- Áp dụng patch test qua Tool Gateway.

## Bước 8: Chạy xác minh

Test Runner chạy:

1. Format check.
2. Type check.
3. Build.
4. Lint.
5. Unit test.
6. Integration test nếu có.

Mỗi command trả:

```json
{
  "command": "npm test",
  "exitCode": 1,
  "stdout": "...",
  "stderr": "...",
  "durationMs": 12453,
  "timedOut": false
}
```

## Bước 9: Phân tích lỗi

Nếu test fail:

- Testing Agent đọc log.
- Xác định lỗi chính.
- Phân loại:
  - Lỗi code.
  - Lỗi test.
  - Lỗi môi trường.
  - Lỗi dependency.
  - Lỗi timeout.
- Tạo feedback có cấu trúc.

## Bước 10: Sửa lặp

Developer Agent nhận:

- Issue gốc.
- Plan.
- Patch hiện tại.
- Test failure.
- Review feedback.
- Lịch sử ngắn gọn các lần sửa.

Developer Agent tạo patch mới.

## Bước 11: Review

Reviewer Agent kiểm tra:

- Diff.
- File thay đổi.
- Test result.
- Acceptance criteria.
- Coding convention.
- Out-of-scope changes.
- Backward compatibility.
- Security risk cơ bản.

## Bước 12: Đánh giá cuối

Evaluator chạy:

- Hidden tests.
- Regression suite.
- Kiểm tra build cuối.
- Kiểm tra git diff.
- Tính metrics.
- Xác định task success.

## Bước 13: Xuất kết quả

CLI xuất:

```text
Task ID: task-001
Status: COMPLETED
Workflow: multi-agent-full
Iterations: 2
Changed files: 3
Build: PASS
Lint: PASS
Public tests: PASS
Hidden tests: PASS
Review: APPROVED
Tokens: 41,283
Duration: 07:42
Patch: .agent-runs/task-001/final.patch
Report: .agent-runs/task-001/final-report.md
```

---

## 12. Thiết kế command CLI

## 12.1. `multi-agent init`

Khởi tạo cấu hình trong repository.

```bash
multi-agent init
```

Tạo:

```text
.multi-agent/
├── config.yaml
├── policies.yaml
├── prompts/
└── tasks/
```

## 12.2. `multi-agent run`

Chạy một task.

```bash
multi-agent run \
  --repo ./project \
  --issue ./issue.md \
  --workflow multi-agent-full \
  --max-iterations 3 \
  --token-budget 50000 \
  --time-limit 1800
```

Các tham số chính:

- `--repo`
- `--issue`
- `--base-commit`
- `--workflow`
- `--model`
- `--max-iterations`
- `--token-budget`
- `--time-limit`
- `--non-interactive`
- `--output-dir`
- `--config`

## 12.3. `multi-agent status`

```bash
multi-agent status task-001
```

Hiển thị:

- Trạng thái hiện tại.
- Agent hiện tại.
- Iteration.
- Token đã dùng.
- Thời gian.
- File thay đổi.
- Command đang chạy.

## 12.4. `multi-agent inspect`

```bash
multi-agent inspect task-001
```

Cho phép xem:

- Plan.
- Agent output.
- Tool calls.
- Diff.
- Test logs.
- Review.
- Errors.

## 12.5. `multi-agent resume`

```bash
multi-agent resume task-001
```

Điều kiện:

- Task chưa hoàn tất.
- State đã được checkpoint.
- Worktree còn hợp lệ.
- Cấu hình không thay đổi trái phép.

## 12.6. `multi-agent report`

```bash
multi-agent report task-001 --format markdown
multi-agent report task-001 --format json
```

## 12.7. `multi-agent experiment`

```bash
multi-agent experiment --config ./experiments/main.yaml
```

Ví dụ cấu hình:

```yaml
name: main-comparison

tasks:
  - task-001
  - task-002
  - task-003

workflows:
  - single-agent
  - multi-agent-basic
  - multi-agent-full

runsPerTask: 3

limits:
  tokenBudget: 50000
  timeLimitSeconds: 1800
  maxIterations: 3

output:
  directory: ./experiment-results
  formats:
    - json
    - csv
    - markdown
```

## 12.8. `multi-agent doctor`

Kiểm tra môi trường:

```bash
multi-agent doctor
```

Kiểm tra:

- Git.
- Docker.
- Node.js.
- Package manager.
- API key.
- Quyền filesystem.
- Cấu hình model.
- Dung lượng ổ đĩa.

---

## 13. Định dạng cấu hình

Ví dụ `config.yaml`:

```yaml
project:
  language: typescript
  framework: nestjs
  packageManager: npm

commands:
  install: npm ci
  build: npm run build
  lint: npm run lint
  test: npm test -- --runInBand
  typecheck: npm run typecheck

workflow:
  type: multi-agent-full
  maxIterations: 3
  requirePlanApproval: false
  requirePatchApproval: false

model:
  provider: configured-provider
  name: configured-model
  temperature: 0
  maxOutputTokens: 8000

limits:
  tokenBudget: 50000
  timeLimitSeconds: 1800
  commandTimeoutSeconds: 300
  maxToolCalls: 100

sandbox:
  runtime: docker
  network: disabled
  cpuLimit: 2
  memoryLimitMb: 4096
  readOnlyRootFilesystem: true

security:
  allowedPaths:
    - src
    - test
    - package.json
    - tsconfig.json
  deniedPaths:
    - .env
    - .git
    - secrets
  allowShell: false

artifacts:
  directory: .agent-runs
  storePrompts: true
  storeModelResponses: true
  storeCommandOutput: true
```

---

## 14. Hợp đồng dữ liệu giữa các agent

## 14.1. Nguyên tắc

- Agent output phải có schema rõ ràng.
- Mỗi schema có version.
- Field quan trọng là bắt buộc.
- Không truyền toàn bộ lịch sử không giới hạn.
- Dữ liệu giữa agent ưu tiên JSON.
- Orchestrator validate output.
- Nếu sai schema, cho phép retry giới hạn.
- Mọi quyết định quan trọng phải có lý do.
- File path phải được chuẩn hóa.
- Không chấp nhận path ra ngoài workspace.

## 14.2. Shared state

Ví dụ:

```json
{
  "taskId": "task-001",
  "issue": {},
  "repository": {},
  "plan": {},
  "currentPatch": {},
  "testResults": [],
  "reviewResults": [],
  "iteration": 2,
  "budgets": {
    "tokenUsed": 30120,
    "tokenLimit": 50000,
    "toolCallsUsed": 43,
    "toolCallsLimit": 100
  },
  "status": "TESTING"
}
```

## 14.3. Context management

Không gửi toàn bộ repository vào prompt.

Context nên gồm:

- Issue gốc.
- Acceptance criteria.
- Plan hiện tại.
- File liên quan.
- Snippet cần thiết.
- Diff hiện tại.
- Test failure gần nhất.
- Review feedback gần nhất.

Có thể áp dụng:

- File ranking.
- Context budget.
- Tóm tắt lịch sử.
- Cache repository analysis.
- Loại bỏ log không cần thiết.
- Chỉ giữ lỗi quan trọng.

---

## 15. Bảo mật và an toàn thực thi

## 15.1. Mối đe dọa

- Agent chạy command nguy hiểm.
- Agent đọc credential.
- Agent ghi file ngoài workspace.
- Dependency script độc hại.
- Prompt injection từ code hoặc issue.
- Agent xóa nhiều file.
- Agent truy cập network trái phép.
- Agent sửa hidden tests.
- Agent chỉnh `.git`.
- Agent tạo process không kết thúc.
- Output log quá lớn.
- Agent dùng command để vượt sandbox.

## 15.2. Command policy

Trong MVP:

- Không cho shell tự do.
- Chỉ cho command đã cấu hình.
- Command được ánh xạ vào ID.

Ví dụ:

```json
{
  "tool": "run_test",
  "args": {
    "suite": "unit"
  }
}
```

Tool Gateway chuyển thành command nội bộ đã biết.

Không cho agent gửi trực tiếp:

```bash
rm -rf /
curl ...
sudo ...
docker ...
```

## 15.3. Path policy

- Chỉ đọc/ghi trong worktree.
- Chuẩn hóa absolute path.
- Chặn `..`.
- Chặn symbolic link ra ngoài.
- Chặn `.env`.
- Chặn credential.
- Chặn hidden-test directory.
- Chặn `.git` trừ Git tools nội bộ.

## 15.4. Resource policy

- CPU limit.
- RAM limit.
- Process limit.
- Disk quota.
- Timeout.
- Output-size limit.
- Network disabled.
- Kill process tree khi timeout.

## 15.5. Git safety

- Dùng worktree riêng.
- Không sửa branch người dùng.
- Không commit tự động trong MVP.
- Lưu patch trước khi reset.
- Dọn worktree sau task.
- Kiểm tra untracked file.
- Không push remote.

---

## 16. Tách biệt agent và công cụ xác minh

Một nguyên tắc quan trọng:

> Agent suy luận và đề xuất hành động; công cụ xác minh thực thi và tạo bằng chứng.

Ví dụ:

- Developer Agent đề xuất patch.
- Patch Tool áp dụng patch.
- Test Runner chạy test.
- Exit code quyết định pass/fail.
- Metrics Collector ghi thời gian.
- Evaluator chạy hidden tests.

Không cho phép LLM tự xác nhận:

- Build pass.
- Test pass.
- File đã được sửa.
- Patch đã được áp dụng.

Mọi trạng thái phải dựa trên kết quả tool thực tế.

---

## 17. Hidden tests và evaluator

## 17.1. Mục tiêu

Hidden tests giúp tránh trường hợp agent chỉ tối ưu theo public tests.

## 17.2. Cách ly hidden tests

- Hidden tests không nằm trong thư mục agent được đọc.
- Agent không được biết nội dung.
- Agent không được sửa.
- Hidden tests chỉ chạy sau khi workflow kết thúc.
- Evaluator có workspace hoặc mount riêng.
- Agent chỉ nhận kết quả nếu thiết kế thí nghiệm cho phép.

## 17.3. Hai lớp test

```text
Agent-visible Test Runner
- Existing tests
- Public tests
- Tests generated by agent

Final Evaluator
- Hidden tests
- Regression suite
- Additional static checks
```

## 17.4. Tiêu chí thành công

Một task thành công khi:

- Build pass.
- Public tests pass.
- Hidden tests pass.
- Regression tests pass.
- Không có lỗi nghiêm trọng ngoài phạm vi.
- Patch đáp ứng acceptance criteria.

---

## 18. Cấu hình Single-Agent và Multi-Agent

## 18.1. Cấu hình A: Single-Agent

Một agent thực hiện:

- Phân tích.
- Lập kế hoạch.
- Sửa code.
- Viết test.
- Phân tích test result.
- Review patch.

Tool và sandbox giữ nguyên.

Mục tiêu:

- Làm baseline.
- Đo hiệu quả khi không phân vai.
- So sánh chi phí.

## 18.2. Cấu hình B: Multi-Agent cơ bản

Gồm:

- Planning Agent.
- Developer Agent.
- Testing Agent.
- Orchestrator.

Không có Reviewer Agent độc lập.

## 18.3. Cấu hình C: Multi-Agent đầy đủ

Gồm:

- Planning Agent.
- Developer Agent.
- Testing Agent.
- Reviewer Agent.
- Orchestrator.
- Vòng lặp sửa.

## 18.4. Cấu hình ablation

Có thể thử:

- Không có Planning Agent.
- Không có Testing Agent.
- Không có Reviewer Agent.
- Không cho vòng lặp.
- Không chia sẻ test feedback.
- Chỉ cho mỗi agent chạy một lần.
- Chỉ dùng test có sẵn.
- Không cho agent sinh test.

Ablation chỉ nên chạy trên tập con để giảm chi phí.

---

## 19. Câu hỏi nghiên cứu

### RQ1

**Multi-Agent có cải thiện tỷ lệ hoàn thành issue so với Single-Agent khi sử dụng cùng mô hình, cùng tool và cùng giới hạn tài nguyên hay không?**

### RQ2

**Testing Agent ảnh hưởng như thế nào đến hidden-test pass rate và regression rate?**

### RQ3

**Reviewer Agent ảnh hưởng như thế nào đến chất lượng patch và số thay đổi ngoài phạm vi?**

### RQ4

**Chi phí bổ sung của Multi-Agent về token, thời gian và số lần gọi mô hình có tương xứng với mức cải thiện chất lượng hay không?**

### RQ5

**Loại task và mức độ phức tạp nào hưởng lợi nhiều nhất từ Multi-Agent?**

### RQ6

**Số vòng lặp giữa Developer, Tester và Reviewer ảnh hưởng như thế nào đến khả năng hội tụ?**

### RQ7

**Cơ chế truyền shared state có ảnh hưởng như thế nào tới chất lượng phối hợp giữa các agent?**

---

## 20. Giả thuyết nghiên cứu

### H1

Multi-Agent có tỷ lệ thành công cao hơn với task liên quan nhiều file hoặc nhiều module.

### H2

Testing Agent giúp tăng hidden-test pass rate và giảm regression.

### H3

Reviewer Agent giúp giảm thay đổi ngoài phạm vi.

### H4

Single-Agent có hiệu quả chi phí tốt hơn với task đơn giản.

### H5

Multi-Agent tiêu thụ nhiều token và thời gian hơn.

### H6

Lợi ích của Multi-Agent tăng theo độ phức tạp task nhưng không tăng tuyến tính.

### H7

Vòng lặp sửa có giới hạn giúp tăng tỷ lệ thành công, nhưng quá nhiều vòng lặp tạo chi phí lớn và có thể không hội tụ.

---

## 21. Thiết kế benchmark

## 21.1. Nguồn task

Có thể sử dụng:

- Task tự xây dựng.
- Issue lịch sử trong repository.
- Patch đã biết trước.
- Một tập con benchmark công khai phù hợp.
- Task được tạo từ bug injection.

Trong đồ án, mini-benchmark tự xây dựng nên là nguồn chính để:

- Kiểm soát độ khó.
- Tạo hidden tests.
- Tránh rò rỉ đáp án.
- Chuẩn hóa môi trường.
- Giảm chi phí setup.

## 21.2. Cấu trúc một task

```text
benchmarks/
└── task-001/
    ├── metadata.yaml
    ├── issue.md
    ├── public-tests/
    ├── hidden-tests/
    ├── expected.patch
    ├── setup.sh
    └── evaluate.sh
```

Ví dụ metadata:

```yaml
id: task-001
title: Fix duplicate email validation
category: validation
difficulty: medium
repository: example-api
baseCommit: abc123
expectedFiles:
  - src/users/users.service.ts
  - src/users/users.service.spec.ts
timeLimitSeconds: 1200
```

## 21.3. Phân loại độ khó

### Dễ

- Một file.
- Một module.
- Thay đổi nhỏ.
- Không đổi database.
- Có test rõ ràng.

### Trung bình

- Hai đến năm file.
- Liên quan controller, service và test.
- Có DTO hoặc query.
- Có nhiều acceptance criteria.

### Khó

- Nhiều module.
- Có transaction.
- Có authorization.
- Có migration.
- Có nhiều edge case.
- Có integration test.

## 21.4. Quy mô khả thi

### Thực nghiệm chính

- 12–20 task.
- 3 nhóm độ khó.
- 2–4 nhóm task.
- 2 hoặc 3 cấu hình chính.
- 3 lần chạy mỗi task.

Ví dụ:

```text
15 task × 3 cấu hình × 3 lần = 135 run
```

### Thực nghiệm ablation

- 6–10 task đại diện.
- 2–4 cấu hình ablation.
- 2 hoặc 3 lần chạy.

Không nên chạy mọi ablation trên toàn bộ benchmark nếu tài nguyên hạn chế.

---

## 22. Điều kiện so sánh công bằng

Các cấu hình phải sử dụng:

- Cùng model.
- Cùng model version.
- Cùng temperature.
- Cùng repository snapshot.
- Cùng issue.
- Cùng public tests.
- Cùng hidden tests.
- Cùng tool.
- Cùng sandbox.
- Cùng wall-clock timeout.
- Cùng tổng token budget.
- Cùng tiêu chí thành công.
- Cùng policy.
- Cùng phương pháp thu metrics.

Không nhất thiết ép cùng số vòng lặp vì kiến trúc workflow khác nhau. Số vòng lặp được ghi nhận như một chỉ số chi phí.

Ngoài ra cần:

- Reset repository sau mỗi run.
- Tạo sandbox mới.
- Không dùng kết quả run trước.
- Không để agent đọc expected patch.
- Không để agent đọc hidden tests.
- Ghi model configuration đầy đủ.

---

## 23. Chỉ số đánh giá

## 23.1. Chỉ số chính

### Task Success Rate

```text
Task Success Rate =
Số task thành công / Tổng số task
```

### Hidden-Test Pass Rate

```text
Hidden-Test Pass Rate =
Số hidden test pass / Tổng số hidden test
```

### Regression Rate

```text
Regression Rate =
Số run làm hỏng test cũ / Tổng số run
```

### Cost

- Input token.
- Output token.
- Tổng token.
- Chi phí API.
- Số lần gọi LLM.
- Số tool call.
- Thời gian toàn task.

### Workflow efficiency

- Số vòng lặp.
- Số lần test.
- Số lần review.
- Số patch.
- Tỷ lệ workflow hội tụ.
- Tỷ lệ dừng vì budget.
- Tỷ lệ dừng vì timeout.

## 23.2. Chỉ số patch

- Số file thay đổi.
- Số dòng thêm.
- Số dòng xóa.
- Patch size.
- Số file ngoài phạm vi.
- Khoảng cách so với patch tham khảo.
- Tỷ lệ thay đổi không cần thiết.

Không nên coi việc giống patch tham khảo là tiêu chí duy nhất vì có thể có nhiều lời giải đúng.

## 23.3. Chất lượng code

- Lỗi ESLint.
- TypeScript errors.
- Static-analysis warnings.
- Cyclomatic complexity.
- Code duplication.
- Maintainability.
- Security issues cơ bản.

## 23.4. Chất lượng test

- Test được thêm.
- Branch coverage.
- Statement coverage.
- Test bắt được bug gốc.
- Test không phụ thuộc implementation quá mức.
- Mutation score nếu có thời gian.

## 23.5. Chỉ số phối hợp

- Số feedback của Tester dẫn đến patch thành công.
- Số review issue hợp lệ.
- Số review issue sai.
- Số vòng lặp trung bình.
- Tỷ lệ agent output sai schema.
- Tỷ lệ thông tin quan trọng bị mất.
- Tỷ lệ Developer sửa đúng theo feedback.

Các chỉ số phối hợp có thể cần rubric thủ công, nên đặt ở nhóm phụ.

---

## 24. Phương pháp phân tích kết quả

Cần báo cáo:

- Giá trị trung bình.
- Trung vị.
- Độ lệch chuẩn.
- Min và max.
- Tỷ lệ thành công.
- Pass@k.
- Kết quả theo loại task.
- Kết quả theo độ khó.
- Chi phí cho mỗi task thành công.
- Tương quan giữa độ khó và số vòng lặp.

Biểu đồ gợi ý:

- Task Success Rate theo cấu hình.
- Token trung bình theo cấu hình.
- Thời gian trung bình.
- Regression rate.
- Success theo độ khó.
- Chi phí trên task thành công.
- Số vòng lặp và xác suất thành công.
- Patch size.
- Out-of-scope changes.

Khi số mẫu nhỏ, cần thận trọng khi kết luận thống kê. Có thể sử dụng:

- Bootstrap confidence interval.
- Fisher's exact test cho tỷ lệ.
- Mann–Whitney U test cho token hoặc thời gian.
- Effect size.

Phần thống kê nâng cao là tùy chọn, không bắt buộc nếu dữ liệu không đủ lớn.

---

## 25. Công nghệ triển khai đề xuất

## 25.1. Phương án TypeScript

Phù hợp nếu muốn đồng nhất với repository backend.

- Runtime: Node.js.
- Language: TypeScript.
- CLI: Commander.js hoặc oclif.
- Terminal UI: Ink.
- Schema: Zod.
- Database: SQLite.
- ORM nhẹ: Drizzle hoặc Prisma SQLite.
- Process execution: execa.
- Git: simple-git hoặc command wrapper.
- Logging: pino.
- Container: Docker CLI hoặc Docker API.
- Testing: Vitest/Jest.
- Orchestration: finite-state machine tự xây dựng hoặc LangGraph JS.

## 25.2. Phương án Python

Phù hợp nếu ưu tiên hệ sinh thái agent.

- Runtime: Python.
- CLI: Typer hoặc Click.
- Terminal UI: Rich.
- Schema: Pydantic.
- Database: SQLite.
- ORM: SQLModel hoặc SQLAlchemy.
- Process execution: subprocess/asyncio.
- Git: GitPython hoặc command wrapper.
- Logging: structlog.
- Container: Docker SDK.
- Testing: pytest.
- Orchestration: LangGraph hoặc state machine tự xây dựng.

## 25.3. Khuyến nghị

Có hai lựa chọn hợp lý:

### Lựa chọn 1: Python + LangGraph

Ưu điểm:

- Hệ sinh thái agent mạnh.
- Dễ xây graph.
- Dễ checkpoint.
- Dễ tích hợp model provider.
- Dễ thử nghiệm.

Nhược điểm:

- Khác ngôn ngữ với repository NestJS.
- Cần quản lý cả Python và Node.js.

### Lựa chọn 2: TypeScript + state machine tự xây dựng

Ưu điểm:

- Đồng nhất ngôn ngữ.
- Dễ trình bày toàn bộ hệ thống.
- Kiểm soát kiến trúc rõ.
- Ít phụ thuộc framework orchestration.

Nhược điểm:

- Phải tự xây retry, checkpoint và graph routing.
- Khối lượng code nền lớn hơn.

### Phương án cân bằng

- Dùng Python cho agent runtime và CLI.
- Dùng Docker để xử lý repository TypeScript.
- Dùng LangGraph cho workflow.
- Dùng SQLite + JSONL.
- Dùng Git worktree.
- Không xây web frontend.

---

## 26. Thiết kế module phần mềm

Ví dụ cấu trúc mã nguồn:

```text
src/
├── cli/
│   ├── commands/
│   ├── renderers/
│   └── main
├── core/
│   ├── task_controller
│   ├── orchestrator
│   ├── state_machine
│   ├── budgets
│   └── stop_conditions
├── agents/
│   ├── planning_agent
│   ├── developer_agent
│   ├── testing_agent
│   ├── reviewer_agent
│   └── single_agent
├── models/
│   ├── provider
│   ├── client
│   ├── usage
│   └── retry
├── tools/
│   ├── gateway
│   ├── repository
│   ├── search
│   ├── file
│   ├── patch
│   ├── git
│   ├── verification
│   └── shell
├── sandbox/
│   ├── executor
│   ├── docker
│   ├── policies
│   └── limits
├── storage/
│   ├── state_store
│   ├── artifact_store
│   └── repositories
├── experiments/
│   ├── runner
│   ├── evaluator
│   ├── metrics
│   └── reports
├── schemas/
└── prompts/
```

---

## 27. Thiết kế prompt

Mỗi agent cần system prompt riêng.

## 27.1. Planning Agent

Nguyên tắc:

- Không sửa code.
- Không giả định file chưa đọc.
- Mỗi file liên quan phải có lý do.
- Tách requirement và assumption.
- Đề xuất thay đổi tối thiểu.
- Nêu test bắt buộc.

## 27.2. Developer Agent

Nguyên tắc:

- Ưu tiên patch nhỏ.
- Không thay đổi ngoài phạm vi.
- Không sửa test để che lỗi.
- Không tự tuyên bố test pass.
- Không thêm dependency nếu chưa cần.
- Giải thích giả định.

## 27.3. Testing Agent

Nguyên tắc:

- Dựa vào issue gốc.
- Không tin tuyệt đối vào Developer Agent.
- Phân biệt lỗi môi trường và lỗi code.
- Ưu tiên regression test.
- Không sửa logic sản phẩm trực tiếp nếu vai trò không cho phép.

## 27.4. Reviewer Agent

Nguyên tắc:

- Review theo acceptance criteria.
- Chỉ request changes khi có lý do cụ thể.
- Phân loại critical và warning.
- Không yêu cầu refactor ngoài phạm vi.
- Không đánh giá dựa trên style cá nhân.
- Dựa vào diff và test result.

---

## 28. Quản lý token và context

## 28.1. Token budget

Token budget có thể chia:

```text
Planning: 15%
Developer: 45%
Testing: 20%
Reviewer: 15%
Reserve: 5%
```

Đây chỉ là cấu hình ban đầu, có thể điều chỉnh.

## 28.2. Giảm token

- Không gửi file không liên quan.
- Dùng ripgrep trước khi đọc file.
- Đọc snippet thay vì file quá lớn.
- Tóm tắt log.
- Cắt stack trace lặp.
- Cache repository map.
- Chỉ gửi diff mới.
- Tóm tắt lịch sử vòng lặp.
- Giới hạn số file context.
- Dùng model nhỏ cho bước đơn giản nếu thí nghiệm cho phép.

Trong so sánh chính, nên dùng cùng model để bảo đảm công bằng.

---

## 29. Quản lý lỗi và khả năng phục hồi

Các nhóm lỗi:

- Model API error.
- Rate limit.
- Invalid JSON.
- Tool validation error.
- Patch apply error.
- Build error.
- Test timeout.
- Sandbox crash.
- Git conflict.
- Disk full.
- User cancel.

Cơ chế:

- Retry có giới hạn.
- Exponential backoff.
- Checkpoint state.
- Lưu artifact trước khi retry.
- Resume task.
- Phân biệt lỗi hệ thống và lỗi giải pháp.
- Không tính lỗi hạ tầng như lỗi reasoning nếu đánh giá thực nghiệm.
- Ghi stop reason rõ ràng.

---

## 30. Mô hình dữ liệu

## 30.1. Task

- `id`
- `title`
- `description`
- `repository`
- `baseCommit`
- `workflow`
- `model`
- `status`
- `tokenBudget`
- `timeLimit`
- `maxIterations`
- `createdAt`
- `startedAt`
- `completedAt`
- `stopReason`

## 30.2. AgentRun

- `id`
- `taskId`
- `agentType`
- `iteration`
- `inputArtifact`
- `outputArtifact`
- `inputTokens`
- `outputTokens`
- `duration`
- `status`
- `error`
- `createdAt`

## 30.3. ToolCall

- `id`
- `taskId`
- `agentRunId`
- `toolName`
- `arguments`
- `result`
- `duration`
- `status`
- `policyDecision`

## 30.4. Patch

- `id`
- `taskId`
- `iteration`
- `diffPath`
- `applied`
- `validationResult`
- `createdAt`

## 30.5. CommandRun

- `id`
- `taskId`
- `iteration`
- `commandType`
- `command`
- `exitCode`
- `stdoutPath`
- `stderrPath`
- `duration`
- `timedOut`

## 30.6. ReviewResult

- `id`
- `taskId`
- `iteration`
- `decision`
- `criticalIssues`
- `warnings`
- `outOfScopeChanges`
- `securityRisks`

## 30.7. Experiment

- `id`
- `name`
- `configuration`
- `taskSet`
- `workflows`
- `runsPerTask`
- `createdAt`
- `completedAt`

---

## 31. Yêu cầu chức năng

### FR-01

Hệ thống cho phép khởi tạo task từ CLI.

### FR-02

Hệ thống đọc issue từ text hoặc file.

### FR-03

Hệ thống kiểm tra repository và base commit.

### FR-04

Hệ thống tạo worktree cô lập.

### FR-05

Hệ thống phân tích repository.

### FR-06

Hệ thống hỗ trợ Single-Agent.

### FR-07

Hệ thống hỗ trợ Multi-Agent.

### FR-08

Hệ thống sinh và áp dụng patch.

### FR-09

Hệ thống chạy build, lint và test.

### FR-10

Hệ thống review diff.

### FR-11

Hệ thống hỗ trợ vòng lặp sửa.

### FR-12

Hệ thống giới hạn token, thời gian và vòng lặp.

### FR-13

Hệ thống lưu event log.

### FR-14

Hệ thống lưu artifact.

### FR-15

Hệ thống xuất báo cáo.

### FR-16

Hệ thống chạy benchmark hàng loạt.

### FR-17

Hệ thống hỗ trợ resume.

### FR-18

Hệ thống cho phép người dùng phê duyệt ở chế độ tương tác.

---

## 32. Yêu cầu phi chức năng

### NFR-01: An toàn

Agent không được truy cập tài nguyên ngoài policy.

### NFR-02: Tái lập

Mỗi run phải lưu đủ cấu hình để chạy lại.

### NFR-03: Quan sát được

Mọi agent call và tool call phải có log.

### NFR-04: Cô lập

Mỗi task chạy trong worktree và sandbox riêng.

### NFR-05: Khả năng phục hồi

Task có thể resume từ checkpoint hợp lệ.

### NFR-06: Tính mở rộng

Có thể thêm agent, tool hoặc model provider.

### NFR-07: Hiệu năng

Không gửi toàn bộ repository vào model nếu không cần.

### NFR-08: Tính kiểm thử

Core logic, policy và state transition phải có unit test.

### NFR-09: Tính nhất quán

Agent output phải validate bằng schema.

### NFR-10: Khả năng giải thích

Báo cáo phải thể hiện quyết định, tool result và stop reason.

---

## 33. Phần bắt buộc và phần mở rộng

## 33.1. Phần bắt buộc

- CLI.
- Đọc repository và issue.
- Git worktree.
- Tool Gateway.
- Docker sandbox.
- Single-Agent baseline.
- Planning Agent.
- Developer Agent.
- Testing Agent.
- Reviewer Agent.
- State machine.
- Sinh và áp dụng patch.
- Build/lint/test thực tế.
- Vòng lặp sửa.
- Event log.
- Artifact storage.
- Metrics.
- Experiment runner.
- Mini-benchmark.
- So sánh định lượng.
- Báo cáo Markdown/JSON.

## 33.2. Phần mở rộng

- Human-in-the-loop nâng cao.
- Tự chọn workflow theo độ khó.
- Semantic code search.
- Tree-sitter.
- Dependency graph.
- Reviewer dùng model khác.
- Parallel agents.
- Dynamic agent creation.
- Tự động tạo pull request.
- Comment review từng dòng.
- Web dashboard đọc artifact.
- Mutation testing.
- SonarQube.
- Hỗ trợ nhiều ngôn ngữ.
- Hỗ trợ nhiều repository.
- Remote worker.
- Queue phân tán.
- Long-term memory.

---

## 34. Rủi ro và giải pháp

## 34.1. Chi phí API cao

Giải pháp:

- Giới hạn token.
- Giới hạn vòng lặp.
- Chọn benchmark nhỏ.
- Cache repository map.
- Cắt log.
- Chỉ gửi file liên quan.
- Dùng ít cấu hình ablation.

## 34.2. Agent làm hỏng repository

Giải pháp:

- Worktree.
- Sandbox.
- Không push.
- Không commit tự động.
- Reset sau run.
- Lưu patch.

## 34.3. Agent chạy command nguy hiểm

Giải pháp:

- Không cho shell tự do.
- Whitelist.
- Tool Gateway.
- Path guard.
- Timeout.
- Network disabled.

## 34.4. Planner hiểu sai

Giải pháp:

- Giữ issue gốc trong shared state.
- Testing Agent dựa vào acceptance criteria.
- Reviewer đọc issue gốc.
- Yêu cầu lý do cho file liên quan.
- Có plan approval trong chế độ tương tác.

## 34.5. Multi-Agent lặp vô hạn

Giải pháp:

- Max iteration.
- Budget.
- No-progress detection.
- Duplicate-error detection.
- Patch similarity detection.
- Stop reason.

## 34.6. Benchmark quá lớn

Giải pháp:

- 12–20 task.
- Ablation trên tập con.
- Giới hạn ba lần chạy.
- Chỉ chọn một stack.
- Tự động hóa setup.

## 34.7. Kết quả đánh giá chủ quan

Ưu tiên:

1. Hidden tests.
2. Regression tests.
3. Build và lint.
4. Static analysis.
5. Patch scope.
6. Rubric thủ công.
7. LLM-as-a-judge chỉ dùng bổ sung.

## 34.8. Nhiễm dữ liệu

Giải pháp:

- Tự xây benchmark.
- Tạo task mới.
- Sử dụng commit mới.
- Không dùng expected patch trong prompt.
- Không cho agent đọc hidden test.

## 34.9. Lỗi môi trường bị nhầm là lỗi agent

Giải pháp:

- Preflight test.
- Ghi infrastructure failure riêng.
- Không tính run lỗi setup vào task failure nếu do hạ tầng.
- Chuẩn hóa Docker image.

---

## 35. Kế hoạch triển khai

## Giai đoạn 1: Xác định phạm vi và benchmark

- Chốt repository.
- Chốt nhóm task.
- Chốt câu hỏi nghiên cứu.
- Thiết kế metadata task.
- Tạo task mẫu.
- Xây hidden tests.

## Giai đoạn 2: Xây CLI và cấu hình

- `init`.
- `run`.
- `status`.
- `inspect`.
- Cấu hình YAML.
- Validation.

## Giai đoạn 3: Xây repository và Git layer

- Kiểm tra repository.
- Worktree.
- Git status.
- Diff.
- Apply patch.
- Reset.
- Artifact.

## Giai đoạn 4: Xây sandbox và tool layer

- Docker image.
- Resource limit.
- Command whitelist.
- File tools.
- Search tools.
- Test runner.
- Logging.

## Giai đoạn 5: Xây Single-Agent baseline

- Model adapter.
- Prompt.
- Tool call.
- Patch.
- Test.
- Retry.
- Metrics.

## Giai đoạn 6: Xây Multi-Agent cơ bản

- Planning Agent.
- Developer Agent.
- Testing Agent.
- Shared state.
- Orchestrator.

## Giai đoạn 7: Bổ sung Reviewer và vòng lặp

- Reviewer Agent.
- Request changes.
- Stop conditions.
- No-progress detection.
- Checkpoint.

## Giai đoạn 8: Xây Experiment Runner

- Batch run.
- Reset.
- Multi-run.
- CSV/JSON.
- Resume.
- Summary.

## Giai đoạn 9: Thực nghiệm

- Chạy baseline.
- Chạy Multi-Agent.
- Chạy ablation.
- Thu số liệu.
- Xử lý lỗi hạ tầng.
- Kiểm tra tính hợp lệ.

## Giai đoạn 10: Phân tích và báo cáo

- Phân tích metrics.
- Trả lời RQ.
- So sánh chi phí.
- Nêu hạn chế.
- Chuẩn bị demo CLI.
- Chuẩn bị slide.

---

## 36. Mốc MVP

Một MVP được coi là hoàn thành khi:

1. Người dùng chạy được một lệnh CLI.
2. Hệ thống nhận repository và issue.
3. Hệ thống tạo worktree.
4. Agent đọc được file.
5. Agent tạo patch.
6. Hệ thống áp dụng patch.
7. Hệ thống chạy test.
8. Hệ thống lưu log.
9. Hệ thống xuất final patch.
10. Có thể chạy cùng task bằng Single-Agent và Multi-Agent.
11. Có metrics để so sánh.

Các tính năng như dashboard, semantic search và mutation testing không cần cho MVP.

---

## 37. Kịch bản demo bảo vệ

### Kịch bản 1: Task thành công ngay vòng đầu

- Chạy CLI.
- Hiển thị plan.
- Hiển thị patch.
- Chạy test.
- Reviewer approve.
- Xuất report.

### Kịch bản 2: Test thất bại và sửa lại

- Developer tạo patch sai.
- Test Runner phát hiện lỗi.
- Testing Agent phân tích.
- Developer sửa.
- Test pass.
- Reviewer approve.

### Kịch bản 3: Reviewer phát hiện thay đổi ngoài phạm vi

- Patch pass test.
- Reviewer phát hiện file không liên quan.
- Developer thu hẹp patch.
- Workflow hoàn thành.

### Kịch bản 4: So sánh Single-Agent và Multi-Agent

- Chạy cùng task.
- Hiển thị kết quả:
  - Success.
  - Token.
  - Time.
  - Iteration.
  - Patch size.
- Phân tích sự đánh đổi.

---

## 38. Kết quả kỳ vọng

Sau khi hoàn thành, hệ thống có thể:

- Hoạt động qua CLI.
- Nhận repository và issue.
- Phân tích codebase.
- Lập kế hoạch.
- Sửa code.
- Viết test.
- Chạy build, lint và test.
- Review patch.
- Sửa lại khi thất bại.
- Giới hạn token và thời gian.
- Chạy trong sandbox.
- Lưu toàn bộ lịch sử.
- Xuất patch và báo cáo.
- Chạy benchmark.
- So sánh Single-Agent và Multi-Agent.

Về nghiên cứu, đồ án kỳ vọng trả lời:

- Multi-Agent có tốt hơn Single-Agent hay không.
- Tốt hơn với loại task nào.
- Testing Agent đóng góp bao nhiêu.
- Reviewer Agent đóng góp bao nhiêu.
- Chi phí tăng bao nhiêu.
- Multi-Agent có hội tụ ổn định không.
- Số vòng lặp hợp lý là bao nhiêu.
- Task đơn giản có cần Multi-Agent không.

Một kết quả hợp lệ có thể là:

- Multi-Agent tốt hơn rõ rệt với task trung bình và khó.
- Single-Agent hiệu quả hơn với task dễ.
- Testing Agent giảm regression.
- Reviewer Agent giảm thay đổi ngoài phạm vi.
- Multi-Agent tăng đáng kể token và thời gian.
- Planner không cần thiết với một số task nhỏ.
- Vòng lặp thứ hai cải thiện nhiều, nhưng các vòng sau ít hiệu quả.
- Multi-Agent không phải lúc nào cũng tối ưu.

---

## 39. Đóng góp dự kiến

1. Đề xuất kiến trúc coding agent Multi-Agent theo hướng CLI-first.
2. Xây dựng cơ chế phối hợp Planner, Developer, Tester và Reviewer.
3. Xây dựng Tool Gateway kiểm soát công cụ.
4. Xây dựng sandbox thực thi an toàn.
5. Xây dựng state machine có budget và stop conditions.
6. Xây dựng artifact-first logging.
7. Xây dựng mini-benchmark backend TypeScript/NestJS.
8. So sánh định lượng Single-Agent và Multi-Agent.
9. Phân tích chất lượng, chi phí và thời gian.
10. Xác định loại task phù hợp với Multi-Agent.
11. Đánh giá ảnh hưởng của Testing Agent và Reviewer Agent.
12. Cung cấp một CLI có thể dùng để demo và chạy thực nghiệm.

---

## 40. Cấu trúc báo cáo đồ án

## Chương 1: Giới thiệu

- Bối cảnh.
- Vấn đề.
- Động cơ.
- Mục tiêu.
- Phạm vi.
- Câu hỏi nghiên cứu.
- Đóng góp.

## Chương 2: Cơ sở lý thuyết

- LLM.
- LLM Agent.
- Tool use.
- Multi-Agent System.
- Prompt engineering.
- Code generation.
- Software testing.
- Static analysis.
- Sandbox.
- Git worktree.

## Chương 3: Nghiên cứu liên quan

- Coding agents.
- Multi-Agent cho software engineering.
- SWE-agent.
- AgentCoder.
- MetaGPT.
- ChatDev.
- SWE-bench.
- Phương pháp đánh giá coding agent.

## Chương 4: Phân tích yêu cầu

- Bài toán.
- Actor.
- Use case.
- Functional requirements.
- Non-functional requirements.
- Threat model.
- Giới hạn phạm vi.

## Chương 5: Thiết kế hệ thống

- Kiến trúc tổng thể.
- CLI.
- Orchestrator.
- State machine.
- Agent.
- Tool Gateway.
- Sandbox.
- Git integration.
- State Store.
- Artifact Store.
- Data schema.
- Command policy.

## Chương 6: Cài đặt

- Công nghệ.
- CLI commands.
- Model adapter.
- Agent implementation.
- Tool implementation.
- Docker sandbox.
- Logging.
- Experiment runner.

## Chương 7: Thiết kế thực nghiệm

- Benchmark.
- Task.
- Baseline.
- Cấu hình Multi-Agent.
- Hidden tests.
- Chỉ số.
- Điều kiện công bằng.
- Quy trình chạy.

## Chương 8: Kết quả và thảo luận

- Task success.
- Hidden tests.
- Regression.
- Token.
- Time.
- Patch quality.
- Ablation.
- Kết quả theo độ khó.
- Trả lời RQ.
- Hạn chế.

## Chương 9: Kết luận

- Kết quả đạt được.
- Đóng góp.
- Hạn chế.
- Hướng phát triển.

---

## 41. Tiêu chí nghiệm thu hệ thống

### Tiêu chí chức năng

- CLI chạy được.
- Nhận được issue.
- Đọc được repository.
- Tạo được patch.
- Chạy được test.
- Có vòng lặp.
- Có review.
- Có report.
- Có experiment.

### Tiêu chí an toàn

- Agent không truy cập host filesystem ngoài worktree.
- Không chạy command ngoài whitelist.
- Có timeout.
- Có resource limit.
- Không đọc hidden tests.
- Không push remote.

### Tiêu chí nghiên cứu

- Có Single-Agent baseline.
- Có Multi-Agent.
- Có benchmark.
- Có tối thiểu hai cấu hình so sánh.
- Có số liệu định lượng.
- Có nhiều lần chạy.
- Có phân tích chi phí.
- Có trả lời câu hỏi nghiên cứu.

---

## 42. Hạn chế dự kiến

- Chỉ hỗ trợ một stack backend.
- Benchmark quy mô nhỏ.
- Kết quả phụ thuộc model.
- Chi phí API.
- Khó đánh giá chất lượng code hoàn toàn tự động.
- Hidden tests không bao phủ mọi hành vi.
- Một số task cần kiến thức domain.
- Sandbox có thể khác môi trường thực.
- Kết quả LLM không xác định.
- Multi-Agent có thể tăng độ phức tạp mà không tăng chất lượng.
- Không khẳng định kết quả áp dụng cho mọi ngôn ngữ hoặc repository.

---

## 43. Hướng phát triển

- Hỗ trợ nhiều ngôn ngữ.
- Hỗ trợ semantic code search.
- Hỗ trợ dependency graph.
- Tự động phân loại độ khó.
- Tự chọn Single-Agent hoặc Multi-Agent.
- Agent chạy song song.
- Reviewer chuyên biệt về security.
- Reviewer chuyên biệt về database.
- Tích hợp pull request.
- Tích hợp CI.
- Web dashboard đọc artifact.
- Remote execution.
- Long-term project memory.
- Adaptive token allocation.
- Học policy routing từ kết quả cũ.
- Human feedback.
- Benchmark lớn hơn.

---

## 44. Kết luận chung

Đề tài có tính thực tế, tính thời sự và đủ chiều sâu để làm đồ án tốt nghiệp nếu phạm vi được kiểm soát.

Phiên bản phù hợp nhất không nên là một hệ thống web lớn. Sản phẩm chính nên là một **coding agent Multi-Agent hoạt động qua CLI**, có khả năng thao tác với repository thông qua lớp công cụ được kiểm soát và chạy command trong sandbox.

Trọng tâm triển khai gồm:

- CLI.
- Orchestrator.
- Agent.
- Tool Gateway.
- Git worktree.
- Docker sandbox.
- Test Runner.
- Artifact logging.
- Experiment Runner.

Trọng tâm nghiên cứu gồm:

- So sánh Single-Agent và Multi-Agent.
- Đánh giá chất lượng patch.
- Đánh giá hidden tests và regression.
- Đánh giá token và thời gian.
- Phân tích ảnh hưởng của từng agent.
- Xác định trường hợp Multi-Agent thực sự có lợi.

Điểm quan trọng nhất của đề tài không phải là số lượng agent, mà là:

> Thiết kế một cơ chế phối hợp có thể kiểm soát, quan sát và đánh giá; sau đó chứng minh bằng thực nghiệm liệu sự phối hợp đó có cải thiện hiệu quả xử lý issue phần mềm hay không.

Với phạm vi một stack backend, một CLI, một sandbox, một benchmark nhỏ và ba cấu hình so sánh, đề tài có tính khả thi cao và có thể tạo ra cả sản phẩm demo lẫn kết quả nghiên cứu định lượng có ý nghĩa.
