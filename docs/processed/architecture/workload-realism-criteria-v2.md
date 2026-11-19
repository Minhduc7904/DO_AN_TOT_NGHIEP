# Tiêu chí độ thực v2 của traffic học viên (đăng ký trước)

> **Task:** `task-07_validate-workload-realism-v2` (tuần 15).
>
> **Trạng thái:** đăng ký ngày 19/11/2026. Tài liệu và mã chấm (`aiops-platform/load/tools/realism-v2.mjs`, hằng số `CRITERIA_V2`) được push lên GitHub **trước khi** chấm bất kỳ run nào theo v2, kể cả ba run `r2` đã có. Sau thời điểm đó không sửa tài liệu này; muốn đổi thì viết v3 theo cùng quy trình.
>
> **Tài liệu liên quan:** [workload-realism-report-v1](workload-realism-report-v1.md) (tiêu chí v1 và số đo `r1`, `r2`), [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 2 và 4, [workload-design-v1](workload-design-v1.md) mục 10.4.

## 1. Vì sao có v2

Tiêu chí v1 (ADR-007 mục 2.4) dùng ngưỡng cố định: KS D < 0,1, lệch trung vị < ±10%, JSD < 0,05. Ở lần đo `r2`, traffic bán thực đạt 6/7, trượt trung vị thời lượng phiên (−42%). Báo cáo v1 mục 5 cho thấy ngưỡng đó đánh trượt cả dữ liệu thật: 60 ngày đầu của log Moodle so với 31 ngày hold-out đã lệch trung vị thời lượng −37%, vì khoảng 18% phiên có thời lượng đúng 0 và phân phối thưa quanh trung vị. Một ngưỡng mà dữ liệu thật không qua được thì không phân biệt được workload tốt với workload xấu.

V2 thay câu hỏi "lệch có nhỏ hơn một con số tự chọn không" bằng câu hỏi "lệch có nhiều hơn mức hai đoạn log thật thường lệch nhau không". Ngưỡng do dữ liệu quyết định.

**Thiên lệch cần ghi nhận:** v2 được nghĩ ra **sau** khi đã xem kết quả v1 của `r1` và `r2`. Vì vậy chấm `r2` theo v2 là chấm sau khi xem dữ liệu và phải ghi như vậy. Bằng chứng chính của v2 là các run chưa chạy tại thời điểm đăng ký (mục 4).

## 2. Định nghĩa

Mọi hằng số nằm trong `CRITERIA_V2` (`realism-criteria.v2`).

1. **Đại lượng.** Bảy đại lượng có ngưỡng của v1, đo bằng đúng bộ đo v1 (`realism.mjs`): KS D và lệch trung vị (trị tuyệt đối) của số thao tác/phiên, thời lượng phiên, think time; JSD tỉ lệ loại thao tác. Hold-out như v1: mọi phiên của ngày 60–90 cho đại lượng mức phiên.
2. **Độ phân giải thời gian.** Log Moodle ghi thời điểm sự kiện theo giây, nên think time của log là số nguyên. Với run, mốc bắt đầu/kết thúc của request được làm tròn xuống theo giây trước khi tính khoảng nghỉ (`timeResolutionMs` = 1000), áp như nhau cho mọi nguồn. Báo cáo v1 mục 5 cho thấy riêng khác biệt độ phân giải làm KS D think time lệch thêm khoảng 0,05.
3. **Nhóm ngày tham chiếu.** Từ phần xây của log (ngày 0–59, `moodle-build-v1.json`), rút `draws` = 1.000 nhóm, mỗi nhóm `k` ngày khác nhau (cùng `k` với kế hoạch của run, hiện là 4), bộ sinh số seed 20261119. Pool ngày theo profile:
   - `normal-mixed`: ngày có số phiên trong khoảng tứ phân vị [Q1, Q3] của phần xây;
   - `healthy-spike`: ngày có số phiên ≥ Q3.
   Mỗi nhóm được dựng thành kế hoạch đúng như kế hoạch phát lại (nén ×30, kẹp think time 300 s).
4. **Cùng cỡ mẫu.** Với nguồn có `n` phiên quan sát, mỗi nhóm tham chiếu rút có hoàn lại `n` phiên rồi mới đo, để nhiễu lấy mẫu của KS ngang với nguồn.
5. **Điểm.** Mỗi khoảng cách đổi thành thứ hạng giữa (mid-rank) trong phân phối 1.000 nhóm: (số nhóm lệch ít hơn + ½ số nhóm lệch bằng) / 1.000. Điểm của một mẫu là thứ hạng **lớn nhất** trong bảy đại lượng.
6. **Ngưỡng.** `tau` = phân vị 95% của điểm các nhóm tham chiếu, mỗi nhóm xếp hạng với 999 nhóm còn lại. Một nguồn **đạt v2** khi điểm ≤ `tau`. Nghĩa: xét cả bảy đại lượng cùng lúc, nguồn không lệch hold-out nhiều hơn 95% nhóm ngày thật. Lấy 95% cho từng đại lượng riêng sẽ làm dữ liệu thật trượt nhiều hơn 5%, nên không dùng.
7. **Quá trình đến** (dáng theo giờ, đỉnh/trung bình, index of dispersion, Hurst): chỉ báo cáo giá trị của nguồn cạnh khoảng 2,5–97,5% của các nhóm tham chiếu, không có ngưỡng, như v1.

**Kết luận "giống thật" theo v2** chỉ được viết khi traffic bán thực đạt v2 **và** có điểm v2 thấp hơn hai nguồn đơn giản (mức 1, mức 2 thuần), giữ cấu trúc điều kiện của v1.

## 3. Điều v2 kiểm và không kiểm

- Kế hoạch bán thực chính là một nhóm ngày thật của phần xây. Vì vậy với nguồn bán thực, v2 kiểm hai điều: bộ phát lại giữ được hình dạng phiên của kế hoạch, và nhóm ngày đã chọn không bất thường so với các ngày thật khác. V2 không chứng minh thêm điều gì về log Moodle so với hành vi người dùng của LMS này (giới hạn chung của workload-design-v1 mục 15).
- Với mức 1 và mức 2 thuần, v2 là phép thử thật: hai nguồn này không lấy từ log, nên phải tự nằm trong dao động của dữ liệu thật.
- Phiên bị cắt ở cuối run (`run_end`) làm thời lượng của run ngắn đi một chút, còn nhóm tham chiếu là kế hoạch không bị cắt. Sai lệch này làm nguồn khó đạt hơn (thận trọng), nên không hiệu chỉnh.

## 4. Áp dụng

1. **Ba run `r2`** (`w14-t04-level1-r2`, `-assumed-r2`, `-moodle-r2`): chấm theo v1 và v2, ghi rõ v2 là chấm sau khi xem dữ liệu.
2. **Bằng chứng chính:** phần traffic học viên của mọi run train và validation của dataset v0 (task-04 tuần 15), chạy sau thời điểm đăng ký trên kế hoạch dựng từ các nhóm ngày chưa ai xem. Mỗi run chấm theo profile của nó (`normal-mixed` hoặc `healthy-spike`) và báo cả v1 lẫn v2. Báo cáo tỉ lệ run đạt v2; không chọn run để báo cáo.
3. Run dataset dùng TTL service token 60 s (lớp fault), khác `r2` (600 s): phiên `auth_failed` (0,02–0,22% ở profile tuần 14) không có thao tác sau bước đăng nhập nên rơi khỏi tập quan sát. Ghi khác biệt này trong báo cáo kết quả.

## 5. Tái lập

```bash
cd aiops-platform/load
node tools/validate-realism.mjs \
  --run level1=results/w14-t04-level1-r2 \
  --run assumed=results/w14-t04-assumed-r2 \
  --run moodle=results/w14-t04-moodle-r2 \
  [--profile normal-mixed --k 4] [--build data/sessions/moodle-build-v1.json] --out results/realism-r2-v1v2.json
```

Mã chấm có test trên dữ liệu biết trước đáp án (`tools/realism-v2.test.mjs`): mid-rank khi có giá trị trùng, pool theo tứ phân vị, làm tròn theo giây, nguồn cùng phân phối với dữ liệu thật đạt còn nguồn có think time gấp đôi trượt, cùng seed cho cùng nhóm và cùng `tau`.
