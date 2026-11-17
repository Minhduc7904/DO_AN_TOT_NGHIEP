# ADR-006 — Thu gọn phạm vi sau refactor và đóng băng LMS

| Trường            | Nội dung                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trạng thái        | Chấp nhận (Bách quyết định trong giai đoạn bắt kịp tiến độ; thông báo Đức khi repo ổn định tới phase RCA)                                                                                                                                                            |
| Ngày              | 17/11/2026 (tuần 16)                                                                                                                                                                                                                                                 |
| Người đề xuất     | Bách                                                                                                                                                                                                                                                                 |
| Thay thế một phần | Quyết định 1, 2, 3 của [ADR-002](adr-002-ai-primary-root-cause-analysis-v1.md); phân tầng MCP/agent, đối chứng thủ công và ranker trong [project-scope-v2](../direction/project-scope-v2.md); task R-18 trong [bảng refactor](../plan/refactor/refactor-board-v1.md) |

## Bối cảnh

Đến tuần 16, refactor (R-01 đến R-18) đã dựng lại LMS thành 7 service + 4 worker, nhưng phần AI/RCA chưa có dòng code nào: chưa có fault injector, workload k6, dataset, RCA engine. Theo [plan-v0.2](../plan/plan-v0.2-24-weeks.md), tuần 16 lẽ ra đã có dynamic graph và RCA baseline; M4 (pipeline một lệnh) là cuối tuần 19.

Trong lúc đó phạm vi lại tăng theo hai hướng:

- **LMS thêm tính năng không tạo đường lan lỗi mới.** Ví dụ R-18 (URL ký có hạn cho media) là tính năng bảo mật, làm dở ở slice 1 và đang làm ảnh trong markdown bài học, quiz, thông báo trả `404` vì `course`/`notification` chưa dựng URL ký.
- **Tài liệu v2 thêm hạng mục nghiên cứu mới vào MVP:** MCP server và agent, ranker học có giám sát, thử nghiệm người thật, bảy case phức tạp, nhiều tầng manifest/provenance. Trong khi đó chỉ C6 đã chạy thật.

Rà soát thiết kế cho thấy thêm ba điểm:

1. Tên đề tài đã đăng ký là "phát hiện bất thường và **hỗ trợ** phân tích nguyên nhân sự cố" ([mô tả đề tài](../description/Mo_ta_de_tai_DATN_260811_125322_day_du.md), dòng 11). ADR-002 đổi thành "AI là bên truy vết chính, kết luận không cần người", lệch với đề tài đăng ký và khó chứng minh hơn.
2. Phương pháp lõi trong [blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md) vẫn là detector không giám sát và điểm xếp hạng tuyến tính có trọng số (giữ nguyên trọng số của bản trước). [evaluation-protocol-v1 mục 5.3](../architecture/evaluation-protocol-v1.md) cấm dùng fault run làm dữ liệu huấn luyện. Vì vậy câu "phần chính là huấn luyện mô hình" của ADR-002 không khớp với chính thiết kế.
3. Baseline `base-manual-auto` được định nghĩa là "không thấy nguyên nhân nằm ngoài đường request" (blueprint-v1 mục 12.6). So với một baseline bị cố ý giới hạn đúng ở điểm mà case được chọn để khai thác là phép so sánh tự chứng minh, hội đồng dễ bác bỏ. Thực tế trace đã nối xuyên RabbitMQ (catalogue mục 4.2), nên ở C3–C6 span lỗi của nguyên nhân nằm ngay trong trace.

## Quyết định

### 1. Đóng băng LMS (System Under Test)

