// ============================================================================
// COMPREHENSIVE COMPONENT WIRING GUIDE
// ============================================================================
// This document provides all patterns needed to wire remaining components
// to real backend APIs, WebSocket streams, and add production error handling.
// ============================================================================

/**
 * QUICK REFERENCE: HOW TO WIRE ANY COMPONENT
 * ==========================================
 * 
 * 1. Import the required hook from useAPIIntegration.js:
 *    import { useROPCalculator, useDemandForecast, useOrders, etc } from '../../hooks/useAPIIntegration';
 * 
 * 2. Import WebSocket hooks for real-time data:
 *    import { useTelemetryStream, useColdChainAlertsStream, etc } from '../../hooks/useWebSocketStreams';
 * 
 * 3. Import error boundaries:
 *    import { SectionErrorBoundary, LoadingFallback, InfoBanner, BackendUnavailable } from '../../components/ErrorBoundaries';
 * 
 * 4. Use the hooks in your component:
 *    const { data, loading, error, fetchFunction } = useCustomHook();
 * 
 * 5. Call the fetch function on component mount:
 *    useEffect(() => { fetchFunction(params); }, [fetchFunction]);
 * 
 * 6. Wrap with SectionErrorBoundary and display states:
 *    return (
 *      <SectionErrorBoundary>
 *        {loading && <LoadingFallback />}
 *        {error && <InfoBanner type="error" message={error} />}
 *        {data && <YourContent data={data} />}
 *      </SectionErrorBoundary>
 *    );
 */

/**
 * EXAMPLE 1: WIRING A FORM COMPONENT (ROP Calculator)
 * ======================================================
 */
