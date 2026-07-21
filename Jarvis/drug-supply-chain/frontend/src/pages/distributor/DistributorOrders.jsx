import { useState, useEffect } from "react";
import { getOrders, updateOrderStatus, dispatchShipment } from "../../services/api";

const normalizeStatus = (value) => {
  if (!value) return "ORDERED";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "received" || normalized === "received") return "RECEIVED";
  if (normalized === "delivered") return "DELIVERED";
  return "ORDERED";
};

const displayStatus = (value) => {
  const normalized = String(value || "ORDERED").trim().toUpperCase();
  if (normalized === "RECEIVED") return "Received";
  if (normalized === "DELIVERED") return "Delivered";
  return "Ordered";
};

const DistributorOrders = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const res = await getOrders(filter);
      setOrders((res.data.orders || []).map((order) => ({ ...order, status: displayStatus(order.status) })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadOrders();
  }, [filter]);

  const handleStatusChange = async (order, newStatus) => {
    try {
      const backendStatus = normalizeStatus(newStatus);
      await updateOrderStatus(order.id, backendStatus);
      if (backendStatus === "RECEIVED" && order.shipment_id) {
        await dispatchShipment(order.shipment_id, {
          batch_ids: [order.batch_no || `ORD-${order.id}`],
          destination: "Regional Hub",
          vehicle_id: "VH-101",
          driver_id: "DRV-42",
        });
      }
      setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: displayStatus(backendStatus) } : item)));
    } catch (err) {
      console.error(err);
    }
  };

  const statusOptions = ["Ordered", "Received", "Delivered"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Received Orders & Dispatch</h1>
        <p className="mt-2 text-slate-600">Fulfillment synced with shipment tracking API.</p>
      </div>
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-slate-700">Filter by Status:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="All">All</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-slate-500">Loading orders...</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Order</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Product</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Vendor</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Qty</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Shipment</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 text-sm text-slate-800">ORD-{order.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{order.product}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{order.vendor}</td>
                  <td className="px-6 py-4 text-sm text-slate-800">{order.quantity}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{order.shipment_id}</td>
                  <td className="px-6 py-4 text-sm">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order, e.target.value)}
                      className="rounded-full px-3 py-1 text-xs font-semibold border border-slate-200"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DistributorOrders;

