# 一键同步更新：把知识库最新笔记同步到网站并自动发布
# 用法：右键"使用 PowerShell 运行"，或终端执行：pwsh ./同步更新.ps1
$ErrorActionPreference = 'Stop'
$src  = 'C:\Users\whf\WPSDrive\451237663\WPS云盘\jacky_wu\jacky_wu\自考学习库'
$site = 'C:\Users\whf\zikaoxuexi'
$dst  = Join-Path $site 'content'
$enc  = New-Object System.Text.UTF8Encoding($false)

Write-Host "[1/4] 拷贝最新内容..." -ForegroundColor Cyan
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Copy-Item -LiteralPath "$src\00178-市场调查与预测" -Destination "$dst\00178-市场调查与预测" -Recurse -Force
Copy-Item -LiteralPath "$src\_模板" -Destination "$dst\_模板" -Recurse -Force
Copy-Item -LiteralPath "$src\README.md" -Destination "$dst\index.md" -Force

Write-Host "[2/4] 校验 frontmatter..." -ForegroundColor Cyan
Get-ChildItem -Path $dst -Recurse -Filter *.md | ForEach-Object {
  $text = [System.IO.File]::ReadAllText($_.FullName, $enc)
  if ($text -match '^(?s)---\r?\n(.*?)\r?\n---') {
    $fm = $Matches[1]
    $lines = $fm -split "\r?\n" | ForEach-Object { if ($_ -match '^  (?!- )(\S)') { $_.Substring(2) } else { $_ } }
    $newFm = [string]::Join("`n", $lines)
    if ($newFm -ne $fm) {
      $newText = [regex]::Replace($text, '^(?s)---\r?\n.*?\r?\n---', "---`n$newFm`n---", 1)
      [System.IO.File]::WriteAllText($_.FullName, $newText, $enc)
    }
  }
}

Write-Host "[3/4] 本地构建验证..." -ForegroundColor Cyan
Set-Location $site
npx quartz build
if ($LASTEXITCODE -ne 0) { Write-Error "构建失败，已中止（不会推送）"; exit 1 }

Write-Host "[4/4] 提交并推送（GitHub Actions 将自动更新网站）..." -ForegroundColor Cyan
git add -A
$msg = "content: 同步更新 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git -c user.name="wuhai511-ui" -c user.email="wuhai511-ui@users.noreply.github.com" commit -m $msg
git push
Write-Host "完成！约 1-2 分钟后访问 https://wuhai511-ui.github.io/zikaoxuexi/" -ForegroundColor Green
