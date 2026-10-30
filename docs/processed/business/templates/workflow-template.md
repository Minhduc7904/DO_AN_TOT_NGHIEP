# <Tên luồng nghiệp vụ> v1

> **Trạng thái:** Nháp | Đề xuất — chờ Đức xác nhận | Đã xác nhận
>
> **Service tham gia:** `<service>`, `<service>`
>
> **Phụ thuộc:** link tới contract, ownership, ADR liên quan trong [architecture](../../architecture/).

## 1. Mục đích

Một đoạn: luồng này giải quyết việc gì cho ai.

## 2. Actor và tiền điều kiện

| Actor | Vai trò | Tiền điều kiện |
| --- | --- | --- |

## 3. Máy trạng thái

Bảng trạng thái, điều kiện chuyển và service chịu trách nhiệm chuyển.

| Từ | Sang | Điều kiện | Service |
| --- | --- | --- | --- |

## 4. Luồng chính

Đánh số từng bước; ghi rõ bước đồng bộ (HTTP) hay bất đồng bộ (command).

## 5. Ngoại lệ và lỗi

| Tình huống | Hành vi hệ thống | Người dùng thấy |
| --- | --- | --- |

## 6. Quy tắc ràng buộc

Mỗi quy tắc một dòng, có mã (ví dụ `BR-01`) để các tài liệu khác tham chiếu.

## 7. API và command liên quan

Link tới contract; không chép lại schema.

## 8. Dữ liệu liên quan

Bảng và service sở hữu; link tới [data-ownership-and-fault-matrix-v2](../../architecture/data-ownership-and-fault-matrix-v2.md).

## 9. Đối chiếu code và test

| Quy tắc | Use case / file | Test |
| --- | --- | --- |
