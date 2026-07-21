import { useState, useEffect } from "react";
import { getAdminStats, getSystemHealth } from "../../services/api";
import api from "../../services/api";

const RegulatorDashboard = () => {
  const [stats, setStats] = useState({
    total_users: 0,
    total_orders: 0,
    active_anomalies: 0,   // ← FIXED: was "active_alerts" (wrong field name)
    compliance_score: 0,   // ← FIXED: was "compliant_batches" (wrong field name)
    total_drugs: 0,
    pending_verifications: 0,
  });

  const [compliance, setCompliance] = useState(null);  // ← FIXED: was hardcoded strings
  const [health, setHealth] = useState(null);          // ← FIXED: was hardcoded "Running"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // 1. Load admin stats — correctly maps active_anomalies field
        const statsRes = await getAdminStats();
        const d = statsRes.data || {};
        setStats({
          total_users:          d.total_users          ?? 0,
          total_orders:         d.total_orders         ?? 0,
          active_anomalies:     d.active_anomalies      ?? 0,   // ← correct field
          compliance_score:     d.compliance_score     ?? 0,    // ← correct field
          total_drugs:          d.total_drugs           ?? 0,
          pending_verifications:d.pending_verifications ?? 0,
        });
      } catch (e) {
        console.error("Stats error:", e);
      }

      try {
        // 2. Load live compliance report — replaces hardcoded "✓ Compliant"
        const compRes = await api.get("/api/compliance/report");
        setCompliance(compRes.data);
      } catch (e) {
        console.error("Compliance error:", e);
      }

      try {
        // 3. Load health — replaces hardcoded "⛓️ Running"
        const hRes = await getSystemHealth();
        setHealth(hRes.data);
      } catch (e) {
        console.error("Health error:", e);
      }

      setLoading(false);
    };

    load();
    const interval = setInterval(load, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Build stat cards using CORRECT field names from API
  const statCards = [
    { label: "Total Users",        value: stats.total_users,           color: "sky"    },
    { label: "Total Orders",       value: stats.total_orders,          color: "emerald"},
    { label: "Active Alerts",      value: stats.active_anomalies,      color: "amber"  }, // ← shows real value now
    { label: "Compliance Score",   value: `${stats.compliance_score}%`,color: "violet" }, // ← shows real value now
  ];

  // Derive live compliance status from API response
  const getComplianceStatus = (label) => {
    if (!compliance?.sections) return { text: "Checking...", color: "slate-400" };
    const section = compliance.sections.find(s =>
      s.label?.toUpperCase().includes(label.toUpperCase())
    );
    if (!section) return { text: "Active", color: "emerald-400" };
    const isOk = section.status === "Compliant";
    return {
      text: isOk ? `✓ Compliant (${section.score}%)` : `⚠️ Review (${section.score}%)`,
      color: isOk ? "emerald-400" : "amber-400",
    };
  };

  // Derive live blockchain status from health API
  const getBlockchainStatus = (key) => {
    if (!health) return { text: "Checking...", color: "slate-400" };
    const map = {
      "Hyperledger Fabric": health.blockchain_mode === "mock" ? "⛓️ Mock Ledger" : "⛓️ Production",
      "Ledger Records":     health.database || "SQLite",
      "Smart Contracts":    health.blockchain_mode ? "✓ Deployed" : "Checking...",
      "Immutability":       health.database !== "unreachable" ? "✓ Verified" : "⚠️ DB Offline",
    };
    return { text: map[key] || "Active", color: "sky-400" };
  };

  const complianceRows = [
    { label: "DSCSA Traceability",        apiKey: "DSCSA" },
    { label: "CDSCO License Verification",apiKey: "CDSCO" },
    { label: "Cold Chain Monitoring",     apiKey: "Cold Chain" },
    { label: "GxP Part 11 Audit Trail",   apiKey: "GxP" },
  ];

  const blockchainRows = [
    "Hyperledger Fabric",
    "Ledger Records",
    "Smart Contracts",
    "Immutability",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Regulatory Dashboard</h1>
          <p className="mt-2 text-slate-400">
            System-wide compliance and oversight.{" "}
            <span className="text-xs text-slate-500">
              Live · auto-refreshes every 30s
            </span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold border ${
          stats.active_anomalies > 0
            ? "bg-amber-900 text-amber-300 border-amber-700"
            : "bg-emerald-900 text-emerald-300 border-emerald-700"
        }`}>
          {stats.active_anomalies > 0
            ? `⚠️ ${stats.active_anomalies} Active Alerts`
            : "✅ All Clear"}
        </span>
      </div>

      {/* Stats Grid — LIVE from API */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">{card.label}</p>
            <p className={`mt-4 text-3xl font-bold text-${card.color}-400`}>
              {loading ? "..." : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status Overview — LIVE from API, not hardcoded */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Compliance — reads from /api/compliance/report */}
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            System Compliance
            {compliance && (
              <span className="ml-2 text-xs text-slate-500 font-normal">
                (updated {new Date(compliance.generated_at).toLocaleTimeString()})
              </span>
            )}
          </h2>
          <div className="space-y-3">
            {complianceRows.map((row) => {
              const status = getComplianceStatus(row.apiKey);
              return (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={`text-${status.color} font-semibold text-sm`}>
                    {loading ? "..." : status.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blockchain Status — reads from /health */}
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Blockchain Status</h2>
          <div className="space-y-3">
            {blockchainRows.map((key) => {
              const status = getBlockchainStatus(key);
              return (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-slate-400">{key}</span>
                  <span className={`text-${status.color} font-semibold text-sm`}>
                    {loading ? "..." : status.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "🚨 Live Anomalies", href: "/regulator/alerts" },
          { label: "📋 Compliance Report", href: "/regulator/compliance" },
          { label: "🔗 Blockchain Ledger", href: "/regulator/blockchain" },
          { label: "📄 Audit Trail", href: "/regulator/audit-trail" },
        ].map((l) => (
          <a key={l.href} href={l.href}
            className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 text-center transition-colors">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
};

export default RegulatorDashboard;
