# Task tuần: Công cụ tải log Moodle, cắt phiên, chia hold-out và sinh phiên Markov

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_build-moodle-session-tools` |
| Tuần | `week-14_2026-11-01_to_2026-11-07` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 20/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-14/task-01-build-moodle-session-tools` |

## Yêu cầu và phạm vi

### Cần thực hiện

Bộ công cụ ở `aiops-platform/load/tools/` biến log Moodle Unistudium 2022 thành file phiên cho k6, theo [workload-design-v1](../../../architecture/workload-design-v1.md) mục 13 và Phụ lục B:

- Script tải zip từ Zenodo (record 13763175) và kiểm checksum; dữ liệu đặt ở thư mục bị gitignore.
- Chuyển log thành file phiên `{session_id, user_key, course_key, day_index, start_offset_s, actions: [{state, think_s}]}`: cắt phiên khi nghỉ > 30 phút, ánh xạ sự kiện theo bảng mục 13.2, gộp sự kiện phụ và sự kiện trùng như Phụ lục B. Báo cáo tỉ lệ phủ, số phiên, phân phối; số liệu khớp mục 2.3.
- Chia đoạn xây (ngày 0–59) và hold-out (ngày 60–90); thống kê đường cong giờ, ngày trung vị, ngày cao điểm chỉ lấy từ đoạn xây.
- Bộ sinh phiên từ chuỗi Markov có seed, dùng cho hai việc: "mức 2 thuần" (bảng chuyển giả định mục 5.4, think time mục 5.6) và sinh thêm phiên kiểu WESSBAS (ma trận học từ đoạn xây, mục 13.8).
- Test đơn vị chạy bằng `node --test`, không cần tải dữ liệu thật.

### Không thực hiện

- Không phát phiên bằng k6 (task-02).
- Không commit CSV gốc hay file phiên sinh ra.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: workload-design-v1 mục 2.3, 5.4, 5.6, 13, Phụ lục B; ADR-007 mục 1–2.
- Người hoặc phần việc cần phối hợp: không có.
- Rủi ro/giả định: Zenodo có thể đổi URL; script báo lỗi rõ khi checksum lệch. Giờ trong log đã bị dịch nên chỉ dùng hình dạng theo giờ (mục 2.3).

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Script tải, chuyển đổi, sinh phiên | Code | `aiops-platform/load/tools/` |
| Báo cáo chuyển đổi trên log thật | Bằng chứng | Mô tả PR |

## Definition of Done

- [ ] Script tải kiểm checksum và từ chối file lệch.
- [ ] Chuyển đổi trên log thật cho tỉ lệ phủ 95,2% và 34.247 phiên có thao tác (khớp mục 2.3, sai khác nhỏ phải được giải thích).
- [ ] File phiên đoạn xây và hold-out tách riêng; tham số đường cong chỉ lấy từ đoạn xây.
- [ ] Bộ sinh Markov cùng seed cho cùng kết quả; test đơn vị cho cắt phiên, ánh xạ, gộp, chia hold-out và sinh Markov.
- [ ] PR mở vào `main`; URL PR ghi vào card.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: [#83](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/83).
- Kết quả review: Không có GitHub `APPROVED` (giai đoạn tự bắt kịp; CI GitHub bị khóa thanh toán, kiểm tra chạy cục bộ, kết quả trong PR). Có một vòng review bằng agent ngoài GitHub; các phát hiện đã sửa trong PR. PR #83 được Bách (người phụ trách) merge ngày 18/11/2026 trước khi finalization; card chuyển `Hoàn thành` bằng commit ghi nhận hậu kiểm trên `main` theo yêu cầu của Bách.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 18/11/2026 — đã merge PR #83; ghi nhận hậu kiểm, chuyển Hoàn thành.
- Ghi chú/tồn đọng: Không có. Log Moodle và file phiên không commit (dữ liệu bên thứ ba, gitignore `aiops-platform/load/data/`).
