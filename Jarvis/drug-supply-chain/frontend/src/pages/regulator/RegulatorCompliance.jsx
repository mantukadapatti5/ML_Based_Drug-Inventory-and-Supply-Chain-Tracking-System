import { useState, useEffect } from "react";
import { getComplianceReport } from "../../services/api";

const RegulatorCompliance = () => {
  const [sections, setSections] = useState([]);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    getComplianceReport()
      .then((res) => {
        setSections(res.data.sections || []);
        setGeneratedAt(res.data.generated_at || "");
      })
      .catch(console.error);
  }, []);

  const handleExportPDF = () => {
    // Feature #21 (PDF Generation): Download compliance report from backend
    window.open(`http://localhost:8000/api/admin/compliance/report/pdf`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-100">Compliance Reports</h1>
        <p className="mt-2 text-slate-400">DSCSA, CDSCO, and Cold Chain compliance status.</p>
      </div>

      {generatedAt && (
        <div className="text-sm text-slate-400">
          Last generated: {new Date(generatedAt).toLocaleString()}
        </div>
      )}

      {/* Compliance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-sm hover:border-slate-600"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
            <p
              className={`mt-4 text-3xl font-bold ${
                item.status === "Compliant" ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {item.status}
            </p>
            <p className="mt-2 text-sm text-slate-300">Score: {item.score}%</p>
            <p className="mt-2 text-xs text-slate-400">{item.details}</p>
          </div>
        ))}
      </div>

      {/* Export Button */}
      <div className="flex gap-4">
        <button
          onClick={handleExportPDF}
          className="rounded-2xl bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-700 transition-colors"
        >
          Export Full Report (PDF)
        </button>
      </div>

      {/* Regulatory Notes */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Regulatory Framework</h2>
        <div className="space-y-3 text-sm text-slate-400">
          <p>
            <strong className="text-slate-200">DSCSA (Drug Supply Chain Security Act):</strong> Requires
            traceability across all shipments with transaction history and verification.
          </p>
          <p>
            <strong className="text-slate-200">CDSCO (Central Drugs Standard Control Organisation):</strong> Enforces
            license verification and quality standards for all suppliers.
          </p>
          <p>
            <strong className="text-slate-200">Cold Chain Management:</strong> Continuous monitoring of
            temperature/humidity to maintain product efficacy and safety.
          </p>
          <p>
            <strong className="text-slate-200">GxP Part 11 Audit Trail:</strong> Immutable records on
            Hyperledger Fabric blockchain for regulatory evidence.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegulatorCompliance;
