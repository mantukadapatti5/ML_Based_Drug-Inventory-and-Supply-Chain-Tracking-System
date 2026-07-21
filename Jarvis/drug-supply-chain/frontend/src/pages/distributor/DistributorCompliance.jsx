import { useState, useEffect } from "react";
import { getComplianceReport } from "../../services/api";

const DistributorCompliance = () => {
  const [sections, setSections] = useState([]);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    getComplianceReport().then((res) => {
      setSections(res.data.sections || []);
      setGeneratedAt(res.data.generated_at || "");
    }).catch(console.error);
  }, []);

  const handleExportPDF = () => {
    // Feature #21 (PDF Generation): Download cryptographically secure ReportLab document from backend
    // Direct window query to functional FastAPI binary reporting engine
    window.open(`http://localhost:8000/api/admin/compliance/report/pdf`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Regulatory Compliance Report</h1>
        <p className="mt-2 text-slate-600">DSCSA / CDSCO / Cold Chain status from live system data.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
            <p className={`mt-4 text-3xl font-bold ${item.status === "Compliant" ? "text-emerald-600" : "text-amber-600"}`}>{item.status}</p>
            <p className="mt-2 text-sm text-slate-600">Score: {item.score}%</p>
            <p className="mt-2 text-xs text-slate-500">{item.details}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <button type="button" onClick={handleExportPDF} className="rounded-2xl bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-700">Export PDF Report</button>
      </div>
    </div>
  );
};

export default DistributorCompliance;
