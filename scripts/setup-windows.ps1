# Fund Dashboard - Windows desktop integration
# Run once to create desktop shortcut + auto-start

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$startBat = Join-Path $PSScriptRoot "start.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$startup = [Environment]::GetFolderPath("Startup")

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fund Dashboard - Desktop Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Create desktop shortcut
Write-Host "[1/3] Creating desktop shortcut..." -ForegroundColor Yellow

$desktopShortcut = Join-Path $desktop "Fund Dashboard.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($desktopShortcut)
$sc.TargetPath = $startBat
$sc.WorkingDirectory = $projectDir
$sc.WindowStyle = 7
$sc.Description = "Fund Dashboard"
$sc.Save()

Write-Host "  Done: $desktopShortcut" -ForegroundColor Green

# 2. Create startup shortcut
Write-Host "[2/3] Setting up auto-start..." -ForegroundColor Yellow

$startupShortcut = Join-Path $startup "Fund Dashboard.lnk"
$sc2 = $ws.CreateShortcut($startupShortcut)
$sc2.TargetPath = $startBat
$sc2.WorkingDirectory = $projectDir
$sc2.WindowStyle = 7
$sc2.Save()

Write-Host "  Done: $startupShortcut" -ForegroundColor Green

# 3. Start service now
Write-Host "[3/3] Starting service..." -ForegroundColor Yellow

Start-Process -FilePath $startBat -WindowStyle Minimized

Write-Host "  Service starting..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Desktop:  Fund Dashboard.lnk" -ForegroundColor White
Write-Host "  Auto-start: ON (Startup folder)" -ForegroundColor White
Write-Host "  URL:      http://localhost:3000/fund-dashboard/" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
