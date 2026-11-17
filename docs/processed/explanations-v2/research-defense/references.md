# Danh mục tài liệu tham khảo cho phần phản biện

> **File này giải thích gì:** danh mục đầy đủ các tài liệu được nhắc trong bộ `research-defense/`, viết ở dạng chép thẳng được vào chương "Tài liệu tham khảo" của báo cáo đồ án: trích dẫn đầy đủ, DOI hoặc URL, giấy phép, file PDF cục bộ (nếu có) và chỗ dùng trong đồ án.
>
> **Khóa `[L-…]`:** trùng với khóa trong danh mục canonical [`literature-matrix-v1`](../../plan/literature-matrix-v1.md) (bản chuẩn; file này là bản đọc kèm PDF). Khóa lấy từ bảng tài liệu trong fact sheet của đợt rà soát, thêm tiền tố `L-`. Tài liệu chưa có khóa trong fact sheet được ghi "khóa đề xuất".
>
> **Trạng thái:** 17/11/2026 (tuần 16 theo lịch). Mọi DOI, tên tác giả, nơi đăng đã được đối chiếu với Crossref, trang arXiv hoặc bản PDF; chỗ nào chưa xác minh được ghi rõ.

---

> **Cột "Dùng ở":** số là file trong thư mục này (01, 02, 03, 04-defense-qa). "04 bảng phụ" trong bản nháp chỉ bảng tóm tắt các phương pháp/benchmark khác; bảng đó nay nằm ở mục 2 của chính file này.

## 1. Cách trích trong báo cáo

- **Trong bài:** dùng tên ngắn + năm, ví dụ "Fang và cs. (2025)" hoặc "[L-Fang2025]" nếu báo cáo đánh số theo khóa.
- **Phiên bản:** với bài arXiv, ghi rõ phiên bản đã đọc (ví dụ `v2`) vì số liệu có thể đổi giữa các phiên bản.
- **Bài đã đăng chính thức:** trích bản chính thức (DOI), kèm link arXiv cho người đọc mở miễn phí.
- **Số liệu do nhóm tự tính** (ví dụ thống kê trên log Unistudium) không trích như số của bài báo; ghi "tính bởi nhóm, script trong repo".

## 2. Danh mục theo nhóm

