# Tài liệu tham khảo đã tải

Repo GitHub của đồ án là **public**, nên chỉ commit tài liệu có giấy phép cho phép phân phối lại. Tài liệu còn lại nằm ở `local-only/` (có `.gitignore`, không lên Git); chạy `./fetch-papers.sh` để tải lại mọi tệp trên máy mới. Trích dẫn đầy đủ: [../references.md](../references.md) và bản chuẩn [literature-matrix-v1](../../../plan/literature-matrix-v1.md).

## Được commit (giấy phép mở, ghi nguồn khi dùng)

| Tệp | Khóa | Giấy phép |
| --- | --- | --- |
| `2017-kuzilek-oulad.pdf` | L-OULAD | CC BY 4.0 |
| `2022-milani-unistudium-readme.txt` | L-Unistudium | CC BY 4.0 (README của bộ dữ liệu; dữ liệu CSV **không** commit) |
| `2024-atil-llm-nondeterminism.pdf` | L-LLMNondet | CC BY 4.0 |
| `2024-chen-rcacopilot.pdf` | L-RCACopilot | CC BY 4.0 |
| `2024-pham-baro.pdf` | L-BARO | CC BY 4.0 |
| `2024-pham-causal-rca-how-far.pdf` | L-Pham2024ASE | CC BY 4.0 |
| `2025-fang-rca-benchmark.pdf` | L-Fang2025 | CC BY-NC-ND 4.0 (bản nguyên, không chỉnh sửa, mục đích học thuật) |
| `2025-pham-rcaeval-benchmark.pdf` | L-RCAEval | CC BY 4.0 |
| `2026-castelo-simgym.pdf` | L-SimGym | CC BY 4.0 |

> **Về `2022-milani-unistudium-readme.txt`:** đây là README nguyên bản của bộ dữ liệu. Link trang phòng lab trong đó (`https://www.dmi.unipg.it/kitlab/`) đã không còn truy cập được (kiểm 17/11/2026). Dữ liệu tải tại Zenodo: https://zenodo.org/records/13763175 — tệp `Unistudium_students_groups_logs_2022.zip` (991 KB, md5 `cdec50cd4a5fc3abf3204f06bf43ee25`, CC BY 4.0). Dữ liệu không commit vào repo (ADR-007); script tải kèm kiểm checksum làm ở tuần 14 (`aiops-platform/load/tools/`).

## Chỉ lưu cục bộ (`local-only/`, không commit)

| Tệp | Khóa | Lý do |
| --- | --- | --- |
| `1995-paxson-poisson-modeling.pdf` | L-PaxsonFloyd | Bản tác giả, bản quyền IEEE |
| `2006-schroeder-open-closed.pdf` | L-Schroeder | Bản quyền tác giả/USENIX |
| `2008-van-hoorn-workload-generation.pdf` | L-vanHoorn | Bản tác giả, bản quyền Springer |
| `2011-wilson-think-times.pdf` | L-Wilson | Bản quyền CMG |
| `2013-kizilcec-disengagement.pdf` | L-Kizilcec2013 | Bản quyền ACM |
| `2015-feitelson-workload-modeling-book.pdf` | L-Feitelson | Chỉ cho phép dùng cá nhân |
| `2021-locke-logassist.pdf` | L-LogAssist | Bản tác giả, bản quyền IEEE |
| `2023-ahmed-llm-incident-root-cause.pdf` | L-Ahmed2023 | arXiv: chỉ arXiv được phân phối |
| `2024-zhang-failure-diagnosis-survey.pdf` | L-Survey | arXiv: chỉ arXiv được phân phối |
| `2025-lu-agent-ab.pdf` | L-AgentAB | arXiv: chỉ arXiv được phân phối |
| `2025-lu-uxagent.pdf` | L-UXAgent | arXiv: chỉ arXiv được phân phối |
