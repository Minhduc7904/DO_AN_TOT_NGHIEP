[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptRoot '..')).Path
$planPath = Join-Path $repoRoot 'docs/processed/plan/plan-v0.2-24-weeks.md'
$weeklyRoot = Join-Path $repoRoot 'docs/processed/plan/weekly'
$jsonRoot = Join-Path $repoRoot 'docs/processed/plan/json'
$weeksRoot = Join-Path $jsonRoot 'weeks'
$timelinePath = Join-Path $repoRoot 'docs/processed/plan/timeline/project-timeline.html'

$taskStatuses = @('Chưa phân công', 'Đã giao', 'Đang thực hiện', 'Chờ xử lý', 'Chờ review', 'Hoàn thành')
$weekStatuses = @('Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành', 'Chờ xử lý')
$schemaVersion = '1.0.0'

function Get-RelativePath {
    param([string]$Path)
    $resolved = (Resolve-Path $Path).Path
    $rootUri = [Uri]($repoRoot.TrimEnd('\') + '\')
    $pathUri = [Uri]$resolved
    return [Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString())
}

function Get-Text {
    param([string]$Path)
    return [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
}

function Convert-MarkdownInline {
    param([AllowEmptyString()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    $value = $Text.Trim()
    $value = [regex]::Replace($value, '<!--.*?-->', '', 'Singleline')
    $value = [regex]::Replace($value, '!\[([^\]]*)\]\([^\)]*\)', '$1')
    $value = [regex]::Replace($value, '\[([^\]]+)\]\(([^\)]+)\)', '$1')
    $value = $value -replace '`', ''
    $value = $value -replace '\*\*', ''
    $value = $value -replace '^>\s*', ''
    return $value.Trim()
}

function Get-ListItems {
    param([AllowEmptyString()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
    $items = @()
    foreach ($line in ($Text -split "`r?`n")) {
        if ($line -match '^\s*-\s+(?:\[[ xX]\]\s*)?(.+?)\s*$') {
            $items += (Convert-MarkdownInline $Matches[1])
        }
    }
    return @($items)
}

function Get-ParagraphText {
    param([AllowEmptyString()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    $parts = @()
    foreach ($line in ($Text -split "`r?`n")) {
        $trimmed = $line.Trim()
        if ($trimmed -and $trimmed -notmatch '^<!--' -and $trimmed -notmatch '^\|') {
            $parts += (Convert-MarkdownInline $trimmed)
        }
    }
    return ($parts -join ' ').Trim()
}

function Get-Section {
    param(
        [string]$Text,
        [string]$Heading,
        [int]$Level
    )
    $hashes = '#' * $Level
    $pattern = "(?ms)^$([regex]::Escape($hashes))\s+$([regex]::Escape($Heading))\s*\r?\n(?<body>.*?)(?=^#{1,$Level}\s+|\z)"
    $match = [regex]::Match($Text, $pattern)
    if ($match.Success) { return $match.Groups['body'].Value.Trim() }
    return ''
}

function Get-BoldBlock {
    param([string]$Text, [string]$LabelPattern)
    $pattern = "(?ms)^\*\*(?:$LabelPattern)\*\*\s*\r?\n(?<body>.*?)(?=^\*\*|^#{1,6}\s+|^---\s*$|\z)"
    $match = [regex]::Match($Text, $pattern)
    if ($match.Success) { return $match.Groups['body'].Value.Trim() }
    return ''
}

function Get-FieldTable {
    param([string]$Text)
    $fields = [ordered]@{}
    foreach ($line in ($Text -split "`r?`n")) {
        if ($line -match '^\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|\s*$') {
            $key = (Convert-MarkdownInline $Matches[1])
            $value = $Matches[2].Trim()
            if ($key -and $key -notin @('Trường', '---') -and $key -notmatch '^-+$') {
                $fields[$key] = $value
            }
        }
    }
    return $fields
}

function Get-StatusValue {
    param([string]$RawValue)
    return (Convert-MarkdownInline $RawValue).Trim()
}

function Get-DateIso {
    param([string]$RawValue)
    $value = Convert-MarkdownInline $RawValue
    if ($value -match '^(\d{2})/(\d{2})/(\d{4})$') {
        return '{0}-{1}-{2}' -f $Matches[3], $Matches[2], $Matches[1]
    }
    if ($value -match '^\d{4}-\d{2}-\d{2}$') { return $value }
    return $null
}

function Get-MarkdownLinks {
    param([AllowEmptyString()][string]$Text)
    $links = @()
    foreach ($match in [regex]::Matches($Text, '\[([^\]]+)\]\(([^\)]+)\)')) {
        $links += [ordered]@{ label = $match.Groups[1].Value; target = $match.Groups[2].Value }
    }
    return @($links)
}

function Resolve-DocumentLink {
    param([string]$DocumentPath, [AllowNull()][string]$Target)
    if ([string]::IsNullOrWhiteSpace($Target)) { return $null }
    if ($Target -match '^(?:https?|mailto):') { return $Target }
    $targetWithoutAnchor = ($Target -split '#', 2)[0]
    $anchor = if ($Target.Contains('#')) { '#' + ($Target -split '#', 2)[1] } else { '' }
    if (-not $targetWithoutAnchor) { return $Target }
    $absolute = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $DocumentPath) $targetWithoutAnchor))
    if (-not $absolute.StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Liên kết vượt ngoài repository: $Target trong $DocumentPath"
    }
    return ((Get-RelativePath $absolute) + $anchor)
}

function Get-TaskData {
    param([string]$TaskPath, [string]$ExpectedWeekId)

    $text = Get-Text $TaskPath
    $titleMatch = [regex]::Match($text, '(?m)^#\s+Task tuần:\s*(.+?)\s*$')
    if (-not $titleMatch.Success) { throw "Task thiếu tiêu đề hợp lệ: $TaskPath" }

    $general = Get-Section $text 'Thông tin chung' 2
    $fields = Get-FieldTable $general
    $id = Get-StatusValue $fields['Mã task']
    $weekId = Get-StatusValue $fields['Tuần']
    $status = Get-StatusValue $fields['Trạng thái']
    if (-not $id) { throw "Task thiếu Mã task: $TaskPath" }
    if ($weekId -ne $ExpectedWeekId) { throw "Task $id khai báo tuần '$weekId', kỳ vọng '$ExpectedWeekId'." }
    if ($taskStatuses -notcontains $status) { throw "Task $id có trạng thái không hợp lệ: '$status'." }

    $doText = Get-Section $text 'Cần thực hiện' 3
    $notDoText = Get-Section $text 'Không thực hiện' 3
    $dependencyText = Get-Section $text 'Đầu vào và phụ thuộc' 2
    $dodText = Get-Section $text 'Definition of Done' 2
    $linksText = Get-Section $text 'Liên kết hồ sơ thực hiện' 2
    $progressText = Get-Section $text 'Cập nhật tiến độ' 2
    $deliverableText = Get-Section $text 'Sản phẩm kỳ vọng' 2

    $dependencies = [ordered]@{ documents = @(); coordination = @(); risks = @() }
    foreach ($line in ($dependencyText -split "`r?`n")) {
        if ($line -match '^\s*-\s*Tài liệu/task cần có trước:\s*(.*)$') { $dependencies.documents = @((Convert-MarkdownInline $Matches[1])) }
        elseif ($line -match '^\s*-\s*Người hoặc phần việc cần phối hợp:\s*(.*)$') { $dependencies.coordination = @((Convert-MarkdownInline $Matches[1])) }
        elseif ($line -match '^\s*-\s*Rủi ro/giả định:\s*(.*)$') { $dependencies.risks = @((Convert-MarkdownInline $Matches[1])) }
    }

    $deliverables = @()
    foreach ($line in ($deliverableText -split "`r?`n")) {
        if ($line -match '^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$') {
            $name = Convert-MarkdownInline $Matches[1]
            if ($name -and $name -notin @('Sản phẩm', '---') -and $name -notmatch '^-+$') {
                $deliverables += [ordered]@{
                    name = $name
                    type = Convert-MarkdownInline $Matches[2]
                    location = Convert-MarkdownInline $Matches[3]
                }
            }
        }
    }

    $dod = @()
    foreach ($line in ($dodText -split "`r?`n")) {
        if ($line -match '^\s*-\s+\[([ xX])\]\s*(.+)$') {
            $dod += [ordered]@{ completed = ($Matches[1] -match '[xX]'); text = Convert-MarkdownInline $Matches[2] }
        }
    }

    $linkMap = [ordered]@{ input = $null; output = $null; pullRequest = $null; review = $null; all = @(Get-MarkdownLinks $linksText) }
    foreach ($line in ($linksText -split "`r?`n")) {
        if ($line -match '^\s*-\s*Input workspace:\s*(.*)$') {
            $foundLink = @(Get-MarkdownLinks $Matches[1] | Select-Object -First 1)
            if ($foundLink.Count) { $linkMap.input = Resolve-DocumentLink $TaskPath $foundLink[0].target }
        }
        elseif ($line -match '^\s*-\s*Output workspace:\s*(.*)$') {
            $foundLink = @(Get-MarkdownLinks $Matches[1] | Select-Object -First 1)
            if ($foundLink.Count) { $linkMap.output = Resolve-DocumentLink $TaskPath $foundLink[0].target }
        }
        elseif ($line -match '^\s*-\s*Pull request:\s*(.*)$') {
            $foundLink = @(Get-MarkdownLinks $Matches[1] | Select-Object -First 1)
            if ($foundLink.Count) { $linkMap.pullRequest = Resolve-DocumentLink $TaskPath $foundLink[0].target }
        }
        elseif ($line -match '^\s*-\s*Kết quả review:\s*(.*)$') { $linkMap.review = Convert-MarkdownInline $Matches[1] }
    }

    $updatedAt = $null
    $notes = $null
    foreach ($line in ($progressText -split "`r?`n")) {
        if ($line -match '^\s*-\s*Cập nhật gần nhất:\s*(.*)$') { $updatedAt = Convert-MarkdownInline $Matches[1] }
        elseif ($line -match '^\s*-\s*Ghi chú/tồn đọng:\s*(.*)$') { $notes = Convert-MarkdownInline $Matches[1] }
    }

    return [ordered]@{
        schemaVersion = $schemaVersion
        generatedAt = $generatedAt
        sourceDigest = $sourceDigest
        id = $id
        weekId = $weekId
        title = Convert-MarkdownInline $titleMatch.Groups[1].Value
        status = $status
        owner = Get-StatusValue $fields['Người phụ trách']
        collaborator = Get-StatusValue $fields['Collaborator']
        priority = Get-StatusValue $fields['Ưu tiên']
        dueDate = Get-DateIso $fields['Hạn dự kiến']
        dueDateDisplay = Convert-MarkdownInline $fields['Hạn dự kiến']
        branch = Get-StatusValue $fields['Nhánh thực hiện']
        scope = [ordered]@{
            required = Get-ParagraphText $doText
            requiredItems = @(Get-ListItems $doText)
            excluded = Get-ParagraphText $notDoText
            excludedItems = @(Get-ListItems $notDoText)
        }
        dependencies = $dependencies
        deliverables = @($deliverables)
        definitionOfDone = @($dod)
        links = $linkMap
        progress = [ordered]@{ updatedAt = $updatedAt; notes = $notes }
        source = Get-RelativePath $TaskPath
    }
}

function Get-PlanWeekSection {
    param([string]$PlanText, [int]$WeekNumber)
    $pattern = "(?ms)^###\s+Tuần\s+$WeekNumber\s+[—-]\s+(?<title>.+?)\s*\r?\n(?<body>.*?)(?=^###\s+Tuần\s+|^##\s+Giai đoạn|^#\s+|\z)"
    $match = [regex]::Match($PlanText, $pattern)
    if ($match.Success) {
        return [ordered]@{ title = Convert-MarkdownInline $match.Groups['title'].Value; body = $match.Groups['body'].Value.Trim() }
    }
    return $null
}

function Get-PhaseForWeek {
    param([int]$WeekNumber)
    if ($WeekNumber -le 2) { return [ordered]@{ id = 'phase-00'; title = 'Preparation / readiness'; startWeek = 1; endWeek = 2 } }
    if ($WeekNumber -le 5) { return [ordered]@{ id = 'phase-01'; title = 'Scope, architecture và nền tảng tái lập'; startWeek = 3; endWeek = 5 } }
    if ($WeekNumber -le 9) { return [ordered]@{ id = 'phase-02'; title = 'LMS microservice testbed + observability-by-design'; startWeek = 6; endWeek = 9 } }
    if ($WeekNumber -le 13) { return [ordered]@{ id = 'phase-03'; title = 'Observability, experiment infrastructure và ground truth'; startWeek = 10; endWeek = 13 } }
    if ($WeekNumber -le 19) { return [ordered]@{ id = 'phase-04'; title = 'Data, anomaly detection và RCA'; startWeek = 14; endWeek = 19 } }
    if ($WeekNumber -le 22) { return [ordered]@{ id = 'phase-05'; title = 'Experimental campaign, analysis và planned final release'; startWeek = 20; endWeek = 22 } }
    return [ordered]@{ id = 'phase-06'; title = 'Buffer / contingency'; startWeek = 23; endWeek = 24 }
}

function Get-WeekOverviewData {
    param([string]$OverviewPath)
    if (-not $OverviewPath) { return $null }
    $text = Get-Text $OverviewPath
    $info = Get-FieldTable (Get-Section $text 'Thông tin tuần' 2)
    $dependencyText = Get-Section $text 'Phụ thuộc, rủi ro và quyết định' 2
    $completionText = Get-Section $text 'Tiêu chí kết thúc tuần' 2
    $dependencies = @(); $risks = @(); $decisions = @()
    foreach ($line in ($dependencyText -split "`r?`n")) {
        if ($line -match '^\s*-\s*Phụ thuộc:\s*(.*)$') { $dependencies += Convert-MarkdownInline $Matches[1] }
        elseif ($line -match '^\s*-\s*Rủi ro:\s*(.*)$') { $risks += Convert-MarkdownInline $Matches[1] }
        elseif ($line -match '^\s*-\s*Quyết định cần chốt:\s*(.*)$') { $decisions += Convert-MarkdownInline $Matches[1] }
    }
    $criteria = @()
    foreach ($line in ($completionText -split "`r?`n")) {
        if ($line -match '^\s*-\s+\[([ xX])\]\s*(.+)$') {
            $criteria += [ordered]@{ completed = ($Matches[1] -match '[xX]'); text = Convert-MarkdownInline $Matches[2] }
        }
    }
    return [ordered]@{
        objective = Convert-MarkdownInline $info['Mục tiêu tuần']
        status = Get-StatusValue $info['Trạng thái tuần']
        canonicalPlan = Convert-MarkdownInline $info['Nguồn plan canonical']
        dependencies = @($dependencies)
        risks = @($risks)
        decisions = @($decisions)
        completionCriteria = @($criteria)
        source = Get-RelativePath $OverviewPath
    }
}

function Write-Utf8IfChanged {
    param([string]$Path, [string]$Content)
    $normalized = $Content.TrimEnd() + "`n"
    if (Test-Path $Path) {
        $existing = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
        if ($existing -eq $normalized) { return $false }
    }
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    [IO.File]::WriteAllText($Path, $normalized, (New-Object Text.UTF8Encoding($false)))
    return $true
}

if (-not (Test-Path $planPath)) { throw "Không tìm thấy plan canonical: $planPath" }
if (-not (Test-Path $timelinePath)) { throw "Không tìm thấy timeline shell: $timelinePath" }

$sourceFiles = @($planPath)
$sourceFiles += @(Get-ChildItem -Path $weeklyRoot -Recurse -File -Filter '*.md' | Where-Object { $_.FullName -notmatch '[\\/]templates[\\/]' -and $_.Name -ne 'weekly-planning-guide.md' } | Sort-Object FullName | ForEach-Object FullName)
$digestBuilder = New-Object Text.StringBuilder
foreach ($sourceFile in $sourceFiles) {
    [void]$digestBuilder.Append((Get-RelativePath $sourceFile)).Append("`n").Append((Get-Text $sourceFile)).Append("`n")
}
$sha = [Security.Cryptography.SHA256]::Create()
$digestBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($digestBuilder.ToString()))
$sourceDigest = ([BitConverter]::ToString($digestBytes)).Replace('-', '').ToLowerInvariant()

$generatedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$projectPath = Join-Path $jsonRoot 'project.json'
if (Test-Path $projectPath) {
    try {
        $existingProject = Get-Content -Raw -Encoding UTF8 $projectPath | ConvertFrom-Json
        if ($existingProject.sourceDigest -eq $sourceDigest) { $generatedAt = [string]$existingProject.generatedAt }
    } catch { }
}

$planText = Get-Text $planPath
$startDate = [DateTime]::ParseExact('2026-08-02', 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
$weeks = @()
$taskIds = @{}

for ($number = 1; $number -le 24; $number++) {
    $weekStart = $startDate.AddDays(($number - 1) * 7)
    $weekEnd = $weekStart.AddDays(6)
    $weekId = 'week-{0:d2}_{1}_to_{2}' -f $number, $weekStart.ToString('yyyy-MM-dd'), $weekEnd.ToString('yyyy-MM-dd')
    $phase = Get-PhaseForWeek $number
    $planWeek = Get-PlanWeekSection $planText $number

    if ($number -eq 1) { $title = 'Chuẩn bị'; $planBody = 'Rà soát yêu cầu học phần, lịch cá nhân, tài khoản/repository, công cụ làm việc, quy ước trao đổi và cách lưu tài liệu.' }
    elseif ($number -eq 2) { $title = 'Chuẩn bị trước triển khai'; $planBody = 'Kiểm tra điều kiện làm việc, lịch họp, cách quản lý task/PR, môi trường cá nhân và vấn đề hành chính.' }
    elseif ($planWeek) { $title = $planWeek.title; $planBody = $planWeek.body }
    else { throw "Không đọc được dữ liệu Tuần $number từ plan canonical." }

    $weekDirectory = Get-ChildItem -Path $weeklyRoot -Directory -Filter ("week-{0:d2}_*" -f $number) | Select-Object -First 1
    $overviewPath = $null
    if ($weekDirectory) {
        if ($weekDirectory.Name -ne $weekId) {
            throw "Tên thư mục tuần '$($weekDirectory.Name)' không khớp lịch canonical '$weekId'."
        }
        $candidate = Join-Path $weekDirectory.FullName 'weekly-overview.md'
        if (Test-Path $candidate) { $overviewPath = $candidate }
    }
    $overview = Get-WeekOverviewData $overviewPath
    $status = if ($overview) { $overview.status } else { 'Chưa bắt đầu' }
    if ($weekStatuses -notcontains $status) { throw "Tuần $number có trạng thái không hợp lệ: '$status'." }

    $tasks = @()
    if ($weekDirectory) {
        foreach ($taskFile in @(Get-ChildItem -Path $weekDirectory.FullName -File -Filter 'task-*.md' | Sort-Object Name)) {
            $task = Get-TaskData $taskFile.FullName $weekDirectory.Name
            $taskKey = "$($task.weekId):$($task.id)"
            if ($taskIds.ContainsKey($taskKey)) { throw "Mã task bị trùng trong tuần: $taskKey." }
            $taskIds[$taskKey] = $true
            $tasks += $task
        }
    }

    $goals = if ($number -le 2) { @($planBody) } else { @(Get-ListItems (Get-BoldBlock $planBody 'Mục tiêu chung')) }
    $workstreams = @()
    if ($number -gt 2) {
        foreach ($role in @('A', 'B')) {
            $roleMatch = [regex]::Match($planBody, "(?ms)^\*\*$role\s+[—-]\s+(?<name>.+?)\*\*\s*\r?\n(?<body>.*?)(?=^\*\*|^#{1,6}\s+|^---\s*$|\z)")
            if ($roleMatch.Success) {
                $workstreams += [ordered]@{
                    role = $role
                    owner = if ($role -eq 'A') { 'Đức' } else { 'Bách' }
                    title = Convert-MarkdownInline $roleMatch.Groups['name'].Value
                    items = @(Get-ListItems $roleMatch.Groups['body'].Value)
                }
            }
        }
    }
    $deliverables = if ($number -le 2) { @() } else { @(Get-ListItems (Get-BoldBlock $planBody 'Bàn giao')) }
    $gateMatch = [regex]::Match($planBody, '(?m)^\*\*(Gate[^:]*):\*\*\s*(.+?)\s*$')
    $gate = if ($gateMatch.Success) { [ordered]@{ name = Convert-MarkdownInline $gateMatch.Groups[1].Value; description = Convert-MarkdownInline $gateMatch.Groups[2].Value } } else { $null }

    $week = [ordered]@{
        schemaVersion = $schemaVersion
        generatedAt = $generatedAt
        sourceDigest = $sourceDigest
        id = $weekId
        number = $number
        title = $title
        startDate = $weekStart.ToString('yyyy-MM-dd')
        endDate = $weekEnd.ToString('yyyy-MM-dd')
        status = $status
        phase = $phase
        objective = if ($overview -and $overview.objective) { $overview.objective } elseif (@($goals).Count) { $goals -join ' ' } else { $title }
        planGoals = @($goals)
        workstreams = @($workstreams)
        deliverables = @($deliverables)
        gate = $gate
        dependencies = if ($overview) { @($overview.dependencies) } else { @() }
        risks = if ($overview) { @($overview.risks) } else { @() }
        decisions = if ($overview) { @($overview.decisions) } else { @() }
        completionCriteria = if ($overview) { @($overview.completionCriteria) } else { @() }
        tasks = @($tasks)
        sources = [ordered]@{
            canonicalPlan = Get-RelativePath $planPath
            weeklyOverview = if ($overview) { $overview.source } else { $null }
        }
    }
    $weeks += $week
}

$phases = @()
foreach ($phaseId in @('phase-00','phase-01','phase-02','phase-03','phase-04','phase-05','phase-06')) {
    $phaseWeek = $weeks | Where-Object { $_.phase.id -eq $phaseId } | Select-Object -First 1
    $phases += $phaseWeek.phase
}

$milestones = @(
    [ordered]@{ id = 'p0'; title = 'Readiness'; week = 2; description = 'Hai thành viên sẵn sàng bắt đầu.' },
    [ordered]@{ id = 'm1'; title = 'Nền tảng tái lập'; week = 5; description = 'Scope, architecture, contract, repository, Compose và CI có baseline.' },
    [ordered]@{ id = 'm2'; title = 'Testbed MVP'; week = 9; description = 'LMS testbed chạy E2E với HTTP, async dependency và test tự động.' },
    [ordered]@{ id = 'm3'; title = 'Observability & Fault'; week = 13; description = 'Telemetry, workload, fault framework và dataset mẫu tái lập được.' },
    [ordered]@{ id = 'm4'; title = 'AI/RCA Integrated MVP'; week = 19; description = 'Pipeline telemetry đến Top-K RCA chạy end-to-end.' },
    [ordered]@{ id = 'm5'; title = 'Evaluation Freeze'; week = 21; description = 'Campaign, baseline, ablation, robustness và kết quả chính hoàn tất.' },
    [ordered]@{ id = 'm6'; title = 'Planned Final Release'; week = 22; description = 'Source, reproducibility package, báo cáo, slide và demo hoàn tất.' },
    [ordered]@{ id = 'b1-b2'; title = 'Contingency'; week = 24; description = 'Buffer rủi ro, không lên lịch feature mới.' }
)

$project = [ordered]@{
    schemaVersion = $schemaVersion
    generatedAt = $generatedAt
    sourceDigest = $sourceDigest
    project = [ordered]@{
        id = 'aiops-rca-for-microservices'
        title = 'AIOps RCA for Microservices'
        description = 'Phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố từ observability telemetry.'
        repository = 'https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP'
        members = @(
            [ordered]@{ name = 'Nguyễn Minh Đức'; shortName = 'Đức'; role = 'Backend / Platform primary'; github = 'https://github.com/Minhduc7904'; avatar = 'docs/processed/plan/timeline/assets/avatar-duc.png' },
            [ordered]@{ name = 'Mai Khoa Bách'; shortName = 'Bách'; role = 'AI / Diagnosis primary'; github = 'https://github.com/b4schh'; avatar = 'docs/processed/plan/timeline/assets/avatar-bach.png' }
        )
    }
    schedule = [ordered]@{ startDate = '2026-08-02'; endDate = '2027-01-16'; totalWeeks = 24 }
    phases = @($phases)
    milestones = @($milestones)
    weeks = @($weeks)
    sources = @($sourceFiles | ForEach-Object { Get-RelativePath $_ })
}

if ($weeks.Count -ne 24) { throw "Kỳ vọng 24 tuần, nhận được $($weeks.Count)." }
for ($index = 1; $index -lt $weeks.Count; $index++) {
    $previousEnd = [DateTime]::ParseExact($weeks[$index - 1].endDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
    $currentStart = [DateTime]::ParseExact($weeks[$index].startDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
    if ($currentStart -ne $previousEnd.AddDays(1)) { throw "Lịch tuần không liên tục tại Tuần $($weeks[$index].number)." }
}

$changed = $false
$projectJson = $project | ConvertTo-Json -Depth 20
$changed = (Write-Utf8IfChanged $projectPath $projectJson) -or $changed

$desiredJsonPaths = @($projectPath)
foreach ($week in $weeks) {
    $weekDirectoryPath = Join-Path $weeksRoot $week.id
    $weekJsonPath = Join-Path $weekDirectoryPath 'week.json'
    $desiredJsonPaths += $weekJsonPath
    $changed = (Write-Utf8IfChanged $weekJsonPath ($week | ConvertTo-Json -Depth 20)) -or $changed
    foreach ($task in $week.tasks) {
        $taskJsonPath = Join-Path (Join-Path $weekDirectoryPath 'tasks') ($task.id + '.json')
        $desiredJsonPaths += $taskJsonPath
        $changed = (Write-Utf8IfChanged $taskJsonPath ($task | ConvertTo-Json -Depth 20)) -or $changed
    }
}

if (Test-Path $weeksRoot) {
    foreach ($jsonFile in @(Get-ChildItem -Path $weeksRoot -Recurse -File -Filter '*.json')) {
        if ($desiredJsonPaths -notcontains $jsonFile.FullName) { Remove-Item -LiteralPath $jsonFile.FullName -Force; $changed = $true }
    }
    foreach ($directory in @(Get-ChildItem -Path $weeksRoot -Recurse -Directory | Sort-Object FullName -Descending)) {
        if (-not (Get-ChildItem -LiteralPath $directory.FullName -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $directory.FullName -Force }
    }
}

$html = Get-Text $timelinePath
$startMarker = '<!-- PROJECT_DATA_START -->'
$endMarker = '<!-- PROJECT_DATA_END -->'
$startIndex = $html.IndexOf($startMarker)
$endIndex = $html.IndexOf($endMarker)
if ($startIndex -lt 0 -or $endIndex -lt 0 -or $endIndex -le $startIndex) { throw 'Timeline HTML thiếu marker dữ liệu.' }
$embeddedJson = ($projectJson -replace '</script', '<\/script')
$replacement = "$startMarker`r`n<script type=`"application/json`" id=`"project-data`">$embeddedJson</script>`r`n$endMarker"
$newHtml = $html.Substring(0, $startIndex) + $replacement + $html.Substring($endIndex + $endMarker.Length)
$changed = (Write-Utf8IfChanged $timelinePath $newHtml) -or $changed

Write-Host ('Đồng bộ thành công: 24 tuần, {0} task, digest {1}.' -f $taskIds.Count, $sourceDigest.Substring(0, 12)) -ForegroundColor Green
if (-not $changed) { Write-Host 'Dữ liệu đã mới nhất; không có file nào thay đổi.' -ForegroundColor DarkGray }
