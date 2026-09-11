param(
    [string]$DrawioExecutable,
    [string[]]$Names
)

$ErrorActionPreference = 'Stop'

if (-not $DrawioExecutable) {
    $command = Get-Command 'draw.io' -ErrorAction SilentlyContinue
    if (-not $command) {
        $command = Get-Command 'drawio' -ErrorAction SilentlyContinue
    }

    $candidates = @(
        $(if ($command) { $command.Source }),
        'C:\Program Files\draw.io\draw.io.exe',
        'C:\Program Files (x86)\draw.io\draw.io.exe'
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    $DrawioExecutable = $candidates | Select-Object -First 1
}

if (-not $DrawioExecutable -or -not (Test-Path -LiteralPath $DrawioExecutable)) {
    throw 'Không tìm thấy Draw.io Desktop. Truyền đường dẫn draw.io.exe qua -DrawioExecutable.'
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $repositoryRoot 'docs\processed\architecture\diagrams'
$outputDirectory = Join-Path $sourceDirectory 'rendered'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

function Invoke-DrawioExport {
    param(
        [string[]]$Arguments,
        [string]$Description
    )

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $process = Start-Process -FilePath $DrawioExecutable -ArgumentList $Arguments -WindowStyle Hidden -Wait -PassThru
        if ($process.ExitCode -eq 0) {
            return
        }

        if ($attempt -lt 2) {
            Start-Sleep -Milliseconds 750
        }
    }

    throw "$Description thất bại sau 2 lần thử, exit code $($process.ExitCode)."
}

$drawioFiles = Get-ChildItem -LiteralPath $sourceDirectory -Filter '*.drawio' | Sort-Object Name
if ($Names) {
    $drawioFiles = $drawioFiles | Where-Object { $_.BaseName -in $Names }
}

$drawioFiles | ForEach-Object {
    $svgOutput = Join-Path $outputDirectory ($_.BaseName + '.svg')
    $pngOutput = Join-Path $outputDirectory ($_.BaseName + '.png')

    Invoke-DrawioExport -Description "Xuất SVG cho $($_.Name)" -Arguments @(
        '-x', '-f', 'svg', '-e', '-b', '20',
        '-o', ('"' + $svgOutput + '"'),
        ('"' + $_.FullName + '"')
    )

    Invoke-DrawioExport -Description "Xuất PNG cho $($_.Name)" -Arguments @(
        '-x', '-f', 'png', '-e', '-b', '20', '-s', '2',
        '-o', ('"' + $pngOutput + '"'),
        ('"' + $_.FullName + '"')
    )

    Write-Output "Đã render: $($_.BaseName)"
}
