package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// DrugBatch represents a pharmaceutical drug batch
type DrugBatch struct {
	BatchID       string        `json:"batch_id"`
	DrugID        string        `json:"drug_id"`
	DrugName      string        `json:"drug_name"`
	SupplierID    string        `json:"supplier_id"`
	Quantity      int           `json:"quantity"`
	UnitPrice     float64       `json:"unit_price"`
	Location      string        `json:"location"`
	ActorRole     string        `json:"actor_role"`
	ActorID       string        `json:"actor_id"`
	CreatedAt     string        `json:"created_at"`
	EventHistory  []EventRecord `json:"event_history"`
	AnomalyFlag   bool          `json:"anomaly_flag"`
	CurrentStatus string        `json:"current_status"`
}

// EventRecord represents a single event in the batch's lifecycle
type EventRecord struct {
	EventNumber int    `json:"event_number"`
	EventType   string `json:"event_type"`
	Location    string `json:"location"`
	ActorRole   string `json:"actor_role"`
	ActorID     string `json:"actor_id"`
	Timestamp   string `json:"timestamp"`
	TxHash      string `json:"tx_hash"`
}

// VerificationResult holds the provenance verification response
type VerificationResult struct {
	BatchID            string   `json:"batch_id"`
	IsValid            bool     `json:"is_valid"`
	ConsensusNodes     []string `json:"consensus_nodes"`
	ConsensusPct       float64  `json:"consensus_pct"`
	VerificationStatus string   `json:"verification_status"`
	VerifiedAt         string   `json:"verified_at"`
}

// ProcurementOrder represents an auto-procured restock order
type ProcurementOrder struct {
	OrderID           string `json:"order_id"`
	DrugID            string `json:"drug_id"`
	Quantity          int    `json:"quantity"`
	Threshold         int    `json:"threshold"`
	RequestedBy       string `json:"requested_by"`
	RequestedAt       string `json:"requested_at"`
	Status            string `json:"status"`
	ContractTriggered bool   `json:"contract_triggered"`
}

// InventoryLevel tracks current quantity for a drug
type InventoryLevel struct {
	DrugID    string `json:"drug_id"`
	Level     int    `json:"level"`
	Threshold int    `json:"threshold"`
	UpdatedAt string `json:"updated_at"`
}

// SmartContract provides functions for managing drug supply chain
type SmartContract struct {
	contractapi.Contract
}

// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, key string) (bool, error) {
	data, err := ctx.GetStub().GetState(key)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}
	return data != nil, nil
}

// RecordDrugBatch issues a new drug batch to the world state
func (s *SmartContract) RecordDrugBatch(ctx contractapi.TransactionContextInterface,
	batchID, drugID, drugName, supplierID string,
	quantity int, unitPrice float64,
	location, actorRole, actorID string) error {

	key := "BATCH_" + batchID
	exists, err := s.AssetExists(ctx, key)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the batch %s already exists", batchID)
	}

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}
	timestampStr := fmt.Sprintf("%d", txTimestamp.Seconds)

	firstEvent := EventRecord{
		EventNumber: 1,
		EventType:   "Production",
		Location:    location,
		ActorRole:   actorRole,
		ActorID:     actorID,
		Timestamp:   timestampStr,
		TxHash:      ctx.GetStub().GetTxID(),
	}

	batch := DrugBatch{
		BatchID:       batchID,
		DrugID:        drugID,
		DrugName:      drugName,
		SupplierID:    supplierID,
		Quantity:      quantity,
		UnitPrice:     unitPrice,
		Location:      location,
		ActorRole:     actorRole,
		ActorID:       actorID,
		CreatedAt:     timestampStr,
		EventHistory:  []EventRecord{firstEvent},
		AnomalyFlag:   false,
		CurrentStatus: "Production",
	}

	batchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(key, batchJSON)
	if err != nil {
		return err
	}

	return ctx.GetStub().SetEvent("DrugBatchRecorded", batchJSON)
}

