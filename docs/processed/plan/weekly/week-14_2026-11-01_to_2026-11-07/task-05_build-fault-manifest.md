# Task tuần: Fault manifest và bộ bật/tắt theo lịch cho C2, C3, C4, C6

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_build-fault-manifest` |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 20/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-14/task-05-build-fault-manifest` |

## Yêu cầu và phạm vi

### Cần thực hiện

- Fault manifest có phiên bản cho 4 case MVP theo [case catalogue v0](../../../architecture/complex-case-catalogue-and-rca-result-v0.md) và [telemetry-and-ground-truth-schema-v1](../../../architecture/telemetry-and-ground-truth-schema-v1.md) mục 8–10: C2 (trễ `course-postgres`), C3 (LLM stub chậm/lỗi), C4 (trễ MinIO), C6 (dừng `identity`, rút ngắn TTL service token nếu làm được không sửa code LMS). Mỗi case: thành phần gốc, tham số, thời điểm bật theo phút của run, thời lượng, cách gỡ, kiểm tra trước/sau.
- Bộ chạy lịch dùng `aiops-platform/faults/fault-control.mjs` (PR #75): bật/tắt đúng giờ, ghi nhật ký JSON có thời điểm UTC thật của từng lệnh, luôn gỡ fault khi bị ngắt; tùy chọn đặt fault trùng cao điểm tải của profile.

### Không thực hiện

- Không làm runner campaign (tuần 15); không làm C1, C5, C7.
- Không sửa code LMS.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: `aiops-platform/faults/` (PR #75); case catalogue v0; data-ownership-and-fault-matrix-v2.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: rút ngắn TTL service token có thể cần khởi động lại `identity` với biến môi trường khác; nếu vậy ghi rõ và để tùy chọn.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Fault manifest 4 case và bộ chạy lịch | Code | `aiops-platform/faults/` |
| Run thử từng case: nhật ký bật/tắt và triệu chứng quan sát được | Bằng chứng | Mô tả PR |

## Definition of Done

- [ ] Manifest kiểm hợp lệ (schema) và có test; tham số mỗi case lấy từ tài liệu case.
- [ ] Bộ chạy lịch bật/tắt đúng thời điểm (sai số ghi trong nhật ký), gỡ fault khi bị ngắt; có test.
- [ ] Mỗi case chạy thử một lần trên stack: telemetry cho thấy triệu chứng trong cửa sổ fault và hết sau khi gỡ.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#84](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/84).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp; CI GitHub bị khóa thanh toán, kiểm tra chạy cục bộ, kết quả trong PR). Có một vòng review bằng agent ngoài GitHub; các phát hiện đã sửa trong PR. PR #84 được Bách (người phụ trách) merge ngày 18/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 18/11/2026 — đã merge PR #84; ghi nhận hậu kiểm, chuyển Hoàn thành.
- Ghi chú/tồn đọng: C6 cần TTL service token 60 s (`FAULTS_SERVICE_TOKEN_TTL_SECONDS`); TTL này gây khoảng 0,05% lỗi 401 giả ở run không có C6, nên chỉ bật cho run C6.
