# Báo cáo kiểm chứng độ thực của traffic học viên v1 (pilot)

> **Task:** `task-04_validate-workload-realism` (tuần 14).
>
> **Trạng thái:** v1, 18/11/2026. Đây là lần đo **pilot**: chứng minh bộ đo chạy được trên ba nguồn tải và cho số đo ban đầu. Ba run dùng code workload trước vòng review của PR #85 (xem mục 7). Trước khi thu dữ liệu thí nghiệm (tuần 15), bộ đo phải chạy lại trên code workload cuối cùng. Ngưỡng ở mục 1 giữ nguyên.
>
> **Tài liệu liên quan:** [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 2 và 4, [workload-design-v1](workload-design-v1.md) mục 10.4 và 13. Công cụ nằm ở `aiops-platform/load/tools/realism.mjs` và `validate-realism.mjs`.

## 0. Đọc nhanh

- **Kết luận theo ngưỡng đã chốt trước:** chưa nguồn nào đạt đủ ngưỡng, nên **chưa được kết luận traffic bán thực là "giống thật"**. Bán thực (mức 2+) đạt 5/7 tiêu chí có ngưỡng. Hai tiêu chí không đạt đều về **thời lượng phiên**: KS D = 0,101 (ngưỡng 0,1) và trung vị lệch −43% (ngưỡng ±10%).
- **Về thứ hạng, bán thực gần hold-out nhất trên mọi đại lượng.** Ví dụ JSD tỉ lệ thao tác: bán thực 0,019, mức 2 thuần 0,132, mức 1 0,299. Pearson dáng theo giờ lần lượt là 0,96, 0,68 và 0,08. Mức 2 thuần không đạt tiêu chí nào; mức 1 cũng vậy.
- **Khoảng lệch thời lượng không do cơ chế phát lại.** Run bán thực khớp kế hoạch của nó: KS D thời lượng giữa run và kế hoạch là 0,022. Phần lệch có sẵn trong dữ liệu xây: chính 60 ngày đầu của log Moodle so với 31 ngày hold-out đã lệch trung vị thời lượng −37% (mục 5).
- **Hai lỗi đo được sửa sau lần chạy đầu** (mục 6). Cả hai làm công cụ đo sai đại lượng, không phải ngưỡng. Bảng ghi cả số trước và sau khi sửa.

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

**Ba run:** cùng stack đầy đủ, cùng thời lượng 2.880 s (một ngày nén ×30), chạy lần lượt ngày 18/11/2026.

| | (a) Mức 1 | (b) Mức 2 thuần | (c) Bán thực (mức 2+) |
| --- | --- | --- | --- |
| `run_id` | `w14-t04-level1-r1` | `w14-t04-assumed-r1` | `w14-t04-moodle-r1` |
| Nguồn phiên | `scenarios/level-1.js`, VU cố định (W1: 1 VU, W3: 4 VU) | Máy trạng thái với tham số giả định (`params/student-assumed-v1.json`) | Phiên thật của 4 ngày trong phần xây (ngày 30, 43, 52, 42) |
| Kế hoạch | không có | `assumed-normal-mixed-k4-v1` (sha256 `02393100e6fe04a4…`) | `moodle-normal-mixed-k4-v1` (sha256 `471ef74a84b9a955…`) |
| Seed | 301 | 302 | 302 |
| Phiên kế hoạch / đã chạy | không có / 1.507 phiên quan sát | 1.246 / 1.245 | 1.246 / 1.245 |
| `dropped_iterations` | không áp dụng | 0 | 0 |
| Request; tỉ lệ lỗi; p95 | 11.532; 0%; ≤ 45 ms | 10.009; 0,07%; 44 ms | 12.840; 0,07%; 43 ms |
| `end_reason` | không áp dụng | completed 1.217, run_end 22, auth_failed 6 | completed 1.193, run_end 48, auth_failed 3, unexpected_status 1 |
| Nhật ký đo | `k6-points.json.gz` (`1e385cc8b4d258ec…`) | `actions.jsonl` (`b55d8811616a763b…`) | `actions.jsonl` (`3ebd35be41a4a285…`) |

Thư mục `results/` không commit (gitignore). Mã băm trên là 16 ký tự đầu của sha256.

## 3. Cách đo

Hold-out và cả ba run được đưa về cùng một dạng: phiên = dãy thao tác `{state, think_s}`.

- **Đo trên traffic thật sự gửi đi, ở phía client.** Workload-design-v1 mục 10.4 ghi "đo trên log gateway". Nhưng log gateway không mang định danh người dùng hay phiên, nên không cắt được phiên ở phía server. Bộ đo dùng nhật ký của k6: `actions.jsonl` cho mức 2/2+ (mỗi dòng là một request đã gửi, có `session_key`, `action_index`) và điểm `http_req_duration` của output JSON cho mức 1. Hai nguồn này ghi đúng những request đã đi tới gateway, nên vẫn giữ ý "không đo trên kịch bản".
- **Bỏ bước chèn đầu phiên.** Log Moodle không có `LOGIN`, `DASH`, `REGISTER`, `REFRESH`, nên các trạng thái này bị loại ở cả bốn nguồn. Phiên chỉ có các bước này (ví dụ phiên mức 2 thuần thoát ngay sau dashboard) cũng bị loại. Vì vậy số phiên quan sát được của (b) là 1.105.
- **Phiên của mức 1.** Mức 1 không có khái niệm phiên. Mỗi lượt (VU, iteration) của hành trình W1 hoặc W3 được tính là một phiên. Request được quy về trạng thái bằng route mẫu (`LEVEL1_ROUTE_STATE`), và các request liên tiếp cùng trạng thái cách nhau dưới 1 s được gộp thành một thao tác. Vì executor dùng VU cố định, số phiên (1.507) không bằng 1.246 như hai run kia. Ràng buộc "cùng tổng số phiên" của mục 10.4 vì thế chỉ giữ được cho (b) và (c).
- **Think time và thời lượng.** Think time là khoảng từ lúc request cuối của thao tác trước kết thúc tới lúc thao tác sau bắt đầu. Thời lượng phiên là tổng các khoảng nghỉ đó, đúng như log Moodle, nơi mỗi sự kiện là tức thời. Hold-out kẹp think time ở 300 s, cùng trần với kế hoạch phát lại (workload-design-v1 mục 13.3).
- **Tham chiếu cho đại lượng lịch đến** (dáng theo giờ, đỉnh/trung bình, dispersion, Hurst) là 4 ngày hold-out chọn theo cùng luật với profile `normal-mixed` (ngày 80, 83, 60, 65; 1.075 phiên), nén ×30 như run. Đại lượng mức phiên dùng toàn bộ 9.709 phiên hold-out.

## 4. Kết quả

Số đo sau khi sửa hai lỗi ở mục 6. Ô **đậm** là đạt ngưỡng.

| Đại lượng | (a) Mức 1 | (b) Mức 2 thuần | (c) Bán thực | Hold-out |
| --- | --- | --- | --- | --- |
| Phiên quan sát | 1.507 | 1.105 | 1.242 | 9.709 |
| KS D thao tác/phiên | 0,436 | 0,159 | **0,089** | |
| Lệch trung vị thao tác/phiên | +133% | **0%** | **0%** | trung vị 3 |
| KS D thời lượng | 0,689 | 0,288 | 0,101 | |
| Lệch trung vị thời lượng | −87% | −45% | −43% | trung vị 65 s |
| KS D think time | 0,962 | 0,118 | **0,073** | |
| Lệch trung vị think time | −89% | +19% | **0%** | trung vị 14 s |
| JSD tỉ lệ thao tác | 0,299 | 0,132 | **0,019** | |
| Pearson dáng theo giờ | 0,08 | 0,68 | 0,96 | |
| Đỉnh/trung bình | 1,21 | 2,09 | 3,17 | 4,02 |
| Index of dispersion | 0,13 | 5,18 | 10,12 | 9,78 |
| Hurst (aggregated variance) | 0,51 | 0,99 | 0,98 | 0,97 |
| **Đạt mọi ngưỡng** | không (0/7) | không (2/7) | không (5/7) | |

Đọc kết quả:

- **Mức 1** đúng như thiết kế: tải phẳng (đỉnh/trung bình 1,21, dispersion < 1, Hurst ≈ 0,5 như quá trình không nhớ), phiên dày thao tác và gần như không nghỉ. Đây là mốc "giả lập đơn giản".
- **Mức 2 thuần** có trung vị số thao tác đúng (do tham số giả định được chọn theo OULAD và thống kê chung), nhưng phân phối lệch: KS D 0,159, tỉ lệ loại thao tác JSD 0,132. Lịch đến có dao động (Hurst 0,99) nhưng đỉnh thấp hơn thật (2,09 so với 4,02).
- **Bán thực** gần hold-out nhất trên mọi đại lượng. Tỉ lệ thao tác, think time và số thao tác/phiên đạt ngưỡng; dispersion và Hurst gần như trùng hold-out. Đỉnh/trung bình thấp hơn (3,17 so với 4,02) vì 4 ngày xây có đỉnh trong ngày thấp hơn 4 ngày hold-out cùng luật chọn. Thời lượng phiên không đạt.

## 5. Chẩn đoán phần không đạt: thời lượng phiên

Để tách lỗi phát lại khỏi khác biệt của dữ liệu, cùng bộ đo được chạy thêm trên kế hoạch và trên phần xây (không chỉnh gì theo kết quả này):

| So sánh | KS D thao tác | KS D thời lượng | Lệch trung vị thời lượng | KS D think | JSD |
| --- | --- | --- | --- | --- | --- |
| Run bán thực so với kế hoạch của nó | 0,020 | 0,022 | −5% (37 s / 39 s) | 0,073 | |
| Kế hoạch `normal-mixed` so với hold-out | 0,072 | 0,088 | −40% | 0,020 | 0,018 |
| Toàn bộ phần xây (ngày 0–59) so với hold-out | 0,069 | 0,064 | −37% | 0,026 | 0,021 |
| Kế hoạch `healthy-spike` so với hold-out | 0,031 | 0,042 | +28% | 0,056 | 0,004 |

- **Cơ chế phát lại trung thành với kế hoạch.** Run so với kế hoạch có KS D 0,02 cho số thao tác và thời lượng. Phần lệch −5% trung vị đến từ 48 phiên bị cắt ở cuối run (`run_end`).
- **Lệch trung vị có sẵn trong dữ liệu.** Ngay cả hai nửa của cùng log thật (xây và hold-out) cũng lệch −37% về trung vị thời lượng, trong khi KS D chỉ 0,064. Nguyên nhân: khoảng 18% phiên chỉ có một thao tác (thời lượng đúng 0), và quanh trung vị phân phối thời lượng thưa, nên một dịch chuyển nhỏ của hàm phân phối làm trung vị nhảy xa. Phiên trong 31 ngày cuối học kỳ dài hơn (gần kỳ thi). Với dữ liệu này, tiêu chí "trung vị thời lượng lệch < 10%" ngay cả dữ liệu thật của chính LMS cũng không đạt.
- **Think time của run lệch thêm khoảng 0,05 KS D so với kế hoạch** (0,073 so với 0,020). Log Moodle có độ phân giải 1 s, nên think time của kế hoạch là số nguyên. Think time đo trên run là số thực (cộng độ trễ của k6 và mạng), làm hàm phân phối lệch ở các bậc nguyên. Đây là giới hạn của phép đo, không phải hành vi khác.

Theo ADR-007 mục 4, không được đổi ngưỡng hay tiêu chí sau khi xem kết quả. Nếu muốn thay tiêu chí trung vị thời lượng (ví dụ chỉ dùng KS D, hoặc lấy mốc là độ lệch giữa phần xây và hold-out), phải ghi thành phiên bản tiêu chí mới kèm lý do **trước** lần đo tiếp theo, và báo cáo song song cả tiêu chí cũ. Báo cáo này chưa thay đổi gì.

## 6. Hai lỗi đo đã sửa sau lần chạy đầu

Cả hai được phát hiện khi đọc bảng của lần chạy đầu. Cả hai làm công cụ đo một đại lượng khác với đại lượng đã định nghĩa. Ngưỡng và dữ liệu run giữ nguyên; chỉ chạy lại bộ đo.

| Lỗi | Hệ quả ở lần đo đầu | Sửa | Số trước → sau |
| --- | --- | --- | --- |
| k6 ≥ 0.41 ghi `vu`, `iter` vào `metadata` của điểm JSON, không còn là tag. Công cụ đọc `tags.vu`, `tags.iter` nên mọi request mức 1 dồn về 2 "phiên". | Mức 1 chỉ có 2 phiên, số đo vô nghĩa | Đọc `metadata.vu`, `metadata.iter` (vẫn đọc tag cho output cũ); test dùng đúng dạng output của k6 | Phiên mức 1: 2 → 1.507 |
| Thời lượng phiên của run được tính từ đầu request đầu tới cuối request cuối, tức cộng thêm thời gian server xử lý. Hold-out thì tính tổng khoảng nghỉ. | Phiên một thao tác của run ra khoảng 0,05 s thay vì 0; riêng điều này đẩy KS D thời lượng lên khoảng 0,17 | Thời lượng của run = tổng khoảng nghỉ, cùng định nghĩa với hold-out; test có phiên một thao tác | KS D thời lượng bán thực: 0,174 → 0,101; mức 2 thuần: 0,287 → 0,288 |

## 7. Giới hạn của lần đo pilot

- **Code workload trước review.** Ba run dùng code của PR #85 trước vòng review (end reason cũ `completed`; gán tài khoản chưa dùng hoán vị nên hai phiên có thể trùng một tài khoản seed). Có 1 phiên ở run bán thực bị 409 `QUIZ_ATTEMPT_ALREADY_SUBMITTED`, khả năng do trùng tài khoản. Phải chạy lại trên code cuối cùng trước tuần 15.
- **Nhiễu token nội bộ.** Stack chạy với TTL service token 60 s (cần cho fault C6). Khoảng 0,05% request đăng nhập bị 401 `SERVICE_TOKEN_INVALID` (6 phiên ở run (b), 3 phiên ở run (c) kết thúc `auth_failed`). Run kiểm chứng độ thực nên chạy với TTL mặc định.
- **Lỗi kết nối giữ sống.** 4 request `PUT …/progress` ở run (c) gặp `EOF` sau 6 s nghỉ: kết nối keep-alive bị server đóng đúng lúc dùng lại. Client đã thử lại thành công (`outcome = retried`).
- **Một run, một seed cho mỗi nguồn,** và chỉ profile `normal-mixed`. Chưa có khoảng tin cậy giữa các seed.
- **Không kiểm chứng giảng viên/admin bằng log Moodle** (không có dữ liệu; theo task card, dùng workload-design-v1 mục 10.1–10.3).

## 8. Kết luận và việc tiếp theo

1. Theo tiêu chí chốt trước: **chưa đạt**. Bán thực gần hold-out nhất (đạt 5/7 tiêu chí, hơn hẳn mức 2 thuần 2/7 và mức 1 0/7) nhưng không đạt về thời lượng phiên. Do đó chưa được dùng cụm từ "giống thật" trong báo cáo đồ án; chỉ được nói "gần hold-out hơn mức 1 và mức 2 thuần trên mọi đại lượng đo".
2. Mục 5 cho thấy phần lệch thời lượng nằm ở khác biệt giữa giai đoạn xây và giai đoạn hold-out của log, không ở cơ chế phát lại.
3. Trước tuần 15: chạy lại ba run trên code workload đã merge, với TTL token mặc định. Nếu đổi tiêu chí thời lượng thì ghi phiên bản tiêu chí mới trước khi chạy (mục 5).

## 9. Tái lập

```bash
cd aiops-platform/load
# Kế hoạch (task-01): data/plans/{assumed,moodle}-normal-mixed-k4-v1.json; hold-out: data/sessions/moodle-holdout-v1.json
# Mức 1: output JSON cần system tag vu, iter (k6 ghi chúng vào metadata của điểm).
TAGS=proto,status,method,url,name,group,check,error,error_code,scenario,expected_response,vu,iter
RUN_ID=w14-t04-level1-r1 JOURNEYS=w1,w3 VUS_W1=1 VUS_W3=4 DURATION=48m SEED=301 ./run-k6.sh level-1 \
  --system-tags=$TAGS --out json=/results/w14-t04-level1-r1/k6-points.json.gz
STUDENT_PRE_VUS=220 STUDENT_MAX_VUS=300 RUN_ID=w14-t04-assumed-r1 WORKLOAD_SEED=302 \
  PLAN=data/plans/assumed-normal-mixed-k4-v1.json ./run-k6.sh student-replay
STUDENT_PRE_VUS=220 STUDENT_MAX_VUS=300 RUN_ID=w14-t04-moodle-r1 WORKLOAD_SEED=302 \
  PLAN=data/plans/moodle-normal-mixed-k4-v1.json ./run-k6.sh student-replay
node tools/validate-realism.mjs \
  --run level1=results/w14-t04-level1-r1 \
  --run assumed=results/w14-t04-assumed-r1 \
  --run moodle=results/w14-t04-moodle-r1 --out results/realism-report-v1.json
```

## Tài liệu tham khảo

- [L-Unistudium] Milani, Biondi, Franzoni, *Unistudium 2022: students groups logs on moodle*, Zenodo v1.2, DOI 10.5281/zenodo.13763175, CC BY 4.0. https://zenodo.org/records/13763175
- [L-Feitelson] D. G. Feitelson, *Workload Modeling for Computer Systems Performance Evaluation*, Cambridge University Press, 2015. https://www.cs.huji.ac.il/~feit/wlmod/
