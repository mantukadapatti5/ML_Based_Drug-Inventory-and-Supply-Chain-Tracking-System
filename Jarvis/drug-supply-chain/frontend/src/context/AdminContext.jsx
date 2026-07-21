import { createContext, useContext, useState } from "react";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  // Mock data for users
  const [users, setUsers] = useState([
    { id: 1, name: "John Vendor", email: "vendor@example.com", role: "vendor", status: "Active", license: "VEND1234" },
    { id: 2, name: "Jane Distributor", email: "distributor@example.com", role: "distributor", status: "Active", license: "DIST1234" },
    { id: 3, name: "Admin User", email: "admin@example.com", role: "admin", status: "Active", license: "ADMIN1234" },
  ]);

  // Mock data for all orders
  const [allOrders, setAllOrders] = useState([
    { id: 1, product: "Paracetamol 500mg", vendor: "John Vendor", distributor: "Jane Distributor", status: "Delivered", date: "2024-05-01" },
    { id: 2, product: "Amoxicillin 250mg", vendor: "John Vendor", distributor: "Jane Distributor", status: "Shipped", date: "2024-04-28" },
    { id: 3, product: "Ibuprofen 200mg", vendor: "John Vendor", distributor: "Jane Distributor", status: "Pending", date: "2024-05-03" },
  ]);

  // Mock data for products
  const [allProducts, setAllProducts] = useState([
    { id: 1, name: "Paracetamol 500mg", vendor: "John Vendor", category: "Pain Relief", stock: 150, price: 5.99 },
    { id: 2, name: "Amoxicillin 250mg", vendor: "John Vendor", category: "Antibiotic", stock: 200, price: 12.50 },
    { id: 3, name: "Ibuprofen 200mg", vendor: "John Vendor", category: "Pain Relief", stock: 100, price: 8.75 },
  ]);

  // Anomaly detection data
  const [anomalies, setAnomalies] = useState([
    { id: 1, type: "Temperature Deviation", product: "Amoxicillin 250mg", severity: "high", detected: "2024-05-05 14:30", shipment: "SHIP002", status: "Unreviewed" },
    { id: 2, type: "Stock Discrepancy", product: "Paracetamol 500mg", severity: "medium", detected: "2024-05-04 10:15", shipment: "SHIP001", status: "Unreviewed" },
    { id: 3, type: "Expiry Alert", product: "Ibuprofen 200mg", severity: "high", detected: "2024-05-03 09:00", shipment: "SHIP003", status: "Reviewed" },
    { id: 4, type: "Unauthorized Access", product: "Multiple", severity: "critical", detected: "2024-05-02 16:45", shipment: "N/A", status: "Unreviewed" },
  ]);

  // Audit reports data
  const [auditReports, setAuditReports] = useState([
    { id: 1, vendor: "MediCorp", date: "2024-05-01", status: "Compliant", findings: "No issues found", inspector: "Admin User" },
    { id: 2, vendor: "PharmaPlus", date: "2024-04-28", status: "Compliant", findings: "Minor documentation gaps", inspector: "Admin User" },
    { id: 3, vendor: "HealthLabs", date: "2024-04-25", status: "Non-Compliant", findings: "Cold chain violation", inspector: "Admin User" },
  ]);

  // CRUD for users
  const updateUserStatus = (id, status) => {
    setUsers(users.map(u => u.id === id ? { ...u, status } : u));
  };

  const deleteUser = (id) => {
    setUsers(users.filter(u => u.id !== id));
  };

  // CRUD for orders
  const updateOrderStatus = (id, status) => {
    setAllOrders(allOrders.map(o => o.id === id ? { ...o, status } : o));
  };

  // CRUD for products
  const updateProduct = (id, updatedProduct) => {
    setAllProducts(allProducts.map(p => p.id === id ? { ...p, ...updatedProduct } : p));
  };

  const deleteProduct = (id) => {
    setAllProducts(allProducts.filter(p => p.id !== id));
  };

  // Anomaly detection management
  const updateAnomalyStatus = (id, status) => {
    setAnomalies(anomalies.map(a => a.id === id ? { ...a, status } : a));
  };

  const addAnomaly = (anomaly) => {
    const newAnomaly = {
      ...anomaly,
      id: Date.now(),
      detected: new Date().toLocaleString(),
      status: 'Unreviewed'
    };
    setAnomalies([...anomalies, newAnomaly]);
  };

  const deleteAnomaly = (id) => {
    setAnomalies(anomalies.filter(a => a.id !== id));
  };

  // Audit reports management
  const addAuditReport = (report) => {
    const newReport = {
      ...report,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0]
    };
    setAuditReports([...auditReports, newReport]);
  };

  const updateAuditReport = (id, updatedReport) => {
    setAuditReports(auditReports.map(r => r.id === id ? { ...r, ...updatedReport } : r));
  };

  const deleteAuditReport = (id) => {
    setAuditReports(auditReports.filter(r => r.id !== id));
  };

  return (
    <AdminContext.Provider value={{
      users,
      allOrders,
      allProducts,
      anomalies,
      auditReports,
      updateUserStatus,
      deleteUser,
      updateOrderStatus,
      updateProduct,
      deleteProduct,
      updateAnomalyStatus,
      addAnomaly,
      deleteAnomaly,
      addAuditReport,
      updateAuditReport,
      deleteAuditReport
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);