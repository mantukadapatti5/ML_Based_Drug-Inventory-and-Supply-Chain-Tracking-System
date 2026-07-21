import { createContext, useContext, useState } from "react";

const DistributorContext = createContext();

export const DistributorProvider = ({ children }) => {
  // Mock data for orders
  const [orders, setOrders] = useState([
    { id: 1, product: "Paracetamol 500mg", vendor: "MediCorp", quantity: 100, status: "Ordered", date: "2024-05-01" },
    { id: 2, product: "Amoxicillin 250mg", vendor: "PharmaPlus", quantity: 75, status: "Received", date: "2024-04-28" },
    { id: 3, product: "Ibuprofen 200mg", vendor: "HealthLabs", quantity: 50, status: "Delivered", date: "2024-04-25" },
  ]);

  // Mock data for inventory with detailed tracking
  const [inventory, setInventory] = useState([
    { id: 1, product: "Paracetamol 500mg", stock: 200, location: "Warehouse A", expiry: "2025-12-31", temperature: 22, humidity: 45 },
    { id: 2, product: "Amoxicillin 250mg", stock: 150, location: "Warehouse B", expiry: "2025-10-15", temperature: 26, humidity: 50 },
    { id: 3, product: "Ibuprofen 200mg", stock: 100, location: "Warehouse A", expiry: "2025-08-20", temperature: 20, humidity: 42 },
  ]);

  // Cold chain monitoring data
  const [coldChainData, setColdChainData] = useState([
    { id: 1, shipmentId: "SHIP001", product: "Paracetamol 500mg", status: "Normal", tempMin: 15, tempMax: 25, currentTemp: 22, location: "Transit", lastUpdate: new Date() },
    { id: 2, shipmentId: "SHIP002", product: "Amoxicillin 250mg", status: "Warning", tempMin: 15, tempMax: 25, currentTemp: 27, location: "Warehouse B", lastUpdate: new Date() },
    { id: 3, shipmentId: "SHIP003", product: "Ibuprofen 200mg", status: "Normal", tempMin: 15, tempMax: 25, currentTemp: 19, location: "Transit", lastUpdate: new Date() },
  ]);

  // CRUD for orders
  const addOrder = (order) => {
    const newOrder = { ...order, id: Date.now(), status: "Ordered", date: new Date().toISOString().split('T')[0] };
    setOrders([...orders, newOrder]);
  };

  const updateOrderStatus = (id, status) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
  };

  const deleteOrder = (id) => {
    setOrders(orders.filter(o => o.id !== id));
  };

  // CRUD for inventory
  const updateInventory = (id, updatedItem) => {
    setInventory(inventory.map(i => i.id === id ? { ...i, ...updatedItem } : i));
  };

  const addInventoryItem = (item) => {
    const newItem = { ...item, id: Date.now() };
    setInventory([...inventory, newItem]);
  };

  // Cold chain management
  const updateColdChainStatus = (id, newStatus) => {
    setColdChainData(coldChainData.map(cc => 
      cc.id === id ? { ...cc, status: newStatus, lastUpdate: new Date() } : cc
    ));
  };

  const updateColdChainTemp = (id, currentTemp) => {
    const newStatus = currentTemp > 26 || currentTemp < 14 ? 'Critical' : currentTemp > 25 || currentTemp < 15 ? 'Warning' : 'Normal';
    setColdChainData(coldChainData.map(cc => 
      cc.id === id ? { ...cc, currentTemp, status: newStatus, lastUpdate: new Date() } : cc
    ));
  };

  const addColdChainShipment = (shipment) => {
    const newShipment = {
      ...shipment,
      id: Date.now(),
      lastUpdate: new Date(),
      status: 'Normal'
    };
    setColdChainData([...coldChainData, newShipment]);
  };

  return (
    <DistributorContext.Provider value={{
      orders,
      inventory,
      coldChainData,
      addOrder,
      updateOrderStatus,
      deleteOrder,
      updateInventory,
      addInventoryItem,
      updateColdChainStatus,
      updateColdChainTemp,
      addColdChainShipment
    }}>
      {children}
    </DistributorContext.Provider>
  );
};

export const useDistributor = () => useContext(DistributorContext);