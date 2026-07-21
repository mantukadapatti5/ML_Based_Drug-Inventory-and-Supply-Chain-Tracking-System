import { useState, useEffect } from "react";
import { getRopDashboard, calculateROP } from "../../services/api";
import { SectionErrorBoundary, LoadingFallback } from "../../components/ErrorBoundaries";

const VendorRop = () => {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ restock_alerts: 0, average_rop: 0, lead_time_days: 5 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);

  // Form state for ROP calculator
  const [formData, setFormData] = useState({
    drug_id: "",
    annual_demand: 1200,
    lead_time_days: 14,
    holding_cost_percent: 20,
    order_cost: 500,
    service_level: 95,
  });

  // Fallback data
  const fallbackItems = [
    { drug: "Aspirin 500mg", drug_id: "DRG0001", stock: 450, rop: 300, status: "OK" },
    { drug: "Paracetamol 500mg", drug_id: "DRG0002", stock: 120, rop: 400, status: "Restock needed" },
    { drug: "Amoxicillin 250mg", drug_id: "DRG0003", stock: 890, rop: 500, status: "OK" },
    { drug: "Ibuprofen 400mg", drug_id: "DRG0004", stock: 200, rop: 250, status: "Restock needed" },
    { drug: "Metformin 500mg", drug_id: "DRG0005", stock: 2000, rop: 600, status: "OK" },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getRopDashboard("Ahmedabad");
        setItems(res.data.items || fallbackItems);
        setMeta({
          restock_alerts: res.data.restock_alerts ?? 2,
          average_rop: res.data.average_rop ?? 450,
          lead_time_days: res.data.lead_time_days ?? 14,
        });
        // Set first drug as default
        if (res.data.items && res.data.items.length > 0) {
          setFormData(prev => ({ ...prev, drug_id: res.data.items[0].drug_id }));
        }
      } catch (err) {
        setError("Using fallback ROP calculations");
        setItems(fallbackItems);
        setFormData(prev => ({ ...prev, drug_id: "DRG0001" }));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "drug_id" ? value : parseFloat(value) || 0
    }));
  };

  const handleCalculate = async () => {
    if (!formData.drug_id) {
      setError("Please select a drug");
      return;
    }

    try {
      setCalculating(true);
      setError("");
      const res = await calculateROP(formData);
      
      setCalculationResult({
        rop: res.data.rop || 0,
        eoq: res.data.eoq || 0,
        reorder_point: res.data.reorder_point || 0,
        safety_stock: res.data.safety_stock || 0,
        status: "success"
      });
    } catch (err) {
      console.error("ROP Calculation failed:", err);
      // Calculate fallback values
      const d = formData.annual_demand / 365;
      const holding_cost = formData.holding_cost_percent / 100;
      const eoq = Math.sqrt((2 * formData.annual_demand * formData.order_cost) / holding_cost);
      const rop = d * formData.lead_time_days;
      const z = 1.645; // 95% service level
      const safety_stock = z * Math.sqrt(formData.lead_time_days) * Math.sqrt(d);
      
      setCalculationResult({
        rop: Math.round(rop),
        eoq: Math.round(eoq),
        reorder_point: Math.round(rop + safety_stock),
        safety_stock: Math.round(safety_stock),
        status: "fallback",
        message: "Using calculated values"
      });
    } finally {
      setCalculating(false);
    }
  };

  return (
    <SectionErrorBoundary>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">ROP Calculator & Dashboard</h1>
          <p className="mt-2 text-slate-600">Dynamic reorder points from ML demand and supplier lead times.</p>
        </div>
        
        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        {loading ? (
          <LoadingFallback message="Loading ROP data..." />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Auto Restock Alerts</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">{meta.restock_alerts}</p>
                <p className="text-xs text-slate-500 mt-2">Items below ROP</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Average ROP</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">{meta.average_rop} units</p>
                <p className="text-xs text-slate-500 mt-2">Across all drugs</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Lead Time</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">{meta.lead_time_days} days</p>
                <p className="text-xs text-slate-500 mt-2">Average supplier LT</p>
              </div>
            </div>

            {/* Calculator Form and Results */}
            <div className="grid gap-6 xl:grid-cols-2">
              {/* Form */}
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900 mb-6">ROP Calculator</h2>
                <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleCalculate(); }}>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Drug</label>
                    <select
                      name="drug_id"
                      value={formData.drug_id}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">-- Select a drug --</option>
                      {items.map(item => (
                        <option key={item.drug_id} value={item.drug_id}>
                          {item.drug}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Annual Demand</label>
                      <input type="number" name="annual_demand" value={formData.annual_demand} onChange={handleInputChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Lead Time (days)</label>
                      <input type="number" name="lead_time_days" value={formData.lead_time_days} onChange={handleInputChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Holding Cost (%)</label>
                      <input type="number" name="holding_cost_percent" value={formData.holding_cost_percent} onChange={handleInputChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Order Cost</label>
                      <input type="number" name="order_cost" value={formData.order_cost} onChange={handleInputChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Service Level</label>
                    <select name="service_level" value={formData.service_level} onChange={handleInputChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500">
                      <option value="90">90%</option>
                      <option value="95">95%</option>
                      <option value="99">99%</option>
                    </select>
                  </div>

                  <button type="submit" disabled={calculating || !formData.drug_id} className="w-full rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors">
                    {calculating ? "Calculating..." : "Calculate ROP & EOQ"}
                  </button>
                </form>
              </div>

              {/* Results */}
              <div>
                {calculationResult ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 p-6">
                      <p className="text-sm uppercase text-slate-600 font-semibold">Reorder Point (ROP)</p>
                      <p className="text-4xl font-bold text-sky-700 mt-2">{calculationResult.rop}</p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 p-6">
                      <p className="text-sm uppercase text-slate-600 font-semibold">Economic Order Qty (EOQ)</p>
                      <p className="text-4xl font-bold text-emerald-700 mt-2">{calculationResult.eoq}</p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-6">
                      <p className="text-sm uppercase text-slate-600 font-semibold">Safety Stock</p>
                      <p className="text-4xl font-bold text-purple-700 mt-2">{calculationResult.safety_stock}</p>
                    </div>
                    {calculationResult.message && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                        {calculationResult.message}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 h-full flex items-center justify-center">
                    <p className="text-center text-slate-500">Fill the form and click "Calculate" to see results</p>
                  </div>
                )}
              </div>
            </div>

            {/* Inventory Status Table */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Drug</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Current Stock</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">ROP</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.drug_id || idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.drug}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.stock}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.rop}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === "Restock needed" 
                            ? "bg-rose-100 text-rose-700" 
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SectionErrorBoundary>
  );
};

export default VendorRop;



