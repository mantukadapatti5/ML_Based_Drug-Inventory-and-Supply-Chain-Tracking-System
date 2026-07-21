import { createContext, useContext, useState } from "react";

const VendorContext = createContext();

export const VendorProvider = ({ children }) => {
  // Mock data for products
  const [products, setProducts] = useState([
    { id: 1, name: "Paracetamol 500mg", category: "Pain Relief", stock: 150, price: 5.99, expiry: "2025-12-31", rop: 50 },
    { id: 2, name: "Amoxicillin 250mg", category: "Antibiotic", stock: 200, price: 12.50, expiry: "2025-10-15", rop: 75 },
    { id: 3, name: "Ibuprofen 200mg", category: "Pain Relief", stock: 100, price: 8.75, expiry: "2025-08-20", rop: 40 },
    { id: 4, name: "Aspirin 100mg", category: "Pain Relief", stock: 30, price: 3.50, expiry: "2025-09-10", rop: 60 },
  ]);

  // Mock data for orders
  const [orders, setOrders] = useState([
    { id: 1, product: "Paracetamol 500mg", quantity: 50, distributor: "MediDist Inc", status: "Pending", date: "2024-05-01" },
    { id: 2, product: "Amoxicillin 250mg", quantity: 30, distributor: "PharmaLink", status: "Shipped", date: "2024-04-28" },
    { id: 3, product: "Ibuprofen 200mg", quantity: 25, distributor: "HealthCorp", status: "Delivered", date: "2024-04-25" },
  ]);

  // Cold chain monitoring data
  const [coldChainAlerts, setColdChainAlerts] = useState([
    { id: 1, product: "Paracetamol 500mg", temperature: 22, status: "normal", location: "Storage A", timestamp: new Date() },
    { id: 2, product: "Amoxicillin 250mg", temperature: 26, status: "warning", location: "Storage B", timestamp: new Date() },
    { id: 3, product: "Ibuprofen 200mg", temperature: 18, status: "normal", location: "Storage A", timestamp: new Date() },
  ]);

  // Forecast data
  const [forecastData, setForecastData] = useState([
    { week: 1, predicted: 450, confidence: 0.95 },
    { week: 2, predicted: 520, confidence: 0.92 },
    { week: 3, predicted: 380, confidence: 0.88 },
    { week: 4, predicted: 620, confidence: 0.90 },
  ]);

  // CRUD for products
  const addProduct = (product) => {
    const newProduct = { ...product, id: Date.now() };
    setProducts([...products, newProduct]);
  };

  const updateProduct = (id, updatedProduct) => {
    setProducts(products.map(p => p.id === id ? { ...p, ...updatedProduct } : p));
  };

  const deleteProduct = (id) => {
    setProducts(products.filter(p => p.id !== id));
  };

  // CRUD for orders
  const addOrder = (order) => {
    const newOrder = { ...order, id: Date.now(), status: "Pending", date: new Date().toISOString().split('T')[0] };
    setOrders([...orders, newOrder]);
  };

  const updateOrderStatus = (id, status) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
  };

  const deleteOrder = (id) => {
    setOrders(orders.filter(o => o.id !== id));
  };

  // Cold chain alert management
  const updateColdChainAlert = (id, newStatus) => {
    setColdChainAlerts(coldChainAlerts.map(alert => 
      alert.id === id ? { ...alert, status: newStatus } : alert
    ));
  };

  const addColdChainAlert = (alert) => {
    const newAlert = { 
      ...alert, 
      id: Date.now(), 
      timestamp: new Date(),
      status: alert.temperature > 25 ? 'warning' : alert.temperature < 15 ? 'critical' : 'normal'
    };
    setColdChainAlerts([...coldChainAlerts, newAlert]);
  };

  // Forecast management
  const updateForecast = (newForecast) => {
    setForecastData(newForecast);
  };

  const simulateForecast = () => {
    const newForecast = forecastData.map(f => ({
      ...f,
      predicted: Math.round(f.predicted + (Math.random() * 200 - 100)),
      confidence: Math.min(0.99, f.confidence + (Math.random() * 0.05 - 0.02))
    }));
    setForecastData(newForecast);
  };

  return (
    <VendorContext.Provider value={{
      products,
      orders,
      coldChainAlerts,
      forecastData,
      addProduct,
      updateProduct,
      deleteProduct,
      addOrder,
      updateOrderStatus,
      deleteOrder,
      updateColdChainAlert,
      addColdChainAlert,
      updateForecast,
      simulateForecast
    }}>
      {children}
    </VendorContext.Provider>
  );
};

export const useVendor = () => useContext(VendorContext);