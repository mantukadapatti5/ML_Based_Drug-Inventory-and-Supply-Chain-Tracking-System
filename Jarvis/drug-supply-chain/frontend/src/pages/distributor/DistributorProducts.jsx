import { useState, useEffect } from "react";
import { getCatalog, requestStock } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatINR, apiErrorMessage } from "../../utils/currency";

const DistributorProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [requesting, setRequesting] = useState({});
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [qtyById, setQtyById] = useState({});

  useEffect(() => {
    getCatalog()
      .then((res) => {
        const list = res?.data?.products ?? [];
        setProducts(Array.isArray(list) ? list : []);
        const defaults = {};
        list.forEach((p) => {
          if (p?.id != null) defaults[p.id] = 100;
        });
        setQtyById(defaults);
      })
      .catch((err) => setError(apiErrorMessage(err, "Failed to load catalog.")));
  }, []);

  const handleRequest = async (product) => {
    if (!product || product.id == null) {
      setError("Invalid product selected.");
      return;
    }
    const qty = Number(qtyById[product.id]) || 0;
    if (qty <= 0) {
      setError("Enter a valid quantity greater than zero.");
      return;
    }

    setError("");
    setRequesting((prev) => ({ ...prev, [product.id]: true }));
    try {
      const res = await requestStock({
        drug_id: product.id,
        drug_name: product.name || "Unknown",
        batch_no: product.batch_no || "",
        quantity: qty,
        requested_quantity: qty,
        requested_by: String(user?.user_id ?? "distributor"),
        distributor_id: Number(user?.user_id) || 6,
        priority: "High",
      });
      setMsg(res?.data?.message || "Stock request sent for " + product.name + ".");
    } catch (err) {
      setError(apiErrorMessage(err, "Request failed."));
    } finally {
      setRequesting((prev) => ({ ...prev, [product.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Product Listing</h1>
        <p className="mt-2 text-slate-600">Live drug catalog from vendors — request stock to order.</p>
      </div>
      {msg ? <div className="rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm">{msg}</div> : null}
      {error ? <div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-widest text-slate-500">{p.manufacturer}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{p.name}</h3>
            <p className="text-sm text-slate-600">Batch: {p.batch_no}</p>
            <p className="mt-3 text-2xl font-bold text-slate-800">{formatINR(p.price)}</p>
            <p className="text-sm text-slate-500">Available: {p.quantity ?? p.stock ?? 0} units</p>
            <label className="mt-3 block text-sm text-slate-600">
              Quantity
              <input
                type="number"
                min={1}
                value={qtyById[p.id] ?? 100}
                onChange={(e) => setQtyById((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={Boolean(requesting[p.id])}
              onClick={() => handleRequest(p)}
              className="mt-4 w-full rounded-2xl bg-sky-600 py-3 text-white font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {requesting[p.id] ? "Requesting..." : "Request Stock"}
            </button>
          </div>
        ))}
      </div>
      {products.length === 0 && !error ? (
        <p className="text-slate-500">No products in catalog. Run backend seed or init_db.</p>
      ) : null}
    </div>
  );
};

export default DistributorProducts;
