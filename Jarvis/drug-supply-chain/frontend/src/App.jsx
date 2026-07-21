import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// Admin Pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBlockchain from "./pages/admin/AdminBlockchain";
import AdminHealth from "./pages/admin/AdminHealth";
import AdminAnomalies from "./pages/admin/AdminAnomalies";
import AdminReports from "./pages/admin/AdminReports";

// Vendor Pages
import VendorLayout from "./pages/vendor/VendorLayout";
import VendorDashboard from "./pages/vendor/VendorDashboard";
import VendorInventory from "./pages/vendor/VendorInventory";
import VendorBilling from "./pages/vendor/VendorBilling";
import VendorStore from "./pages/vendor/VendorStore";
import VendorOrders from "./pages/vendor/VendorOrders";
import VendorForecast from "./pages/vendor/VendorForecast";
import VendorColdChain from "./pages/vendor/VendorColdChain";
import VendorExpiry from "./pages/vendor/VendorExpiry";
import VendorAnomaly from "./pages/vendor/VendorAnomaly";
import VendorRop from "./pages/vendor/VendorRop";
import VendorAutoProcure from "./pages/vendor/VendorAutoProcure";

// Distributor Pages
import DistributorLayout from "./pages/distributor/DistributorLayout";
import DistributorDashboard from "./pages/distributor/DistributorDashboard";
import DistributorSales from "./pages/distributor/DistributorSales";
import DistributorOrders from "./pages/distributor/DistributorOrders";
import DistributorProducts from "./pages/distributor/DistributorProducts";
import DistributorInventory from "./pages/distributor/DistributorInventory";
import DistributorColdChain from "./pages/distributor/DistributorColdChain";
import DistributorRatings from "./pages/distributor/DistributorRatings";
import DistributorCompliance from "./pages/distributor/DistributorCompliance";
import ShipmentMap from "./pages/distributor/ShipmentMap";
import QRScanner from "./pages/distributor/QRScanner";

// Regulator Pages
import RegulatorLayout from "./pages/regulator/RegulatorLayout";
import RegulatorDashboard from "./pages/regulator/RegulatorDashboard";
import RegulatorBatches from "./pages/regulator/RegulatorBatches";
import RegulatorCompliance from "./pages/regulator/RegulatorCompliance";
import RegulatorBlockchain from "./pages/regulator/RegulatorBlockchain";
import RegulatorAlerts from "./pages/regulator/RegulatorAlerts";
import RegulatorAuditTrail from "./pages/regulator/RegulatorAuditTrail";

// Shared Pages
import OrderHistory from "./pages/shared/OrderHistory";

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="blockchain" element={<AdminBlockchain />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="anomalies" element={<AdminAnomalies />} />
            <Route path="reports" element={<AdminReports />} />
            <Route index element={<AdminDashboard />} />
          </Route>

          {/* Vendor Routes */}
          <Route path="/vendor" element={<ProtectedRoute role="vendor"><VendorLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<VendorDashboard />} />
            <Route path="inventory" element={<VendorInventory />} />
            <Route path="billing" element={<VendorBilling />} />
            <Route path="order-history" element={<OrderHistory />} />
            <Route path="store" element={<VendorStore />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="forecast" element={<VendorForecast />} />
            <Route path="cold-chain" element={<VendorColdChain />} />
            <Route path="expiry" element={<VendorExpiry />} />
            <Route path="anomaly" element={<VendorAnomaly />} />
            <Route path="rop" element={<VendorRop />} />
            <Route path="auto-procure" element={<VendorAutoProcure />} />
            <Route index element={<VendorDashboard />} />
          </Route>

          {/* Distributor Routes */}
          <Route path="/distributor" element={<ProtectedRoute role="distributor"><DistributorLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DistributorDashboard />} />
            <Route path="sales" element={<DistributorSales />} />
            <Route path="orders" element={<DistributorOrders />} />
            <Route path="order-history" element={<OrderHistory />} />
            <Route path="products" element={<DistributorProducts />} />
            <Route path="inventory" element={<DistributorInventory />} />
            <Route path="cold-chain" element={<DistributorColdChain />} />
            <Route path="ratings" element={<DistributorRatings />} />
            <Route path="compliance" element={<DistributorCompliance />} />
            <Route path="tracking" element={<ShipmentMap />} />
            <Route path="shipments" element={<ShipmentMap />} />
            <Route path="verification" element={<QRScanner />} />
            <Route index element={<DistributorDashboard />} />
          </Route>

          {/* Regulator Routes */}
          <Route path="/regulator" element={<ProtectedRoute role="regulator"><RegulatorLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<RegulatorDashboard />} />
            <Route path="batches" element={<RegulatorBatches />} />
            <Route path="compliance" element={<RegulatorCompliance />} />
            <Route path="blockchain" element={<RegulatorBlockchain />} />
            <Route path="alerts" element={<RegulatorAlerts />} />
            <Route path="audit-trail" element={<RegulatorAuditTrail />} />
            <Route index element={<RegulatorDashboard />} />
          </Route>

          {/* Fallback - Redirect to login */}
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
