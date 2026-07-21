import axios from "axios";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
console.log("🔧 API Base URL:", configuredBaseUrl || "http://localhost:8000");

const api = axios.create({
  baseURL: configuredBaseUrl || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Log all requests
api.interceptors.request.use((config) => {
  console.log(`📤 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data);
  return config;
});

export const setAuthToken = (token) => {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
};

// Auth
export const checkEmailRegistered = (email) => api.get(`/api/auth/check-email/${encodeURIComponent(email)}`);
export const verifyUser = (userId) => api.patch(`/api/auth/users/${userId}/verify`);

// ML
export const getForecastDrugs = () => api.get("/api/forecast/drugs");
export const getForecastPredict = (data) => api.post("/api/forecast/predict", data);
export const getAnomalyLogs = (params) => api.get("/api/anomalies/logs", { params });
export const getAnomalyLogsFallback = (limit = 50) => api.get("/api/analytics/anomalies-fallback", { params: { limit } });
/** @deprecated Use complianceResolveAnomaly for GxP e-signature flow */
export const resolveAnomaly = (id, notes) => api.put(`/api/anomalies/logs/${id}/resolve`, null, { params: { notes } });

export const complianceVerifyOverride = (data) => api.post("/api/compliance/verify-override", data);

export const complianceResolveAnomaly = (data) => api.post("/api/compliance/resolve-anomaly", data);

export const getGxpAuditTrail = (params) => api.get("/api/compliance/audit-trail", { params });

export const getComplianceStatus = () => api.get("/api/compliance/status");

// Inventory
export const getCatalog = () => api.get("/api/inventory/catalog");
export const getInventoryItems = () => api.get("/api/inventory/items");
export const getInventoryItemsFallback = () => api.get("/api/inventory/items-fallback");
export const createInventoryItem = (data) => api.post("/api/inventory/items", data);
export const updateInventoryItem = (id, data) => api.put(`/api/inventory/items/${id}`, data);
export const deleteInventoryItem = (id) => api.delete(`/api/inventory/items/${id}`);
export const getRopDashboard = (region = "Ahmedabad") => api.get(`/api/inventory/rop-dashboard?region=${region}`);
export const calculateROP = (data) => api.post("/api/inventory/calculate-rop", data);
export const getFefoSorted = (params) => api.get("/api/inventory/fefo-sorted", { params });
export const getStockRequests = () => api.get("/api/inventory/requests");
export const updateRequestStatus = (id, status) => api.patch(`/api/inventory/requests/${id}/status?status=${encodeURIComponent(status)}`);
export const requestStock = (data) => api.post("/api/inventory/request-stock", data);
export const triggerAutoOrder = (data) => api.post("/api/procurement/auto-order", data);

// Orders
export const getOrders = (status) => api.get("/api/orders", { params: status && status !== "All" ? { status } : {} });
export const updateOrderStatus = (orderId, status) => api.patch(`/api/orders/${orderId}/status`, { status });
export const checkoutCart = (data) => api.post("/api/orders/checkout", data);
export const getOrderHistory = (params = {}) => api.get("/api/orders/history", { params });

// Sales
export const getSales = (distributorId) => api.get("/api/sales", { params: distributorId ? { distributor_id: distributorId } : {} });
export const createSale = (data) => api.post("/api/sales", data);
export const getSalesDrugs = () => api.get("/api/sales/drugs");

// Analytics
export const getAnalyticsSummary = () => api.get("/api/analytics/summary");
export const getSupplierPerformance = () => api.get("/api/suppliers/performance/summary");
export const getDistributorStats = (distributorId = 3) => api.get("/api/analytics/distributor-stats", { params: { distributor_id: distributorId } });

// IoT / Cold chain
export const getColdChainMonitor = () => api.get("/api/iot/cold-chain/monitor");
export const getColdChainMonitorFallback = () => api.get("/api/iot/cold-chain/monitor-fallback");
export const getActiveAlerts = () => api.get("/api/iot/sensors/alerts/active");
export const acknowledgeAlert = (id) => api.put(`/api/iot/sensors/alerts/${id}/acknowledge`);

// Blockchain
export const verifyBatch = (batchId) => api.get(`/api/blockchain/verify/${batchId}`);
export const getProvenance = (batchId) => api.get(`/api/blockchain/get-provenance/${batchId}`);
export const getBlockchainHealth = () => api.get("/api/blockchain/health");
export const getBlockchainExplorerFallback = (limit = 50) => api.get("/api/blockchain/explorer-fallback", { params: { limit } });

// GPS
export const getShipmentLocation = (id) => api.get(`/api/shipments/${id}/location`);
export const getShipmentHistory = (id) => api.get(`/api/shipments/${id}/location/history`);
export const getActiveShipments = () => api.get("/api/iot/events/active-shipments");
export const dispatchShipment = (id, data) => api.post(`/api/shipments/${id}/dispatch`, data);

// Admin
export const getAdminUsers = (params) => api.get("/api/admin/users", { params });
export const getAdminStats = () => api.get("/api/admin/dashboard/stats");
export const getAuditTrail = () => api.get("/api/admin/audit-trail");
export const getComplianceReport = () => api.get("/api/compliance/report");
export const getAdminComplianceReport = () => api.get("/api/admin/compliance/report");
export const getCompliancePdf = (batchId) =>
  api.get(`/api/admin/compliance/report/pdf?batch_id=${encodeURIComponent(batchId)}`, {
    responseType: "blob",
  });

export const getSystemHealth = () => api.get("/health");

export default api;
