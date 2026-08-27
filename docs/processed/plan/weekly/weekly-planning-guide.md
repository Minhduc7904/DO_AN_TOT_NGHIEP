# Hướng dẫn bảng task chung theo tuần

## Mục đích

`docs/processed/plan/weekly/` là điểm vào chung để Đức và Bách xem công việc tuần, nhận task và theo dõi tiến độ. Thư mục này không thay thế plan canonical hoặc hồ sơ công việc cá nhân.

## Cấu trúc một tuần

```text
week-xx_yyyy-mm-dd_to_yyyy-mm-dd/
├── weekly-overview.md
├── task-01_short-title.md
├── task-02_short-title.md
└── task-03_short-title.md
```

- `weekly-overview.md` là một file duy nhất nêu mục tiêu tuần, link tới plan canonical, bảng task/owner/trạng thái, ưu tiên, phụ thuộc, rủi ro và tiêu chí kết thúc tuần.
- Mỗi `task-xx_short-title.md` là một task nhỏ có người phụ trách duy nhất. File phải nêu yêu cầu, phần không làm, đầu vào/phụ thuộc, sản phẩm kỳ vọng, DoD, trạng thái và link hồ sơ workspace.

## Cách sử dụng

1. Đầu tuần, chia hạng mục của plan canonical thành các task nhỏ, kiểm chứng được và phân cho Đức hoặc Bách.
2. Người thực hiện mở các file có trường **Người phụ trách** là mình để biết task cần làm.
3. Khi nhận task, đổi trạng thái thành `Đã giao` hoặc `Đang thực hiện`; nên tạo input trong workspace cá nhân trước khi bắt đầu.
4. Khi work và DoD đã sẵn sàng, người phụ trách chuyển task sang `Chờ review`. Chỉ ghi nhận `Hoàn thành` sau review đạt, PR đã merge vào nhánh canonical và người phụ trách đã cập nhật completion record cùng link input/output trong workspace cá nhân.

Plan canonical hiện hành quyết định mốc, phạm vi và phân vai cấp cao. Bảng tuần chỉ cụ thể hóa thành task thực hiện; không tự thay đổi nội dung canonical.
