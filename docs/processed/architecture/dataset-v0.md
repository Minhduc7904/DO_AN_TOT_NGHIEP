# Dataset v0

> **Task:** `task-04_collect-dataset-v0` (tuần 15).
>
> **Trạng thái:** bản nháp, cập nhật 23/11/2026. Đã chốt luật chia ngày, kế hoạch phiên của ba split, các slot run (khai báo trước khi chạy) và các quyết định từ pilot task-03. Run dataset chạy từ 23/11/2026 (mục 6).
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
- **Run thay thế** (mục 8.6) dùng seed mới trong cùng khoảng và giữ `replacement_for_run_id`.
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

Bảng run theo slot ghi khi hàng đợi chạy xong. Sự kiện trong lúc chạy:

### 6.1. Ngân sách export trace (23/11/2026)

- Run `validation-healthy-healthy-spike-s2003-20261123t123352z` (export với ngân sách mặc định 20.000 trace) có 56.701 trace ứng viên, 18.602 trace nhiễu, 38.099 trace còn lại; export giữ 20.000 (mẫu đều theo thời gian, `_evenly_spaced`) và bỏ 18.099 (`dropped_by_budget`), giữ 52,5%. Không lỗi tải (`fetch_errors`, `not_found`, `parse_errors` = 0), không `aborted`.
- **Độ phủ ứng viên** (trace ứng viên không nhiễu ÷ request k6 trong cửa sổ) của mọi run pilot `normal-mixed` và dataset v0 tới thời điểm này là 0,990–0,996, kể cả run trên (0,995). 16 lần chạm giới hạn kết quả tìm kiếm của Tempo lặp lại ở mọi run, không theo tải, và không làm mất trace đáng kể; nguồn mất trace duy nhất là ngân sách. Run pilot `c2-spike` (fault cộng đỉnh tải) là ngoại lệ: 0,687, 291 lần chạm giới hạn.
- Quyết định: nâng ngân sách mặc định lên 60.000 (commit `ebbae7f`) để run còn lại có `dropped_by_budget` = 0. Run `train-healthy-healthy-spike-s1003-20261123t134927z` đang chạy với ngân sách cũ được ngắt có chủ đích lúc 14:04Z (`aborted`, giữ trong ledger) và chạy lại bằng spec `train-healthy-healthy-spike-1-r2.json` (cùng seed, `replacement_for_run_id`).
- Run s2003 đã đạt gate thực thi và chất lượng (`partial`), nên theo mục 8.6 không được thay; nó giữ slot validation `healthy-spike` với trace là mẫu 52,5%. Cách nhận run này cho primary evaluation và giới hạn đi kèm ở [evaluation-protocol-v1](evaluation-protocol-v1.md) mục 6.1.1 bảng F (task-06).