// UpdateBatchEvent appends a new lifecycle event to the drug batch
func (s *SmartContract) UpdateBatchEvent(ctx contractapi.TransactionContextInterface,
	batchID, eventType, location, actorRole, actorID string) error {

	validEvents := map[string]bool{
		"Quality_Check": true,
		"Dispatch":      true,
		"Transit":       true,
		"Received":      true,
		"Dispensed":     true,
	}

	if !validEvents[eventType] {
		return fmt.Errorf("invalid eventType: %s", eventType)
	}

	key := "BATCH_" + batchID
	batchJSON, err := ctx.GetStub().GetState(key)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if batchJSON == nil {
		return fmt.Errorf("the batch %s does not exist", batchID)
	}

	var batch DrugBatch
	err = json.Unmarshal(batchJSON, &batch)
	if err != nil {
		return err
	}

	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()
	
	newEvent := EventRecord{
		EventNumber: len(batch.EventHistory) + 1,
		EventType:   eventType,
		Location:    location,
		ActorRole:   actorRole,
		ActorID:     actorID,
		Timestamp:   fmt.Sprintf("%d", txTimestamp.Seconds),
		TxHash:      ctx.GetStub().GetTxID(),
	}

	batch.EventHistory = append(batch.EventHistory, newEvent)
	batch.CurrentStatus = eventType

	updatedBatchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(key, updatedBatchJSON)
	if err != nil {
		return err
	}

	return ctx.GetStub().SetEvent("BatchEventUpdated", updatedBatchJSON)
}

// GetProvenance returns the complete audit trail for a batch
func (s *SmartContract) GetProvenance(ctx contractapi.TransactionContextInterface,
	batchID string) ([]EventRecord, error) {

	key := "BATCH_" + batchID
	batchJSON, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if batchJSON == nil {
		return nil, fmt.Errorf("the batch %s does not exist", batchID)
	}

	var batch DrugBatch
	err = json.Unmarshal(batchJSON, &batch)
	if err != nil {
		return nil, err
	}

	return batch.EventHistory, nil
}

// VerifyBatch validates the integrity of the batch's history
func (s *SmartContract) VerifyBatch(ctx contractapi.TransactionContextInterface,
	batchID string) (*VerificationResult, error) {

	key := "BATCH_" + batchID
	batchJSON, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if batchJSON == nil {
		return nil, fmt.Errorf("the batch %s does not exist", batchID)
	}

	var batch DrugBatch
	err = json.Unmarshal(batchJSON, &batch)
	if err != nil {
		return nil, err
	}

	// Validate chain of events
	chainUnbroken := true
	for i, event := range batch.EventHistory {
		if event.EventNumber != i+1 {
			chainUnbroken = false
			break
		}
	}

	isValid := !batch.AnomalyFlag && chainUnbroken
	status := "Failed"
	if isValid {
		status = "Verified"
	}

	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()

	result := &VerificationResult{
		BatchID:            batchID,
		IsValid:            isValid,
		ConsensusNodes:     []string{"Node_Delhi", "Node_Mumbai", "Node_Bengaluru"},
		ConsensusPct:       66.7,
		VerificationStatus: status,
		VerifiedAt:         fmt.Sprintf("%d", txTimestamp.Seconds),
	}

	return result, nil
}

// FlagAnomaly marks a batch as potentially compromised
func (s *SmartContract) FlagAnomaly(ctx contractapi.TransactionContextInterface,
	batchID, reason, flaggedBy string) error {

	key := "BATCH_" + batchID
	batchJSON, err := ctx.GetStub().GetState(key)
	if err != nil {
		return err
	}
	if batchJSON == nil {
		return fmt.Errorf("the batch %s does not exist", batchID)
	}

	var batch DrugBatch
	err = json.Unmarshal(batchJSON, &batch)
	if err != nil {
		return err
	}

	batch.AnomalyFlag = true

	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()

	anomalyEvent := EventRecord{
		EventNumber: len(batch.EventHistory) + 1,
		EventType:   "AnomalyFlagged",
		Location:    "System",
		ActorRole:   "Admin",
		ActorID:     flaggedBy,
		Timestamp:   fmt.Sprintf("%d", txTimestamp.Seconds),
		TxHash:      ctx.GetStub().GetTxID(),
	}

	batch.EventHistory = append(batch.EventHistory, anomalyEvent)

	updatedBatchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(key, updatedBatchJSON)
	if err != nil {
		return err
	}

	return ctx.GetStub().SetEvent("AnomalyFlagged", []byte(reason))
}

