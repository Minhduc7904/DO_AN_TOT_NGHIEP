# Literature matrix v1 — danh mục tài liệu tham khảo của đồ án

> **Trạng thái:** v1, 17/11/2026. Thay [literature-matrix-v0](literature-matrix-v0.md) làm **danh mục tài liệu tham khảo canonical** cho báo cáo; v0 giữ làm lịch sử (phân tích chi tiết từng phương pháp của v0 vẫn đúng, các mục L1–L12 được kế thừa ở mục 2).
>
> **Nguồn:** đợt nghiên cứu ngày 17/11/2026 cho hai yêu cầu phản biện (chứng minh AI/RCA đóng góp thực sự; dữ liệu trông thực tế) — quyết định ở [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md), phân tích ở [realism-and-ai-contribution-strategy-v1](../direction/realism-and-ai-contribution-strategy-v1.md), giải thích dễ hiểu và PDF ở [explanations-v2/research-defense](../explanations-v2/research-defense/README.md). Tên tác giả, DOI, nơi đăng ở mục 3 đã được đối chiếu với Crossref, trang arXiv hoặc bản PDF; chỗ chưa xác minh ghi rõ.

## 1. Cách dùng khi viết báo cáo

- Tài liệu trong repo trích bằng khóa `[L-…]` (mục 3) hoặc `L1`–`L12` (mục 2), kèm URL. Khi viết báo cáo, tra khóa ở đây để lấy trích dẫn đầy đủ.
- Bài arXiv: ghi phiên bản đã đọc vì số liệu có thể đổi giữa các phiên bản; bài đã đăng chính thức thì trích bản DOI, kèm link arXiv.
- Số liệu do nhóm tự tính (OULAD, log Moodle) không trích như số của bài báo; ghi "tính bởi nhóm" và trỏ tới phụ lục cách tính trong [workload-design-v1](../architecture/workload-design-v1.md).
- Trước khi trích một con số, xem mục 5 (các điểm dễ trích sai).

## 2. Kế thừa từ v0 (L1–L12)

Phân tích chi tiết (input, phương pháp, metric, giới hạn, liên hệ đồ án) xem [literature-matrix-v0](literature-matrix-v0.md) mục 2–7.

