# Báo cáo kiểm chứng độ thực của traffic học viên v1

> **Task:** `task-04_validate-workload-realism` (tuần 14).
>
> **Trạng thái:** v1, cập nhật 19/11/2026. Số đo ở mục 0, 2, 4 và 5 lấy từ ba run `r2` chạy trên code workload đã merge (`main` `ba2d7da`, gồm PR #85 sau review và PR #90) với TTL service token mặc định 600 s. Lần đo pilot ngày 18/11/2026 (run `r1`, code trước review, TTL 60 s) giữ ở mục 7 để đối chiếu. Ngưỡng ở mục 1 không đổi giữa hai lần đo. Mục 10 (thêm ngày 19/11/2026, task-07 tuần 15) chấm lại `r2` theo [tiêu chí v2](workload-realism-criteria-v2.md).
>
> **Tài liệu liên quan:** [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 2 và 4, [workload-design-v1](workload-design-v1.md) mục 10.4 và 13. Công cụ nằm ở `aiops-platform/load/tools/realism.mjs` và `validate-realism.mjs`.

## 0. Đọc nhanh

- **Kết luận theo ngưỡng đã chốt trước:** chưa nguồn nào đạt đủ ngưỡng, nên **chưa được kết luận traffic bán thực là "giống thật"**. Bán thực (mức 2+) đạt 6/7 tiêu chí có ngưỡng. Tiêu chí không đạt là **trung vị thời lượng phiên**: lệch −42% (ngưỡng ±10%). KS D thời lượng = 0,099 đạt ngưỡng 0,1 nhưng chỉ cách ngưỡng 0,001 (lần pilot là 0,101), nên coi là sát ngưỡng, không phải đạt chắc chắn.
- **Về thứ hạng, bán thực gần hold-out nhất trên mọi đại lượng.** Ví dụ JSD tỉ lệ thao tác: bán thực 0,019, mức 2 thuần 0,132, mức 1 0,300. Pearson dáng theo giờ lần lượt là 0,96, 0,68 và −0,02. Mức 2 thuần đạt 1/7 tiêu chí (trung vị số thao tác); mức 1 không đạt tiêu chí nào.
- **Khoảng lệch thời lượng không do cơ chế phát lại.** Run bán thực khớp kế hoạch của nó: KS D thời lượng giữa run và kế hoạch là 0,020. Phần lệch có sẵn trong dữ liệu xây: chính 60 ngày đầu của log Moodle so với 31 ngày hold-out đã lệch trung vị thời lượng −37% (mục 5).
- **Số đo gần như không đổi so với pilot** (mục 7). Các đại lượng đo ở phía client do kế hoạch phiên quyết định; code sửa sau review chủ yếu đổi phía server (khóa seed đúng, không trùng tài khoản). Run `r2` không còn phiên `auth_failed` hay `unexpected_status`.
- **Theo tiêu chí v2** (đăng ký 19/11/2026, [workload-realism-criteria-v2](workload-realism-criteria-v2.md)): bán thực **đạt**, mức 2 thuần và mức 1 không đạt (mục 10). Đây là chấm lại `r2` sau khi đã xem dữ liệu; bằng chứng chính của v2 là run dataset v0 (tuần 15).
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
- **Một run, một seed cho mỗi nguồn,** và chỉ profile `normal-mixed`. Chưa có khoảng tin cậy giữa các seed.
- **Không kiểm chứng giảng viên/admin bằng log Moodle** (không có dữ liệu; theo task card, dùng workload-design-v1 mục 10.1–10.3).
- **Run thí nghiệm dùng TTL 60 s.** Lớp fault đặt TTL 60 s cho mọi run (healthy lẫn fault) để C6 có cùng cấu hình. Run `r2` dùng 600 s để đo hành vi người dùng không lẫn nhiễu token; ở profile của task-03 (TTL 60 s), nhiễu này làm 0,02–0,22% phiên kết thúc `auth_failed`.

## 8. Kết luận và việc tiếp theo

1. Theo tiêu chí chốt trước: **chưa đạt**. Bán thực gần hold-out nhất (đạt 6/7 tiêu chí, hơn hẳn mức 2 thuần 1/7 và mức 1 0/7) nhưng không đạt trung vị thời lượng phiên, và KS D thời lượng chỉ đạt sát ngưỡng. Do đó chưa được dùng cụm từ "giống thật" trong báo cáo đồ án; chỉ được nói "gần hold-out hơn mức 1 và mức 2 thuần trên mọi đại lượng đo".
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

## Tài liệu tham khảo

- [L-Unistudium] Milani, Biondi, Franzoni, *Unistudium 2022: students groups logs on moodle*, Zenodo v1.2, DOI 10.5281/zenodo.13763175, CC BY 4.0. https://zenodo.org/records/13763175
- [L-Feitelson] D. G. Feitelson, *Workload Modeling for Computer Systems Performance Evaluation*, Cambridge University Press, 2015. https://www.cs.huji.ac.il/~feit/wlmod/
