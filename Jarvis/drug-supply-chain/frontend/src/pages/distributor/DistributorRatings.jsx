import { useState, useEffect } from "react";
import { getSupplierPerformance } from "../../services/api";

const DistributorRatings = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getSupplierPerformance();
        const data = res.data?.suppliers || (Array.isArray(res.data) ? res.data : []);
        setVendors(
          data.map((v) => ({
            name: v.supplier_name,
            score: v.rating_score,
            feedback: v.feedback || `Status: ${v.status || "Verified"}`,
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
        <div>
        <h1 className="text-3xl font-semibold text-slate-900">Supplier Performance Rating</h1>
        <p className="mt-2 text-slate-600">Live scores from delivery, cold-chain, and order history.</p>
      </div>
      {loading ? (
        <p className="text-slate-500">Loading supplier ratings...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {vendors.map((vendor) => (
            <div key={vendor.name} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{vendor.name}</p>
              <p className="mt-4 text-4xl font-semibold text-slate-900">{vendor.score}</p>
              <p className="mt-3 text-sm text-slate-600">{vendor.feedback}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DistributorRatings;

