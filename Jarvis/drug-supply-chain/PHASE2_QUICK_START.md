# Phase 2 Quick Reference Card

## Files to Check/Update

### 1. Read Setup Guide First
```bash
cat FABRIC_SETUP_GUIDE.md
```
This walks you through spinning up the local Fabric network step-by-step.

### 2. Create/Update .env File
```bash
# Copy template and fill in credentials
cp .env.fabric.template .env

# Edit and add paths (after running ./network.sh in fabric-samples)
nano .env
```

**Minimal .env for Phase 2**:
```bash
FABRIC_MODE=production
FABRIC_CHANNEL=drugchannel
FABRIC_CHAINCODE=drug_provenance
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_CERT_PATH=/full/path/to/Admin@org1.example.com-cert.pem
FABRIC_KEY_PATH=/full/path/to/keystore/*_sk
FABRIC_TLS_CERT_PATH=/full/path/to/tlsca.org1.example.com-cert.pem
FABRIC_MSP_ID=Org1MSP
```

### 3. Backend Configuration
- [backend/config.py](backend/config.py): ✅ Updated with `FABRIC_MODE` setting
- [backend/services/fabric_client.py](backend/services/fabric_client.py): ✅ Enhanced connect() method

### 4. Documentation Created
- [PHASE2_SUMMARY.md](PHASE2_SUMMARY.md): Overview of changes
- [FABRIC_SETUP_GUIDE.md](FABRIC_SETUP_GUIDE.md): Step-by-step setup

## Transition Workflow

### Step 1: Set Up Fabric Test Network (One-time, ~10 minutes)
```bash
# Clone fabric-samples (outside your project)
cd ~
git clone https://github.com/hyperledger/fabric-samples.git
cd fabric-samples
git checkout release-2.5

# Start network with channel
cd test-network
./network.sh up createChannel -c drugchannel -ca
```

### Step 2: Deploy Chaincode (~2 minutes)
```bash
# From test-network directory
export CHAINCODE_PATH="/path/to/Jarvis/drug-supply-chain/blockchain/chaincode"

./network.sh deployCC \
  -c drugchannel \
  -ccn drug_provenance \
  -ccp $CHAINCODE_PATH \
  -ccl go
```

### Step 3: Extract Credentials (~1 minute)
```bash
# List certificate paths
ls ~/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/
ls ~/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/
ls ~/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/cacerts/
```

### Step 4: Update .env (~1 minute)
```bash
cd ~/Jarvis/drug-supply-chain
cat > .env << EOF
FABRIC_MODE=production
FABRIC_CHANNEL=drugchannel
FABRIC_CHAINCODE=drug_provenance
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_CERT_PATH=/full/path/from/step3/Admin@org1.example.com-cert.pem
FABRIC_KEY_PATH=/full/path/from/step3/[hex]_sk
FABRIC_TLS_CERT_PATH=/full/path/from/step3/tlsca.org1.example.com-cert.pem
FABRIC_MSP_ID=Org1MSP
EOF
```

### Step 5: Restart Backend (~30 seconds)
```bash
# Kill existing process and restart
python -m backend.main
```

### Step 6: Verify in Logs
Look for:
```
✅ Fabric Gateway connected (LIVE): channel=drugchannel chaincode=drug_provenance
```

Or if it says:
```
Fabric mode set to 'mock' — using in-memory mock ledger.
```
Then FABRIC_MODE is still "mock" or credentials are invalid.

## Testing Live Mode

### Test Endpoint
```bash
# Submit a quarantine (writes to real blockchain if connected)
curl -X POST http://localhost:8000/api/blockchain/quarantine \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "BATCH-001",
    "reason": "CRITICAL_TEMPERATURE_BREACH",
    "reference_key": "telemetry_001"
  }'

# Live response:
{
  "tx_id": "0x...",
  "batch_id": "BATCH-001",
  "status": "QUARANTINED",
  "mode": "gateway"          ← ✅ LIVE blockchain
}

# Mock response:
{
  "tx_id": "0x...",
  "batch_id": "BATCH-001",
  "status": "QUARANTINED",
  "mode": "mock"             ← ❌ In-memory fallback
}
```

## Features Now Enabled

| Feature # | Feature Name | Ledger Impact |
|-----------|--------------|---------------|
| #8 | Movement History | Immutable supply chain events |
| #11 | Provenance Chain | Consensus-verified product lineage |
| #16 | Smart Procurement | Ledger-based auto-ordering |
| #19 | Vendor Rating | Immutable supplier scores |
| #21 | Compliance Logs | GxP Part 11 audit trail |

## Troubleshooting Checklist

- [ ] fabric-samples cloned to `~/fabric-samples`?
- [ ] `./network.sh up` ran successfully?
- [ ] `./network.sh deployCC` ran successfully?
- [ ] .env has FABRIC_MODE=production?
- [ ] .env has absolute paths (full paths, not ~/)?
- [ ] Backend logs show "Fabric Gateway connected (LIVE)"?
- [ ] Quarantine endpoint returns "mode": "gateway"?

## Rollback to Mock (if needed)
```bash
# Just change FABRIC_MODE in .env
FABRIC_MODE=mock

# Restart backend
# Now all requests use in-memory mock ledger
```

## Next Steps (Phase 3)

Once Fabric is verified working:
1. Update frontend API endpoints to use real blockchain
2. Add WebSocket listeners for real-time ledger events
3. Integrate FEFO dispatch with ledger consensus

## Support

Detailed troubleshooting: See [FABRIC_SETUP_GUIDE.md](FABRIC_SETUP_GUIDE.md)