// QuarantineAsset locks a batch to QUARANTINED status (regulatory compliance — irreversible via chaincode)
func (s *SmartContract) QuarantineAsset(ctx contractapi.TransactionContextInterface,
	batchID, reason string) error {

	key := "BATCH_" + batchID
	batchJSON, err := ctx.GetStub().GetState(key)
	if err != nil {
		return err
	}
	if batchJSON == nil {
		return fmt.Errorf("the batch %s does not exist", batchID)
	}

	var batch DrugBatch
	err = json.Unmarshal(batchJSON, &batch)
	if err != nil {
		return err
	}

	if batch.CurrentStatus == "QUARANTINED" {
		return fmt.Errorf("batch %s is already quarantined", batchID)
	}

	batch.AnomalyFlag = true
	batch.CurrentStatus = "QUARANTINED"

	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()
	txID := ctx.GetStub().GetTxID()

	quarantineEvent := EventRecord{
		EventNumber: len(batch.EventHistory) + 1,
		EventType:   "Quarantine",
		Location:    "Regulatory_Lock",
		ActorRole:   "System",
		ActorID:     "AI_Anomaly_Engine",
		Timestamp:   fmt.Sprintf("%d", txTimestamp.Seconds),
		TxHash:      txID,
	}

	batch.EventHistory = append(batch.EventHistory, quarantineEvent)

	updatedBatchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(key, updatedBatchJSON)
	if err != nil {
		return err
	}

	return ctx.GetStub().SetEvent("BatchQuarantined", []byte(reason))
}

// AutoProcure creates a procurement order if inventory is low
func (s *SmartContract) AutoProcure(ctx contractapi.TransactionContextInterface,
	drugID string, quantity, threshold int, requestedBy string) (string, error) {

	invKey := "INVENTORY_" + drugID
	invJSON, err := ctx.GetStub().GetState(invKey)
	if err != nil {
		return "", err
	}
	
	if invJSON != nil {
		var inv InventoryLevel
		err = json.Unmarshal(invJSON, &inv)
		if err == nil && inv.Level >= threshold {
			return "", fmt.Errorf("threshold_not_met")
		}
	}

	txID := ctx.GetStub().GetTxID()
	orderID := "ORDER_" + txID[:8]
	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()

	order := ProcurementOrder{
		OrderID:           orderID,
		DrugID:            drugID,
		Quantity:          quantity,
		Threshold:         threshold,
		RequestedBy:       requestedBy,
		RequestedAt:       fmt.Sprintf("%d", txTimestamp.Seconds),
		Status:            "PENDING",
		ContractTriggered: true,
	}

	orderJSON, err := json.Marshal(order)
	if err != nil {
		return "", err
	}

	err = ctx.GetStub().PutState("ORDER_"+orderID, orderJSON)
	if err != nil {
		return "", err
	}

	ctx.GetStub().SetEvent("AutoProcurementTriggered", orderJSON)
	return orderID, nil
}

// UpdateInventoryLevel updates the current level of a drug
func (s *SmartContract) UpdateInventoryLevel(ctx contractapi.TransactionContextInterface,
	drugID string, newLevel, threshold int) error {

	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()
	
	inv := InventoryLevel{
		DrugID:    drugID,
		Level:     newLevel,
		Threshold: threshold,
		UpdatedAt: fmt.Sprintf("%d", txTimestamp.Seconds),
	}

	invJSON, err := json.Marshal(inv)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState("INVENTORY_"+drugID, invJSON)
	if err != nil {
		return err
	}

	if newLevel < threshold {
		qtyToOrder := (threshold * 2) - newLevel
		s.AutoProcure(ctx, drugID, qtyToOrder, threshold, "System_Auto")
	}

	return nil
}

// GetProcurementOrders returns all orders, optionally filtered by status
func (s *SmartContract) GetProcurementOrders(ctx contractapi.TransactionContextInterface,
	status string) ([]*ProcurementOrder, error) {

	resultsIterator, err := ctx.GetStub().GetStateByRange("ORDER_", "ORDER_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var orders []*ProcurementOrder

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var order ProcurementOrder
		err = json.Unmarshal(queryResponse.Value, &order)
		if err != nil {
			return nil, err
		}

		if status == "" || order.Status == status {
			orders = append(orders, &order)
		}
	}

	return orders, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating drug provenance chaincode: %s", err.Error())
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting drug provenance chaincode: %s", err.Error())
	}
}
