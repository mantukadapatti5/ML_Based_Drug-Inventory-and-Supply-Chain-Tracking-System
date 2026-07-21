#!/bin/bash
# ============================================================================
# Hyperledger Fabric Setup for Windows (Git Bash)
# ============================================================================
# This script runs in Git Bash and sets up Fabric network
# Run with: bash setup-fabric.sh

set -e  # Exit on any error

echo "=========================================="
echo "🔗 Hyperledger Fabric Setup (Git Bash)"
echo "=========================================="
echo ""

# Step 1: Navigate to test-network
echo "📁 Navigating to test-network..."
cd "/c/Users/Mahanthesh V K/fabric-samples/test-network"
echo "✅ Current directory: $(pwd)"
echo ""

# Step 2: Clean up any old state
echo "🧹 Cleaning up old network state..."
./network.sh down
echo "✅ Old network cleaned"
echo ""

# Step 3: Start fresh network
echo "🚀 Bringing up Fabric network..."
echo "   (This will take 2-3 minutes...)"
./network.sh up createChannel -c drugchannel -ca

if [ $? -eq 0 ]; then
    echo "✅ Network started successfully!"
else
    echo "❌ Network startup failed. Check Docker Desktop is running."
    exit 1
fi
echo ""

# Step 4: Deploy chaincode
echo "📦 Deploying drug_provenance chaincode..."
CHAINCODE_PATH="/c/Users/Mahanthesh V K/OneDrive/Desktop/Dummy/Jarvis/drug-supply-chain/blockchain/chaincode"

./network.sh deployCC \
  -c drugchannel \
  -ccn drug_provenance \
  -ccp "$CHAINCODE_PATH" \
  -ccl go

if [ $? -eq 0 ]; then
    echo "✅ Chaincode deployed successfully!"
else
    echo "❌ Chaincode deployment failed."
    exit 1
fi
echo ""

# Step 5: Extract credentials
echo "🔑 Extracting admin credentials..."
echo ""

KEYSTORE_DIR="/c/Users/Mahanthesh V K/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore"

if [ -d "$KEYSTORE_DIR" ]; then
    KEY_FILE=$(ls "$KEYSTORE_DIR" | head -1)
    echo "✅ Found keystore file: $KEY_FILE"
    echo ""
    echo "📋 Credential paths for .env file:"
    echo "=================================================="
    echo ""
    echo "FABRIC_CERT_PATH=C:\\Users\\Mahanthesh V K\\fabric-samples\\test-network\\organizations\\peerOrganizations\\org1.example.com\\users\\Admin@org1.example.com\\msp\\signcerts\\Admin@org1.example.com-cert.pem"
    echo ""
    echo "FABRIC_KEY_PATH=C:\\Users\\Mahanthesh V K\\fabric-samples\\test-network\\organizations\\peerOrganizations\\org1.example.com\\users\\Admin@org1.example.com\\msp\\keystore\\$KEY_FILE"
    echo ""
    echo "FABRIC_TLS_CERT_PATH=C:\\Users\\Mahanthesh V K\\fabric-samples\\test-network\\organizations\\peerOrganizations\\org1.example.com\\peers\\peer0.org1.example.com\\tls\\cacerts\\tlsca.org1.example.com-cert.pem"
    echo ""
    echo "=================================================="
else
    echo "❌ Keystore directory not found!"
    echo "   This means the network may not have started properly."
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Fabric setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Copy the credential paths above"
echo "2. Update .env in drug-supply-chain folder"
echo "3. Start backend with: powershell -File start-backend.ps1"
echo "4. Test API endpoint"
echo ""
