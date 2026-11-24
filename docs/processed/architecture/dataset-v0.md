# Dataset v0

> **Task:** `task-04_collect-dataset-v0` (tuần 15).
>
> **Trạng thái:** cập nhật 24/11/2026. Đã chốt luật chia ngày, kế hoạch phiên của ba split, các slot run (khai báo trước khi chạy) và các quyết định từ pilot task-03. 10/10 slot train và validation đã có run đạt gate (mục 6); slot test chỉ khai báo, chờ freeze ở tuần 19.
>
> **Tài liệu liên quan:** [evaluation-protocol-v1](evaluation-protocol-v1.md) mục 5, 6.1, 8; [workload-design-v1](workload-design-v1.md) mục 11.4, 13.5. Manifest máy đọc được: [`aiops-platform/experiments/datasets/dataset-v0.json`](../../../aiops-platform/experiments/datasets/dataset-v0.json); kiểm tra: `aiops-platform/experiments/check-dataset.mjs`.

## 1. Mục đích và phạm vi

Dataset v0 là tập run đầu tiên dùng cho đánh giá:

- **train:** run healthy để fit chuẩn hóa và baseline (mục 9.1);
- **validation:** run healthy và fault run để chọn ngưỡng, window, persistence (mục 9.2).

Slot **test** chỉ được khai báo, chưa chạy. Danh sách test freeze ở tuần 19 (mục 6.3). Run pilot của task-02 và task-03 không thuộc dataset (mục 6.1).

## 2. Phiên Moodle theo split

Phiên học viên mức 2+ lấy từ **đoạn xây** của log Moodle (ngày 0–59). Hold-out (ngày 60–90) chỉ dùng cho kiểm chứng độ thực, không vào split nào (mục 5.4).

**Luật `day-split-v1`** (ghi trong code `DAY_SPLIT` trước khi sinh kế hoạch):

- Xếp 60 ngày theo số phiên giảm dần; bằng nhau thì ngày nhỏ trước.
- Chia kiểu rắn bò theo thứ tự test, validation, train, train, validation, test, … Mỗi split nhận 20 ngày.

**Lý do chọn luật này:**

- Số phiên tăng dần theo học kỳ: ngày 0–19 cao nhất 832 phiên, ngày 40 có 1.376. Cắt ba khối ngày liền nhau sẽ cho ba split có tải rất khác nhau. Chia phân tầng giữ phân bố tải ngày giống nhau giữa các split, nên khác biệt giữa split đến từ ngày được chọn, không từ giai đoạn của môn học.
- Ngày đông nhất (ngày 40) vào test, để E1 (báo động giả khi tải cao hợp lệ) được đo ở tải thật cao nhất. Train và validation thấy tải thấp hơn một chút: lệch về phía bất lợi cho phương pháp, không phải có lợi.

