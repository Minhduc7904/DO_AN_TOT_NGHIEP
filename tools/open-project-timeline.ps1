[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$syncScript = Join-Path $scriptRoot 'sync-plan-json-and-timeline.ps1'
$timelinePath = Join-Path (Resolve-Path (Join-Path $scriptRoot '..')).Path 'docs/processed/plan/timeline/project-timeline.html'

& $syncScript
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    throw "Đồng bộ timeline thất bại với exit code $LASTEXITCODE."
}

if (-not (Test-Path $timelinePath)) {
    throw "Không tìm thấy timeline: $timelinePath"
}

Start-Process -FilePath $timelinePath
Write-Host "Đã mở timeline: $timelinePath" -ForegroundColor Green
