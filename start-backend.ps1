# ============================================================================
# Step 1: Verify Docker Desktop is Running
# ============================================================================
# Run this FIRST in PowerShell
# This checks if Docker engine is active before proceeding

Write-Host "🐳 Checking Docker Desktop status..." -ForegroundColor Cyan

$dockerStatus = docker ps 2>&1

if ($dockerStatus -like "*Cannot connect to Docker daemon*" -or $dockerStatus -like "*error*") {
    Write-Host "❌ Docker Desktop is NOT running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "ACTION REQUIRED:" -ForegroundColor Yellow
    Write-Host "1. Open Windows Start Menu"
    Write-Host "2. Search for 'Docker Desktop'"
    Write-Host "3. Click to launch it"
    Write-Host "4. Wait 1-2 minutes for the icon to turn GREEN in taskbar"
    Write-Host "5. Then run this script again"
    Write-Host ""
    exit 1
}

Write-Host "✅ Docker Desktop is running!" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 2: Start Backend from Correct Virtual Environment
# ============================================================================

Write-Host "🚀 Starting Backend FastAPI server..." -ForegroundColor Cyan

# Navigate to Jarvis folder where .venv exists
$jarvisPath = "C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis"
cd $jarvisPath

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray

# Activate venv
Write-Host "Activating virtual environment..." -ForegroundColor Gray
& ".\.venv\Scripts\Activate.ps1"

# Move to drug-supply-chain
cd "drug-supply-chain"
Write-Host "Changed to: $(Get-Location)" -ForegroundColor Gray

# Start backend
Write-Host ""
Write-Host "Starting backend on http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python -m backend.main
