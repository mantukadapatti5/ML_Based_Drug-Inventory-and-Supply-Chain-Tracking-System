import { useState, useEffect } from "react";
import { getInventoryItems, updateInventoryItem } from "../../services/api";
import { formatINR } from "../../utils/currency";

const DistributorInventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editStock, setEditStock] = useState(0);

  const load = () => {
    getInventoryItems()
      .then((res) => setItems(res.data.items || res.data.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveStock = async (id) => {
    await updateInventoryItem(id, { quantity: editStock });
    setEditingId(null);
    load();
  };

  const totalStock = items.reduce((s, i) => s + (i.quantity ?? i.stock ?? 0), 0);
  const lowStock = items.filter((i) => (i.quantity ?? i.stock ?? 0) < 100).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Inventory</h1>
        <p className="mt-2 text-slate-600">Live catalog stock — synced with vendor database.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total units</p>
          <p className="text-3xl font-bold">{totalStock}</p>
        </div>
        
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">SKUs</p>
          <p className="text-3xl font-bold">{items.length}</p>
        </div>
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Low stock</p>
          <p className="text-3xl font-bold text-amber-600">{lowStock}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        {loading ? <p className="p-8 text-slate-500">Loading...</p> : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Product</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Batch</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Stock</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Price</th>
                <th className="px-6 py-4 text-sm font-semibold">Update</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-sm">{item.name}</td>
                  <td className="px-6 py-4 text-sm">{item.batch_no}</td>
                  <td className="px-6 py-4 text-sm">
                    {editingId === item.id ? (
                      <input type="number" value={editStock} onChange={(e) => setEditStock(+e.target.value)} className="w-20 border rounded px-2" />
                    ) : (
                      item.quantity ?? item.stock
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{formatINR(item.price)}</td>
                  <td className="px-6 py-4 text-sm">
                    {editingId === item.id ? (
                      <button type="button" onClick={() => saveStock(item.id)} className="text-green-600 font-semibold">Save</button>
                    ) : (
                      <button type="button" onClick={() => { setEditingId(item.id); setEditStock(item.quantity ?? item.stock); }} className="text-sky-600 font-semibold">Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DistributorInventory;
