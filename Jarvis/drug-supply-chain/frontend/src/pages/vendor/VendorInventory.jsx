import { useState } from "react";
import { getInventoryItems, getInventoryItemsFallback, createInventoryItem, updateInventoryItem, deleteInventoryItem } from "../../services/api";
import { useDataWithFallback, normalizeRecords } from "../../hooks/useDataWithFallback";
import { formatINR } from "../../utils/currency";

const VendorInventory = () => {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", batch_no: "", manufacturer: "", quantity: 0, price: 0, expiry_date: "",
  });

  // Intelligent fallback: tries primary DB endpoint, falls back to CSV
  const { data: rawProducts, loading, error, source, refresh } = useDataWithFallback(
    () => getInventoryItems(),
    () => getInventoryItemsFallback(50)
  );

  // Normalize column names from CSV (handles drug_name, drugName, Drug Name, etc.)
  const products = normalizeRecords(rawProducts).map((p, idx) => ({
    id: p.id ?? idx,
    name: p.name ?? p.drugName ?? p.drugid ?? "Unknown",
    batchNo: p.batchNo ?? p.batch_no ?? p.batchnumber ?? "N/A",
    manufacturer: p.manufacturer ?? p.mfr ?? p.category ?? "General",
    quantity: parseInt(p.quantity ?? p.stock ?? 0),
    price: parseFloat(p.price ?? 0),
    expiryDate: p.expiryDate ?? p.expiry_date ?? p.expiry ?? "N/A",
  }));

  const handleSave = async () => {
    try {
      await updateInventoryItem(editingId, {
        name: editForm.name,
        batch_no: editForm.batchNo,
        manufacturer: editForm.manufacturer,
        quantity: parseInt(editForm.quantity, 10),
        price: parseFloat(editForm.price),
        expiry_date: editForm.expiryDate,
      });
      setEditingId(null);
      refresh();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save product. Check console for details.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this product?")) {
      try {
        await deleteInventoryItem(id);
        refresh();
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Failed to delete product.");
      }
    }
  };

  const handleAddProduct = async () => {
    try {
      await createInventoryItem({
        ...newProduct,
        vendor_id: 2,
      });
      setNewProduct({ name: "", batch_no: "", manufacturer: "", quantity: 0, price: 0, expiry_date: "" });
      setShowAddForm(false);
      refresh();
    } catch (err) {
      console.error("Add failed:", err);
      alert("Failed to add product.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Inventory</h1>
          <p className="mt-2 text-slate-600">
            {loading ? "Loading inventory..." : `Live stock (${source === "primary" ? "Database" : "CSV Fallback"}) — ${products.length} items`}
          </p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="rounded-2xl bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
          {showAddForm ? "Cancel" : "Add Product"}
        </button>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">⚠️ Data Loading Issue</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {showAddForm && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-2">
          <input placeholder="Name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="rounded-2xl border px-4 py-3" />
          <input placeholder="Batch No" value={newProduct.batch_no} onChange={(e) => setNewProduct({ ...newProduct, batch_no: e.target.value })} className="rounded-2xl border px-4 py-3" />
          <input placeholder="Manufacturer" value={newProduct.manufacturer} onChange={(e) => setNewProduct({ ...newProduct, manufacturer: e.target.value })} className="rounded-2xl border px-4 py-3" />
          <input type="number" placeholder="Stock" value={newProduct.quantity} onChange={(e) => setNewProduct({ ...newProduct, quantity: +e.target.value })} className="rounded-2xl border px-4 py-3" />
          <input type="number" placeholder="Price" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: +e.target.value })} className="rounded-2xl border px-4 py-3" />
          <input type="date" value={newProduct.expiry_date} onChange={(e) => setNewProduct({ ...newProduct, expiry_date: e.target.value })} className="rounded-2xl border px-4 py-3" />
          <button onClick={handleAddProduct} className="md:col-span-2 rounded-2xl bg-green-600 py-3 text-white font-semibold">Save Product</button>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-slate-500 animate-pulse">⏳ Loading inventory data...</p>
        ) : products.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No products available. Add one to get started.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Product</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Batch</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Stock</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Price</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Expiry</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 text-sm">
                    {editingId === p.id ? (
                      <input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="border rounded px-2 w-full" />
                    ) : (
                      p.name
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {editingId === p.id ? (
                      <input value={editForm.batchNo || ""} onChange={(e) => setEditForm({ ...editForm, batchNo: e.target.value })} className="border rounded px-2 w-full" />
                    ) : (
                      p.batchNo
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {editingId === p.id ? (
                      <input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: +e.target.value })} className="border rounded px-2 w-20" />
                    ) : (
                      p.quantity
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {editingId === p.id ? (
                      <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: +e.target.value })} className="border rounded px-2 w-20" />
                    ) : (
                      formatINR(p.price)
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{p.expiryDate}</td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    {editingId === p.id ? (
                      <>
                        <button onClick={handleSave} className="text-green-600 font-semibold hover:text-green-800">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-700">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(p.id); setEditForm(p); }} className="text-sky-600 font-semibold hover:text-sky-800">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 font-semibold hover:text-red-800">Delete</button>
                      </>
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

export default VendorInventory;