**Kế hoạch trong mỗi split:** `normal-mixed` lấy `k` = 4 ngày gần trung vị của split nhất; `healthy-spike` lấy 4 ngày đông nhất của split. Ngày, số phiên, sha256 và đỉnh tải của 6 kế hoạch nằm ở [load/README](../../../aiops-platform/load/README.md#kế-hoạch-phiên-theo-split-cho-dataset) và trong manifest.

**Ngoại lệ về mức tải:** kế hoạch validation `normal-mixed` có đỉnh 2,43 phiên/s, vượt giới hạn 0,35 × `λ_knee` = 1,96 của workload-design-v1 mục 8.4.

- Nguyên nhân: ngày 6 và ngày 13 cùng thứ trong tuần, cùng có một đợt đăng nhập dồn khoảng 12:00. Chồng hai ngày làm hai đợt trùng giờ.
- Kế hoạch được giữ, không đổi luật chọn ngày sau khi xem kết quả. `λ_knee` ≥ 5,6 là cận dưới (task-02), và đỉnh chỉ kéo dài một ô 60 s.
- Điều kiện kèm theo: run healthy validation `normal-mixed` phải đạt tiêu chí "khỏe" mục 8.4. Nếu trượt, hạ `k` của kế hoạch này và ghi lại ở đây.
- **Kết quả (23/11/2026):** run `validation-healthy-normal-mixed-s2002-20261123t091816z` đạt mọi tiêu chí: p95 Gateway lớn nhất theo cửa sổ 60 s là 0,091 s, phản hồi ngoài mong đợi 0,16%, phiên bỏ ngang 0,47%, 0 iteration bị bỏ, không container nào vượt ngưỡng CPU/bộ nhớ. Kế hoạch giữ nguyên `k` = 4.

## 3. Seed và dữ liệu seed

| Nhóm | Khoảng `workload_seed` | Quy tắc |
| --- | --- | --- |
| train | 1000–1999 | Mỗi run healthy một seed |
| validation | 2000–2999 | Fault run các case cùng `repeat_index` dùng **cùng** seed; run healthy mỗi run một seed |
| test | 3000–3999 | Như validation |

- **Quy tắc seed cho fault run** (workload-design-v1 mục 11.4, trước đây là đề xuất, chốt ở task này): fault run của các case khác nhau cùng `repeat_index` dùng cùng `workload_seed`. Nhờ vậy khác biệt giữa các case đến từ fault, không từ workload.
- **Run thay thế** (evaluation-protocol-v1 mục 8.6) giữ nguyên cấu hình của slot, kể cả `workload_seed`, và ghi `replacement_for_run_id`. Giữ seed là điều kiện để quy tắc seed của fault run vẫn đúng. `check-dataset.mjs` kiểm seed của run được chọn và của run bị thay đều khớp seed của slot.
  - *Sửa ngày 24/11/2026:* bản khai báo trước khi chạy (mục này, `seed_rule` của manifest, workload-design-v1 mục 11.4) ghi "run thay thế dùng seed mới", trái mục 8.6. Run thay thế duy nhất của dataset v0 đã chạy cùng seed (mục 6.2), nên việc sửa chỉ đưa tài liệu về đúng mục 8.6, không đổi run nào.
- Dữ liệu seed R-10: `small`/42 cho mọi run (mục 5.5).

## 4. Slot run

| Split | Run | Profile | Seed |
| --- | --- | --- | --- |
| train | 2 run healthy | `normal-mixed` | 1001, 1002 |
| train | 2 run healthy | `healthy-spike` | 1003, 1004 |
| validation | 1 run healthy | `normal-mixed` | 2002 |
| validation | 1 run healthy | `healthy-spike` | 2003 |
| validation | fault C2, C3, C4, C6, `repeat_index` 1 | `normal-mixed` | 2001 |
| test (chỉ khai báo) | fault C2, C3, C4, C6, `repeat_index` 2–5 | `normal-mixed` | 3001–3004 (theo lần lặp) |
| test (chỉ khai báo) | 1 run healthy mỗi profile | hai profile | 3005, 3006 |

- **Train có hai run mỗi profile**, thay vì mức tối thiểu một run. Một run chỉ có một seed nên không thấy được dao động của baseline theo workload.
- Tổng số run cần chạy cho v0: 10, khoảng 13 giờ máy.

**Đã chốt sau pilot task-03** ([fault-pilot-report-v1](fault-pilot-report-v1.md)):

- **Fault manifest v2** (`aiops-platform/faults/manifests/fault-manifest-v2.json`): cường độ như v1, C3 fault 900 s, các case khác như v1. Spec fault run ghim manifest này.
- **Slot validation trùng cao điểm:** `validation-c2-normal-mixed-r1` (`align_peak: true`). C2 là case nhạy với tải nhất (ở cao điểm có thể cạn pool của `course`), nên validation có tổ hợp fault cùng tải cao hợp lệ để chỉnh ngưỡng. C3, C4, C6 theo lịch mặc định, đúng điều kiện đã đo khi freeze thời lượng (với 900 s, align-peak của C3 chỉ đặt được tới giây 1380).
- **Không thêm profile healthy đối chứng** (`upload media peak healthy`, `AI job healthy`): run healthy `normal-mixed` đã có job AI và upload media trong đúng các cửa sổ fault, và bộ đo triệu chứng không vượt ngưỡng trên các cửa sổ đó (báo cáo pilot mục 6).

Số run healthy test và slot cao điểm của test chốt khi freeze (tuần 19).

## 5. Kiểm tra tự động

`check-dataset.mjs` đối chiếu manifest với ledger và file kế hoạch (bảng ở [experiments/README](../../../aiops-platform/experiments/README.md#dataset-manifest-dataset-manifestv0)):

- không trùng ngày log, seed, `run_id` giữa các split;
- kế hoạch đúng sha256; run đã chạy đúng kế hoạch của split;
- run đạt gate thực thi, `RunGroundTruth` hợp lệ, chất lượng `pass` hoặc `partial`;
- chuỗi run thay thế khớp ledger;
- test chưa chạy.

`--require-complete` thêm kiểm độ phủ tối thiểu theo DoD của task.

## 6. Kết quả

Hàng đợi chạy từ 23/11/2026 09:14Z đến 24/11/2026 01:48Z trên một máy, mỗi lúc một run. Hàng đợi nghỉ từ 14:04Z đến 18:29Z ngày 23/11 để đổi ngân sách trace, gộp task-03 và chạy Gate M3 (task-08). Script hàng đợi (không commit) chờ RAM trống ≥ 4.300 MB trước mỗi run, cao hơn mặc định 4.000 MB của runner (`--min-available-mb`).

Mọi run giữ slot chạy trên commit sạch (`code_dirty` = false): `ec98a55` và `dbb9ae1` cho bốn run giữ slot đầu tiên, `9daed76` cho sáu run sau. Ngoài tài liệu, ba commit này khác nhau ở:

- ngân sách export trace (mục 6.1);
- phần kiểm eligibility của `check-dataset.mjs` (chạy sau run);
- spec `train-healthy-healthy-spike-1-r2.json`;
- một chuỗi mô tả trong `fault-manifest-v2.json`.

Ngoài ngân sách trace, workload, cấu hình fault và cách thu telemetry không đổi.

**10/10 slot train và validation có run đạt** gate thực thi `pass`, `RunGroundTruth` `valid`, chất lượng `partial`. `check-dataset.mjs --require-complete` không báo lỗi, cảnh báo hay phần còn thiếu nào. Lý do `partial`:

- Mọi run có `truncated_modality:traces`: truy vấn tìm kiếm của Tempo chạm giới hạn kết quả. Riêng run validation `healthy-spike` còn bỏ trace vì ngân sách (mục 6.1).
- C6 có thêm `telemetry_silent:identity`. Khoảng im lặng (21:56:36,737–22:01:41,737Z) bắt đầu sớm hơn `fault_start` 0,04 s và kết thúc muộn hơn `fault_end` 4,96 s. Nó nằm trong cửa sổ fault cộng biên −5 s/+30 s của `eligibility.v1`.
- Run validation `normal-mixed` có thêm `duplicates`: 1/26.297 dòng log trùng, metric và span không trùng.

Cả ba lý do đều thuộc loại được nhận ở evaluation-protocol-v1 mục 6.1.1 bảng F. Mục này nằm ở PR task-06; xem thứ tự merge ở card task-04.

| Slot | `run_id` | Gate thực thi / chất lượng / ground truth | Tiêu chí khỏe | Trace (eligibility.v1) | Độ phủ ứng viên | `dropped_by_budget` |
| --- | --- | --- | --- | --- | --- | --- |
| `train-healthy-normal-mixed-1` | `train-healthy-normal-mixed-s1001-20261123t102740z` | `pass` / `partial` / `valid` | đạt | đủ | 0,992 | 0 |
| `train-healthy-normal-mixed-2` | `train-healthy-normal-mixed-s1002-20261123t113109z` | `pass` / `partial` / `valid` | đạt | đủ | 0,991 | 0 |
| `train-healthy-healthy-spike-1` | `train-healthy-healthy-spike-s1003-20261123t224223z` | `pass` / `partial` / `valid` | đạt | đủ | 0,995 | 0 |
| `train-healthy-healthy-spike-2` | `train-healthy-healthy-spike-s1004-20261124t002521z` | `pass` / `partial` / `valid` | đạt | đủ | 0,996 | 0 |
| `validation-healthy-normal-mixed-1` | `validation-healthy-normal-mixed-s2002-20261123t091816z` | `pass` / `partial` / `valid` | đạt | đủ | 0,991 | 0 |
| `validation-healthy-healthy-spike-1` | `validation-healthy-healthy-spike-s2003-20261123t123352z` | `pass` / `partial` / `valid` | đạt | mẫu, giữ 52,5% | 0,995 | 18.099 |
| `validation-c2-normal-mixed-r1` | `validation-c2-normal-mixed-s2001-20261123t182901z` | `pass` / `partial` / `valid` | — | đủ | 0,989 | 0 |
| `validation-c3-normal-mixed-r1` | `validation-c3-normal-mixed-s2001-20261123t193231z` | `pass` / `partial` / `valid` | — | đủ | 0,989 | 0 |
| `validation-c4-normal-mixed-r1` | `validation-c4-normal-mixed-s2001-20261123t203506z` | `pass` / `partial` / `valid` | — | đủ | 0,990 | 0 |
| `validation-c6-normal-mixed-r1` | `validation-c6-normal-mixed-s2001-20261123t213759z` | `pass` / `partial` / `valid` | — | đủ | 0,992 | 0 |

- **Tiêu chí khỏe** (workload-design-v1 mục 8.4) chỉ áp cho run healthy. Fault run được kiểm bằng gate và `RunGroundTruth`. Fault run validation của dataset không qua Gate M3. Gate M3 (task-08, PR #96) chỉ chạy lại bốn fault run pilot và đối chiếu dữ liệu thô của chúng.
- **Trace:** 9/10 run giữ đủ trace. Run validation `healthy-spike` là mẫu đều, giữ 52,5% (mục 6.1). Độ phủ ứng viên ở mọi run từ 0,989 đến 0,996, trên mức tối thiểu 0,98.
- **Fault run validation:** C2 trùng cao điểm, fault bắt đầu ở giây 1.260,0 sau `run_start`. C3, C4, C6 theo lịch mặc định. Gate thực thi xác nhận lệnh bật/tắt fault thành công, và `RunGroundTruth` xác nhận có triệu chứng tối thiểu (`verification_checks`).

### 6.1. Ngân sách export trace (23/11/2026)

- Run `validation-healthy-healthy-spike-s2003-20261123t123352z` (export với ngân sách mặc định 20.000 trace) có 56.701 trace ứng viên, 18.602 trace nhiễu, 38.099 trace còn lại; export giữ 20.000 (mẫu đều theo thời gian, `_evenly_spaced`) và bỏ 18.099 (`dropped_by_budget`), giữ 52,5%. Không lỗi tải (`fetch_errors`, `not_found`, `parse_errors` = 0), không `aborted`.
- **Độ phủ ứng viên** (trace ứng viên không nhiễu ÷ request k6 trong cửa sổ) của mọi run pilot `normal-mixed` và dataset v0 tới thời điểm này (trước các fault run validation) là 0,990–0,996, kể cả run trên (0,995). 16 lần chạm giới hạn kết quả tìm kiếm của Tempo lặp lại ở mọi run, không theo tải, và không làm mất trace đáng kể; nguồn mất trace duy nhất là ngân sách. Run pilot `c2-spike` (fault cộng đỉnh tải) là ngoại lệ: 0,687, 291 lần chạm giới hạn.
- Quyết định: nâng ngân sách mặc định lên 60.000 (commit `ebbae7f`) để run còn lại có `dropped_by_budget` = 0. Run `train-healthy-healthy-spike-s1003-20261123t134927z` đang chạy với ngân sách cũ được ngắt có chủ đích lúc 14:04Z (`aborted`, giữ trong ledger) và chạy lại bằng spec `train-healthy-healthy-spike-1-r2.json` (cùng seed, `replacement_for_run_id`).
- **Lệch khỏi câu chữ của evaluation-protocol-v1 mục 8.6.** Mục 8.6 chỉ cho rerun khi gate khai báo trước bị fail. Gate của run này fail (`aborted`, `k6_exit_105`) là do người vận hành chủ động ngắt; nếu chạy hết, run có lẽ đã đạt gate như s2003, chỉ là trace bị lấy mẫu. Lý do ngắt:
  - đây là thay đổi hạ tầng đã version hóa (`ebbae7f`), đúng ngoại lệ "sửa infrastructure bug đã được version hóa" của mục 8.6;
  - quyết định đưa ra lúc 14:04Z, trước khi run có export, quality report hay kết quả mô hình nào;
  - run thay thế giữ nguyên workload và seed.
- Run s2003 không export lại được với ngân sách 60.000: bước reset của run kế tiếp (`docker compose down --volumes` lúc 13:49:27Z) đã xóa dữ liệu Tempo trước khi có quyết định nâng ngân sách.
- Run s2003 đã đạt gate thực thi và chất lượng (`partial`), nên theo mục 8.6 không được thay; nó giữ slot validation `healthy-spike` với trace là mẫu 52,5%. Cách nhận run này cho primary evaluation và giới hạn đi kèm ở [evaluation-protocol-v1](evaluation-protocol-v1.md) mục 6.1.1 bảng F (task-06).

### 6.2. Run không giữ slot

Theo evaluation-protocol-v1 mục 8.6 và experiments/README, run bị lỗi không bị xóa mà giữ nguyên trong ledger và thư mục run.

| `run_id` | Kết quả | Nguyên nhân | Xử lý |
| --- | --- | --- | --- |
| `validation-healthy-normal-mixed-s2002-20261123t091430z`, `train-healthy-normal-mixed-s1001-20261123t091511z`, `train-healthy-normal-mixed-s1002-20261123t091552z`, `validation-healthy-healthy-spike-s2003-20261123t091632z` | `failed` ở bước dữ liệu seed (`seed_data_failed`), chưa chạy workload | Worktree mới của task-04 chưa cài dependency của `lms/` (`pnpm install`) | Cài dependency, chạy lại bằng spec cũ với `run_id` mới. Các run này không có telemetry hay `RunGroundTruth`. |
| `train-healthy-healthy-spike-s1003-20261123t091712z` | `aborted` ở bước reset, chưa chạy workload | Hàng đợi bị dừng để cài dependency như dòng trên | Như trên |
| `train-healthy-healthy-spike-s1003-20261123t134927z` | `aborted` lúc 14:04Z, sau khoảng 14 phút workload | Ngắt có chủ đích vì export sẽ dùng ngân sách trace cũ (mục 6.1) | Thay bằng `train-healthy-healthy-spike-s1003-20261123t224223z` (cùng seed, `replacement_for_run_id`), ghi trong `replaced_run_ids` của slot. Ledger ghi `ground_truth: valid` cho run này (k6 kịp ghi tóm tắt), nhưng gate thực thi fail nên nó không dùng được. |

Năm run đầu (4 run `failed` ở bước dữ liệu seed, 1 run `aborted` ở reset) hỏng trước khi workload bắt đầu. Spec chạy lại không ghi `replacement_for_run_id`, và slot không liệt kê chúng trong `replaced_run_ids`. Luật "hỏng trước khi có workload thì không tính là run bị thay" **được đặt sau khi chạy**: mục 8.6 và experiments/README trước đó không nói gì về trường hợp này. Hệ quả:

- Chuỗi thật của slot `train-healthy-healthy-spike-1` là `091712z` → `134927z` → `224223z`, nhưng manifest chỉ ghi `134927z`.
- Luật đã được ghi vào experiments/README.
- `check-dataset.mjs` không phát hiện run chạy lại mà không khai trong manifest. Các run này nhận ra được trong ledger qua cùng split, profile và seed với slot, cùng trạng thái `failed`/`aborted`.

Quyết định chạy lại năm run này chỉ dựa trên lỗi dựng môi trường, không dựa trên kết quả detector hay mô hình (evaluation-protocol-v1 mục 8.6). Riêng run `134927z` là trường hợp ngắt chủ động ở mục 6.1.
