# ============================================================================
# API Test: Verify Fabric Gateway Connection
# ============================================================================
# Run this in a NEW PowerShell window (while backend is running)

Write-Host "=========================================="
Write-Host "🧪 Testing Blockchain Quarantine API"
Write-Host "=========================================="
Write-Host ""

# Check if backend is running
Write-Host "🔍 Checking if backend is running on localhost:8000..." -ForegroundColor Cyan
try {
    $testResponse = Invoke-WebRequest -Uri "http://localhost:8000/docs" -Method GET -ErrorAction Stop -TimeoutSec 2
    Write-Host "✅ Backend is running!" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is NOT running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure to:" -ForegroundColor Yellow
    Write-Host "1. Open PowerShell"
    Write-Host "2. Run: powershell -File start-backend.ps1"
    Write-Host "3. Wait for FastAPI server to start"
    Write-Host "4. Then run this script in a NEW PowerShell window"
    exit 1
}

Write-Host ""
Write-Host "📤 Sending test quarantine request..." -ForegroundColor Cyan
Write-Host ""

# Create test payload
$body = @{
    batch_id = "BATCH-TEST-001"
    reason = "CRITICAL_TEMPERATURE_BREACH"
    reference_key = "telemetry_001"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:8000/api/blockchain/quarantine" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 10

    # Parse response
    $responseData = $response.Content | ConvertFrom-Json

    Write-Host "✅ API Response:" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Batch ID:  $($responseData.batch_id)"
    Write-Host "  Status:    $($responseData.status)"
    Write-Host "  TX ID:     $($responseData.tx_id)"
    Write-Host "  Mode:      $($responseData.mode)"
    Write-Host ""

    # Check if gateway mode is active
    if ($responseData.mode -eq "gateway") {
        Write-Host "✅ LIVE BLOCKCHAIN MODE ACTIVE!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Your transaction was recorded on the actual Hyperledger Fabric ledger."
        Write-Host "   Phase 2 is complete! 🎉"
    } elseif ($responseData.mode -eq "mock") {
        Write-Host "⚠️  Mock Mode (Fallback)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   The API is working, but credentials may not be configured."
        Write-Host "   Check that:"
        Write-Host "   1. .env file exists in drug-supply-chain directory"
        Write-Host "   2. FABRIC_MODE=production"
        Write-Host "   3. All credential paths are correct and files exist"
        Write-Host "   4. Backend was restarted after updating .env"
    }

    Write-Host ""
    Write-Host "=========================================="
    Write-Host "Full Response:"
    Write-Host "=========================================="
    Write-Host ($responseData | ConvertTo-Json -Depth 3)

} catch {
    Write-Host "❌ API call failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Cyan
    Write-Host "1. Check backend is running (first PowerShell window)"
    Write-Host "2. Check backend logs for errors"
    Write-Host "3. Verify .env file exists and is valid"
    Write-Host "4. Check that Fabric network is running (docker ps)"
    exit 1
}

Write-Host ""
