import { useState, useEffect } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { useAnalytics } from "../../hooks/useAPIIntegration";
import { useColdChainAlertsStream } from "../../hooks/useWebSocketStreams";
import { SectionErrorBoundary, LoadingFallback, InfoBanner, BackendUnavailable, NoDataPlaceholder } from "../../components/ErrorBoundaries";

const VendorDashboard = () => {
  const { data: analyticsData, loading, error: analyticsError, getSummary } = useAnalytics();
  const { alerts: coldChainAlerts, connected: wsConnected } = useColdChainAlertsStream();
  const [kpis, setKpis] = useState({
    spoilage_risk_pct: 0,
    inventory_health_pct: 0,
    avg_lead_time_days: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [dismissError, setDismissError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getSummary();
        if (res && res.series) {
          setChartData(res.series);
        }
        if (res && res.kpis) {
          setKpis(res.kpis);
        }
      } catch (err) {
        console.error("AI Analytics fetch failed:", err);
      }
    };
    fetchData();
  }, [getSummary]);

  return (
    <SectionErrorBoundary>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">AI-Powered Analytics</h1>
            <p className="mt-2 text-slate-600">Insights from sales, anomalies, and expiry data.</p>
          </div>
          <div className="flex gap-3">
            <div className={`px-4 py-2 rounded-2xl text-sm font-bold border ${
              wsConnected
                ? 'bg-green-50 text-green-700 border-green-100'
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
              {wsConnected ? '✓ Live' : '⚠️ Cached'}
            </div>
            <div className="px-4 py-2 bg-sky-50 text-sky-700 rounded-2xl text-sm font-bold border border-sky-100">
              ML Models: Active
            </div>
          </div>
        </div>

        {/* Error Messages */}
        {analyticsError && !dismissError && (
          <InfoBanner
            type="warning"
            title="Analytics Data Loading"
            message={`Some analytics may be unavailable: ${analyticsError}`}
            onClose={() => setDismissError(true)}
          />
        )}

        {!wsConnected && (
          <InfoBanner
            type="info"
            title="Real-Time Streaming Unavailable"
            message="Displaying cached data. WebSocket connection is temporarily unavailable."
          />
        )}

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Spoilage Risk</p>
            <p className="mt-2 text-3xl font-bold text-rose-600">{(kpis.spoilage_risk_pct || 0).toFixed(1)}%</p>
            <div className="mt-4 h-1 bg-rose-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-600 transition-all"
                style={{ width: `${Math.min(kpis.spoilage_risk_pct || 0, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Inventory Health</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{(kpis.inventory_health_pct || 0).toFixed(1)}%</p>
            <div className="mt-4 h-1 bg-emerald-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${Math.min(kpis.inventory_health_pct || 0, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Avg Lead Time</p>
            <p className="mt-2 text-3xl font-bold text-sky-600">{(kpis.avg_lead_time_days || 0).toFixed(1)} Days</p>
            <div className="mt-4 text-xs text-slate-500">Industry average: 2.5 days</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Spoilage Risk Chart */}
          <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Predicted Spoilage Risk (%)</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-2"></div>
                  <p>Fetching ML Data...</p>
                </div>
              </div>
            ) : chartData && chartData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="predicted_spoilage_risk"
                      stroke="#f43f5e"
                      strokeWidth={3}
                      fillOpacity={0.1}
                      fill="#f43f5e"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoDataPlaceholder description="No forecast data available yet" />
            )}
          </div>

          {/* Efficiency Chart */}
          <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Efficiency Trends</h3>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-2"></div>
                  <p>Processing Insights...</p>
                </div>
              </div>
            ) : chartData && chartData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="efficiency_score"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#10b981" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <NoDataPlaceholder description="No efficiency data available yet" />
            )}
          </div>
        </div>

        {/* Cold Chain Alerts Feed */}
        {coldChainAlerts && coldChainAlerts.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/10 p-4">
            <p className="text-sm font-semibold text-amber-200 mb-3">📊 Active Cold Chain Alerts</p>
            <div className="space-y-2">
              {coldChainAlerts.slice(0, 3).map((alert, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                  <span className="text-amber-100">
                    {alert.shipment_id || alert.batch_id}: {alert.type || 'Temperature Alert'}
                  </span>
                  <span className="text-amber-300 font-mono text-xs">{alert.current_temp || alert.temperature}°C</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  );
};

export default VendorDashboard;