1. Không thêm nghiệp vụ hoặc tính năng sản phẩm mới. Chỉ nhận thay đổi phục vụ trực tiếp telemetry, fault hoặc workload, ví dụ: metric pool PostgreSQL, metric outbox backlog, root span cho mỗi lần chạy của `scheduler-worker`, LLM stub chỉnh được độ trễ/lỗi, điểm chèn fault (proxy trước dependency), sửa lỗi chặn regression.
2. **Hủy R-18 và revert slice 1** (commit `a1ea944`). Media quay lại cơ chế đọc nội dung bằng UUID khó đoán (header `Cache-Control: public, max-age=300` như trước R-18; bản đầu ADR này ghi nhầm `no-store`, đính chính ngày 17/11/2026), đã được chấp nhận ở R-12. Giới hạn này ghi trong [http-and-event-contracts-v2](../architecture/http-and-event-contracts-v2.md) §1.1.
3. Giữ nguyên các phần đã xong, có test và không cản trở nghiên cứu dù ít giá trị cho RCA: ba cửa đăng nhập, CRUD provider/model/binding của `ai`, avatar và tự nhận MIME (PR #71), tách chi tiết khóa học (PR #70), giao diện terminal của seeder, export CSV. Gỡ ra tốn công và rủi ro hơn giữ. Báo cáo đồ án không cần mô tả các phần này.

### 2. Vai trò của RCA engine

1. Giữ cách nói của đề tài đã đăng ký: RCA engine **tự động** phát hiện incident và tạo **xếp hạng ứng viên nguyên nhân kèm bằng chứng** để **hỗ trợ** người vận hành. RCA engine vẫn là phần chính của đề tài; bỏ yêu cầu "kết luận không cần người can thiệp" và cách nói "AI là bên truy vết chính".
2. Mô tả đúng phần học máy: detector không giám sát fit trên run khỏe (Isolation Forest, thống kê robust), trọng số và ngưỡng hiệu chỉnh trên validation. Không gọi đây là "huấn luyện mô hình có giám sát".
3. **Ranker học có giám sát** ("Hướng 2", blueprint-v1 mục 12.4) chuyển xuống **Stretch**. Proposed ranker của MVP là "Hướng 1".

### 3. Đối chứng với truy vết thủ công (RQ6)

1. RQ6 vẫn thuộc MVP, nhưng giá trị của RCA engine được chứng minh bằng **chi phí và độ ổn định của chẩn đoán**, không bằng lập luận "người không tìm ra":
   - độ chính xác Top-K của engine so với baseline thủ công trên cùng run;
   - thời gian từ lúc incident được khai báo tới khi có kết luận đúng;
   - số artifact (trace, panel, truy vấn log) baseline thủ công phải mở;
   - kết quả khi có nhiều triệu chứng đồng thời và nhiễu nền từ workload.
2. **Định nghĩa lại `base-manual-auto`** mô phỏng cách một SRE làm thật, không bị cấm nhìn ra ngoài đường request: từ triệu chứng, lấy các trace lỗi/chậm nhất trong cửa sổ incident, đi theo span CLIENT lỗi hoặc chậm sâu nhất và kết luận service sở hữu span đó. Nếu trace dẫn sang service khác qua cạnh async/auth thì baseline được đi theo.
3. **Thử nghiệm người thật** chuyển xuống **Target**: 2–3 người, chỉ để minh họa định tính, làm sau khi campaign đã freeze; không phải tiêu chí hoàn thành.

### 4. Bộ case MVP

| Mức    | Case                      | Lý do                                                                                     |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| MVP    | C2 (viết lại), C3, C4, C6 | Bốn `root_cause_service` khác nhau (`course`, `ai`, `media`, `identity`); C6 đã chạy thật |
| Target | C1, C5, C7                | C1 là giả thuyết (mỗi worker có queue riêng); C5 và C7 cùng dồn về `identity` như C6      |

- **C2 viết lại:** cơ chế FC "export CSV giữ kết nối DB" không khớp code, vì export đọc từng khối 500 dòng để không giữ truy vấn dài (`lms/services/course/src/application/use-cases/courses/export-courses-csv.use-case.ts`, dòng 14–16). Thay bằng chèn trễ có kiểm soát trên kết nối `course` → `course-postgres` (proxy đặt trước dependency), `fault_type=dependency_latency`, `root_cause_service=course`, `root_cause_component=course-postgres`. C2 đóng vai **case đối chứng dễ**: baseline thủ công được kỳ vọng tìm ra, để phép so sánh trung thực.
- **Số lần lặp:** đề xuất `R = 5` mỗi case MVP (1 run validation, 4 run final test), tức 20 fault run, thay cho đề xuất 7 × 3 của evaluation-protocol-v1. Ít case nhưng nhiều lần lặp để báo cáo được khoảng dao động theo case.
- Một case Target chỉ vào tập đánh giá khi chuỗi nhân quả đã chạy thật, theo quy tắc sẵn có của project-scope-v2 mục 3.4.

### 5. Ngoài phạm vi

- **MCP server và agent LLM** (`aiops-platform/mcp/`, `aiops-platform/agent/`) chuyển từ "thứ yếu" sang **Out-of-scope**; chỉ nhắc như hướng phát triển. Schema `RcaIncidentResult` vẫn giữ vì là output của RCA engine; phần "nơi lưu cho MCP đọc" không còn là yêu cầu.
- Ablation tách theo từng loại cạnh (sync/async/auth/shared) và cạnh shared-resource chuyển xuống Target; cạnh shared-resource chỉ cần khi C1 chạy được. MVP giữ ablation có/không graph và có/không temporal như bản gốc.
- Manifest và provenance chỉ giữ các trường bắt buộc của `RunGroundTruth`; các tầng manifest khác làm khi còn thời gian.

## Hệ quả

- `media`: bỏ `MEDIA_URL_SIGNING_KEY`, `MEDIA_URL_TTL_SECONDS`, contract tầng truy cập, mã lỗi `MEDIA_URL_INVALID`; regression `media-upload` và Postman quay về bản trước R-18. Ảnh markdown của bài học, quiz, thông báo đọc được trở lại.
- Các tài liệu project-scope-v2, ADR-002, blueprint-v1, evaluation-protocol-v1, research-questions-and-metrics-v2, complex-case-catalogue, data-ownership-and-fault-matrix-v2, service-catalogue-and-topology-v2, khung định hướng v1 và `aiops-platform/README.md` có ghi chú cập nhật trỏ về ADR này. Những đoạn chi tiết chưa sửa từng dòng thì ADR này được ưu tiên khi mâu thuẫn.
- Phạm vi MVP còn lại: fault injector cho 4 case, workload k6, runner dataset, RCA engine (Hướng 1 và các baseline), `base-manual-auto` mới, đánh giá RQ1–RQ6.

## Việc tiếp theo (không thuộc quyết định này)

- Chốt người làm fault injector và k6: [implementation-backlog-v1](../plan/implementation-backlog-v1.md) giao cho Đức, tài liệu refactor ghi "mảng AI".
- Thiết kế workload theo hành vi người dùng (vai trò, chuỗi bước trong phiên, thời gian nghỉ, phân bố truy cập theo giờ) để trả lời góp ý giữa kỳ của giáo viên hướng dẫn: đã thiết kế ở [workload-design-v1](../architecture/workload-design-v1.md) (PR #78); sau nghiên cứu ngày 17/11/2026 được nâng thành workload bán thực (mức 2+) và bộ bằng chứng E1–E8 ở [ADR-007](adr-007-semi-real-workload-and-ai-evidence-v1.md).
- Kế hoạch tuần 11–24: [plan-v0.3](../plan/plan-v0.3-24-weeks.md) (Gate R ở cuối tuần 12 là điều kiện để làm tiếp); từ tuần 14 theo [plan-v0.4](../plan/plan-v0.4-24-weeks.md).
- ~~Đóng hoặc phân loại lại issue #44 và #50 trên GitHub~~: đã đóng ngày 17/11/2026 (không còn áp dụng, code v1 đã bị xóa ở R-05), có comment phân loại từng mục.

## Phương án đã loại

- **Gỡ CRUD provider/model/binding của `ai` và gộp ba cửa đăng nhập:** giảm code nhưng phải sửa test, regression, Postman và seeder trong lúc tiến độ AI đang trễ; lợi ích cho nghiên cứu gần bằng không.
- **Làm nốt R-18 cho `course`/`notification`:** thêm endpoint nội bộ, scope và script chuyển markdown mà không tạo tín hiệu mới cho RCA.
- **Giữ bảy case với `R = 3`:** chỉ 2 run final test mỗi case; ba case cùng `identity` khiến xếp hạng hằng đã đạt Top-3 khoảng 71% (ADR-005). Lưu ý (đính chính 17/11/2026): bộ bốn case MVP cũng không hết bão hòa Top-3. Bốn `root_cause_service` khác nhau nên xếp hạng hằng vẫn đạt Top-3 = 75%, Top-1 = 25%. Lợi ích thật của bộ mới là nhiều run test mỗi case hơn; khi báo cáo, Top-1 và MRR là chỉ số chính và luôn kèm mốc xếp hạng hằng ([evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md) mục 18.4).
