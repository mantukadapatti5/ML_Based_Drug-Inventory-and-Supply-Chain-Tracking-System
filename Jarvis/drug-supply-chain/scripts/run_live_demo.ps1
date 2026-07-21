# End-to-end live verification — Drug Supply Chain
# Usage:
#   .\scripts\run_live_demo.ps1              # Docker + backend job + edge
#   .\scripts\run_live_demo.ps1 -Breach      # Force temp > 8C on edge
#   .\scripts\run_live_demo.ps1 -SmokeOnly   # No Docker, run smoke_test only
#   .\scripts\run_live_demo.ps1 -SkipDocker  # Backend + edge only (Docker already up)

param(
    [switch]$Breach,
    [switch]$SkipDocker,
    [switch]$SmokeOnly
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
$env:PYTHONPATH = $Root

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example" -ForegroundColor Green
}

function Test-DockerEngine {
    docker info 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

if ($SmokeOnly) {
    python scripts\smoke_test.py
    exit $LASTEXITCODE
}

Write-Host "`n=== Smoke test (offline core) ===" -ForegroundColor Cyan
python scripts\smoke_test.py
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Smoke test reported failures — fix dependencies first (pip install -r backend/requirements.txt)"
}

if (-not $SkipDocker) {
    if (-not (Test-DockerEngine)) {
        Write-Host "`nDocker engine is not running. Start Docker Desktop, then re-run." -ForegroundColor Red
        Write-Host "Continuing with -SkipDocker mode instructions:" -ForegroundColor Yellow
        Write-Host "  docker compose up -d --build"
        Write-Host "  python -m uvicorn backend.main:app --port 8000"
        Write-Host "  python edge/raspberry-pi/main.py"
        exit 1
    }

    Write-Host "`n=== Docker infrastructure ===" -ForegroundColor Cyan
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Host "Waiting 25s for services..."
    Start-Sleep -Seconds 25
    docker compose ps
}

Write-Host "`n=== Starting backend (uvicorn) in background ===" -ForegroundColor Cyan
$logFile = Join-Path $Root "logs\uvicorn.log"
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

$uvicornArgs = @(
    "-NoExit", "-Command",
    "Set-Location '$Root'; `$env:PYTHONPATH='$Root'; python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 2>&1 | Tee-Object -FilePath '$logFile'"
)
Start-Process powershell -ArgumentList $uvicornArgs | Out-Null

Write-Host "Waiting 12s for API..."
Start-Sleep -Seconds 12

try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 15
    Write-Host "Health:" -ForegroundColor Green
    $health | ConvertTo-Json -Depth 3
} catch {
    Write-Warning "Backend not ready: $_"
    Write-Host "Check logs: $logFile"
}

Write-Host "`n=== Edge truck simulator (Ctrl+C to stop) ===" -ForegroundColor Cyan
$env:EDGE_MQTT_HOST = "localhost"
if ($Breach) {
    $env:EDGE_FORCE_BREACH = "1"
    Write-Host "BREACH MODE ON" -ForegroundColor Yellow
}

python edge\raspberry-pi\main.py
