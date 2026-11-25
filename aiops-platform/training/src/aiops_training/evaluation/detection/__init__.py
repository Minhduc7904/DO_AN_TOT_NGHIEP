"""Evaluation harness cho phát hiện sự cố (evaluation-protocol-v1 mục 7.1, 17, 20, 22).

Ranh giới mục 3.3: detector và incident lifecycle không đọc ground truth; harness đọc
`RunGroundTruth` sau khi đã có incident record để chấm.
"""
