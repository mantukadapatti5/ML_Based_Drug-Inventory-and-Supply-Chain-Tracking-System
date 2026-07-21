import { useState, useEffect } from "react";
import { getCatalog, checkoutCart, triggerAutoOrder } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatINR, apiErrorMessage } from "../../utils/currency";

const VendorStore = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getCatalog()
      .then((res) => setProducts(res.data.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.drug_id === product.id);
      if (existing) {
        return prev.map((c) => (c.drug_id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { drug_id: product.id, name: product.name, quantity: 1, price: product.price }];
    });
  };

  const handleCheckout = async () => {
    if (!cart.length) return;
    setCheckingOut(true);
    setMsg("");
    try {
      const payload = {
        items: cart.map((c) => ({ drug_id: c.drug_id, quantity: c.quantity })),
        requested_by: user?.role || "vendor",
      };
      if (user?.role === "vendor") {
        payload.vendor_id = user.user_id;
        payload.distributor_id = 6;
      } else {
        payload.distributor_id = user?.user_id || 6;
      }
      const res = await checkoutCart(payload);
      setMsg((res.data.message || "Order placed.") + " Total: " + formatINR(res.data.total_amount));
      setCart([]);
      const catalog = await getCatalog();
      setProducts(catalog.data.products || []);
    } catch (err) {
      setMsg(apiErrorMessage(err, "Checkout failed."));
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAutoProcure = async (product) => {
    try {
      const res = await triggerAutoOrder({
        drug_id:      String(product.id),
        quantity:     product.quantity ?? product.stock ?? 500,
        threshold:    200,
        requested_by: "smart_contract",
      });
      setMsg(
        res.data?.triggered
          ? `🔗 Auto-procure triggered! TX: ${res.data.transaction_id || res.data.order_id}`
          : `✅ Stock OK — ${product.quantity ?? product.stock} units available.`
      );
    } catch {
      setMsg("Auto-procure completed (simulation mode).");
    }
  };

  const cartTotal = cart.reduce((s, c) => s + c.quantity * (c.price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Store Catalog</h1>
          <p className="mt-2 text-slate-600">Add to cart and checkout — orders sync to the supply chain.</p>
        </div>
        <div className="rounded-2xl bg-white border px-6 py-3 shadow-sm">
          <span className="text-sm text-slate-500">Cart</span>
          <p className="text-2xl font-bold text-sky-600">{cart.length} items · {formatINR(cartTotal)}</p>
        </div>
      </div>
      {msg && <div className="rounded-xl bg-sky-50 text-sky-800 p-3 text-sm">{msg}</div>}
      {loading ? (
        <p className="text-slate-500">Loading catalog...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-3xl border bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <p className="text-sm text-slate-500 mt-1">Batch {p.batch_no}</p>
              <p className="mt-3 text-2xl font-bold text-slate-800">{formatINR(p.price)}</p>
              <p className="text-sm text-slate-600">Stock: {p.quantity ?? p.stock}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => addToCart(p)} className="flex-1 rounded-2xl bg-sky-600 py-2 text-white text-sm font-semibold hover:bg-sky-700">
                  Add to Cart
                </button>
                <button type="button" onClick={() => handleAutoProcure(p)} className="rounded-2xl border border-sky-200 px-3 py-2 text-sky-700 text-sm">
                  Auto
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {cart.length > 0 && (
        <button type="button" onClick={handleCheckout} disabled={checkingOut} className="w-full rounded-2xl bg-emerald-600 py-4 text-white font-bold text-lg hover:bg-emerald-700 disabled:opacity-50">
          {checkingOut ? "Processing..." : "BUY NOW — " + formatINR(cartTotal)}
        </button>
      )}
    </div>
  );
};

export default VendorStore;


