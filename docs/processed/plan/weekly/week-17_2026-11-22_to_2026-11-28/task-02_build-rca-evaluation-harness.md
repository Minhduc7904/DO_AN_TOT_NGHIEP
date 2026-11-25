# Task tuần: RCA evaluation harness (Top-K, coverage, mốc tham chiếu)

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_build-rca-evaluation-harness` |
| Tuần | `week-17_2026-11-22_to_2026-11-28` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Không có |
| Ưu tiên | Cao |
| Hạn dự kiến | 28/11/2026 (mốc bù tiến độ) |
| Nhánh thực hiện | `feat/week-17/task-02-build-rca-evaluation-harness` |

## Yêu cầu và phạm vi

### Cần thực hiện

Theo [evaluation-protocol-v1](../../../architecture/evaluation-protocol-v1.md) mục 16, 18, 20.3, 20.6, 20.7 và [catalogue case](../../../architecture/complex-case-catalogue-and-rca-result-v0.md) mục 5.2–5.3. Harness RCA trong `evaluation/` (cạnh harness phát hiện của tuần 16):

- **`RcaIncidentResult`** (`rca_result_schema_version = "0"`): đọc và kiểm schema, mỗi incident một file bất biến cộng `manifest.json` (`incident_id`, `run_id`, `created_at`, `sha256`) ở `aiops-platform/training/results/<run_id>/`. Entry có candidate ngoài candidate set thì run thành `diagnostic_only` kèm lý do. Chuỗi trích từ log/trace là dữ liệu không tin cậy.
- **`service-candidates.v1`** thành config có version (10 service/worker, thứ tự tie-break mục 18.1). Ranking có tối đa một entry cho mỗi candidate; candidate không bị bỏ vì thiếu modality (mục 18.2).
- **Ghép prediction với incident matched** của evaluation artifact phát hiện (mục 16.2, 17.4): chỉ incident matched được chấm RCA; `root_cause_service` lấy từ `RunGroundTruth`, chỉ evaluator đọc.
- **Chỉ số:**
  - conditional Top-1/Top-3/MRR/Average Rank (mục 18.3);
  - `eligible_fault_runs`, `matched_detected_runs`, `rca_output_runs`, `insufficient_evidence_runs`, `rca_evaluable_runs`, `rca_coverage` (mục 18.5);
  - owner-level Top-K là diagnostic phụ (mục 18.3, 20.3);
  - end-to-end với semantic miss (mục 18.6);
  - theo case và gộp; số đếm và mẫu số (mục 20.6).
- **Mốc tham chiếu:** constant ranking theo thứ tự tie-break và random ranking (kỳ vọng Top-1 = 1/10, có seed) (mục 15.2, 18.4).
- **Thống kê** (mục 20.7), dùng ở test; trên validation chỉ báo số đếm:
  - bootstrap CI theo incident/run, phân tầng theo case;
  - McNemar exact cho Top-1 ghép cặp, kèm p-value hiệu chỉnh Holm cho họ so sánh;
  - bootstrap ghép cặp CI cho chênh lệch MRR.
- **`analyst_kind`** (trường của evaluation instance, protocol mục 3.2, không thuộc `RcaIncidentResult`): kiểm theo đúng enum `rca_engine | manual_baseline_auto | simplerca_baseline | baro_baseline | static_threshold_baseline | constant_ranking_reference | random_ranking_reference`; phân biệt các phương pháp cùng `analyst_kind` bằng `model.name`.
- **Evaluation artifact RCA có lineage:** sha256 của prediction, incident artifact, config. Chặn split test khi không có `--final-test` và chặn code chưa commit, như harness phát hiện.

### Không thực hiện

- Không cài thuật toán RCA nào (task-03 đến task-06).
- Không tạo composite score kết hợp độ chính xác và thời gian (mục 15.5).
- Không chấm split test.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: harness phát hiện và evaluation artifact của tuần 16 (`evaluation/detection/`), `RunGroundTruth` (tuần 14–15).
- Người hoặc phần việc cần phối hợp: task-03 đến task-06 xuất đúng schema; task-08 dùng harness để chấm và chọn.
- Rủi ro/giả định: schema `RcaIncidentResult` v0 là đề xuất của catalogue; nếu phải đổi trường thì cập nhật catalogue và bump phiên bản, không sửa ngầm.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Harness RCA, lệnh chấm, test | Code | `aiops-platform/training/src/aiops_training/evaluation/rca/` |
| `service-candidates-v1.json`, RCA evaluation config | Config | `aiops-platform/training/configs/` |
| README phần RCA harness | Docs | `aiops-platform/training/README.md` |

## Definition of Done

- [ ] Schema `RcaIncidentResult` v0 được kiểm; prediction sai schema hoặc có candidate ngoài set bị đánh dấu `diagnostic_only` kèm lý do, có test.
- [ ] Top-1/Top-3/MRR/Average Rank, coverage và end-to-end tính đúng trên prediction và ground truth dựng tay, gồm `insufficient_evidence`, run không có incident matched, hòa điểm.
- [ ] Mốc constant và random có trong artifact; random tất định theo seed.
- [ ] Bootstrap CI, McNemar exact (kèm Holm) và bootstrap ghép cặp cho chênh lệch MRR có test với ví dụ tính tay.
- [ ] `analyst_kind` ngoài enum của mục 3.2 bị từ chối, có test.
- [ ] Split test bị chặn khi không có `--final-test`; artifact có lineage sha256; test, lint đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Không tạo (giai đoạn tự bắt kịp; bằng chứng nằm trong PR).
- Output workspace: Không tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 25/11/2026 — lập card.
- Ghi chú/tồn đọng: Không có.