### 2.1. Đánh giá phương pháp RCA (phân tích nguyên nhân gốc)

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép bản đọc | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-Fang2025** | A. Fang, S. Zhang, Y. Yang, H. Wu, J. Xu, X. Wang, R. Wang, M. Wang, Q. Lu, P. He, "Rethinking the Evaluation of Microservice RCA with a Fault Propagation-Aware Benchmark," *Proc. ACM Softw. Eng.*, vol. 3, no. FSE, pp. 1605–1627, 2026 (FSE 2026), doi:10.1145/3797100. Bản tiền ấn phẩm: arXiv:2510.04711 (v1 06/10/2025, v2 23/12/2025). | https://arxiv.org/abs/2510.04711 | CC BY-NC-ND 4.0 | [`papers/2025-fang-rca-benchmark.pdf`](papers/2025-fang-rca-benchmark.pdf) (v2) | 01, 02 mục 1, 03 mục 2, 04 |
| **L-Pham2024ASE** | L. Pham, H. Ha, H. Zhang, "Root Cause Analysis for Microservices based on Causal Inference: How Far Are We?," in *Proc. 39th IEEE/ACM Int. Conf. Automated Software Engineering (ASE '24)*, 2024, doi:10.1145/3691620.3695065. arXiv:2408.13729. | https://arxiv.org/abs/2408.13729 | CC BY 4.0 | [`papers/2024-pham-causal-rca-how-far.pdf`](papers/2024-pham-causal-rca-how-far.pdf) (v2) | 03 mục 2, 04 |
| **L-RCAEval** | L. Pham, H. Zhang, H. Ha, F. Salim, X. Zhang, "RCAEval: A Benchmark for Root Cause Analysis of Microservice Systems with Telemetry Data," in *Companion Proc. ACM Web Conference 2025 (WWW '25 Companion)*, pp. 777–780, 2025, doi:10.1145/3701716.3715290. arXiv:2412.17015. Mã nguồn và dữ liệu: https://github.com/phamquiluan/RCAEval (MIT). | https://arxiv.org/abs/2412.17015 | CC BY 4.0 (bài); MIT (mã, dữ liệu) | [`papers/2025-pham-rcaeval-benchmark.pdf`](papers/2025-pham-rcaeval-benchmark.pdf) (v5) | 03 mục E6, 04 |
| **L-BARO** | L. Pham, H. Ha, H. Zhang, "BARO: Robust Root Cause Analysis for Microservices via Multivariate Bayesian Online Change Point Detection," *Proc. ACM Softw. Eng.*, vol. 1, no. FSE, pp. 2214–2237, 2024 (FSE 2024), doi:10.1145/3660805. arXiv:2405.09330. | https://arxiv.org/abs/2405.09330 | CC BY 4.0 | [`papers/2024-pham-baro.pdf`](papers/2024-pham-baro.pdf) (v1) | 03 mục E2, E6, 04 |
| **L-Survey** | S. Zhang, S. Xia, W. Fan, B. Shi, X. Xiong, Z. Zhong, M. Ma, Y. Sun, D. Pei, "Failure Diagnosis in Microservice Systems: A Comprehensive Survey and Analysis," *ACM Trans. Softw. Eng. Methodol.*, vol. 35, no. 1, 2025, doi:10.1145/3715005. arXiv:2407.01710. | https://arxiv.org/abs/2407.01710 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2024-zhang-failure-diagnosis-survey.pdf`](papers/local-only/2024-zhang-failure-diagnosis-survey.pdf) (không commit) | 04 (tra venue các phương pháp) |
| **L-RCACopilot** | Y. Chen, H. Xie, M. Ma, Y. Kang, X. Gao, L. Shi, Y. Cao, X. Gao, H. Fan, M. Wen, J. Zeng, S. Ghosh, X. Zhang, C. Zhang, Q. Lin, S. Rajmohan, D. Zhang, T. Xu, "Automatic Root Cause Analysis via Large Language Models for Cloud Incidents," in *Proc. 19th European Conf. Computer Systems (EuroSys '24)*, pp. 674–688, 2024, doi:10.1145/3627703.3629553. arXiv:2305.15778. | https://arxiv.org/abs/2305.15778 | CC BY 4.0 | [`papers/2024-chen-rcacopilot.pdf`](papers/2024-chen-rcacopilot.pdf) (v4) | 04 (cách đo trong công nghiệp, ablation) |
| **L-TraceRCA** | Z. Li và cs., "Practical Root Cause Localization for Microservice Systems via Trace Analysis," IWQoS 2021 (tên và venue lấy từ danh mục tham khảo của L-RCAEval). | https://github.com/NetManAIOps/TraceRCA | — | không tải | 03 mục 2 (baseline gần `base-manual-auto`) |
| **L-MicroRank** | G. Yu và cs., "MicroRank: End-to-End Latency Issue Localization with Extended Spectrum Analysis in Microservice Environments," WWW 2021 (venue lấy từ L-Survey và L-RCAEval). | https://github.com/IntelligentDDS/MicroRank | — | không tải | tham khảo (bảng mục 2) |
| **L-Nezha** | G. Yu và cs., "Nezha: Interpretable Fine-Grained Root Causes Analysis for Microservices on Multi-modal Observability Data," ESEC/FSE 2023. | https://github.com/IntelligentDDS/Nezha | mã MIT | không tải | 01, 04 (ví dụ tụt 0,87 → 0,04) |
| **L-CIRCA** | M. Li và cs., "Causal Inference-Based Root Cause Analysis for Online Service Systems with Intervention Recognition," KDD 2022. | https://github.com/NetManAIOps/CIRCA | — | không tải | tham khảo (bảng mục 2) |
| **L-RCD** | A. Ikram và cs., "Root Cause Analysis of Failures in Microservices through Causal Discovery," NeurIPS 2022. | https://proceedings.neurips.cc/paper_files/paper/2022/hash/c9fcd02e6445c7dfbad6986abee53d0d-Abstract.html | — | không tải | tham khảo (bảng mục 2) |
| **L-Eadro** | C. Lee, T. Yang, Z. Chen, Y. Su, M. R. Lyu, "Eadro: An End-to-End Troubleshooting Framework for Microservices on Multi-source Data," ICSE 2023. arXiv:2302.05092. | https://arxiv.org/abs/2302.05092 | CC BY 4.0 | không tải (không phải tài liệu chính) | tham khảo (bảng mục 2) |
| **L-OpenRCA** | OpenRCA (Microsoft), benchmark RCA cho LLM, ICLR 2025. Tên bài và danh sách tác giả **chưa xác minh** (trang dự án không mở được lúc tra cứu); khi trích, lấy trích dẫn từ README của repo. | https://github.com/microsoft/OpenRCA | mã MIT | không tải | tham khảo (bảng mục 2) |
| **L-ITBench** | S. Jha và cs., "ITBench: Evaluating AI Agents across Diverse Real-World IT Automation Tasks," arXiv:2502.05352, 2025. | https://arxiv.org/abs/2502.05352 | CC BY-NC-ND 4.0 | không tải | tham khảo (bảng mục 2) |
| **L-MetaRCA** | Meta Engineering, "Leveraging AI for efficient incident response," blog kỹ thuật, 24/06/2024. | https://engineering.fb.com/2024/06/24/data-infrastructure/leveraging-ai-for-efficient-incident-response/ | — | không tải | 04 (đo bằng backtest, cảnh báo gợi ý sai) |

### 2.2. Đánh giá với người dùng

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép bản đọc | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-LogAssist** | S. Locke, H. Li, T.-H. Chen, W. Shang, W. Liu, "LogAssist: Assisting Log Analysis Through Log Summarization," *IEEE Trans. Softw. Eng.*, vol. 48, no. 9, pp. 3227–3241, 2022 (bản online sớm 2021), doi:10.1109/TSE.2021.3083715. | https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf | bản tác giả, bản quyền IEEE | [`papers/local-only/2021-locke-logassist.pdf`](papers/local-only/2021-locke-logassist.pdf) (không commit) | 03 mục E7, 04 |
| **L-Ahmed2023** | T. Ahmed, S. Ghosh, C. Bansal, T. Zimmermann, X. Zhang, S. Rajmohan, "Recommending Root-Cause and Mitigation Steps for Cloud Incidents using Large Language Models," in *Proc. 45th Int. Conf. Software Engineering (ICSE '23)*, pp. 1737–1749, 2023, doi:10.1109/ICSE48619.2023.00149. arXiv:2301.03797. | https://arxiv.org/abs/2301.03797 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2023-ahmed-llm-incident-root-cause.pdf`](papers/local-only/2023-ahmed-llm-incident-root-cause.pdf) (không commit) | 03 mục E7, 04 |
| **L-NASA-TLX** | S. G. Hart, L. E. Staveland, "Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research," *Advances in Psychology*, pp. 139–183, 1988, doi:10.1016/S0166-4115(08)62386-9. Đọc nhanh qua trang tổng quan. | https://en.wikipedia.org/wiki/NASA-TLX | — | không tải | 03 mục E7 |
| **L-SUS** | J. Brooke, "SUS: A 'quick and dirty' usability scale," trong *Usability Evaluation in Industry*, Taylor & Francis, 1996, doi:10.1201/9781498710411-35. Cách tính điểm và mức trung bình ~68: MeasuringU. | https://measuringu.com/sus/ | — | không tải | 03 mục E7 |

### 2.3. Dữ liệu hành vi người học

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-Unistudium** | A. Milani, G. Biondi, V. Franzoni, "Unistudium 2022: students groups logs on moodle," Dataset, phiên bản V1.2, Zenodo, 2022, doi:10.5281/zenodo.13763175. (Zenodo ghi tác giả theo thứ tự Milani, Biondi, Franzoni; README trong gói ghi Franzoni, Biondi, Milani. Báo cáo nên theo thứ tự trên Zenodo.) | https://zenodo.org/records/13763175 | CC BY 4.0 | chỉ README: [`papers/2022-milani-unistudium-readme.txt`](papers/2022-milani-unistudium-readme.txt); log CSV **không** đưa vào repo | 02 mục 4–9 |
| **L-OULAD** | J. Kuzilek, M. Hlosta, Z. Zdrahal, "Open University Learning Analytics dataset," *Scientific Data*, vol. 4, art. 170171, 2017, doi:10.1038/sdata.2017.171. | https://pmc.ncbi.nlm.nih.gov/articles/PMC5704676/ | CC BY 4.0 (bài và dữ liệu) | [`papers/2017-kuzilek-oulad.pdf`](papers/2017-kuzilek-oulad.pdf) | 02 mục 3 |
| khóa đề xuất **L-Kizilcec2013** | R. F. Kizilcec, C. Piech, E. Schneider, "Deconstructing Disengagement: Analyzing Learner Subpopulations in Massive Open Online Courses," in *Proc. 3rd Int. Conf. Learning Analytics and Knowledge (LAK '13)*, pp. 170–179, 2013, doi:10.1145/2460296.2460330. | https://doi.org/10.1145/2460296.2460330 | bản quyền ACM | [`papers/local-only/2013-kizilcec-disengagement.pdf`](papers/local-only/2013-kizilcec-disengagement.pdf) (không commit) | 02 mục 2 (profile học viên mức 2, đã dùng trong workload-design-v1) |

### 2.4. Mô hình hóa và sinh workload

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-WESSBAS** | C. Vögele, A. van Hoorn, E. Schulz, W. Hasselbring, H. Krcmar, "WESSBAS: extraction of probabilistic workload specifications for load testing and performance prediction — a model-driven approach for session-based application systems," *Software and Systems Modeling*, vol. 17, no. 2, pp. 443–477, 2018 (online 2016), doi:10.1007/s10270-016-0566-5. | https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/ | CC BY 4.0 (theo Europe PMC) | **chưa tải được tự động** (PMC và Springer chặn tải bằng script); tải tay qua trình duyệt, xem [`papers/README.md`](papers/README.md) | 02 mục 6, 04 |
| **L-vanHoorn** | A. van Hoorn, M. Rohr, W. Hasselbring, "Generating Probabilistic and Intensity-Varying Workload for Web-Based Software Systems," in *SPEC Int. Performance Evaluation Workshop (SIPEW 2008)*, LNCS 5119, pp. 124–143, Springer, 2008, doi:10.1007/978-3-540-69814-2_9. | https://oceanrep.geomar.de/id/eprint/14489/ | bản tác giả, bản quyền Springer | [`papers/local-only/2008-van-hoorn-workload-generation.pdf`](papers/local-only/2008-van-hoorn-workload-generation.pdf) (không commit) | 02 mục 2 |
| **L-PaxsonFloyd** | V. Paxson, S. Floyd, "Wide Area Traffic: The Failure of Poisson Modeling," *IEEE/ACM Trans. Networking*, vol. 3, no. 3, pp. 226–244, 1995, doi:10.1109/90.392383. | https://www.icir.org/vern/papers/poisson.TON.pdf | bản tác giả, bản quyền IEEE | [`papers/local-only/1995-paxson-poisson-modeling.pdf`](papers/local-only/1995-paxson-poisson-modeling.pdf) (không commit) | 02 mục 6, 9 |
| **L-Schroeder** | B. Schroeder, A. Wierman, M. Harchol-Balter, "Open Versus Closed: A Cautionary Tale," in *Proc. 3rd USENIX Symp. Networked Systems Design and Implementation (NSDI '06)*, pp. 239–252, 2006. | https://www.usenix.org/legacy/events/nsdi06/tech/full_papers/schroeder/schroeder_html/index.html | bản quyền tác giả/USENIX | [`papers/local-only/2006-schroeder-open-closed.pdf`](papers/local-only/2006-schroeder-open-closed.pdf) (không commit) | 02 mục 6 |
| **L-Wilson** | T. Wilson, "What Were They Thinking: Modeling Think Times for Performance Testing," *CMG MeasureIT*, khoảng 2011 (năm suy từ đường dẫn tải lên 2011/03 và tài liệu dẫn mới nhất 11/2010; số phát hành chưa xác minh). | https://www.cmg.org/wp-content/uploads/2011/03/m_77_6.pdf | bản quyền CMG | [`papers/local-only/2011-wilson-think-times.pdf`](papers/local-only/2011-wilson-think-times.pdf) (không commit) | 02 mục 9 |
| **L-Feitelson** | D. G. Feitelson, *Workload Modeling for Computer Systems Performance Evaluation*, Cambridge University Press, 2015, doi:10.1017/CBO9781139939690. Tác giả cho tải bản PDF để dùng cá nhân, cấm phân phối lại. | https://www.cs.huji.ac.il/~feit/wlmod/ | chỉ dùng cá nhân | [`papers/local-only/2015-feitelson-workload-modeling-book.pdf`](papers/local-only/2015-feitelson-workload-modeling-book.pdf) (14,3 MB, không commit) | 02 mục 9 (chương 5 đuôi dài, 6 tương quan, 7 tự tương tự) |
| (tài liệu kỹ thuật) | Grafana Labs, "Open and closed models," tài liệu k6. | https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/ | — | không tải | 02 mục 6 |

### 2.5. LLM đóng vai người dùng

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép bản đọc | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-UXAgent** | Y. Lu, B. Yao, H. Gu, J. Huang, J. Wang, Y. Li, J. Gesi, Q. He, T. J.-J. Li, D. Wang, "UXAgent: An LLM Agent-Based Usability Testing Framework for Web Design," in *Extended Abstracts of the CHI Conf. Human Factors in Computing Systems (CHI EA '25)*, 2025, doi:10.1145/3706599.3719729. arXiv:2504.09407 (v3 đổi tên thành "UXAgent: A System for Simulating Usability Testing of Web Design with LLM Agents"). | https://arxiv.org/abs/2504.09407 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2025-lu-uxagent.pdf`](papers/local-only/2025-lu-uxagent.pdf) (v3, không commit) | 02 mục 10 |
| **L-AgentAB** | Y. Lu, T.-Y. Hsu, H. Gu, L. Cui, Y. Xie, W. Headden, B. Yao, A. Veeragouni, J. Liu, S. Nag, J. Wang, D. Wang, "AgentA/B: Automated and Scalable Web A/B Testing with Interactive LLM Agents," arXiv:2504.09723, 2025 (bản v4 ghi CHI EA '26; DOI chưa tìm thấy trên Crossref). | https://arxiv.org/abs/2504.09723 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2025-lu-agent-ab.pdf`](papers/local-only/2025-lu-agent-ab.pdf) (v4, không commit) | 02 mục 10 |
| **L-LLMNondet** | B. Atıl, S. Aykent, A. Chittams, L. Fu, R. J. Passonneau, E. Radcliffe, G. R. Rajagopal, A. Sloan, T. Tudrej, F. Ture, Z. Wu, L. Xu, B. Baldwin, "Non-Determinism of 'Deterministic' LLM System Settings in Hosted Environments," in *Proc. 5th Workshop on Evaluation and Comparison of NLP Systems (Eval4NLP 2025)*, pp. 135–148, 2025, doi:10.18653/v1/2025.eval4nlp-1.12. Tiền ấn phẩm: arXiv:2408.04667 ("Non-Determinism of 'Deterministic' LLM Settings"). | https://arxiv.org/abs/2408.04667 | CC BY 4.0 | [`papers/2024-atil-llm-nondeterminism.pdf`](papers/2024-atil-llm-nondeterminism.pdf) (v5) | 02 mục 10 |
| **L-SimGym** | A. Castelo, Z. Z. Foumani, A. Fan và cs. (Shopify), "SimGym: Traffic-Grounded Browser Agents for Offline A/B Testing in E-Commerce," arXiv:2602.01443, 2026. | https://arxiv.org/abs/2602.01443 | CC BY 4.0 | [`papers/2026-castelo-simgym.pdf`](papers/2026-castelo-simgym.pdf) (v1) | 02 mục 10 |

## 3. Tài liệu nội bộ của đồ án được dẫn

| Tài liệu | Vai trò |
| --- | --- |
| [ADR-007](../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) | Quyết định chính thức: workload bán thực, E1–E8, đăng ký trước |
| [realism-and-ai-contribution-strategy-v1](../../direction/realism-and-ai-contribution-strategy-v1.md) | Đề xuất gốc kèm tra cứu |
| [ADR-006](../../adr/adr-006-trim-project-scope-v1.md) | Vai trò "hỗ trợ", `base-manual-auto`, 4 case MVP, `R = 5` |
| [plan-v0.4](../../plan/plan-v0.4-24-weeks.md) | Lịch tuần 14–21 cho mức 2+, E1–E8 |
| [evaluation-protocol-v1](../../architecture/evaluation-protocol-v1.md) | Quy chế chấm (cần đọc kèm ghi chú cập nhật theo ADR-007) |
| `workload-design-v1.md` (PR #78, chưa merge) | Thiết kế mức 1 + 2, tham số OULAD, Wilson, van Hoorn, Schroeder |

## 4. Những điểm lệch phát hiện khi đối chiếu nguồn (17/11/2026)

| Điểm | Tài liệu đang ghi | Nguồn thật | Đề xuất |
| --- | --- | --- | --- |
| Số bộ dữ liệu SimpleRCA thắng | ADR-007 và đề xuất gốc ghi "thắng SOTA trên 5/8 bộ dữ liệu" | Bảng 2 của L-Fang2025 (cả v1 và v2) có **11** bộ; Top@1 của SimpleRCA cao hơn phương pháp SOTA tương ứng ở **7/11** bộ, thấp hơn ở 4/11 (Nezha-OB, Eadro-TT, Eadro-SN, AIOps-2021) | Sửa thành "7/11 bộ (Top@1)" khi viết báo cáo |
| QPS "0,14–4,35" | ADR-007: "QPS của các benchmark cũ chỉ 0,14–4,35" | L-Fang2025 nêu đúng bốn ví dụ trên Train-Ticket: Nezha-TT 0,14; Eadro-TT 0,25; RE2-TT 4,35; RE3-TT 1,34. Bảng 1 cùng bài có bộ cao hơn (RE2-OB 16,42; AIOps-2021 61,63) | Ghi "ví dụ trên Train-Ticket", không nói "mọi benchmark cũ" |
| Nezha 0,87 → 0,04 | Dễ đọc thành "chỉ đổi workload mà tụt" | Bộ mới của L-Fang2025 đổi **nhiều thứ cùng lúc**: workload, độ sâu gọi, loại lỗi, nhãn phân cấp, lọc theo tác động người dùng | Nói "khi đánh giá trên bộ khó và thực tế hơn", không quy hết cho workload |
| "~8 giây mỗi bước" của UXAgent | Fact sheet, ADR-007 | Có ở bản HTML v2 của L-UXAgent; bản v3 bỏ câu này, chỉ còn "20 phiên ~90 phút, 1.000 phiên ~12 giờ" | Trích kèm "(bản v2)" |
| Năm của LogAssist | "TSE 2021" | Đăng chính thức TSE 48(9), 2022; online 2021 | Ghi "TSE 2022 (online 2021)" |
| Tỉ lệ sự kiện Moodle ánh xạ được | ADR-007: ~90,6% (188 516/208 109) | Phụ thuộc bảng ánh xạ; với bảng nháp rộng hơn (thêm `submission_status_viewed`, `attempt_summary_viewed`…) nhóm tính được 91,6% | Chốt bảng ánh xạ ở tuần 14 rồi tính lại bằng script |
