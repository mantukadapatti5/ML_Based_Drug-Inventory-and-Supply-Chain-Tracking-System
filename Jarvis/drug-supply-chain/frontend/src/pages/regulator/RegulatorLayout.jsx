import { Outlet, Link, useLocation } from "react-router-dom";

const RegulatorLayout = () => {
  const location = useLocation();

  const menuItems = [
    { path: "/regulator/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/regulator/batches", label: "Batch Tracking", icon: "📦" },
    { path: "/regulator/compliance", label: "Compliance Reports", icon: "✓" },
    { path: "/regulator/blockchain", label: "Blockchain Ledger", icon: "⛓️" },
    { path: "/regulator/alerts", label: "Alerts & Anomalies", icon: "⚠️" },
    { path: "/regulator/audit-trail", label: "Audit Trail", icon: "📋" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-950 border-r border-slate-800 p-6">
          <h1 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
            🔐 Regulator Portal
          </h1>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default RegulatorLayout;
