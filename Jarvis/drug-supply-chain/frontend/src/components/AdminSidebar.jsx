// ════════════════════════════════════════════════════════════════════
// AdminSidebar.jsx — replace frontend/src/components/AdminSidebar.jsx
// ════════════════════════════════════════════════════════════════════
import { NavLink } from "react-router-dom";

const adminNavItems = [
  { label: "🏠 Dashboard",       path: "/admin/dashboard" },
  { label: "👥 Users",           path: "/admin/users" },
  { label: "🔗 Blockchain",      path: "/admin/blockchain" },
  { label: "❤️ System Health",   path: "/admin/health" },
  { label: "🚨 Anomalies",       path: "/admin/anomalies" },
  { label: "📋 Audit Reports",   path: "/admin/reports" },
];

export const AdminSidebar = () => (
  <aside className="hidden lg:block w-72 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 p-6 text-slate-100">
    <div className="mb-10">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Admin Portal</div>
      <div className="text-2xl font-semibold text-white">AuditChain</div>
      <p className="mt-2 text-sm text-slate-400">Compliance, blockchain and system health.</p>
    </div>
    <nav className="space-y-1">
      {adminNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `block rounded-2xl px-4 py-3 text-sm font-medium transition ${
              isActive
                ? "bg-red-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  </aside>
);

export default AdminSidebar;
