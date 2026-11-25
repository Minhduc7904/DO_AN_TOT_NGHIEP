# Báo cáo kiểm chứng độ thực của traffic học viên v1

> **Task:** `task-04_validate-workload-realism` (tuần 14).
>
> **Trạng thái:** v1, cập nhật 25/11/2026 (bổ sung nguồn đơn giản ở `healthy-spike`, mục 11–12); trước đó 24/11/2026. Số đo ở mục 0, 2, 4 và 5 lấy từ ba run `r2` chạy trên code workload đã merge (`main` `ba2d7da`, gồm PR #85 sau review và PR #90) với TTL service token mặc định 600 s. Lần đo pilot ngày 18/11/2026 (run `r1`, code trước review, TTL 60 s) giữ ở mục 7 để đối chiếu. Ngưỡng ở mục 1 không đổi giữa hai lần đo. Mục 10 (thêm ngày 19/11/2026, task-07 tuần 15) chấm lại `r2` theo [tiêu chí v2](workload-realism-criteria-v2.md). Mục 11–12 (24/11/2026) chấm 10 run train/validation của dataset v0, là bằng chứng chính của v2, và kết luận theo cả hai tiêu chí.
>
> **Tài liệu liên quan:** [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 2 và 4, [workload-design-v1](workload-design-v1.md) mục 10.4 và 13. Công cụ nằm ở `aiops-platform/load/tools/realism.mjs` và `validate-realism.mjs`.

## 0. Đọc nhanh

- **Kết luận theo ngưỡng đã chốt trước:** chưa nguồn nào đạt đủ ngưỡng, nên **chưa được kết luận traffic bán thực là "giống thật" theo v1**. Bán thực (mức 2+) đạt 6/7 tiêu chí có ngưỡng. Tiêu chí không đạt là **trung vị thời lượng phiên**: lệch −42% (ngưỡng ±10%). KS D thời lượng = 0,099 đạt ngưỡng 0,1 nhưng chỉ cách ngưỡng 0,001 (lần pilot là 0,101), nên coi là sát ngưỡng, không phải đạt chắc chắn.
- **Về thứ hạng, bán thực gần hold-out nhất trên mọi đại lượng.** Ví dụ JSD tỉ lệ thao tác: bán thực 0,019, mức 2 thuần 0,132, mức 1 0,300. Pearson dáng theo giờ lần lượt là 0,96, 0,68 và −0,02. Mức 2 thuần đạt 1/7 tiêu chí (trung vị số thao tác); mức 1 không đạt tiêu chí nào.
- **Khoảng lệch thời lượng không do cơ chế phát lại.** Run bán thực khớp kế hoạch của nó: KS D thời lượng giữa run và kế hoạch là 0,020. Phần lệch có sẵn trong dữ liệu xây: chính 60 ngày đầu của log Moodle so với 31 ngày hold-out đã lệch trung vị thời lượng −37% (mục 5).
- **Số đo gần như không đổi so với pilot** (mục 7). Các đại lượng đo ở phía client do kế hoạch phiên quyết định; code sửa sau review chủ yếu đổi phía server (khóa seed đúng, không trùng tài khoản). Run `r2` không còn phiên `auth_failed` hay `unexpected_status`.
- **Theo tiêu chí v2** (đăng ký 19/11/2026, [workload-realism-criteria-v2](workload-realism-criteria-v2.md)): chấm lại `r2` sau khi đã xem dữ liệu, bán thực **đạt**, mức 2 thuần và mức 1 không đạt (mục 10). Bằng chứng chính là 10 run train/validation của dataset v0, chạy sau thời điểm đăng ký: **10/10 run đạt v2** (4/4 nhóm ngày khác nhau) và **0/10 đạt v1** (mục 11).
- **Kết luận** (mục 12): được viết "traffic học viên bán thực `normal-mixed` giống thật theo tiêu chí v2", kèm giới hạn: với bán thực, v2 chỉ kiểm bộ phát và nhóm ngày; dáng theo giờ của nhóm validation nằm ngoài dải; 1/4 ngày của mỗi nhóm đã nằm trong kế hoạch `r2`; chỉ có 2 nhóm ngày độc lập. Với `healthy-spike` cũng **được viết** sau khi chạy hai nguồn đơn giản theo cấu hình đăng ký trước khi chạy (25/11/2026): cả mức 1 và mức 2 thuần có điểm v2 1,000, cao hơn mọi run bán thực (≤ 0,919); kèm các giới hạn tương ứng (mục 11, phần bổ sung; mục 12). Theo v1 vẫn chưa đạt.
- **Hai lỗi đo được sửa sau lần chạy pilot đầu tiên** (mục 6). Cả hai làm công cụ đo sai đại lượng, không phải ngưỡng.

## 1. Tiêu chí chốt trước

Theo ADR-007 mục 2.4 và workload-design-v1 mục 10.4. Ngưỡng được ghi trong `THRESHOLDS` của `tools/realism.mjs` trước khi chạy run và không đổi sau khi xem kết quả.

| Đại lượng | Phép đo | Ngưỡng |
| --- | --- | --- |
| Số thao tác/phiên | KS hai mẫu (D); lệch trung vị tương đối | D < 0,1; \|lệch\| < 10% |
| Thời lượng phiên | KS (D); lệch trung vị | D < 0,1; \|lệch\| < 10% |
| Think time | KS (D); lệch trung vị | D < 0,1; \|lệch\| < 10% |
| Tỉ lệ loại thao tác | Jensen–Shannon (log2) | JSD < 0,05 |
| Dáng theo giờ | Pearson số phiên bắt đầu mỗi "giờ" (đã nén ×30) | báo cáo, không có ngưỡng |
| Đỉnh/trung bình, index of dispersion, Hurst | số request mỗi bin 30 s | báo cáo cạnh hold-out, không có ngưỡng |

Điều kiện kết luận "giống thật": nguồn bán thực đạt mọi ngưỡng **và** gần hold-out hơn hai nguồn còn lại.

## 2. Dữ liệu và ba run

**Hold-out:** 31 ngày cuối (ngày 60–90) của log Moodle Unistudium 2022 [L-Unistudium], gồm 9.709 phiên (`data/sessions/moodle-holdout-v1.json`, sha256 `17c6afac6605ca36…`). Không tham số nào được chỉnh bằng hold-out.

**Ba run:** cùng stack đầy đủ (lớp fault bật nhưng không có fault nào được kích hoạt), cùng thời lượng 2.880 s (một ngày nén ×30), chạy lần lượt ngày 19/11/2026 (02:49–05:15 UTC) trên `main` `ba2d7da`, `IDENTITY_SERVICE_TOKEN_TTL_SECONDS=600`.

| | (a) Mức 1 | (b) Mức 2 thuần | (c) Bán thực (mức 2+) |
| --- | --- | --- | --- |
| `run_id` | `w14-t04-level1-r2` | `w14-t04-assumed-r2` | `w14-t04-moodle-r2` |
| Nguồn phiên | `scenarios/level-1.js`, VU cố định (W1: 1 VU, W3: 4 VU) | Máy trạng thái với tham số giả định (`params/student-assumed-v1.json`) | Phiên thật của 4 ngày trong phần xây (ngày 30, 43, 52, 42) |
| Kế hoạch | không có | `assumed-normal-mixed-k4-v1` (sha256 `02393100e6fe04a4…`) | `moodle-normal-mixed-k4-v1` (sha256 `471ef74a84b9a955…`) |
| Seed | 301 | 302 | 302 |
| Phiên kế hoạch / đã chạy | không có / 1.462 phiên quan sát | 1.246 / 1.245 | 1.246 / 1.245 |
| `dropped_iterations`; `accounts_overlapping` | không áp dụng | 0; 0 | 0; 0 |
| Request; tỉ lệ lỗi; p95 | 11.406; 0%; ≤ 45 ms | 10.163; 0%; 43 ms | 12.880; 0,04%; 43 ms |
| `end_reason` | không áp dụng | exit 1.223, run_end 22 | exit 1.197, run_end 48 |
| Nhật ký đo | `k6-points.json.gz` (`a6f7abe5154ddf33…`) | `actions.jsonl` (`8dfdb8aa5491ad94…`) | `actions.jsonl` (`d431023b7155babd…`) |

Khóa Moodle A–D được ánh xạ đúng sang bốn khóa seed (`5eed0010-…-0001` đến `-0004`). 0,04% lỗi của run (c) là 5 request `PUT …/progress` gặp `EOF` của kết nối keep-alive, đã thử lại thành công (`outcome = retried`). Thư mục `results/` không commit (gitignore). Mã băm trên là 16 ký tự đầu của sha256.

## 3. Cách đo

Hold-out và cả ba run được đưa về cùng một dạng: phiên = dãy thao tác `{state, think_s}`.

- **Đo trên traffic thật sự gửi đi, ở phía client.** Workload-design-v1 mục 10.4 ghi "đo trên log gateway". Nhưng log gateway không mang định danh người dùng hay phiên, nên không cắt được phiên ở phía server. Bộ đo dùng nhật ký của k6: `actions.jsonl` cho mức 2/2+ (mỗi dòng là một request đã gửi, có `session_key`, `action_index`) và điểm `http_req_duration` của output JSON cho mức 1. Hai nguồn này ghi đúng những request đã đi tới gateway, nên vẫn giữ ý "không đo trên kịch bản".
- **Bỏ bước chèn đầu phiên.** Log Moodle không có `LOGIN`, `DASH`, `REGISTER`, `REFRESH`, nên các trạng thái này bị loại ở cả bốn nguồn. Phiên chỉ có các bước này (ví dụ phiên mức 2 thuần thoát ngay sau dashboard) cũng bị loại. Vì vậy số phiên quan sát được của (b) là 1.111.
- **Phiên của mức 1.** Mức 1 không có khái niệm phiên. Mỗi lượt (VU, iteration) của hành trình W1 hoặc W3 được tính là một phiên. Request được quy về trạng thái bằng route mẫu (`LEVEL1_ROUTE_STATE`), và các request liên tiếp cùng trạng thái cách nhau dưới 1 s được gộp thành một thao tác. Vì executor dùng VU cố định, số phiên (1.462) không bằng 1.246 như hai run kia. Ràng buộc "cùng tổng số phiên" của mục 10.4 vì thế chỉ giữ được cho (b) và (c).
- **Think time và thời lượng.** Think time là khoảng từ lúc request cuối của thao tác trước kết thúc tới lúc thao tác sau bắt đầu. Thời lượng phiên là tổng các khoảng nghỉ đó, đúng như log Moodle, nơi mỗi sự kiện là tức thời. Hold-out kẹp think time ở 300 s, cùng trần với kế hoạch phát lại (workload-design-v1 mục 13.3).
- **Tham chiếu cho đại lượng lịch đến** (dáng theo giờ, đỉnh/trung bình, dispersion, Hurst) là 4 ngày hold-out chọn theo cùng luật với profile `normal-mixed` (ngày 80, 83, 60, 65; 1.075 phiên), nén ×30 như run. Đại lượng mức phiên dùng toàn bộ 9.709 phiên hold-out.

## 4. Kết quả

Số đo của ba run `r2`, bằng công cụ đã sửa hai lỗi ở mục 6. Ô **đậm** là đạt ngưỡng.

| Đại lượng | (a) Mức 1 | (b) Mức 2 thuần | (c) Bán thực | Hold-out |
| --- | --- | --- | --- | --- |
| Phiên quan sát | 1.462 | 1.111 | 1.245 | 9.709 |
| KS D thao tác/phiên | 0,423 | 0,158 | **0,087** | |
| Lệch trung vị thao tác/phiên | +133% | **0%** | **0%** | trung vị 3 |
| KS D thời lượng | 0,684 | 0,288 | **0,099** | |
| Lệch trung vị thời lượng | −87% | −44% | −42% | trung vị 65 s |
| KS D think time | 0,962 | 0,118 | **0,075** | |
| Lệch trung vị think time | −89% | +20% | **0%** | trung vị 14 s |
| JSD tỉ lệ thao tác | 0,300 | 0,132 | **0,019** | |
| Pearson dáng theo giờ | −0,02 | 0,68 | 0,96 | |
| Đỉnh/trung bình | 1,25 | 2,08 | 3,16 | 4,02 |
| Index of dispersion | 0,14 | 5,03 | 10,03 | 9,78 |
| Hurst (aggregated variance) | 0,30 | 0,99 | 0,98 | 0,97 |
| **Đạt mọi ngưỡng** | không (0/7) | không (1/7) | không (6/7) | |

Đọc kết quả:

- **Mức 1** đúng như thiết kế: tải phẳng (đỉnh/trung bình 1,25, dispersion 0,14 < 1), phiên dày thao tác và gần như không nghỉ. Đây là mốc "giả lập đơn giản". Hurst của mức 1 là 0,30 ở `r2` và 0,51 ở pilot: chuỗi gần phẳng của VU cố định (vòng kín) làm ước lượng aggregated variance không ổn định, nên chỉ đọc là "không có phụ thuộc dài hạn" (khác xa 0,97 của hold-out), không đọc giá trị cụ thể.
- **Mức 2 thuần** có trung vị số thao tác đúng (do tham số giả định được chọn theo OULAD và thống kê chung), nhưng phân phối lệch: KS D 0,158, tỉ lệ loại thao tác JSD 0,132. Lịch đến có dao động (Hurst 0,99) nhưng đỉnh thấp hơn thật (2,08 so với 4,02).
- **Bán thực** gần hold-out nhất trên mọi đại lượng. Tỉ lệ thao tác, think time, số thao tác/phiên và KS D thời lượng đạt ngưỡng; dispersion và Hurst gần như trùng hold-out. Đỉnh/trung bình thấp hơn (3,16 so với 4,02) vì 4 ngày xây có đỉnh trong ngày thấp hơn 4 ngày hold-out cùng luật chọn. Trung vị thời lượng phiên không đạt; KS D thời lượng đạt sát ngưỡng (0,099 so với 0,1).

## 5. Chẩn đoán phần không đạt: thời lượng phiên

Để tách lỗi phát lại khỏi khác biệt của dữ liệu, cùng bộ đo được chạy thêm trên kế hoạch và trên phần xây (không chỉnh gì theo kết quả này):

| So sánh | KS D thao tác | KS D thời lượng | Lệch trung vị thời lượng | KS D think | JSD |
| --- | --- | --- | --- | --- | --- |
| Run bán thực `r2` so với kế hoạch của nó | 0,018 | 0,020 | −3% (38 s / 39 s) | 0,075 | |
| Run mức 2 thuần `r2` so với kế hoạch của nó | 0,023 | 0,020 | −4% (36,5 s / 38 s) | 0,018 | |
| Kế hoạch `normal-mixed` so với hold-out | 0,072 | 0,088 | −40% | 0,020 | 0,018 |
| Toàn bộ phần xây (ngày 0–59) so với hold-out | 0,069 | 0,064 | −37% | 0,026 | 0,021 |
| Kế hoạch `healthy-spike` so với hold-out | 0,031 | 0,042 | +28% | 0,056 | 0,004 |

- **Cơ chế phát lại trung thành với kế hoạch.** Run so với kế hoạch có KS D khoảng 0,02 cho số thao tác và thời lượng, ở cả hai nguồn dùng bộ phát. Phần lệch −3% đến −4% trung vị đến từ các phiên bị cắt ở cuối run (`run_end`: 48 và 22 phiên).
- **Lệch trung vị có sẵn trong dữ liệu.** Ngay cả hai nửa của cùng log thật (xây và hold-out) cũng lệch −37% về trung vị thời lượng, trong khi KS D chỉ 0,064. Nguyên nhân: khoảng 18% phiên chỉ có một thao tác (thời lượng đúng 0), và quanh trung vị phân phối thời lượng thưa, nên một dịch chuyển nhỏ của hàm phân phối làm trung vị nhảy xa. Phiên trong 31 ngày cuối học kỳ dài hơn (gần kỳ thi). Với dữ liệu này, tiêu chí "trung vị thời lượng lệch < 10%" ngay cả dữ liệu thật của chính LMS cũng không đạt.
- **Think time của run lệch thêm khoảng 0,05 KS D so với kế hoạch** (0,073 so với 0,020). Log Moodle có độ phân giải 1 s, nên think time của kế hoạch là số nguyên. Think time đo trên run là số thực (cộng độ trễ của k6 và mạng), làm hàm phân phối lệch ở các bậc nguyên. Đây là giới hạn của phép đo, không phải hành vi khác. Run mức 2 thuần ủng hộ giải thích này: think time của kế hoạch mức 2 thuần được lấy mẫu từ phân phối liên tục (89% giá trị không nguyên, độ phân giải 0,1 s), và run lệch kế hoạch của nó chỉ 0,018.

Theo ADR-007 mục 4, không được đổi ngưỡng hay tiêu chí sau khi xem kết quả. Nếu muốn thay tiêu chí trung vị thời lượng (ví dụ chỉ dùng KS D, hoặc lấy mốc là độ lệch giữa phần xây và hold-out), phải ghi thành phiên bản tiêu chí mới kèm lý do **trước** lần đo tiếp theo, và báo cáo song song cả tiêu chí cũ. Báo cáo này chưa thay đổi gì.

## 6. Hai lỗi đo đã sửa sau lần chạy đầu

Cả hai được phát hiện khi đọc bảng của lần đo pilot đầu tiên (run `r1`). Cả hai làm công cụ đo một đại lượng khác với đại lượng đã định nghĩa. Ngưỡng và dữ liệu run giữ nguyên; chỉ chạy lại bộ đo.

| Lỗi | Hệ quả ở lần đo đầu | Sửa | Số trước → sau |
| --- | --- | --- | --- |
| k6 ≥ 0.41 ghi `vu`, `iter` vào `metadata` của điểm JSON, không còn là tag. Công cụ đọc `tags.vu`, `tags.iter` nên mọi request mức 1 dồn về 2 "phiên". | Mức 1 chỉ có 2 phiên, số đo vô nghĩa | Đọc `metadata.vu`, `metadata.iter` (vẫn đọc tag cho output cũ); test dùng đúng dạng output của k6 | Phiên mức 1: 2 → 1.507 |
| Thời lượng phiên của run được tính từ đầu request đầu tới cuối request cuối, tức cộng thêm thời gian server xử lý. Hold-out thì tính tổng khoảng nghỉ. | Phiên một thao tác của run ra khoảng 0,05 s thay vì 0; riêng điều này đẩy KS D thời lượng lên khoảng 0,17 | Thời lượng của run = tổng khoảng nghỉ, cùng định nghĩa với hold-out; test có phiên một thao tác | KS D thời lượng bán thực: 0,174 → 0,101; mức 2 thuần: 0,287 → 0,288 |

## 7. Lần đo pilot (18/11/2026) và giới hạn

**Pilot.** Ba run `w14-t04-level1-r1`, `w14-t04-assumed-r1`, `w14-t04-moodle-r1` chạy ngày 18/11/2026 trên code workload trước vòng review của PR #85, với TTL service token 60 s. So với `r2`, pilot khác ở ba điểm:

- Khóa Moodle A–D được ánh xạ sang bốn khóa đầu trang 1 của danh mục. Lúc đó bốn khóa này là khóa do run thử fault tạo ra (ít bài học và quiz hơn), không phải khóa seed.
- Gán tài khoản chưa dùng hoán vị, và chưa gán theo phiên (PR #90), nên hai phiên có thể chạy cùng lúc trên một tài khoản seed: 1 phiên ở run bán thực bị 409 `QUIZ_ATTEMPT_ALREADY_SUBMITTED`.
- TTL 60 s làm khoảng 0,05% request đăng nhập bị 401 `SERVICE_TOKEN_INVALID`: 6 phiên ở (b) và 3 phiên ở (c) kết thúc `auth_failed`.

| Đại lượng của bán thực (c) | Pilot `r1` | `r2` |
| --- | --- | --- |
| Phiên quan sát | 1.242 | 1.245 |
| KS D thao tác/phiên | 0,089 | 0,087 |
| KS D thời lượng | 0,101 | 0,099 |
| Lệch trung vị thời lượng | −43% | −42% |
| KS D think time | 0,073 | 0,075 |
| JSD tỉ lệ thao tác | 0,019 | 0,019 |
| Đỉnh/trung bình; dispersion; Hurst | 3,17; 10,12; 0,98 | 3,16; 10,03; 0,98 |
| Tiêu chí đạt | 5/7 | 6/7 |

Mức 1 pilot: 1.507 phiên, KS D thời lượng 0,689, JSD 0,299, Hurst 0,51. Mức 2 thuần pilot: 1.105 phiên, KS D thao tác 0,159, JSD 0,132, 1/7 tiêu chí. Bản pilot của báo cáo ghi nhầm mức 2 thuần đạt 2/7; chạy lại công cụ trên run `r1` cho 1/7 (chỉ trung vị số thao tác đạt), đúng với bảng số của chính bản đó.

Các đại lượng phía client gần như không đổi giữa hai lần đo, đúng như dự đoán: hình dạng phiên do kế hoạch quyết định. Thay đổi 5/7 → 6/7 chỉ do KS D thời lượng đi từ 0,101 xuống 0,099 quanh ngưỡng 0,1. Mức chênh này nằm trong dao động giữa hai lần chạy, nên không coi là cải thiện thật.

**Giới hạn còn lại của `r2`:**

- **KS D thời lượng sát ngưỡng.** 0,099 so với ngưỡng 0,1, với một run một seed. Lần chạy khác có thể cho 0,101 như pilot. Không dùng kết quả "đạt" của tiêu chí này làm luận điểm.
- **Lỗi kết nối giữ sống.** 5 request `PUT …/progress` ở run (c) gặp `EOF` sau khoảng nghỉ: kết nối keep-alive bị server đóng đúng lúc dùng lại. Client thử lại thành công.
- **Một run, một seed cho mỗi nguồn,** và chỉ profile `normal-mixed`. Chưa có khoảng tin cậy giữa các seed. (Giới hạn của riêng `r2`; mục 11 chấm thêm 10 run dataset ở hai profile.)
- **Không kiểm chứng giảng viên/admin bằng log Moodle** (không có dữ liệu; theo task card, dùng workload-design-v1 mục 10.1–10.3).
- **Run thí nghiệm dùng TTL 60 s.** Lớp fault đặt TTL 60 s cho mọi run (healthy lẫn fault) để C6 có cùng cấu hình. Run `r2` dùng 600 s để đo hành vi người dùng không lẫn nhiễu token; ở profile của task-03 (TTL 60 s), nhiễu này làm 0,02–0,22% phiên kết thúc `auth_failed`.

## 8. Kết luận và việc tiếp theo

1. Theo tiêu chí chốt trước: **chưa đạt**. Bán thực gần hold-out nhất (đạt 6/7 tiêu chí, hơn hẳn mức 2 thuần 1/7 và mức 1 0/7) nhưng không đạt trung vị thời lượng phiên, và KS D thời lượng chỉ đạt sát ngưỡng. Do đó, theo v1, chưa được dùng cụm từ "giống thật" trong báo cáo đồ án; chỉ được nói "gần hold-out hơn mức 1 và mức 2 thuần trên mọi đại lượng đo". Kết luận theo v2 (thêm ngày 24/11/2026) ở mục 12.
2. Mục 5 cho thấy phần lệch thời lượng nằm ở khác biệt giữa giai đoạn xây và giai đoạn hold-out của log, không ở cơ chế phát lại.
3. Đã chạy lại ba run trên code workload đã merge với TTL mặc định (19/11/2026); số đo khớp pilot. Bộ phát workload ở `ba2d7da` dùng được cho thu dữ liệu tuần 15.
4. Tiêu chí thời lượng giữ nguyên ở lần đo này. Nếu muốn thay (mục 5), phải ghi phiên bản tiêu chí mới kèm lý do trước lần đo kế tiếp và báo cáo song song tiêu chí cũ; nên kèm nhiều seed để có khoảng tin cậy cho KS D thời lượng.

## 9. Tái lập

```bash
cd aiops-platform/load
# Kế hoạch (task-01): data/plans/{assumed,moodle}-normal-mixed-k4-v1.json; hold-out: data/sessions/moodle-holdout-v1.json
# Mức 1: output JSON cần system tag vu, iter (k6 ghi chúng vào metadata của điểm).
TAGS=proto,status,method,url,name,group,check,error,error_code,scenario,expected_response,vu,iter
# Stack: identity chạy với IDENTITY_SERVICE_TOKEN_TTL_SECONDS=600 (lớp fault: FAULTS_SERVICE_TOKEN_TTL_SECONDS=600).
RUN_ID=w14-t04-level1-r2 JOURNEYS=w1,w3 VUS_W1=1 VUS_W3=4 DURATION=48m SEED=301 ./run-k6.sh level-1 \
  --system-tags=$TAGS --out json=/results/w14-t04-level1-r2/k6-points.json.gz
RUN_ID=w14-t04-assumed-r2 WORKLOAD_SEED=302 PLAN=data/plans/assumed-normal-mixed-k4-v1.json ./run-k6.sh student-replay
RUN_ID=w14-t04-moodle-r2 WORKLOAD_SEED=302 PLAN=data/plans/moodle-normal-mixed-k4-v1.json ./run-k6.sh student-replay
node tools/validate-realism.mjs \
  --run level1=results/w14-t04-level1-r2 \
  --run assumed=results/w14-t04-assumed-r2 \
  --run moodle=results/w14-t04-moodle-r2 --out results/realism-report-r2.json
# Từ 19/11/2026 lệnh này in thêm điểm theo tiêu chí v2 (cần data/sessions/moodle-build-v1.json); mục 10.
# Bổ sung 25/11/2026: nguồn đơn giản ở healthy-spike (mục 11, phần bổ sung). Từ thư mục gốc repository.
node aiops-platform/experiments/run-experiment.mjs aiops-platform/experiments/specs/realism-v2/pilot-level2-assumed-healthy-spike.json \
  --compose-env-file docker-compose/.env --confirm-reset aiops-lms
# Mức 1: reset và seed như runner (down --volumes; FAULTS_SERVICE_TOKEN_TTL_SECONDS=60 up --build --wait;
# lms/scripts/seed-data.mjs --profile small --seed 42), rồi:
cd aiops-platform/load
RUN_ID=w15-t07-level1-healthy-spike JOURNEYS=w1,w3 VUS_W1=3 VUS_W3=13 DURATION=48m SEED=402 ./run-k6.sh level-1 \
  --system-tags=$TAGS --out json=/results/w15-t07-level1-healthy-spike/k6-points.json.gz
node tools/validate-realism.mjs --profile healthy-spike --run level2=../experiments/runs/<run_id mức 2 thuần>/workload
node tools/validate-realism.mjs --profile healthy-spike --run level1=results/w15-t07-level1-healthy-spike
```

## 10. Chấm lại `r2` theo tiêu chí v2 (19/11/2026, sau khi xem dữ liệu)

Tiêu chí v2 hỏi nguồn có lệch hold-out nhiều hơn mức các nhóm ngày thật của log thường lệch hay không: 1.000 nhóm 4 ngày rút từ 31 ngày thường của phần xây (số phiên trong [204, 576]), mỗi nhóm rút đúng số phiên của nguồn, đổi bảy khoảng cách thành thứ hạng trong phân phối của các nhóm thật; nguồn đạt khi thứ hạng lớn nhất ≤ `tau` (phân vị 95% của chính các nhóm thật). Mốc thời gian của run làm tròn theo giây như log Moodle. Định nghĩa đầy đủ và thiên lệch "nghĩ ra sau khi xem v1" ở [workload-realism-criteria-v2](workload-realism-criteria-v2.md); tiêu chí và mã chấm được push (commit `602230b`) trước khi chạy bảng dưới.

| Đại lượng (khoảng cách; thứ hạng trong nhóm ngày thật) | (a) Mức 1 | (b) Mức 2 thuần | (c) Bán thực | Phân vị 95% của nhóm ngày thật |
| --- | --- | --- | --- | --- |
| KS D thao tác/phiên | 0,423; 1,00 | 0,158; 0,94 | 0,087; 0,45 | 0,16 |
| Lệch trung vị thao tác/phiên | 133%; 1,00 | 0%; 0,39 | 0%; 0,38 | 33% |
| KS D thời lượng | 0,680; 1,00 | 0,288; 1,00 | 0,099; 0,49 | 0,17 |
| Lệch trung vị thời lượng | 88%; 1,00 | 43%; 0,45 | 42%; 0,42 | 65% |
| KS D think time | 0,912; 1,00 | 0,118; 1,00 | 0,029; 0,35 | 0,05 |
| Lệch trung vị think time | 86%; 1,00 | 21%; 1,00 | 0%; 0,20 | 14% |
| JSD tỉ lệ thao tác | 0,300; 1,00 | 0,132; 1,00 | 0,019; 0,15 | 0,09 |
| **Điểm (thứ hạng lớn nhất) / `tau`** | 1,000 / 0,987 | 1,000 / 0,987 | **0,490 / 0,986** | |
| **Đạt v2** | không | không | **có** | |

Quá trình đến (không có ngưỡng; khoảng 2,5–97,5% của nhóm ngày thật): Pearson dáng theo giờ 0,74–0,97 (bán thực 0,96, mức 2 thuần 0,68, mức 1 0,05); đỉnh/trung bình 2,98–10,58 (3,16; 1,99; 1,25); index of dispersion 9,5–29,9 (10,0; 5,0; 0,14); Hurst 0,82–0,99 (0,98; 0,99; 0,27). Bán thực nằm trong khoảng ở cả bốn đại lượng; mức 2 thuần ngoài khoảng ở Pearson, đỉnh/trung bình, dispersion; mức 1 ngoài khoảng ở cả bốn.

Đọc kết quả:

- **Ngưỡng cố định của v1 chặt hơn dao động của chính dữ liệu thật.** Phân vị 95% của nhóm ngày thật cho KS D thời lượng là 0,17 và lệch trung vị thời lượng 65%, so với 0,1 và 10% của v1. Lệch −42% của bán thực nằm ở thứ hạng 0,42: gần một nửa nhóm ngày thật lệch hold-out nhiều hơn thế.
- **V2 vẫn phân biệt được nguồn.** Mức 2 thuần, dù trung vị số thao tác khớp, vẫn trượt rõ ở think time (KS D 0,118 so với 0,05) và tỉ lệ thao tác (JSD 0,132 so với 0,09): tham số giả định không tái tạo được hành vi thật. Mức 1 xa ngoài dải ở mọi đại lượng.
- **Làm tròn theo giây đưa KS D think time của bán thực từ 0,075 về 0,029**, đúng như chẩn đoán độ phân giải ở mục 5.
- Với bán thực, đạt v2 nghĩa là bộ phát giữ được hình dạng phiên của kế hoạch và 4 ngày đã chọn không bất thường; v2 không chứng minh thêm điều gì về log Moodle so với người dùng của LMS này (criteria-v2 mục 3).
- Kết luận "giống thật" theo v2 chưa được viết ở đây vì đây là chấm sau khi xem dữ liệu. Nó chỉ được viết khi các run dataset v0 (chạy sau thời điểm đăng ký, trên nhóm ngày chưa ai xem) đạt v2.

## 11. Bằng chứng chính: run train/validation của dataset v0 (24/11/2026)

Theo criteria-v2 mục 4.2. Tiêu chí v2 và mã chấm được push ở commit `602230b` (19/11/2026 15:18 +07); run dataset đầu tiên bắt đầu lúc 23/11/2026 09:14Z (16:14 +07), bốn ngày sau thời điểm đăng ký. Chấm **mọi** run train và validation đang giữ slot của dataset v0 (task-04, [dataset-v0](dataset-v0.md) mục 6). Sáu run dataset khác trong ledger không được chấm: năm run hỏng trước khi workload bắt đầu, và một run `healthy-spike` bị ngắt sau 14 phút rồi được thay thế (dataset-v0 mục 6.2). Chúng bị loại theo trạng thái ledger (gate thực thi fail) và quyết định ghi ở dataset-v0 mục 6.1–6.2. Việc ngắt run `healthy-spike` được ghi ở đó là sai lệch khỏi evaluation-protocol-v1 mục 8.6, và luật cho run hỏng trước workload được đặt sau khi chạy. Không run nào bị loại theo điểm độ thực; không run nào được chọn hay bỏ sau khi chấm.

Mỗi run chấm phần traffic học viên theo profile của nó, với cùng hold-out và cùng mã chấm như mục 10. Pool ngày tham chiếu và ngày hold-out cho quá trình đến khác nhau theo profile (criteria-v2 mục 2.3):

- `normal-mixed`: 31 ngày có số phiên trong [Q1, Q3] = [204, 576]; ngày hold-out 80, 83, 60, 65, như mục 10.
- `healthy-spike`: 16 ngày có số phiên ≥ 576; ngày hold-out 75, 67, 76, 74.

Lệnh chấm:

```bash
cd aiops-platform/load
node tools/validate-realism.mjs --profile <normal-mixed|healthy-spike> \
  --run <tên>=../experiments/runs/<run_id>/workload --out <tên>.json
```

| Split | Case | Profile | `run_id` | Phiên | V1 (đạt/7) | V2 điểm / `tau` (đại lượng có thứ hạng cao nhất) | V2 | Quá trình đến ngoài khoảng 2,5–97,5% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| train | healthy | normal-mixed | `train-healthy-normal-mixed-s1001-20261123t102740z` | 1.262 | 6/7 (trượt: trung vị thời lượng) | 0,386 / 0,987 (trung vị thao tác) | **đạt** | không |
| train | healthy | normal-mixed | `train-healthy-normal-mixed-s1002-20261123t113109z` | 1.262 | 6/7 (trượt: trung vị thời lượng) | 0,386 / 0,987 (trung vị thao tác) | **đạt** | không |
| validation | healthy | normal-mixed | `validation-healthy-normal-mixed-s2002-20261123t091816z` | 1.156 | 5/7 (trượt: KS thao tác, trung vị thời lượng) | 0,679 / 0,984 (trung vị thời lượng) | **đạt** | Pearson dáng theo giờ 0,68 (khoảng 0,74–0,97) |
| train | healthy | healthy-spike | `train-healthy-healthy-spike-s1003-20261123t224223z` | 3.368 | 5/7 (trượt: trung vị thời lượng, JSD) | 0,917 / 0,989 (JSD) | **đạt** | không |
| train | healthy | healthy-spike | `train-healthy-healthy-spike-s1004-20261124t002521z` | 3.370 | 5/7 (trượt: trung vị thời lượng, JSD) | 0,919 / 0,988 (JSD) | **đạt** | không |
| validation | healthy | healthy-spike | `validation-healthy-healthy-spike-s2003-20261123t123352z` | 3.398 | 5/7 (trượt: trung vị thời lượng, trung vị think) | 0,499 / 0,988 (trung vị think) | **đạt** | không |
| validation | C2 | normal-mixed | `validation-c2-normal-mixed-s2001-20261123t182901z` | 1.157 | 5/7 (trượt: KS thao tác, trung vị thời lượng) | 0,668 / 0,987 (trung vị thời lượng) | **đạt** | Pearson dáng theo giờ 0,68 (khoảng 0,74–0,97) |
| validation | C3 | normal-mixed | `validation-c3-normal-mixed-s2001-20261123t193231z` | 1.158 | 5/7 (trượt: KS thao tác, trung vị thời lượng) | 0,687 / 0,987 (trung vị thời lượng) | **đạt** | Pearson dáng theo giờ 0,68 (khoảng 0,74–0,97) |
| validation | C4 | normal-mixed | `validation-c4-normal-mixed-s2001-20261123t203506z` | 1.158 | 5/7 (trượt: KS thao tác, trung vị thời lượng) | 0,687 / 0,987 (trung vị thời lượng) | **đạt** | Pearson dáng theo giờ 0,68 (khoảng 0,74–0,97) |
| validation | C6 | normal-mixed | `validation-c6-normal-mixed-s2001-20261123t213759z` | 947 | 5/7 (trượt: KS thao tác, trung vị thời lượng) | 0,593 / 0,990 (trung vị thời lượng) | **đạt** | Pearson dáng theo giờ 0,38 (khoảng 0,74–0,97) |

`tau` khác nhau một chút giữa các run vì nhóm tham chiếu rút đúng số phiên của từng run (criteria-v2 mục 2.4). Cột "Phiên" là số phiên học viên quan sát được, tức phiên có ít nhất một thao tác sau bước đăng nhập.

**Tỉ lệ đạt:**

| Profile | Run đạt v2 | Nhóm ngày khác nhau đạt v2 | Run đạt v1 |
| --- | --- | --- | --- |
| `normal-mixed` | 7/7 (3 healthy, 4 fault) | 2/2 | 0/7 |
| `healthy-spike` | 3/3 (healthy) | 2/2 | 0/3 |
| Tổng | 10/10 | 4/4 | 0/10 |

**Đọc kết quả:**

- **Số run độc lập ít hơn số dòng của bảng.** Phiên phát lại lấy từ file kế hoạch của split; `workload_seed` chỉ đổi phần ngẫu nhiên của bộ phát (gán tài khoản, độ kiên nhẫn), không đổi phiên. Đối chiếu `sessions.jsonl` của hai run train: 1.265/1.265 phiên ghép theo phiên nguồn có cùng số thao tác; chỉ khác tham số phụ của bộ phát (`account_index`, profile kiên nhẫn: `patience_s`, `slow_limit`) và số request do thử lại. Vì vậy:
  - hai run train `normal-mixed` cho số đo gần như trùng (KS D think time 0,0828 và 0,0821);
  - năm run validation `normal-mixed` (healthy seed 2002, bốn fault run seed 2001) chỉ khác nhau ở phần do seed và fault làm đổi. Thực chất chỉ có **4 nhóm ngày** khác nhau: train `normal-mixed` (ngày 36, 42, 31, 48), validation `normal-mixed` (6, 52, 29, 13), train `healthy-spike` (39, 26, 33, 20), validation `healthy-spike` (46, 41, 19, 44). Tỉ lệ "theo nhóm ngày" mới là số mẫu độc lập.
- **V1 không đạt ở run nào.** Mọi run trượt lệch trung vị thời lượng phiên (ngưỡng v1 10%), giống `r2` (mục 4). Một số run trượt thêm KS D số thao tác/phiên (validation `normal-mixed`: 0,104–0,105, ngưỡng 0,1), JSD tỉ lệ thao tác (train `healthy-spike`: 0,071, ngưỡng 0,05) hoặc lệch trung vị think time (validation `healthy-spike`: 14%, ngưỡng 10%). Theo v2, các khoảng cách đó vẫn nằm trong dao động của nhóm ngày thật: thứ hạng lớn nhất 0,92 (JSD của hai run train `healthy-spike`), dưới `tau` 0,99.
- **Fault run vẫn đạt v2.** Fault chỉ làm đổi phần nhỏ của phiên trong cửa sổ fault. Riêng C6: `identity` bị pause nên 213/1.160 phiên học viên (18,4%) kết thúc `auth_failed` không có thao tác, nên chỉ còn 947 phiên quan sát. Phần còn lại vẫn đạt v2 (0,593). Số đo độ thực của fault run phản ánh workload cộng tác động của fault, không phải workload thuần; run healthy là bằng chứng sạch hơn.
- **Quá trình đến.** Pearson dáng theo giờ của nhóm validation `normal-mixed` là 0,68, ngoài khoảng 0,74–0,97 của profile này (không có ngưỡng). Nguyên nhân nằm ở 4 ngày đã chọn, không ở bộ phát: tính trên chính file kế hoạch `moodle-normal-mixed-k4-validation-v1` (giờ = `start_s` ÷ 120 s, so với hold-out cùng ngày của bộ chấm) cũng ra 0,677. Run khớp kế hoạch ở các nhóm khác:
  - train `normal-mixed`: kế hoạch 0,948, run 0,95;
  - train `healthy-spike`: kế hoạch 0,729, run 0,73, nằm trong khoảng 0,65–0,95 của profile `healthy-spike`.

  C6 thấp hơn nữa (0,38) vì phiên bắt đầu trong cửa sổ pause không đăng nhập được. Ba đại lượng còn lại (đỉnh/trung bình, index of dispersion, Hurst) nằm trong khoảng ở mọi run.
- **TTL 60 s.** Run dataset dùng TTL service token 60 s của lớp fault (criteria-v2 mục 4.3), khác `r2` (600 s). Ở run không phải C6, 0,03–0,34% phiên học viên kết thúc `auth_failed` (1–4 phiên mỗi run). Phần lớn các phiên này hỏng ở bước đăng nhập nên rơi khỏi tập quan sát; phiên hỏng giữa chừng vẫn được tính với các thao tác đã làm. Tỉ lệ này quá nhỏ để đổi phân phối đo.

**Giới hạn của bằng chứng:**

- **Một số ngày đã được xem trước.** Criteria-v2 mục 4.2 yêu cầu kế hoạch dựng từ "nhóm ngày chưa ai xem". Ở đây, một ngày tính là "đã xem" nếu nó thuộc một nhóm 4 ngày đã được đo độ thực trước khi đăng ký v2. Mục 5 có đo gộp toàn bộ phần xây (ngày 0–59), nhưng phép đo gộp đó không cho kết quả riêng của nhóm nào nên không tính. Luật chia ngày `day-split-v1` (task-04) chia theo thứ hạng số phiên và được ghi trước khi sinh kế hoạch, nhưng không loại các ngày đã dùng trước đó. So với các kế hoạch đã đo:
  - Kế hoạch `moodle-normal-mixed-k4-v1` (ngày 30, 43, 52, 42) đã được chấm ở `r2` (mục 4, 10). Ngày 42 nằm trong nhóm train `normal-mixed`, ngày 52 trong nhóm validation (mỗi nhóm 1/4 ngày).
  - Kế hoạch `moodle-healthy-spike-k4-v1` (40, 46, 39, 26) đã được đo theo bộ đo v1 ở mục 5 (dòng "Kế hoạch `healthy-spike` so với hold-out", 18/11/2026). Nó cũng được dùng ở task-02 và ở run pilot `pilot-c2-healthy-spike-s26-20261123t040552z` của task-03. Ngày 39, 26 nằm trong nhóm train `healthy-spike`, ngày 46 trong nhóm validation.

  Không nhóm nào trùng nguyên với nhóm đã đo, và không ngày nào được chọn dựa trên kết quả độ thực. Điều kiện "chưa ai xem" đúng hoàn toàn với 2/4 ngày của nhóm train `healthy-spike` và 3/4 ngày của mỗi nhóm còn lại.
- **Nhóm validation `normal-mixed` bất thường về lịch đến.** Pearson dáng theo giờ 0,68 (C6: 0,38) nằm ngoài khoảng 0,74–0,97 của nhóm ngày thật. Đại lượng này không có ngưỡng nên không làm run trượt v2. Dù vậy, câu "nhóm ngày không bất thường" chỉ đúng với bảy đại lượng mức phiên, không đúng với dáng theo giờ của nhóm này.
- **Với bán thực, v2 chỉ kiểm hai điều** (criteria-v2 mục 3): bộ phát giữ được hình dạng phiên của kế hoạch, và nhóm ngày đã chọn không bất thường so với các ngày thật khác. Nó không chứng minh log Moodle giống người dùng của LMS này.
- **Nguồn đơn giản ở `normal-mixed` là điểm chấm sau khi xem dữ liệu.** Điều kiện thứ hai của kết luận (điểm v2 thấp hơn mức 1 và mức 2 thuần, criteria-v2 mục 2) chỉ so được với hai run `r2` cùng profile `normal-mixed` và `k` = 4, chấm ở mục 10: mức 1 và mức 2 thuần cùng điểm 1,000, tức thứ hạng tối đa.
  - Điểm này được chấm sau khi đã biết hai nguồn trượt v1 (criteria-v2 mục 4.1). Vì vậy điều kiện thứ hai chỉ là kiểm tra hợp lý, không phải bằng chứng độc lập.
  - Phép so cũng vượt lô: hai run `r2` khác run dataset ở TTL (600 s), số phiên (1.111–1.462 so với 947–1.262) và code (`ba2d7da` so với `ec98a55`/`dbb9ae1`/`9daed76`). Khoảng cách của hai nguồn này vượt xa phân vị 95% (ví dụ KS D thời lượng của mức 2 thuần là 0,288 so với 0,17), nên các khác biệt trên không kéo được điểm 1,000 xuống.
  - Profile `healthy-spike`: hai nguồn đơn giản chạy ngày 25/11/2026 theo cấu hình đăng ký trước, ở phần bổ sung ngay dưới; khác với `normal-mixed`, đây là phép so đăng ký trước khi có số đo của nguồn đơn giản.

### Bổ sung: nguồn đơn giản ở `healthy-spike` (đăng ký 25/11/2026, trước khi chạy)

Phần này đăng ký cấu hình và luật kết luận cho điều kiện thứ hai của criteria-v2 mục 2 ở profile `healthy-spike`. Nó được commit và push trước khi chạy hai run dưới đây. Các run bán thực `healthy-spike` đã chấm ở bảng trên (điểm 0,499; 0,917; 0,919), nên luật đặt sau khi biết điểm bán thực nhưng trước khi có bất kỳ số đo nào của hai nguồn đơn giản.

| | Mức 2 thuần | Mức 1 |
| --- | --- | --- |
| Cách chạy | Runner (`run-experiment.mjs`), spec `experiments/specs/realism-v2/pilot-level2-assumed-healthy-spike.json`: reset, dữ liệu seed, TTL service token 60 s, profile `healthy-spike` kèm lịch giảng viên/admin như run dataset | Reset và dữ liệu seed như runner (TTL 60 s), rồi `run-k6.sh level-1` như mục 9 |
| Nguồn phiên | Kế hoạch `assumed-healthy-spike-k4-v1` (sha256 `ca43e8c0b2ac3e8f…`), dựng từ tham số giả định `params/student-assumed-v1.json`, không lấy ngày nào của log | `JOURNEYS=w1,w3`, `VUS_W1=3`, `VUS_W3=13`, `DURATION=48m` |
| Seed | `workload_seed` 401 (split `pilot`, không thuộc dataset) | `SEED=402` |

**Số VU của mức 1.** Mức 1 dùng VU cố định, không có profile (mục 2). Mức 1 tương ứng giữ tỉ lệ W1 : W3 = 1 : 4 của `r2` và nhân số VU để tổng request gần bằng số request học viên trung bình của ba run bán thực `healthy-spike` (37.147; 37.217; 37.000; trung bình 37.121). Ở `r2`, mỗi VU W1 sinh 1.889 request và mỗi VU W3 sinh 2.379 request trong 48 phút. Hệ số 37.121 / 11.405 = 3,26 cho 3 VU W1 và 13 VU W3, dự kiến khoảng 36.600 request. Đại lượng mức phiên của mức 1 không phụ thuộc số VU; số VU chỉ đổi số phiên quan sát, tức cỡ mẫu của nhóm tham chiếu.

**Chấm:** `validate-realism.mjs --profile healthy-spike`, cùng hold-out, pool 16 ngày và mã chấm như các run dataset `healthy-spike` ở bảng trên.

**Luật kết luận (chốt trước khi chạy):**

- Được viết "traffic học viên bán thực `healthy-spike` giống thật theo tiêu chí v2" khi điểm v2 của **cả hai** nguồn đơn giản **lớn hơn** 0,919, tức điểm lớn nhất của ba run bán thực `healthy-spike`.
- Nếu một nguồn có điểm ≤ 0,919 thì không viết, và ghi nguyên kết quả.
- Mỗi nguồn chấm đúng một run. Chỉ chạy lại khi run hỏng ở gate thực thi vì lỗi hạ tầng, không chạy lại vì điểm. Run hỏng vẫn giữ trong ledger hoặc thư mục kết quả.

**Giới hạn biết trước:** mỗi nguồn một run, một seed. Run mức 1 chạy ngoài runner nên không có dòng ledger, giống `r2`.

#### Kết quả (25/11/2026, sau khi chạy)

Run mức 2 thuần chạy trên commit đăng ký `53b9f9a`, cây sạch (`run-manifest.json`: `code.dirty` = false). Run mức 1 chạy liền sau trong cùng script trên cùng checkout; nó không có bản ghi commit riêng, nhưng dữ liệu seed có cùng fingerprint (`fe30935…`) với run mức 2 thuần, và commit kết quả `5af3a29` được tạo sau khi cả hai xong. Cả hai chạy trên máy Linux hiện tại với TTL service token 60 s, chấm bằng `validate-realism.mjs --profile healthy-spike` như các run dataset (pool 16 ngày, hold-out 9.709 phiên).

| | Mức 2 thuần | Mức 1 |
| --- | --- | --- |
| Run | `pilot-healthy-healthy-spike-s401-20261125t030333z` (runner, dòng ledger) | `w15-t07-level1-healthy-spike` (`run-k6.sh level-1`, reset và dữ liệu seed như runner) |
| Thời gian | 03:04Z–03:53Z | 04:42Z–05:30Z |
| Thực thi | Gate thực thi `pass`, `RunGroundTruth` `valid`, chất lượng `partial` (`truncated_modality:traces`); kế hoạch sha256 `ca43e8c0b2ac3e8f…`; 40.460 request (học viên 39.332, còn lại giảng viên/admin), tỉ lệ lỗi 0,0025% (1 request), không iteration bị bỏ, không tài khoản dùng chồng | 16 VU (W1 3, W3 13) chạy đủ 48 phút, 6.216 iteration, không iteration bị ngắt; 38.435 request (W1 5.603, W3 32.831, 1 request của setup; dự kiến khoảng 36.600 request học viên), tỉ lệ lỗi 0 |
| Phiên quan sát | 3.891 | 6.216 |
| KS D thao tác/phiên; thời lượng; think time (khoảng cách v2, mốc thời gian làm tròn giây như mục 10) | 0,106; 0,270; 0,125 | 0,313; 0,682; 0,912 |
| JSD tỉ lệ thao tác | 0,158 | 0,320 |
| Thứ hạng lớn nhất (đại lượng) | 1,00 (KS D thời lượng, KS D think time, JSD) | 1,00 (6/7 đại lượng bằng 1,000; lệch trung vị thời lượng 0,999) |
| **Điểm v2 / `tau`** | **1,000 / 0,988** | **1,000 / 0,987** |
| Đạt v2 | không | không |
| Quá trình đến (khoảng 2,5–97,5% của nhóm ngày `healthy-spike`): Pearson dáng theo giờ (0,65–0,95); đỉnh/trung bình (2,97–5,31); index of dispersion (23,9–41,7); Hurst (0,94–0,99) | 0,60; 2,55; 19,2; 1,00 | −0,04; 1,24; 0,55; 0,28 |

Cả hai nguồn nằm ngoài khoảng của nhóm ngày thật ở cả bốn đại lượng của quá trình đến (không có ngưỡng, criteria-v2 mục 2.7). Ghi chú về phần đăng ký: hệ số 37.121 / 11.405 là 3,2548, tức 3,25 khi làm tròn (phần đăng ký ghi 3,26); số VU 3 và 13 không đổi.

**Áp luật đã đăng ký:** điểm của cả hai nguồn đơn giản (1,000) lớn hơn 0,919, nên điều kiện thứ hai của criteria-v2 mục 2 được thỏa cho `healthy-spike`. Mức 2 thuần trượt rõ ở thời lượng phiên, think time và tỉ lệ thao tác, giống `r2` ở `normal-mixed`: tham số giả định không tái tạo được hành vi thật, dù trung vị số thao tác khớp. Mức 1 xa ngoài dải ở cả bảy đại lượng.

## 12. Kết luận theo v1 và v2

- **Theo v1** (ngưỡng cố định, mục 1): **chưa đạt** ở run nào, gồm `r2` và cả 10 run dataset. Vẫn không được dùng cụm "giống thật" theo v1.
- **Theo v2, profile `normal-mixed`:** bán thực đạt v2 ở 7/7 run và 2/2 nhóm ngày, chạy sau thời điểm đăng ký; điểm (0,386–0,687) thấp hơn mức 1 và mức 2 thuần (1,000). Hai điều kiện của criteria-v2 mục 2 được thỏa, nên **được viết: traffic học viên bán thực `normal-mixed` giống thật theo tiêu chí v2**. Khi viết phải kèm bốn giới hạn ở mục 11:
  1. nghĩa của v2 với bán thực: bộ phát trung thành với kế hoạch, và nhóm ngày không bất thường ở bảy đại lượng mức phiên;
  2. dáng theo giờ của nhóm validation nằm ngoài dải của nhóm ngày thật;
  3. 1/4 ngày của mỗi nhóm đã nằm trong kế hoạch `r2`;
  4. chỉ có 2 nhóm ngày độc lập, và phép so với nguồn đơn giản là chấm sau khi xem dữ liệu.
- **Theo v2, profile `healthy-spike`:** bán thực đạt v2 ở 3/3 run và 2/2 nhóm ngày (điểm 0,499–0,919). Hai nguồn đơn giản chạy ngày 25/11/2026 theo cấu hình và luật đăng ký trước (commit `53b9f9a`) đều có điểm 1,000 (mục 11, phần bổ sung). Cả hai điều kiện của criteria-v2 mục 2 được thỏa, nên **được viết: traffic học viên bán thực `healthy-spike` giống thật theo tiêu chí v2**. Khi viết phải kèm:
  1. nghĩa của v2 với bán thực (bộ phát trung thành với kế hoạch, nhóm ngày không bất thường ở bảy đại lượng mức phiên). Ở `healthy-spike`, pool tham chiếu chỉ có 16 ngày và cả 8 ngày của hai nhóm bán thực đều nằm trong pool (một nửa pool; ở `normal-mixed` là 8/31), nên vế "nhóm ngày không bất thường so với các ngày thật khác" yếu hơn ở profile này;
  2. 1/4 ngày của nhóm validation và 2/4 ngày của nhóm train đã nằm trong kế hoạch đã xem trước (mục 11);
  3. chỉ có 2 nhóm ngày độc lập;
  4. mỗi nguồn đơn giản một run, một seed; luật được đặt sau khi biết điểm bán thực nhưng trước khi có số đo của nguồn đơn giản.

  Kết luận chỉ cho traffic học viên; giảng viên/admin là mức 2 giả định, không thuộc kết luận.
- Tiêu chí v1 và v2 giữ nguyên. Các số đo trên không dẫn tới thay đổi tiêu chí.

## Tài liệu tham khảo

- [L-Unistudium] Milani, Biondi, Franzoni, *Unistudium 2022: students groups logs on moodle*, Zenodo v1.2, DOI 10.5281/zenodo.13763175, CC BY 4.0. https://zenodo.org/records/13763175
- [L-Feitelson] D. G. Feitelson, *Workload Modeling for Computer Systems Performance Evaluation*, Cambridge University Press, 2015. https://www.cs.huji.ac.il/~feit/wlmod/