| Khóa | Trích dẫn (giữ nguyên từ v0) | Bài toán |
| --- | --- | --- |
| L1 | **Chandola, Banerjee, Kumar (2009)** — *Anomaly Detection: A Survey*. ACM Computing Surveys. DOI: [10.1145/1541880.1541882](https://doi.org/10.1145/1541880.1541882) | Tổng quan anomaly/outlier detection và giả định của các nhóm phương pháp |
| L2 | **Rousseeuw, Croux (1993)** — *Alternatives to the Median Absolute Deviation*. Journal of the American Statistical Association. DOI: [10.1080/01621459.1993.10476408](https://doi.org/10.1080/01621459.1993.10476408) | Robust estimation của location/scale khi dữ liệu có outlier |
| L3 | **Liu, Ting, Zhou (2008)** — *Isolation Forest*. IEEE ICDM. DOI: [10.1109/ICDM.2008.17](https://doi.org/10.1109/ICDM.2008.17) | Unsupervised anomaly detection trên dữ liệu nhiều chiều |
| L4 | **Sigelman et al. (2010)** — *Dapper, a Large-Scale Distributed Systems Tracing Infrastructure*. Google Technical Report. [Google Research](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/) | Quan sát execution path xuyên nhiều service/machine trong distributed system |
| L5 | **Mace, Roelke, Fonseca (2015)** — *Pivot Tracing: Dynamic Causal Monitoring for Distributed Systems*. SOSP. DOI: [10.1145/2815400.2815415](https://doi.org/10.1145/2815400.2815415) | Correlate evidence xuyên component/machine để troubleshoot distributed systems |
| L6 | **Wu, Tordsson, Elmroth, Kao (2020)** — *MicroRCA: Root Cause Localization of Performance Issues in Microservices*. IEEE/IFIP NOMS. DOI: [10.1109/NOMS47738.2020.9110353](https://doi.org/10.1109/NOMS47738.2020.9110353) | Root-cause localization cho performance issues trong microservices |
| L7 | **Liu et al. (2021)** — *MicroHECL: High-Efficient Root Cause Localization in Large-Scale Microservice Systems*. ICSE-SEIP. DOI: [10.1109/ICSE-SEIP52600.2021.00043](https://doi.org/10.1109/ICSE-SEIP52600.2021.00043) | Root-cause localization khi anomaly lan truyền qua service dependency |
| L8 | **Lee, Yang, Chen, Su, Lyu (2023)** — *Eadro: An End-to-End Troubleshooting Framework for Microservices on Multi-source Data*. ICSE. DOI: [10.1109/ICSE48619.2023.00150](https://doi.org/10.1109/ICSE48619.2023.00150) | Joint anomaly detection + root-cause localization từ nhiều telemetry modality |
| L9 | **Tatbul, Lee, Zdonik, Alam, Gottschlich (2018)** — *Precision and Recall for Time Series*. NeurIPS. [arXiv:1803.03639](https://arxiv.org/abs/1803.03639) | Đánh giá anomaly xảy ra theo **range/interval**, không chỉ independent points |
| L10 | **Lavin, Ahmad (2015)** — *Evaluating Real-Time Anomaly Detection Algorithms — The Numenta Anomaly Benchmark*. IEEE ICMLA. DOI: [10.1109/ICMLA.2015.141](https://doi.org/10.1109/ICMLA.2015.141) | Đánh giá real-time/streaming anomaly detector có xét thời điểm phát hiện và false alarms |
| L11 | **Schmidl, Wenig, Papenbrock (2022)** — *Anomaly Detection in Time Series: A Comprehensive Evaluation*. PVLDB. DOI: [10.14778/3538598.3538602](https://doi.org/10.14778/3538598.3538602) | So sánh rộng nhiều thuật toán và metric time-series anomaly detection |
| L12 | **Yu, Zhao, Li, Li, Wang, Zhang, Sui, Pei (2024)** — *A Survey on Intelligent Management of Alerts and Incidents in IT Services*. Journal of Network and Computer Applications, 224, 103842. DOI: [10.1016/j.jnca.2024.103842](https://doi.org/10.1016/j.jnca.2024.103842) | Alert và incident management trong IT services, đặc biệt correlation, lifecycle và xử lý failure |

Khóa dạng tên dùng trong một số tài liệu cho các mục kế thừa: `L-Rousseeuw1993` = L2, `L-IForest2008` = L3, `L-Dapper2010` = L4, `L-Tatbul2018` = L9, `L-NAB2015` = L10.

## 3. Bổ sung 17/11/2026 (khóa `L-…`)

### 3.1. Đánh giá phương pháp RCA (phân tích nguyên nhân gốc)

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép bản đọc | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-Fang2025** | A. Fang, S. Zhang, Y. Yang, H. Wu, J. Xu, X. Wang, R. Wang, M. Wang, Q. Lu, P. He, "Rethinking the Evaluation of Microservice RCA with a Fault Propagation-Aware Benchmark," *Proc. ACM Softw. Eng.*, vol. 3, no. FSE, pp. 1605–1627, 2026 (FSE 2026), doi:10.1145/3797100. Bản tiền ấn phẩm: arXiv:2510.04711 (v1 06/10/2025, v2 23/12/2025). | https://arxiv.org/abs/2510.04711 | CC BY-NC-ND 4.0 | [`papers/2025-fang-rca-benchmark.pdf`](../explanations-v2/research-defense/papers/2025-fang-rca-benchmark.pdf) (v2) | 01, 02 mục 1, 03 mục 2, 04 |
| **L-Pham2024ASE** | L. Pham, H. Ha, H. Zhang, "Root Cause Analysis for Microservices based on Causal Inference: How Far Are We?," in *Proc. 39th IEEE/ACM Int. Conf. Automated Software Engineering (ASE '24)*, 2024, doi:10.1145/3691620.3695065. arXiv:2408.13729. | https://arxiv.org/abs/2408.13729 | CC BY 4.0 | [`papers/2024-pham-causal-rca-how-far.pdf`](../explanations-v2/research-defense/papers/2024-pham-causal-rca-how-far.pdf) (v2) | 03 mục 2, 04 |
| **L-RCAEval** | L. Pham, H. Zhang, H. Ha, F. Salim, X. Zhang, "RCAEval: A Benchmark for Root Cause Analysis of Microservice Systems with Telemetry Data," in *Companion Proc. ACM Web Conference 2025 (WWW '25 Companion)*, pp. 777–780, 2025, doi:10.1145/3701716.3715290. arXiv:2412.17015. Mã nguồn và dữ liệu: https://github.com/phamquiluan/RCAEval (MIT). | https://arxiv.org/abs/2412.17015 | CC BY 4.0 (bài); MIT (mã, dữ liệu) | [`papers/2025-pham-rcaeval-benchmark.pdf`](../explanations-v2/research-defense/papers/2025-pham-rcaeval-benchmark.pdf) (v5) | 03 mục E6, 04 |
| **L-BARO** | L. Pham, H. Ha, H. Zhang, "BARO: Robust Root Cause Analysis for Microservices via Multivariate Bayesian Online Change Point Detection," *Proc. ACM Softw. Eng.*, vol. 1, no. FSE, pp. 2214–2237, 2024 (FSE 2024), doi:10.1145/3660805. arXiv:2405.09330. | https://arxiv.org/abs/2405.09330 | CC BY 4.0 | [`papers/2024-pham-baro.pdf`](../explanations-v2/research-defense/papers/2024-pham-baro.pdf) (v1) | 03 mục E2, E6, 04 |
| **L-Survey** | S. Zhang, S. Xia, W. Fan, B. Shi, X. Xiong, Z. Zhong, M. Ma, Y. Sun, D. Pei, "Failure Diagnosis in Microservice Systems: A Comprehensive Survey and Analysis," *ACM Trans. Softw. Eng. Methodol.*, vol. 35, no. 1, 2025, doi:10.1145/3715005. arXiv:2407.01710. | https://arxiv.org/abs/2407.01710 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2024-zhang-failure-diagnosis-survey.pdf`](../explanations-v2/research-defense/papers/local-only/2024-zhang-failure-diagnosis-survey.pdf) (không commit) | 04 (tra venue các phương pháp) |
| **L-RCACopilot** | Y. Chen, H. Xie, M. Ma, Y. Kang, X. Gao, L. Shi, Y. Cao, X. Gao, H. Fan, M. Wen, J. Zeng, S. Ghosh, X. Zhang, C. Zhang, Q. Lin, S. Rajmohan, D. Zhang, T. Xu, "Automatic Root Cause Analysis via Large Language Models for Cloud Incidents," in *Proc. 19th European Conf. Computer Systems (EuroSys '24)*, pp. 674–688, 2024, doi:10.1145/3627703.3629553. arXiv:2305.15778. | https://arxiv.org/abs/2305.15778 | CC BY 4.0 | [`papers/2024-chen-rcacopilot.pdf`](../explanations-v2/research-defense/papers/2024-chen-rcacopilot.pdf) (v4) | 04 (cách đo trong công nghiệp, ablation) |
| **L-TraceRCA** | Z. Li và cs., "Practical Root Cause Localization for Microservice Systems via Trace Analysis," IWQoS 2021 (tên và venue lấy từ danh mục tham khảo của L-RCAEval). | https://github.com/NetManAIOps/TraceRCA | — | không tải | 03 mục 2 (baseline gần `base-manual-auto`) |
| **L-MicroRank** | G. Yu và cs., "MicroRank: End-to-End Latency Issue Localization with Extended Spectrum Analysis in Microservice Environments," WWW 2021 (venue lấy từ L-Survey và L-RCAEval). | https://github.com/IntelligentDDS/MicroRank | — | không tải | 04 bảng phụ |
| **L-Nezha** | G. Yu và cs., "Nezha: Interpretable Fine-Grained Root Causes Analysis for Microservices on Multi-modal Observability Data," ESEC/FSE 2023. | https://github.com/IntelligentDDS/Nezha | mã MIT | không tải | 01, 04 (ví dụ tụt 0,87 → 0,04) |
| **L-CIRCA** | M. Li và cs., "Causal Inference-Based Root Cause Analysis for Online Service Systems with Intervention Recognition," KDD 2022. | https://github.com/NetManAIOps/CIRCA | — | không tải | 04 bảng phụ |
| **L-RCD** | A. Ikram và cs., "Root Cause Analysis of Failures in Microservices through Causal Discovery," NeurIPS 2022. | https://proceedings.neurips.cc/paper_files/paper/2022/hash/c9fcd02e6445c7dfbad6986abee53d0d-Abstract.html | — | không tải | 04 bảng phụ |
| **L-Eadro** | C. Lee, T. Yang, Z. Chen, Y. Su, M. R. Lyu, "Eadro: An End-to-End Troubleshooting Framework for Microservices on Multi-source Data," ICSE 2023. arXiv:2302.05092. | https://arxiv.org/abs/2302.05092 | CC BY 4.0 | không tải (không phải tài liệu chính) | 04 bảng phụ |
| **L-OpenRCA** | OpenRCA (Microsoft), benchmark RCA cho LLM, ICLR 2025. Tên bài và danh sách tác giả **chưa xác minh** (trang dự án không mở được lúc tra cứu); khi trích, lấy trích dẫn từ README của repo. | https://github.com/microsoft/OpenRCA | mã MIT | không tải | 04 bảng phụ |
| **L-ITBench** | S. Jha và cs., "ITBench: Evaluating AI Agents across Diverse Real-World IT Automation Tasks," arXiv:2502.05352, 2025. | https://arxiv.org/abs/2502.05352 | CC BY-NC-ND 4.0 | không tải | 04 bảng phụ |
| **L-MetaRCA** | Meta Engineering, "Leveraging AI for efficient incident response," blog kỹ thuật, 24/06/2024. | https://engineering.fb.com/2024/06/24/data-infrastructure/leveraging-ai-for-efficient-incident-response/ | — | không tải | 04 (đo bằng backtest, cảnh báo gợi ý sai) |

### 3.2. Đánh giá với người dùng

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép bản đọc | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-LogAssist** | S. Locke, H. Li, T.-H. Chen, W. Shang, W. Liu, "LogAssist: Assisting Log Analysis Through Log Summarization," *IEEE Trans. Softw. Eng.*, vol. 48, no. 9, pp. 3227–3241, 2022 (bản online sớm 2021), doi:10.1109/TSE.2021.3083715. | https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf | bản tác giả, bản quyền IEEE | [`papers/local-only/2021-locke-logassist.pdf`](../explanations-v2/research-defense/papers/local-only/2021-locke-logassist.pdf) (không commit) | 03 mục E7, 04 |
| **L-Ahmed2023** | T. Ahmed, S. Ghosh, C. Bansal, T. Zimmermann, X. Zhang, S. Rajmohan, "Recommending Root-Cause and Mitigation Steps for Cloud Incidents using Large Language Models," in *Proc. 45th Int. Conf. Software Engineering (ICSE '23)*, pp. 1737–1749, 2023, doi:10.1109/ICSE48619.2023.00149. arXiv:2301.03797. | https://arxiv.org/abs/2301.03797 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2023-ahmed-llm-incident-root-cause.pdf`](../explanations-v2/research-defense/papers/local-only/2023-ahmed-llm-incident-root-cause.pdf) (không commit) | 03 mục E7, 04 |
| **L-NASA-TLX** | S. G. Hart, L. E. Staveland, "Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research," *Advances in Psychology*, pp. 139–183, 1988, doi:10.1016/S0166-4115(08)62386-9. Đọc nhanh qua trang tổng quan. | https://en.wikipedia.org/wiki/NASA-TLX | — | không tải | 03 mục E7 |
| **L-SUS** | J. Brooke, "SUS: A 'quick and dirty' usability scale," trong *Usability Evaluation in Industry*, Taylor & Francis, 1996, doi:10.1201/9781498710411-35. Cách tính điểm và mức trung bình ~68: MeasuringU. | https://measuringu.com/sus/ | — | không tải | 03 mục E7 |

### 3.3. Dữ liệu hành vi người học

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-Unistudium** | A. Milani, G. Biondi, V. Franzoni, "Unistudium 2022: students groups logs on moodle," Dataset, phiên bản V1.2, Zenodo, 2022, doi:10.5281/zenodo.13763175. (Zenodo ghi tác giả theo thứ tự Milani, Biondi, Franzoni; README trong gói ghi Franzoni, Biondi, Milani. Báo cáo nên theo thứ tự trên Zenodo.) | https://zenodo.org/records/13763175 | CC BY 4.0 | chỉ README: [`papers/2022-milani-unistudium-readme.txt`](../explanations-v2/research-defense/papers/2022-milani-unistudium-readme.txt); log CSV **không** đưa vào repo | 02 mục 4–9 |
| **L-OULAD** | J. Kuzilek, M. Hlosta, Z. Zdrahal, "Open University Learning Analytics dataset," *Scientific Data*, vol. 4, art. 170171, 2017, doi:10.1038/sdata.2017.171. | https://pmc.ncbi.nlm.nih.gov/articles/PMC5704676/ | CC BY 4.0 (bài và dữ liệu) | [`papers/2017-kuzilek-oulad.pdf`](../explanations-v2/research-defense/papers/2017-kuzilek-oulad.pdf) | 02 mục 3 |
| khóa đề xuất **L-Kizilcec2013** | R. F. Kizilcec, C. Piech, E. Schneider, "Deconstructing Disengagement: Analyzing Learner Subpopulations in Massive Open Online Courses," in *Proc. 3rd Int. Conf. Learning Analytics and Knowledge (LAK '13)*, pp. 170–179, 2013, doi:10.1145/2460296.2460330. | https://doi.org/10.1145/2460296.2460330 | bản quyền ACM | [`papers/local-only/2013-kizilcec-disengagement.pdf`](../explanations-v2/research-defense/papers/local-only/2013-kizilcec-disengagement.pdf) (không commit) | 02 mục 2 (profile học viên mức 2, đã dùng trong workload-design-v1) |

### 3.4. Mô hình hóa và sinh workload

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-WESSBAS** | C. Vögele, A. van Hoorn, E. Schulz, W. Hasselbring, H. Krcmar, "WESSBAS: extraction of probabilistic workload specifications for load testing and performance prediction — a model-driven approach for session-based application systems," *Software and Systems Modeling*, vol. 17, no. 2, pp. 443–477, 2018 (online 2016), doi:10.1007/s10270-016-0566-5. | https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/ | CC BY 4.0 (theo Europe PMC) | **chưa tải được tự động** (PMC và Springer chặn tải bằng script); tải tay qua trình duyệt, xem [`papers/README.md`](../explanations-v2/research-defense/papers/README.md) | 02 mục 6, 04 |
| **L-vanHoorn** | A. van Hoorn, M. Rohr, W. Hasselbring, "Generating Probabilistic and Intensity-Varying Workload for Web-Based Software Systems," in *SPEC Int. Performance Evaluation Workshop (SIPEW 2008)*, LNCS 5119, pp. 124–143, Springer, 2008, doi:10.1007/978-3-540-69814-2_9. | https://oceanrep.geomar.de/id/eprint/14489/ | bản tác giả, bản quyền Springer | [`papers/local-only/2008-van-hoorn-workload-generation.pdf`](../explanations-v2/research-defense/papers/local-only/2008-van-hoorn-workload-generation.pdf) (không commit) | 02 mục 2 |
| **L-PaxsonFloyd** | V. Paxson, S. Floyd, "Wide Area Traffic: The Failure of Poisson Modeling," *IEEE/ACM Trans. Networking*, vol. 3, no. 3, pp. 226–244, 1995, doi:10.1109/90.392383. | https://www.icir.org/vern/papers/poisson.TON.pdf | bản tác giả, bản quyền IEEE | [`papers/local-only/1995-paxson-poisson-modeling.pdf`](../explanations-v2/research-defense/papers/local-only/1995-paxson-poisson-modeling.pdf) (không commit) | 02 mục 6, 9 |
| **L-Schroeder** | B. Schroeder, A. Wierman, M. Harchol-Balter, "Open Versus Closed: A Cautionary Tale," in *Proc. 3rd USENIX Symp. Networked Systems Design and Implementation (NSDI '06)*, pp. 239–252, 2006. | https://www.usenix.org/legacy/events/nsdi06/tech/full_papers/schroeder/schroeder_html/index.html | bản quyền tác giả/USENIX | [`papers/local-only/2006-schroeder-open-closed.pdf`](../explanations-v2/research-defense/papers/local-only/2006-schroeder-open-closed.pdf) (không commit) | 02 mục 6 |
| **L-Wilson** | T. Wilson, "What Were They Thinking: Modeling Think Times for Performance Testing," *CMG MeasureIT*, khoảng 2011 (năm suy từ đường dẫn tải lên 2011/03 và tài liệu dẫn mới nhất 11/2010; số phát hành chưa xác minh). | https://www.cmg.org/wp-content/uploads/2011/03/m_77_6.pdf | bản quyền CMG | [`papers/local-only/2011-wilson-think-times.pdf`](../explanations-v2/research-defense/papers/local-only/2011-wilson-think-times.pdf) (không commit) | 02 mục 9 |
| **L-Feitelson** | D. G. Feitelson, *Workload Modeling for Computer Systems Performance Evaluation*, Cambridge University Press, 2015, doi:10.1017/CBO9781139939690. Tác giả cho tải bản PDF để dùng cá nhân, cấm phân phối lại. | https://www.cs.huji.ac.il/~feit/wlmod/ | chỉ dùng cá nhân | [`papers/local-only/2015-feitelson-workload-modeling-book.pdf`](../explanations-v2/research-defense/papers/local-only/2015-feitelson-workload-modeling-book.pdf) (14,3 MB, không commit) | 02 mục 9 (chương 5 đuôi dài, 6 tương quan, 7 tự tương tự) |
| (tài liệu kỹ thuật) | Grafana Labs, "Open and closed models," tài liệu k6. | https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/ | — | không tải | 02 mục 6 |

### 3.5. LLM đóng vai người dùng

| Khóa | Trích dẫn đầy đủ | Link | Giấy phép bản đọc | File cục bộ | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| **L-UXAgent** | Y. Lu, B. Yao, H. Gu, J. Huang, J. Wang, Y. Li, J. Gesi, Q. He, T. J.-J. Li, D. Wang, "UXAgent: An LLM Agent-Based Usability Testing Framework for Web Design," in *Extended Abstracts of the CHI Conf. Human Factors in Computing Systems (CHI EA '25)*, 2025, doi:10.1145/3706599.3719729. arXiv:2504.09407 (v3 đổi tên thành "UXAgent: A System for Simulating Usability Testing of Web Design with LLM Agents"). | https://arxiv.org/abs/2504.09407 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2025-lu-uxagent.pdf`](../explanations-v2/research-defense/papers/local-only/2025-lu-uxagent.pdf) (v3, không commit) | 02 mục 10 |
| **L-AgentAB** | Y. Lu, T.-Y. Hsu, H. Gu, L. Cui, Y. Xie, W. Headden, B. Yao, A. Veeragouni, J. Liu, S. Nag, J. Wang, D. Wang, "AgentA/B: Automated and Scalable Web A/B Testing with Interactive LLM Agents," arXiv:2504.09723, 2025 (bản v4 ghi CHI EA '26; DOI chưa tìm thấy trên Crossref). | https://arxiv.org/abs/2504.09723 | arXiv: chỉ cho phép arXiv phân phối | [`papers/local-only/2025-lu-agent-ab.pdf`](../explanations-v2/research-defense/papers/local-only/2025-lu-agent-ab.pdf) (v4, không commit) | 02 mục 10 |
| **L-LLMNondet** | B. Atıl, S. Aykent, A. Chittams, L. Fu, R. J. Passonneau, E. Radcliffe, G. R. Rajagopal, A. Sloan, T. Tudrej, F. Ture, Z. Wu, L. Xu, B. Baldwin, "Non-Determinism of 'Deterministic' LLM System Settings in Hosted Environments," in *Proc. 5th Workshop on Evaluation and Comparison of NLP Systems (Eval4NLP 2025)*, pp. 135–148, 2025, doi:10.18653/v1/2025.eval4nlp-1.12. Tiền ấn phẩm: arXiv:2408.04667 ("Non-Determinism of 'Deterministic' LLM Settings"). | https://arxiv.org/abs/2408.04667 | CC BY 4.0 | [`papers/2024-atil-llm-nondeterminism.pdf`](../explanations-v2/research-defense/papers/2024-atil-llm-nondeterminism.pdf) (v5) | 02 mục 10 |
| **L-SimGym** | A. Castelo, Z. Z. Foumani, A. Fan và cs. (Shopify), "SimGym: Traffic-Grounded Browser Agents for Offline A/B Testing in E-Commerce," arXiv:2602.01443, 2026. | https://arxiv.org/abs/2602.01443 | CC BY 4.0 | [`papers/2026-castelo-simgym.pdf`](../explanations-v2/research-defense/papers/2026-castelo-simgym.pdf) (v1) | 02 mục 10 |

## 4. Bằng chứng E1–E8 (ADR-007) và tài liệu làm căn cứ

| Bằng chứng | Căn cứ chính |
| --- | --- |
| Workload bán thực (mức 2+) và kiểm chứng độ thực | L-Unistudium, L-OULAD, L-WESSBAS, L-PaxsonFloyd, L-Feitelson, L-Fang2025 (workload đơn giản làm RCA trông tốt hơn) |
| Mức 3 chỉ offline | L-UXAgent, L-AgentAB, L-LLMNondet, L-SimGym |
| E1 phát hiện dưới tải bán thực | L3 (Isolation Forest), L2 (thống kê robust), L9–L11 (đánh giá phát hiện theo khoảng) |
| E2 bảng chính, baseline đã công bố | L-Pham2024ASE, L-Fang2025 (SimpleRCA), L-BARO, L-TraceRCA, L-RCAEval |
| E3 quan sát suy giảm | L-Pham2024ASE (độ nhạy theo dữ liệu), L-Nezha (bỏ từng modality) |
| E4 chi phí chẩn đoán | L-MetaRCA, L-RCACopilot (đo trong công nghiệp), L-Ahmed2023 |
| E5 ablation | L-Nezha, L-RCACopilot |
| E6 đối chứng ngoài | L-RCAEval, L-BARO |
| E7 thử nghiệm người | L-LogAssist, L-Ahmed2023, L-NASA-TLX, L-SUS |

## 5. Các điểm dễ trích sai (đối chiếu nguồn 17/11/2026)

| Điểm | Tài liệu đang ghi | Nguồn thật | Đề xuất |
| --- | --- | --- | --- |
| Số bộ dữ liệu SimpleRCA thắng | ADR-007 và đề xuất gốc ghi "thắng SOTA trên 5/8 bộ dữ liệu" | Bảng 2 của L-Fang2025 (cả v1 và v2) có **11** bộ; Top@1 của SimpleRCA cao hơn phương pháp SOTA tương ứng ở **7/11** bộ, thấp hơn ở 4/11 (Nezha-OB, Eadro-TT, Eadro-SN, AIOps-2021) | Sửa thành "7/11 bộ (Top@1)" khi viết báo cáo |
| QPS "0,14–4,35" | ADR-007: "QPS của các benchmark cũ chỉ 0,14–4,35" | L-Fang2025 nêu đúng bốn ví dụ trên Train-Ticket: Nezha-TT 0,14; Eadro-TT 0,25; RE2-TT 4,35; RE3-TT 1,34. Bảng 1 cùng bài có bộ cao hơn (RE2-OB 16,42; AIOps-2021 61,63) | Ghi "ví dụ trên Train-Ticket", không nói "mọi benchmark cũ" |
| Nezha 0,87 → 0,04 | Dễ đọc thành "chỉ đổi workload mà tụt" | Bộ mới của L-Fang2025 đổi **nhiều thứ cùng lúc**: workload, độ sâu gọi, loại lỗi, nhãn phân cấp, lọc theo tác động người dùng | Nói "khi đánh giá trên bộ khó và thực tế hơn", không quy hết cho workload |
| "~8 giây mỗi bước" của UXAgent | Fact sheet, ADR-007 | Có ở bản HTML v2 của L-UXAgent; bản v3 bỏ câu này, chỉ còn "20 phiên ~90 phút, 1.000 phiên ~12 giờ" | Trích kèm "(bản v2)" |
| Năm của LogAssist | "TSE 2021" | Đăng chính thức TSE 48(9), 2022; online 2021 | Ghi "TSE 2022 (online 2021)" |
| Tỉ lệ sự kiện Moodle ánh xạ được | ADR-007: ~90,6% (188 516/208 109) | Phụ thuộc bảng ánh xạ; với bảng nháp rộng hơn (thêm `submission_status_viewed`, `attempt_summary_viewed`…) nhóm tính được 91,6% | Chốt bảng ánh xạ ở tuần 14 rồi tính lại bằng script |
