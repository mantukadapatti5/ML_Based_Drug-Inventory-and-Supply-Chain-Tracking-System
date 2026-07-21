import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Dashboard",       path: "/vendor/dashboard" },
  { label: "Inventory",       path: "/vendor/inventory" },
  { label: "Billing",         path: "/vendor/billing" },
  { label: "Order History",   path: "/vendor/order-history" },
  { label: "Store",           path: "/vendor/store" },
  { label: "Orders",          path: "/vendor/orders" },
  { label: "Forecasting",     path: "/vendor/forecast" },
  { label: "Auto-Procure 🔗", path: "/vendor/auto-procure" },
  { label: "Cold Chain",      path: "/vendor/cold-chain" },
  { label: "Expiry",          path: "/vendor/expiry" },
  { label: "Anomalies",       path: "/vendor/anomaly" },
  { label: "ROP",             path: "/vendor/rop" },
];

const VendorSidebar = () => {
  return (
    <aside className="hidden lg:block w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-6">
      <div className="mb-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Vendor Portal</div>
        <div className="text-2xl font-semibold text-slate-900">PharmaSupply</div>
        <p className="mt-2 text-sm text-slate-500">Inventory, orders, forecasting and cold chain monitoring.</p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default VendorSidebar;
