# Phase 2: Windows-Optimized Complete Setup Guide

## Overview

You have 3 automated scripts to run in sequence. Each handles a critical part of the setup:

1. **start-backend.ps1** - Starts FastAPI backend from correct venv
2. **setup-fabric.sh** - Sets up Hyperledger Fabric network (Git Bash)
3. **test-api.ps1** - Verifies everything works together

---

## ✅ CRITICAL FIRST: Start Docker Desktop

**This is the most important step.** Hyperledger Fabric cannot run without Docker.

### On Windows:
1. Open **Windows Start Menu**
2. Search for **"Docker Desktop"**
3. Click to launch it
4. Wait **1-2 minutes** for the icon to turn **GREEN** in your taskbar
5. Verify it's ready:
   ```powershell
   docker ps
   ```
   Should show empty table header without errors.

---

## 🚀 Phase 2 Setup (5 Steps)

### Step 1: Start Backend (PowerShell Window #1)

```powershell
# This launches your FastAPI server on port 8000
powershell -File "C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\start-backend.ps1"

# Keep this window open! Your backend will run here.
# You'll see FastAPI startup logs and then:
# ✅ Uvicorn running on http://127.0.0.1:8000
```

**Expected output:**
```
✅ Docker Desktop is running!
Activating virtual environment...
Changed to: C:\Users\...\drug-supply-chain
Starting backend on http://localhost:8000

INFO:     Uvicorn running on http://127.0.0.1:8000 [Press CTRL+C to quit]
```

✅ **Leave this window running.** Proceed to Step 2.

---

### Step 2: Set Up Fabric Network (Git Bash Window)

Open a **new terminal** with Git Bash:

1. In VS Code: Click **Terminal** → **New Terminal** → Select **Git Bash** from dropdown
2. Or: Right-click folder in Explorer → **Git Bash Here**

Then run:
```bash
bash "/c/Users/Mahanthesh V K/OneDrive/Desktop/Dummy/setup-fabric.sh"
```

**What happens:**
- Cleans old network state
- Brings up Fabric test network (takes ~2-3 minutes)
- Deploys your drug_provenance chaincode
- Extracts admin credentials

**Expected output:**
```
✅ Network started successfully!
✅ Chaincode deployed successfully!
✅ Found keystore file: c123abc456def_sk

📋 Credential paths for .env file:
==================================================
FABRIC_CERT_PATH=C:\Users\...
FABRIC_KEY_PATH=C:\Users\...\c123abc456def_sk
FABRIC_TLS_CERT_PATH=C:\Users\...
```

