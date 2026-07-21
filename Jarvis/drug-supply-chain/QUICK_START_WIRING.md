# ⚡ QUICK START: NEXT 5 COMPONENTS TO WIRE

Use this checklist to quickly wire the next 5 critical components. Each takes 15-30 minutes.

---

## COMPONENT 1: VendorRop.jsx (15 min)

**Location:** `frontend/src/pages/vendor/VendorRop.jsx`

**What it does:** Users submit drug ID, region, and supplier to get ROP recommendations

**Wire it:**

```javascript
// 1. Add imports
import { useROPCalculator } from '../../hooks/useAPIIntegration';
import { SectionErrorBoundary, LoadingFallback, InfoBanner } from '../../components/ErrorBoundaries';

// 2. In component
const { rop, loading, error, calculate } = useROPCalculator();

// 3. On form submit
const handleSubmit = async (e) => {
  e.preventDefault();
  await calculate(formData.drugId, formData.region, 1);
};

// 4. Render result
{rop && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
    <p>Recommended Order Point: {rop.rop} units</p>
    <p>Safety Stock: {rop.safety_stock} units</p>
    <p>Economic Order Qty: {rop.economic_order_qty} units</p>
  </div>
)}

// 5. Wrap with error boundary
return <SectionErrorBoundary>... form ...</SectionErrorBoundary>;
```

**API Called:** `POST /api/inventory/calculate-rop`

---

## COMPONENT 2: VendorForecast.jsx (15 min)

**Location:** `frontend/src/pages/vendor/VendorForecast.jsx`

**What it does:** Users submit drug, region, and horizon days to get ML demand forecast

**Wire it:**

```javascript
// 1. Add imports
import { useDemandForecast } from '../../hooks/useAPIIntegration';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

// 2. In component
const { forecast, loading, error, predict } = useDemandForecast();

// 3. On form submit
const handleSubmit = async (e) => {
  e.preventDefault();
  await predict(drugId, region, horizonDays);
};

// 4. Render chart
{forecast && forecast.predictions && (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={forecast.predictions}>
      <CartesianGrid />
      <XAxis dataKey="day" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="predicted_demand" stroke="#10b981" />
    </LineChart>
  </ResponsiveContainer>
)}

// 5. Wrap with error boundary
return <SectionErrorBoundary>... form + chart ...</SectionErrorBoundary>;
```

**API Called:** `POST /api/forecast/predict`

---

## COMPONENT 3: AdminAnomalies.jsx (20 min)

**Location:** `frontend/src/pages/admin/AdminAnomalies.jsx`

**What it does:** Admin views anomalies and can resolve them with GxP compliance

**Wire it:**

```javascript
// 1. Add imports
import { useAnomalyDetection, useGxPCompliance } from '../../hooks/useAPIIntegration';

// 2. In component
const { anomalies, loading, error, listAnomalies } = useAnomalyDetection();
const { verifyAndLogOverride } = useGxPCompliance();

// 3. Load on mount
useEffect(() => {
  listAnomalies(100);
}, [listAnomalies]);

// 4. Handle resolve
const handleResolve = async (anomalyId) => {
  await verifyAndLogOverride({
    anomaly_log_id: anomalyId,
    password: 'admin@12',  // Or get from password input
    reason_notes: 'Reviewed and approved'
  });
  // Refresh list
  await listAnomalies(100);
};

// 5. Render table
<table>
  {anomalies.map(a => (
    <tr key={a.id}>
      <td>{a.batch_id}</td>
      <td>{a.anomaly_type}</td>
      <td>{(a.anomaly_score * 100).toFixed(0)}%</td>
      <td>
        <button onClick={() => handleResolve(a.id)}>Resolve</button>
      </td>
    </tr>
  ))}
</table>

return <SectionErrorBoundary>... table ...</SectionErrorBoundary>;
```

**APIs Called:** 
- `GET /api/anomalies/logs`
- `POST /api/compliance/verify-override`

---

## COMPONENT 4: DistributorOrders.jsx (20 min)

**Location:** `frontend/src/pages/distributor/DistributorOrders.jsx`

**What it does:** Distributor creates new orders using FEFO checkout

**Wire it:**

```javascript
// 1. Add imports
import { useOrders } from '../../hooks/useAPIIntegration';

// 2. In component
const { checkout, loading, error } = useOrders();

// 3. Handle checkout
const handleCheckout = async () => {
  const items = [
    { drug_id: 1, quantity: 100 },
    { drug_id: 2, quantity: 50 }
  ];
  const result = await checkout(items, 3, 'distributor');
  alert(`✓ Order created: ${result.order_id}`);
};

// 4. Show results
{error && <InfoBanner type="error" message={error} />}
{loading && <p>Processing checkout...</p>}

return (
  <SectionErrorBoundary>
    <form onSubmit={e => { e.preventDefault(); handleCheckout(); }}>
      {/* Item selection UI */}
      <button type="submit" disabled={loading}>Checkout</button>
    </form>
  </SectionErrorBoundary>
);
```

**API Called:** `POST /api/orders/checkout`

---

## COMPONENT 5: DistributorColdChain.jsx (20 min)

**Location:** `frontend/src/pages/distributor/DistributorColdChain.jsx`

**What it does:** Real-time cold chain monitoring with temperature alerts

**Wire it:**