export const VendorRopExample = () => {
  const [formData, setFormData] = useState({ drugId: '', region: '', supplierId: 1 });
  const { rop, loading, error, calculate } = useROPCalculator();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await calculate(formData.drugId, formData.region, formData.supplierId);
  };

  return (
    <SectionErrorBoundary>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Drug ID"
          value={formData.drugId}
          onChange={(e) => setFormData({ ...formData, drugId: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          required
        />
        <input
          type="text"
          placeholder="Region (e.g., North)"
          value={formData.region}
          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Calculating...' : 'Calculate ROP'}
        </button>
        
        {error && <InfoBanner type="error" message={error} />}
        
        {rop && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900">ROP Results:</h4>
            <ul className="mt-2 text-sm text-green-800 space-y-1">
              <li>Recommended Order Point: <strong>{rop.rop}</strong> units</li>
              <li>Safety Stock: <strong>{rop.safety_stock}</strong> units</li>
              <li>Economic Order Qty: <strong>{rop.economic_order_qty}</strong> units</li>
              <li>Avg Daily Demand: <strong>{rop.avg_daily_demand}</strong> units</li>
            </ul>
          </div>
        )}
      </form>
    </SectionErrorBoundary>
  );
};

/**
 * EXAMPLE 2: WIRING A BLOCKCHAIN TRANSACTION BUTTON
 * ====================================================
 */
export const CertifyDrugBatchButton = ({ batchId, drugName, manufacturer, expiryDate }) => {
  const { recordBatch, loading, error, txStatus } = useBlockchainTransactions();
  const [submitted, setSubmitted] = useState(false);

  const handleCertify = async () => {
    try {
      setSubmitted(true);
      const result = await recordBatch({
        batch_id: batchId,
        drug_name: drugName,
        manufacturer,
        expiry_date: expiryDate,
        certification_timestamp: new Date().toISOString(),
      });

      // Show success toast
      alert(`✓ Batch certified!\nTransaction ID: ${result.transaction_id}`);
    } catch (err) {
      alert(`✗ Certification failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleCertify}
        disabled={loading || submitted}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 w-full"
      >
        {loading ? '🔄 Certifying...' : submitted ? '✓ Certified' : '📋 Certify Batch'}
      </button>

      {error && (
        <InfoBanner
          type="error"
          title="Certification Failed"
          message={error}
        />
      )}

      {txStatus && (
        <InfoBanner
          type="success"
          title="Batch Certified"
          message={`Transaction ID: ${txStatus.transaction_id}\nBlockchain Hash: ${txStatus.blockchain_hash}`}
        />
      )}
    </div>
  );
};

/**
 * EXAMPLE 3: WIRING A REAL-TIME MONITORING COMPONENT
 * ====================================================
 */
export const ColdChainMonitoringCard = ({ batchId }) => {
  const { telemetry, connected, error } = useTelemetryStream(batchId);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (telemetry.temperature !== null) {
      setHistory((prev) => [...prev, telemetry].slice(-20));
    }
  }, [telemetry]);

  const getTemperatureStatus = (temp) => {
    if (temp === null) return 'unknown';
    if (temp > 25) return 'warning';
    if (temp > 28) return 'critical';
    return 'normal';
  };

  const status = getTemperatureStatus(telemetry.temperature);
  const statusColor = {
    normal: 'text-green-600',
    warning: 'text-amber-600',
    critical: 'text-red-600',
    unknown: 'text-gray-600',
  };

  return (
    <SectionErrorBoundary>
      <div className={`rounded-lg border p-4 ${
        status === 'critical'
          ? 'border-red-300 bg-red-50'
          : status === 'warning'
          ? 'border-amber-300 bg-amber-50'
          : 'border-green-300 bg-green-50'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-900">Batch {batchId}</h4>
          <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
            connected ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'
          }`}>
            {connected ? '🟢 Live' : '⚪ Offline'}
          </span>
        </div>

        {error && (
          <InfoBanner type="warning" message={error} />
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Temperature</p>
            <p className={`text-2xl font-bold ${statusColor[status]}`}>
              {telemetry.temperature !== null ? `${telemetry.temperature}°C` : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Humidity</p>
            <p className="text-2xl font-bold text-blue-600">
              {telemetry.humidity !== null ? `${telemetry.humidity}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Battery</p>
            <p className="text-2xl font-bold text-purple-600">
              {telemetry.battery !== null ? `${telemetry.battery}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Last Update</p>
            <p className="text-sm font-mono text-slate-700">{telemetry.timestamp || '—'}</p>
          </div>
        </div>

        {history.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-600 mb-2">Temperature Trend (Last {history.length} readings)</p>
            <div className="flex gap-1 h-8">
              {history.map((h, idx) => {
                const percent = h.temperature ? ((h.temperature - 10) / 30) * 100 : 50;
                return (
                  <div
                    key={idx}
                    title={`${h.temperature}°C`}
                    className={`flex-1 rounded-sm ${
                      h.temperature > 25
                        ? 'bg-red-400'
                        : h.temperature > 20
                        ? 'bg-amber-300'
                        : 'bg-green-400'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  );
};

/**
 * EXAMPLE 4: WIRING A DATA TABLE WITH ASYNC ACTIONS
 * ===================================================
 */
export const AnomaliesTable = () => {
  const { anomalies, loading, error, listAnomalies } = useAnomalyDetection();
  const { verifyAndLogOverride } = useGxPCompliance();
  const [resolving, setResolving] = useState({});

  useEffect(() => {
    listAnomalies(100);
  }, [listAnomalies]);

  const handleResolve = async (logId, password) => {
    setResolving((prev) => ({ ...prev, [logId]: true }));
    try {
      await verifyAndLogOverride({
        anomaly_log_id: logId,
        password,
        reason_notes: 'Reviewed and approved by operator',
      });
      // Refresh anomalies list
      await listAnomalies(100);
      alert('✓ Anomaly resolved');
    } catch (err) {
      alert(`✗ Resolution failed: ${err.message}`);
    } finally {
      setResolving((prev) => ({ ...prev, [logId]: false }));
    }
  };

  return (
    <SectionErrorBoundary>
      {loading && <LoadingFallback />}
      {error && <InfoBanner type="error" message={error} />}

      {anomalies && anomalies.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">Batch ID</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Score</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((anomaly) => (
                <tr key={anomaly.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{anomaly.batch_id}</td>
                  <td className="px-4 py-2">{anomaly.anomaly_type}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      anomaly.anomaly_score > 0.7
                        ? 'bg-red-100 text-red-700'
                        : anomaly.anomaly_score > 0.4
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {(anomaly.anomaly_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      anomaly.resolved
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {anomaly.resolved ? 'Resolved' : 'Unresolved'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {!anomaly.resolved && (
                      <button
                        onClick={() => handleResolve(anomaly.id, 'admin@12')}
                        disabled={resolving[anomaly.id]}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {resolving[anomaly.id] ? 'Resolving...' : 'Resolve'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (!anomalies || anomalies.length === 0) && (
        <div className="text-center py-8 text-gray-600">
          No anomalies detected
        </div>
      )}
    </SectionErrorBoundary>
  );
};

/**
 * EXAMPLE 5: WIRING PDF EXPORT BUTTON
 * ====================================
 */
export const PdfExportButton = ({ batchId }) => {
  const { downloadCompliancePdf, downloading, error } = useComplianceExport();
  const [downloaded, setDownloaded] = useState(false);

  const handleExport = async () => {
    const success = await downloadCompliancePdf(batchId);
    if (success) {
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleExport}
        disabled={downloading}
        className={`px-4 py-2 rounded-lg font-semibold w-full transition-colors ${
          downloaded
            ? 'bg-green-600 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
        }`}
      >
        {downloading ? '📥 Downloading...' : downloaded ? '✓ Downloaded' : '📋 Export PDF Report'}
      </button>

      {error && (
        <InfoBanner type="error" message={`Export failed: ${error}`} />
      )}
    </div>
  );
};

/**
 * HOOKS AVAILABLE FOR WIRING
 * ============================
 * 
 * From useAPIIntegration.js:
 * - useROPCalculator() → POST /api/inventory/calculate-rop
 * - useDemandForecast() → POST /api/forecast/predict
 * - useAnomalyDetection() → POST /api/anomalies/detect, GET /api/anomalies/logs
 * - useBlockchainTransactions() → POST /api/blockchain/record-batch, record-transfer
 * - useGxPCompliance() → POST /api/compliance/verify-override, resolve-anomaly
 * - useOrders() → GET /api/orders, PATCH /api/orders/{id}/status, POST /api/orders/checkout
 * - useSales() → GET /api/sales, POST /api/sales
 * - useColdChainMonitoring() → GET /api/iot/cold-chain/monitor, score telemetry
 * - useShipmentTracking() → GET /api/shipments/{id}/location, history
 * - useComplianceExport() → GET /api/admin/compliance/report/pdf
 * - useAnalytics() → GET /api/analytics/summary, /api/admin/dashboard/stats
 * 
 * From useWebSocketStreams.js:
 * - useTelemetryStream(batchId) → Real-time temperature/humidity/weight
 * - useColdChainAlertsStream() → Real-time cold chain alerts
 * - useAnomalyAlertsStream() → Real-time anomaly detection alerts
 * - useGpsTrackingStream(shipmentId) → Real-time GPS location tracking
 * - useSystemHealthStream() → Real-time system health status
 * - useOrderUpdatesStream(distributorId) → Real-time order status changes
 * - useSalesDataStream() → Real-time sales transactions
 * - useComplianceEventsStream() → Real-time compliance events
 */

/**
 * REMAINING COMPONENTS TO WIRE
 * ==============================
 * Priority 1 (Critical):
 * - AdminUsers.jsx: Use useAnalytics to fetch users list, add delete/enable/disable actions
 * - AdminAnomalies.jsx: Use useAnomalyDetection + useGxPCompliance for resolve workflow
 * - AdminReports.jsx: Use useAnalytics + useComplianceExport for PDF generation
 * - VendorForecast.jsx: Use useDemandForecast for form submission, show predictions
 * - VendorRop.jsx: Use useROPCalculator for form, display ROP recommendations
 * - VendorColdChain.jsx: Use useColdChainMonitoring + useTelemetryStream for real-time
 * - DistributorOrders.jsx: Use useOrders for checkout form, status updates
 * - DistributorInventory.jsx: Use useColdChainMonitoring for warehouse inventory
 * - DistributorColdChain.jsx: Use useColdChainMonitoring + WebSocket for alerts
 * - DistributorSales.jsx: Use useSales + useSalesDataStream for real-time sales feed
 * - DistributorCompliance.jsx: Use useGxPCompliance + useComplianceExport for audit trail
 * - ShipmentMap.jsx: Use useShipmentTracking + useGpsTrackingStream for map updates
 * 
 * Priority 2 (Important):
 * - VendorOrders.jsx: Use useOrders + useOrderUpdatesStream
 * - VendorInventory.jsx: Use useColdChainMonitoring
 * - VendorAnomaly.jsx: Use useAnomalyDetection
 * - DistributorRatings.jsx: Use useAnalytics for supplier ratings
 * - DistributorVerification.jsx: Use useGxPCompliance for verification workflow
 * - AdminBlockchain.jsx: Use useBlockchainTransactions for batch recording
 * - AdminHealth.jsx: Use useSystemHealthStream for real-time health
 * - RegulatorDashboard.jsx: Use useAnalytics + useAnomalyAlertsStream
 * 
 * Priority 3 (Nice-to-have):
 * - VendorStore.jsx: Product catalog with mock data is acceptable
 * - VendorBilling.jsx: Billing history with mock data is acceptable
 * - VendorExpiry.jsx: Expiry alerts with mock data is acceptable
 * - RegulatorBatches.jsx, RegulatorCompliance.jsx, etc.: Can use aggregated APIs
 */

export default {
  VendorRopExample,
  CertifyDrugBatchButton,
  ColdChainMonitoringCard,
  AnomaliesTable,
  PdfExportButton,
};