✅ **Copy the credential paths** (you'll use them in Step 3)

---

### Step 3: Update .env File

Edit the `.env` file in your drug-supply-chain directory:

**File location:**
```
C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain\.env
```

**Contents (paste your credential paths from Step 2):**
```
FABRIC_MODE=production
FABRIC_CHANNEL=drugchannel
FABRIC_CHAINCODE=drug_provenance
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_CERT_PATH=C:\Users\Mahanthesh V K\fabric-samples\test-network\organizations\peerOrganizations\org1.example.com\users\Admin@org1.example.com\msp\signcerts\Admin@org1.example.com-cert.pem
FABRIC_KEY_PATH=C:\Users\Mahanthesh V K\fabric-samples\test-network\organizations\peerOrganizations\org1.example.com\users\Admin@org1.example.com\msp\keystore\[KEY_FILE_FROM_STEP_2]
FABRIC_TLS_CERT_PATH=C:\Users\Mahanthesh V K\fabric-samples\test-network\organizations\peerOrganizations\org1.example.com\peers\peer0.org1.example.com\tls\cacerts\tlsca.org1.example.com-cert.pem
FABRIC_MSP_ID=Org1MSP
```

**Important:** Replace `[KEY_FILE_FROM_STEP_2]` with the actual keystore filename from Step 2 (e.g., `c123abc456def_sk`)

---

### Step 4: Restart Backend

Stop the backend in PowerShell Window #1:
```
Press Ctrl+C
```

Then restart it:
```powershell
powershell -File "C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\start-backend.ps1"
```

Watch for this success message in logs:
```
✅ Fabric Gateway connected (LIVE): channel=drugchannel chaincode=drug_provenance
```

Or if credentials are wrong:
```
Fabric mode set to 'mock' — using in-memory mock ledger.
```

---

### Step 5: Test API (PowerShell Window #2)

Open a **new PowerShell window** (keep backend running in #1):

```powershell
powershell -File "C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\test-api.ps1"
```

**Expected success response:**
```
✅ API Response:

  Batch ID:  BATCH-TEST-001
  Status:    QUARANTINED
  TX ID:     0x...
  Mode:      gateway

✅ LIVE BLOCKCHAIN MODE ACTIVE!
   Your transaction was recorded on the actual Hyperledger Fabric ledger.
   Phase 2 is complete! 🎉
```

**Or if in mock mode:**
```
⚠️  Mock Mode (Fallback)
   Check that:
   1. .env file exists in drug-supply-chain directory
   2. FABRIC_MODE=production
   3. All credential paths are correct
```

---

## 📋 Window Layout (All 3 Running Together)

```
┌─────────────────────────────────────────────┐
│ PowerShell #1: BACKEND (python -m backend)  │
│ Status: Uvicorn running on :8000            │
│ (Keep this open at all times)               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Git Bash: FABRIC SETUP                      │
│ (Run setup-fabric.sh, then close when done) │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ PowerShell #2: API TESTING                  │
│ (Run test-api.ps1 to verify everything)     │
└─────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Issue: "Docker Desktop is NOT running"
- Start Docker Desktop from Windows Start Menu
- Wait 1-2 minutes for green icon
- Then run setup-fabric.sh again

### Issue: "Cannot find file" errors in Git Bash
- Use forward slashes `/` in Git Bash (not backslashes)
- Use `/c/Users/` for C: drive
- Scripts already handle this

### Issue: Backend shows "Fabric credentials not configured"
- Check .env file exists in drug-supply-chain directory
- Verify FABRIC_MODE=production
- Verify credential paths have NO `[KEY_FILE_FROM_STEP_2]` placeholder
- Restart backend after updating .env

### Issue: API returns "Unable to connect"
- Is backend running in PowerShell #1?
- Check backend logs for errors
- Try curl from same machine: `curl http://localhost:8000/docs`

### Issue: Chaincode deployment fails
- Verify Fabric network started (check setup-fabric.sh output)
- Check Docker containers: `docker ps`
- Check Docker logs: `docker logs peer0.org1.example.com`

---

## ✅ Success Indicators

Phase 2 is complete when you see:

1. ✅ Backend logs show: `"Fabric Gateway connected (LIVE)"`
2. ✅ API returns: `"mode": "gateway"`
3. ✅ Response has real transaction ID: `"tx_id": "0x..."`

---

## 📝 Next Steps

Once Phase 2 is complete:

1. **Phase 3**: Update frontend endpoints to use real blockchain
2. **Features Enabled**: #8 (Movement), #11 (Provenance), #16 (Smart Procurement), #19 (Vendor Rating), #21 (Compliance)
3. **Production Ready**: Your system now uses immutable ledger for all transactions

---

## Quick Command Reference

| Task | Command |
|------|---------|
| Start Docker | Search Windows Start Menu for "Docker Desktop" |
| Start Backend | `powershell -File start-backend.ps1` |
| Setup Fabric | `bash setup-fabric.sh` (in Git Bash) |
| Test API | `powershell -File test-api.ps1` |
| Check Docker | `docker ps` |
| Check Backend | `curl http://localhost:8000/docs` |
| Kill Backend | `Ctrl+C` in PowerShell #1 |
| Reset Fabric | `bash ./network.sh down` (in Git Bash test-network) |

---

## File Locations

```
C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\
├── start-backend.ps1          ← PowerShell backend launcher
├── setup-fabric.sh            ← Git Bash Fabric setup
├── test-api.ps1               ← PowerShell API tester
└── Jarvis\
    ├── .venv\                 ← Virtual environment (do not edit)
    └── drug-supply-chain\
        ├── .env               ← UPDATE with credential paths
        ├── backend\
        │   ├── main.py
        │   ├── config.py
        │   └── services\
        │       └── fabric_client.py
        └── blockchain\
            └── chaincode\
                ├── drug_provenance.go
                └── go.mod
```

---

🎉 **You're ready! Start with Step 1: Docker Desktop, then follow Steps 1-5 above.**
