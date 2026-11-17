#!/usr/bin/env bash
# Tải lại các tài liệu tham khảo của research-defense (kể cả bản local-only không được commit).
#
#   docs/processed/explanations-v2/research-defense/papers/fetch-papers.sh
#
# Chỉ tải tệp còn thiếu. Sau khi tải, so sha256 với bản nhóm đã đọc ngày 17/11/2026; lệch thì
# chỉ cảnh báo (arXiv có thể đã ra phiên bản mới) — khi trích số liệu, ghi rõ phiên bản đã đọc.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p local-only

# đích | URL | sha256 bản đã đọc
LIST='
2017-kuzilek-oulad.pdf|https://www.nature.com/articles/sdata2017171.pdf|08d310c9e2a1d086da8f70bf85c70f08fec4d047166078750b703a08f265b3d6
2024-atil-llm-nondeterminism.pdf|https://arxiv.org/pdf/2408.04667|8aa6e2f2488397d0ce305e8c97461d55123f87dbaa440230424a87f59d024056
2024-chen-rcacopilot.pdf|https://arxiv.org/pdf/2305.15778|00c69fd459cece875ed399e1802f08a67791b58766281e57be0685e6332beae0
2024-pham-baro.pdf|https://arxiv.org/pdf/2405.09330|fd97437484a150f0fefdff1c0dcd358f572b7aa54f90e48c1493c56bc463b04b
2024-pham-causal-rca-how-far.pdf|https://arxiv.org/pdf/2408.13729|d95e8a21c43293cb97f00c92b96cf112f760c137415c3995cdfd5e3667d4fe7a
2025-fang-rca-benchmark.pdf|https://arxiv.org/pdf/2510.04711|70a6534467f35c63e7b53180f8241b7a04a7ec92b8d087d8bf54da67eba29ad4
2025-pham-rcaeval-benchmark.pdf|https://arxiv.org/pdf/2412.17015|3fcd6934a70645a26df7005f1d7c52383b8c5a8b0f62ad4ac94f4a919bf3360a
2026-castelo-simgym.pdf|https://arxiv.org/pdf/2602.01443|82f53d0d36d218da671bc0afc8818ec28a3fa485dc78df769425d6d4e853138b
local-only/1995-paxson-poisson-modeling.pdf|https://www.icir.org/vern/papers/poisson.TON.pdf|12e98a309ed60e5f6895444e0d33f724dd680d5b1d7ae30977f89c3db9382298
local-only/2006-schroeder-open-closed.pdf|https://www.usenix.org/legacy/events/nsdi06/tech/full_papers/schroeder/schroeder.pdf|8ca72bd7209637b68c7fce12cf1656f22f950d412cf1a3f47bdfaa5683f2a54f
local-only/2008-van-hoorn-workload-generation.pdf|https://oceanrep.geomar.de/id/eprint/14489/2/vanHoornRohrHasselbring2008GeneratingProbabilisticAndIntensityVaryingWorkloadForWebBasedSoftwareSystems-Final-stamped-finalPageNumbers.pdf|eb039cacd909f7b8d70540d364099e5f25d354b70f889ef40fd648ae3a075dfc
local-only/2011-wilson-think-times.pdf|https://www.cmg.org/wp-content/uploads/2011/03/m_77_6.pdf|ed9e1e0bcbda1aaf6d999cbf8dcfdd0402b39ea7f02391f70ed54f30f482a056
local-only/2013-kizilcec-disengagement.pdf|https://web.stanford.edu/~cpiech/bio/papers/deconstructingDisengagement.pdf|3eef6645c62a0029448b27930395479862605ad5d172dd4573a6d61ec5a47d9b
local-only/2015-feitelson-workload-modeling-book.pdf|https://www.cs.huji.ac.il/~feit/wlmod/wlmod.pdf|496a8ff521d6d987d667301f70f1a569acc7dc7f4640a10fb71ea24664a1a4aa
local-only/2021-locke-logassist.pdf|https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf|c8a1c14e471e2ed9288e546790910f6fb4b48aff81af9c66783c9c590e720b5a
local-only/2023-ahmed-llm-incident-root-cause.pdf|https://arxiv.org/pdf/2301.03797|06f5db93d5c816d46c09c656abe682de083319f04a3d1c457c6e8359fb3b7ed5
local-only/2024-zhang-failure-diagnosis-survey.pdf|https://arxiv.org/pdf/2407.01710|727d1323a59803ee7a69642df4bb8f2263622243ecae7ce8cd5cd03f2ada3eae
local-only/2025-lu-agent-ab.pdf|https://arxiv.org/pdf/2504.09723|a09fa9aca9ff1f326bff1f576612a2d7196f957c8b53ed23b7a7c163f4bc7037
local-only/2025-lu-uxagent.pdf|https://arxiv.org/pdf/2504.09407|0f0d28be4412a4de9efc15ae3bb7c4bfd5a923d6e1ffb78de3c1bdd72c208746
'

status=0
while IFS='|' read -r dest url sha; do
  [[ -z "$dest" ]] && continue
  if [[ ! -s "$dest" ]]; then
    echo "tải $dest"
    if ! curl -fsSL --retry 2 -o "$dest" "$url"; then
      echo "  KHÔNG tải được $url — mở link bằng trình duyệt và lưu thành $dest" >&2
      rm -f "$dest"; status=1; continue
    fi
  fi
  actual=$(sha256sum "$dest" | cut -d' ' -f1)
  [[ "$actual" == "$sha" ]] || echo "  cảnh báo: sha256 của $dest khác bản đã đọc (có thể là phiên bản khác)" >&2
done <<< "$LIST"
exit $status
