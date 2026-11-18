"""Ground truth canonical, triệu chứng và đường lan dự kiến của 4 case MVP.

Nguồn: telemetry-and-ground-truth-schema-v1 mục 9 (bảng FA–FH, mục 9.1 cho FG) và mục 10 (evidence
floor của FA, FC, FD, FG); complex-case-catalogue-and-rca-result-v0 mục C2, C3, C4, C6. Các kỳ vọng
này chỉ dùng để kiểm chứng execution và audit bằng chứng — **không** được nối vào feature vector
(schema v1 mục 8.2, mục 12).
"""

from __future__ import annotations

from typing import Any


def _evidence(
    entity_type: str,
    entity_id: str,
    modality: str,
    signal: str,
    expectation: str,
    required: bool = True,
) -> dict[str, Any]:
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "modality": modality,
        "signal": signal,
        "expectation": expectation,
        "required": required,
    }


CASE_TRUTH: dict[str, dict[str, Any]] = {
    "C2": {
        "fault_id": "FC",
        "fault_target": "course-postgres",
        "fault_target_kind": "dependency",
        "expected_symptom": (
            "Mọi truy vấn của course chậm, không có span lỗi; latency gateway-course và route "
            "course (ghi danh, làm quiz) tăng."
        ),
        "expected_propagation_path": [
            "course-postgres",
            "course",
            "gateway-course",
            "gateway",
        ],
        "expected_evidence": [
            _evidence(
                "dependency",
                "course-postgres",
                "metrics",
                "lms_dependency_duration_seconds{dependency_identity=course-postgres}",
                "tăng đồng loạt theo mọi operation_name trong cửa sổ fault",
            ),
            _evidence(
                "service",
                "course",
                "metrics",
                "http_server_request_duration_seconds{service_name=course}",
                "tăng trong cửa sổ fault",
            ),
            _evidence("service", "course", "traces", "span chậm thuộc course", "không có span lỗi"),
            _evidence(
                "resource",
                "course",
                "metrics",
                "process_cpu_time_seconds_total{service_name=course}",
                "bằng chứng phụ",
                required=False,
            ),
        ],
        "expected_symptom_services": None,
        "lag_basis": None,
    },
    "C3": {
        "fault_id": "FD",
        "fault_target": "ai-llm-provider",
        "fault_target_kind": "dependency",
        "expected_symptom": (
            "Job AI RUNNING lâu, tài liệu EXTRACTING lâu; lời gọi provider của ai-worker dài; "
            "lỗi muộn ở cạnh ai-worker → course."
        ),
        "expected_propagation_path": ["ai-llm-provider", "ai-worker", "ai", "course", "gateway"],
        "expected_evidence": [
            _evidence(
                "dependency",
                "ai-llm-provider",
                "metrics",
                "lms_dependency_duration_seconds{dependency_identity=ai-llm-provider}",
                "tăng trong cửa sổ fault (cần có job AI trong cửa sổ)",
            ),
            _evidence(
                "dependency",
                "ai-llm-provider",
                "traces",
                "span CLIENT ai-llm-provider POST chat/completions",
                "dài hoặc lỗi; service_name = ai-worker hoặc ai",
            ),
            _evidence(
                "service",
                "ai-worker",
                "traces",
                "CONSUMER ai-worker--run-ai-job-v1",
                "kéo dài",
                required=False,
            ),
        ],
        "expected_symptom_services": None,
        "lag_basis": None,
    },
    "C4": {
        "fault_id": "FA",
        "fault_target": "media-minio",
        "fault_target_kind": "dependency",
        "expected_symptom": (
            "Upload-complete, thumbnail và đọc nội dung media chậm; span media-minio chậm ở "
            "media và "
            "media-worker."
        ),
        "expected_propagation_path": [
            "media-minio",
            "media",
            "media-worker",
            "gateway-media",
            "gateway",
        ],
        "expected_evidence": [
            _evidence(
                "dependency",
                "media-minio",
                "metrics",
                "lms_dependency_duration_seconds{dependency_identity=media-minio}",
                "tăng trong cửa sổ fault (service_name = media, media-worker)",
            ),
            _evidence(
                "dependency",
                "media-minio",
                "traces",
                "span CLIENT media-minio *",
                "chậm hoặc lỗi",
            ),
            _evidence(
                "service",
                "media",
                "metrics",
                "http_server_request_duration_seconds{service_name=media}",
                "route upload-complete/content tăng",
                required=False,
            ),
        ],
        "expected_symptom_services": None,
        "lag_basis": None,
    },
    "C6": {
        "fault_id": "FG",
        "fault_target": "identity",
        "fault_target_kind": "service",
        "expected_symptom": (
            "Đăng nhập lỗi ngay; sau khoảng yên lặng (TTL token dịch vụ) mọi route qua gateway "
            "lỗi 504 "
            "dù service đích khỏe; identity im lặng."
        ),
        "expected_propagation_path": [
            "identity",
            "gateway-identity-token",
            "gateway",
            "<worker>-identity-token",
        ],
        "expected_evidence": [
            _evidence(
                "dependency",
                "gateway-identity-token",
                "metrics",
                "lms_dependency_error_count_total{dependency_identity=gateway-identity-token}",
                "tăng sau khoảng yên lặng",
            ),
            _evidence(
                "dependency",
                "gateway-identity-token",
                "traces",
                "span CLIENT lỗi gateway-identity-token POST /internal/v1/auth/service-token",
                "trace lỗi không có span của service đích",
            ),
            _evidence(
                "service",
                "identity",
                "metrics",
                "process_cpu_time_seconds_total{service_name=identity}",
                "ngừng tăng → telemetry_silent (giá trị cuối vẫn còn ~5 phút)",
            ),
            _evidence(
                "dependency",
                "gateway-identity-token",
                "logs",
                "dependency.failure",
                "span_id khớp span CLIENT lỗi",
                required=False,
            ),
        ],
        "expected_symptom_services": ["gateway"],
        "lag_basis": "IDENTITY_SERVICE_TOKEN_TTL_SECONDS",
    },
}

HEALTHY_TRUTH: dict[str, Any] = {
    "expected_symptom": (
        "Không có fault: mọi service khỏe theo tiêu chí workload-design-v1 mục 8.4."
    ),
    "expected_propagation_path": [],
    "expected_evidence": [],
}


def expected_symptom_lag(case_id: str, token_ttl_s: int | None) -> dict[str, Any] | None:
    """Độ trễ kỳ vọng tính từ cấu hình (schema v1 mục 9.1), không từ quan sát.

    FG: token dịch vụ đã cache còn dùng tới hết hạn, nên triệu chứng đầu tiên tới muộn nhất sau một
    TTL cộng biên 30 s (chu kỳ làm mới và độ trễ thu thập; giả định, chốt ở pilot).
    """
    truth = CASE_TRUTH[case_id]
    if truth["lag_basis"] is None or token_ttl_s is None:
        return None
    return {"min_seconds": 0, "max_seconds": token_ttl_s + 30, "basis": truth["lag_basis"]}
