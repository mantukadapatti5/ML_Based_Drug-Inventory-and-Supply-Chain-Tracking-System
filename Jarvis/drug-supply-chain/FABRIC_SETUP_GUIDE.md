# Phase 2: Hyperledger Fabric Local Network Setup Guide

This guide walks you through spinning up a local Hyperledger Fabric test network and deploying your drug provenance chaincode to enable Features #8, #11, #16, #19, and #21.

## Prerequisites

- **Docker & Docker Compose** (Fabric runs in containers)
- **Git** (for cloning fabric-samples)
- **Go 1.20+** (optional, for chaincode verification)
- **Node.js 16+** (for Fabric CLI tools)

### Verify Docker Installation
```bash
docker --version
docker-compose --version
```

---

## Step 1: Clone Fabric Samples (Outside Your Project)

The official Hyperledger Fabric test network is not included in your repository. Clone it to a location **outside** your drug-supply-chain project (recommended: `~/fabric-samples/`):

```bash
cd ~
git clone https://github.com/hyperledger/fabric-samples.git
cd fabric-samples
git checkout release-2.5  # Use stable release (adjust version if needed)
```

This gives you the `test-network` directory and the network management scripts.

---

## Step 2: Bring Up the Local Test Network

Navigate to the test network and create a channel named `drugchannel`:

```bash
cd ~/fabric-samples/test-network

# Bring up the network with CA (Certificate Authority)
./network.sh up createChannel -c drugchannel -ca

# Expected output:
# - peer0.org1.example.com:7051 (running)
# - peer0.org2.example.com:7051 (running)
# - Orderer (running)
# - Channel 'drugchannel' created
```

**Troubleshooting:**
- If script fails with permission denied: `chmod +x ./network.sh`
- If Docker containers won't start: Check `docker ps` and `docker logs orderer.example.com`
- If port conflicts: Stop other services using 7051, 7052, 9051, 9052, etc.

---

## Step 3: Verify Network Health

```bash
# Check running containers
docker ps | grep -E "peer|orderer|ca"

# You should see:
# - peer0.org1.example.com
# - peer0.org2.example.com
# - orderer.example.com
# - ca_org1
# - ca_org2
```

---

## Step 4: Deploy Your Drug Provenance Chaincode

With the network running, deploy your `drug_provenance.go` smart contract:

```bash
# From ~/fabric-samples/test-network directory:

export CHAINCODE_PATH="/path/to/Jarvis/drug-supply-chain/blockchain/chaincode"
export CHAINCODE_NAME="drug_provenance"
export CHANNEL_NAME="drugchannel"

./network.sh deployCC \
  -c $CHANNEL_NAME \
  -ccn $CHAINCODE_NAME \
  -ccp $CHAINCODE_PATH \
  -ccl go

# Expected output:
# - Packaging chaincode...
# - Installing on peer0.org1.example.com...
# - Approving on org1...
# - Committing on orderer...
# - Chaincode instantiated successfully
```

**Troubleshooting:**
- If "chaincode not found": Verify `drug_provenance.go` and `go.mod` are in the path
- If "install failed": Check Docker daemon is running (`docker ps`)
- If "permission denied": Run with sudo or adjust fabric-samples ownership

---

## Step 5: Extract Admin Credentials

The test-network generates certificates and keys in `organizations/`. You need to provide these paths to your FastAPI backend:

```bash
# List admin certificate path (use first file found)
ls ~/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/

# Should output:
# Admin@org1.example.com-cert.pem

# List admin private keys
ls ~/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/

# Should output:
# [random_hex]_sk  (e.g., c123abc456def...\_sk)

# List peer TLS CA certificate
ls ~/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/cacerts/

# Should output:
# tlsca.org1.example.com-cert.pem
```

---

## Step 6: Update Backend Configuration

Edit your `.env` file (or create one) in the drug-supply-chain root directory:

