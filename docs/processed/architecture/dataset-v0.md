# Dataset v0

> **Task:** `task-04_collect-dataset-v0` (tuần 15).
>
> **Trạng thái:** bản nháp, cập nhật 20/11/2026. Đã chốt luật chia ngày, kế hoạch phiên của ba split và các slot run (khai báo trước khi chạy). **Chưa có run nào.** Các run dataset chạy sau khi pilot của task-03 tuần 15 xong, vì cần fault manifest v2, quyết định profile đối chứng và slot trùng cao điểm của task-03.
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

**Còn chờ task-03:**

- **Fault manifest v2:** cường độ, thời lượng fault, slot cao điểm.
- **Run validation trùng cao điểm:** chọn slot nào đặt `align_peak` (ít nhất một cho cả campaign, mục 5.3), và nó chạy trên profile nào.
- **Profile healthy đối chứng** (`upload media peak healthy`, `AI job healthy`): nếu task-03 quyết định cần, thêm slot train và validation cho chúng.

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

Chưa có. Mục này ghi run theo slot, gate, chất lượng, run bị thay và giới hạn sau khi chạy.
