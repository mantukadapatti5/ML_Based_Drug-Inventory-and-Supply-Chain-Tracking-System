import { useState, useEffect } from "react";
import { getSales, createSale, getSalesDrugs } from "../../services/api";
import { formatINR } from "../../utils/currency";

const DistributorSales = () => {
  const [sales, setSales] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drugsLoading, setDrugsLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    distributor_id: 3,
    drug_id: "",
    quantity: 1,
    amount: 0,
  });

  // Load sales list
  useEffect(() => {
    getSales()
      .then((res) => setSales(res.data?.sales || []))
      .catch((err) => setError("Failed to load sales: " + (err.message || "")))
      .finally(() => setLoading(false));
  }, []);

  // Load drugs dropdown — calls /api/sales/drugs
  useEffect(() => {
    setDrugsLoading(true);
    getSalesDrugs()
      .then((res) => {
        const list = res.data?.drugs || [];
        setDrugs(list);
        // Auto-select first drug
        if (list.length > 0) {
          setForm((prev) => ({
            ...prev,
            drug_id: list[0].id,
            amount: list[0].price * (prev.quantity || 1),
          }));
        }
      })
      .catch((err) => {
        console.error("Drug list error:", err);
        // Hard fallback so dropdown is never empty
        const fallback = [
          { id: 156, name: "Cold Chain Vaccine Serum", price: 250.0 },
          { id: 157, name: "Paracetamol Infusion Pack", price: 45.0 },
          { id: 158, name: "Amoxicillin Capsule Box", price: 120.0 },
        ];
        setDrugs(fallback);
        setForm((prev) => ({ ...prev, drug_id: fallback[0].id, amount: fallback[0].price }));
      })
      .finally(() => setDrugsLoading(false));
  }, []);

  // Auto-recalculate amount when drug or quantity changes
  const handleDrugChange = (e) => {
    const id = Number(e.target.value);
    const drug = drugs.find((d) => d.id === id);
    setForm((prev) => ({
      ...prev,
      drug_id: id,
      amount: drug ? drug.price * prev.quantity : prev.amount,
    }));
  };

  const handleQtyChange = (e) => {
    const qty = Number(e.target.value) || 1;
    const drug = drugs.find((d) => d.id === form.drug_id);
    setForm((prev) => ({
      ...prev,
      quantity: qty,
      amount: drug ? drug.price * qty : prev.amount,
    }));
  };

  const handleSubmit = async () => {
    if (!form.drug_id) {
      setError("Please select a drug.");
      return;
    }
    if (form.quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }
    setError("");
    setMsg("");
    try {
      await createSale({
        distributor_id: Number(form.distributor_id),
        drug_id: Number(form.drug_id),
        quantity: Number(form.quantity),
        amount: Number(form.amount),
      });
      setMsg("✅ Sale recorded successfully!");
      // Refresh sales list
      const res = await getSales();
      setSales(res.data?.sales || []);
      // Reset qty
      setForm((prev) => ({ ...prev, quantity: 1 }));
    } catch (err) {
      setError("Failed to record sale: " + (err.response?.data?.detail || err.message));
    }
  };

  const summary = {
    total_units: sales.reduce((s, r) => s + (r.quantity || 0), 0),
    total_revenue: sales.reduce((s, r) => s + (r.amount || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Sales</h1>
        <p className="mt-2 text-slate-600">Record sales and view revenue history.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500 uppercase tracking-widest">Total Units Sold</p>
          <p className="mt-3 text-4xl font-bold text-slate-900">{summary.total_units.toLocaleString()}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500 uppercase tracking-widest">Total Revenue</p>
          <p className="mt-3 text-4xl font-bold text-slate-900">{formatINR(summary.total_revenue)}</p>
        </div>
      </div>

      {/* New Sale Form */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Record New Sale</h2>

        {msg && <p className="mb-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2">{msg}</p>}
        {error && <p className="mb-3 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-2">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Drug Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Select Drug
            </label>
            {drugsLoading ? (
              <div className="rounded-2xl border px-4 py-3 text-slate-400 text-sm animate-pulse">
                Loading drugs...
              </div>
            ) : (
              <select
                value={form.drug_id}
                onChange={handleDrugChange}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                {drugs.length === 0 && (
                  <option value="">No drugs available</option>
                )}
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {formatINR(d.price)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Distributor ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Distributor ID
            </label>
            <input
              type="number"
              min={1}
              value={form.distributor_id}
              onChange={(e) => setForm({ ...form, distributor_id: Number(e.target.value) })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={handleQtyChange}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Amount (auto-calculated) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Total Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="mt-4 w-full rounded-2xl bg-sky-600 py-3 text-white font-semibold hover:bg-sky-700 transition-colors"
        >
          Record Sale
        </button>
      </div>

      {/* Sales History Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Sales History</h2>
        </div>
        {loading ? (
          <p className="p-8 text-center text-slate-400 animate-pulse">Loading sales...</p>
        ) : sales.length === 0 ? (
          <p className="p-8 text-center text-slate-400">No sales recorded yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Drug</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Qty</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-800">{s.drug_name || "Unknown"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{s.quantity}</td>
                  <td className="px-6 py-4 text-sm text-slate-800 font-medium">{formatINR(s.amount)}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{s.sale_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DistributorSales;
