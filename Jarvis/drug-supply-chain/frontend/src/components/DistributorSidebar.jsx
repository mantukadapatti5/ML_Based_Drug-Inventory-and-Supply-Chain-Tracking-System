import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Dashboard", path: "/distributor/dashboard" },
  { label: "Sales", path: "/distributor/sales" },
  { label: "Orders", path: "/distributor/orders" },
  { label: "Order History", path: "/distributor/order-history" },
  { label: "Products", path: "/distributor/products" },
  { label: "Inventory", path: "/distributor/inventory" },
  { label: "Cold Chain", path: "/distributor/cold-chain" },
  { label: "Ratings", path: "/distributor/ratings" },
  { label: "Compliance", path: "/distributor/compliance" },
  { label: "Shipment Tracking", path: "/distributor/tracking" },
  { label: "Drug Verification", path: "/distributor/verification" },
];

const DistributorSidebar = () => {
  return (
    <aside className="hidden lg:block w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-6">
      <div className="mb-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Distributor Portal</div>
        <div className="text-2xl font-semibold text-slate-900">SupplyTrack</div>
        <p className="mt-2 text-sm text-slate-500">Sales, shipments, inventory and compliance tools.</p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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

export default DistributorSidebar;