```javascript
// 1. Add imports
import { useColdChainMonitoring } from '../../hooks/useAPIIntegration';
import { useColdChainAlertsStream } from '../../hooks/useWebSocketStreams';

// 2. In component
const { alerts, monitorColdChain } = useColdChainMonitoring();
const streamAlerts = useColdChainAlertsStream();

// 3. Load on mount
useEffect(() => {
  monitorColdChain();
}, [monitorColdChain]);

// 4. Render cards
{alerts.map(alert => (
  <div key={alert.shipment_id} className={`p-4 rounded border ${
    alert.status === 'warning' ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'
  }`}>
    <p>Shipment: {alert.shipment_id}</p>
    <p>Temp: {alert.current_temp}°C</p>
    <p>Status: {alert.status}</p>
  </div>
))}

// 5. Display real-time alerts
{streamAlerts.alerts.length > 0 && (
  <div className="border border-red-300 bg-red-50 p-4">
    <h3>🔴 New Alerts ({streamAlerts.alerts.length})</h3>
    {streamAlerts.alerts.slice(0, 3).map(a => (
      <p key={a.id}>{a.shipment_id}: {a.type}</p>
    ))}
  </div>
)}

return <SectionErrorBoundary>... cards ...</SectionErrorBoundary>;
```

**APIs Called:**
- `GET /api/iot/cold-chain/monitor`
- WebSocket: `cold_chain_alert` events

---

## Quick Verification After Each Wire

After wiring each component, verify it works:

1. ✅ **Component loads without crashing** - No red error screen
2. ✅ **Loading state shows** - Spinner appears while fetching
3. ✅ **API call succeeds** - Check DevTools Network tab
4. ✅ **Data displays** - Real data from backend appears on screen
5. ✅ **Error handling works** - Stop backend, component shows error message instead of crashing
6. ✅ **Retry button works** - Click retry, data reloads when backend comes back

---

## Test with Real Backend

Before finalizing each component, test with real backend:

```bash
# Terminal 1: Start Backend
cd backend
python main.py

# Terminal 2: Start Frontend
cd frontend
npm run dev

# Browser: Test login + component
http://localhost:3001
Email: vendor@gmail.com or dis@gmail.com (for distributor)
Password: vendor@12 or dis@12
```

---

## Troubleshooting During Wiring

| Problem | Solution |
|---------|----------|
| "Cannot find module" | Install missing import: `npm install socket.io-client` |
| API returns 401 | Check auth token in localStorage, re-login |
| "Backend unavailable" message | Start backend with `python main.py` |
| Data not loading | Check browser console for CORS errors |
| WebSocket shows "⚠️ Cached" | Normal fallback, HTTP polling working fine |
| Form not submitting | Check form field names match API schema |

---

## Hooks Reference (Quick Copy-Paste)

### Get All Users
```javascript
const { users, loading, error } = useAnalytics().getAdminStats()
// Returns: { total_users, total_orders, total_drugs, ... }
```

### Get All Orders
```javascript
const { orders, loading, error, listOrders } = useOrders();
await listOrders('Delivered');  // Optional filter by status
```

### Get All Sales
```javascript
const { sales, summary, loading, error, listSales } = useSales();
await listSales(3);  // distributor_id: 3
```

### Get Anomalies
```javascript
const { anomalies, loading, error, listAnomalies } = useAnomalyDetection();
await listAnomalies(100, false);  // limit: 100, unresolved only
```

### Record Blockchain Transaction
```javascript
const { recordBatch, loading, error, txStatus } = useBlockchainTransactions();
await recordBatch({ batch_id: 'B001', drug_name: 'Aspirin', ... });
// Returns: { transaction_id, blockchain_hash, ... }
```

### Export PDF Report
```javascript
const { downloadCompliancePdf, downloading, error } = useComplianceExport();
await downloadCompliancePdf('B001');  // Triggers browser download
```

### Subscribe to Real-Time Updates
```javascript
const { telemetry, connected } = useTelemetryStream('B001');
// telemetry = { temperature, humidity, weight, battery, timestamp }

const { alerts, connected } = useColdChainAlertsStream();
// alerts = [ { shipment_id, current_temp, status, ... } ]

const { orders, connected } = useOrderUpdatesStream(3);
// orders = [ { id, status, product, ... } ] - real-time updates
```

---

## Timeline Estimate

- **Component 1 (VendorRop):** 15 min
- **Component 2 (VendorForecast):** 15 min
- **Component 3 (AdminAnomalies):** 20 min
- **Component 4 (DistributorOrders):** 20 min
- **Component 5 (DistributorColdChain):** 20 min

**Total:** ~90 minutes to wire 5 critical components

**Remaining 15+ components:** 5-10 min each using same patterns

---

## Success = ✅

When you see:
- ✅ Real data from backend (not mock)
- ✅ Live updates via WebSocket
- ✅ No errors on screen (handled gracefully)
- ✅ Works offline with fallback
- ✅ Responsive and fast (<200ms)

**You've successfully wired your first production-grade component!**

---

**Good luck! 🚀 You've got this!**

Questions? Check:
1. `COMPONENT_WIRING_GUIDE.js` - Examples
2. `SETUP_CONFIGURATION_GUIDE.js` - Troubleshooting
3. `README_INTEGRATION.md` - Full reference