```bash
# From ~/Jarvis/drug-supply-chain/

# Enable production mode to use live Fabric
FABRIC_MODE=production

# Set the channel and chaincode names
FABRIC_CHANNEL=drugchannel
FABRIC_CHAINCODE=drug_provenance

# Peer endpoint (inside Docker network, the test-network uses DNS names)
# For local host access: localhost:7051
FABRIC_PEER_ENDPOINT=localhost:7051

# Set credential paths (full paths or relative)
FABRIC_CERT_PATH=/path/to/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem

FABRIC_KEY_PATH=/path/to/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/[key_filename]_sk

FABRIC_TLS_CERT_PATH=/path/to/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/cacerts/tlsca.org1.example.com-cert.pem

# MSP ID (usually Org1MSP for test-network)
FABRIC_MSP_ID=Org1MSP
```

**Example with full paths (macOS/Linux):**
```
FABRIC_MODE=production
FABRIC_CHANNEL=drugchannel
FABRIC_CHAINCODE=drug_provenance
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_CERT_PATH=$HOME/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem
FABRIC_KEY_PATH=$HOME/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/c123abc456def_sk
FABRIC_TLS_CERT_PATH=$HOME/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/cacerts/tlsca.org1.example.com-cert.pem
FABRIC_MSP_ID=Org1MSP
```

---

## Step 7: Test Fabric Gateway Connection

Restart your FastAPI backend and check logs:

```bash
# In your drug-supply-chain directory
python -m backend.main

# Watch for log output:
# ✅ "Fabric Gateway connected: channel=drugchannel chaincode=drug_provenance"
# ❌ "Fabric credentials not configured — using mock ledger" → Check .env paths
```

---

## Step 8: Verify Live Chaincode Execution

Submit a test transaction through your API:

```bash
# Test the quarantine endpoint (Feature #13 anomaly handling)
curl -X POST http://localhost:8000/api/blockchain/quarantine \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "BATCH-TEST-001",
    "reason": "CRITICAL_TEMPERATURE_BREACH",
    "reference_key": "telemetry_001"
  }'

# Expected responses:
# ✅ Live Fabric: "mode": "gateway", "tx_id": "0x..." (actual ledger hash)
# ❌ Mock mode: "mode": "mock", "tx_id": "0x..." (in-memory only)
```

---

## Cleanup & Shutdown

When done with your Fabric network:

```bash
# Stop the network (keeps volumes/data)
cd ~/fabric-samples/test-network
./network.sh down

# Full cleanup (removes everything including data)
./network.sh down
rm -rf organizations channel-artifacts

# Restart fresh for next session
./network.sh up createChannel -c drugchannel -ca
```

---

## Features Enabled by Phase 2

Once Fabric is live, these features use real blockchain ledger:

- **#8 Movement History**: Recorded immutably on chaincode
- **#11 Provenance Chain**: Full audit trail on ledger
- **#16 Smart Procurement**: Auto-trigger orders based on inventory consensus
- **#19 Vendor Rating**: Consensus-driven supplier scoring
- **#21 Compliance Logs**: Immutable GxP audit records

---

## Troubleshooting

### Issue: "Connection refused" on `localhost:7051`
**Solution**: Verify network is up with `docker ps | grep peer`

### Issue: Certificate file not found
**Solution**: Double-check paths match output from `ls` command in Step 5

### Issue: "UNAUTHORIZED" when submitting transactions
**Solution**: Ensure credentials path is correct and file is readable

### Issue: Chaincode not installed
**Solution**: Re-run `./network.sh deployCC` with correct `-ccp` path

### Issue: Want to keep old data while testing
**Solution**: Use `./network.sh down` (keeps organizations/) then `./network.sh up`

---

## Next Steps (Phase 3)

Once Fabric is live:
1. Update frontend endpoints to query real blockchain (instead of mock REST)
2. Enable event listeners for real-time chaincode events
3. Integrate with FEFO dispatch logic using ledger consensus
