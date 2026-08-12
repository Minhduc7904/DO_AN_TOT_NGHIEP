# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_thesis-project-and-github-setup` |
| Tên task | Chuẩn bị đồ án, dự án và tổ chức GitHub |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-02_2026-08-09_to_2026-08-15` |
| Trạng thái | Hoàn thành |
| Ngày tạo | 09/08/2026 |
| Thời gian dự kiến | 09/08/2026 → 12/08/2026 |

## Mục tiêu và phạm vi

### Task cần làm gì?

Chuẩn bị nền tảng làm việc cho đồ án: tổ chức repository GitHub, chuẩn hóa README và thư mục tài liệu, tạo workspace chia việc cho Đức/Bách, đồng thời viết skill và rule để AI agent tuân thủ cách làm việc của nhóm.

### Phạm vi không thực hiện

- Không triển khai chức năng chuyên môn của hệ thống AIOps/RCA.
- Không viết chi tiết các task chuyên môn tiếp theo của Bách hoặc Đức.
- Không thay đổi nội dung gốc của tài liệu trong `docs/raw/`.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Repository đồ án trên GitHub | Code | `https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP` |
| Cấu trúc tài liệu và workspace chia việc | Docs | `../../../../../workspace/` và `../../../../../docs/` |
| Skill và rule cho AI agent | Docs | `../../../../../agent-resources/skills/graduation-workspace/` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: mô tả đồ án, kế hoạch ban đầu và các tài liệu học phần hiện có trong repository.
- Người cần phối hợp: Bách sử dụng workspace riêng sau khi cấu trúc được tạo.
- Rủi ro hoặc giả định: quy tắc chỉ phát huy hiệu lực khi mọi thành viên và AI agent đọc `AGENTS.md` hoặc `CLAUDE.md` trước khi làm việc.

## Definition of Done

- [x] Repository GitHub có README nêu rõ mục tiêu, phạm vi và định hướng của đồ án.
- [x] Tài liệu được phân biệt thành `docs/raw/` và `docs/processed/`.
- [x] Có workspace riêng cho Đức và Bách, chia theo tuần, task, `input/` và `output/`.
- [x] Có skill/rule bằng tiếng Việt hướng dẫn cách tổ chức task, viết input/output và điều kiện hoàn thành.
- [x] Claude Code, Codex và GitHub Copilot có file chỉ dẫn để đọc quy tắc trước khi thay đổi dự án.
