import { useState, useEffect, useRef } from "react";
import { verifyBatch, getProvenance } from "../../services/api";

/**
 * REAL QR Code Scanner using device camera.
 * Uses html5-qrcode library — works on laptop camera and phone camera.
 *
 * Install: npm install html5-qrcode
 *
 * This replaces the fake text-input verification with actual camera scanning.
 * When a drug box QR code is scanned, it automatically calls the blockchain
 * verification endpoint and shows the full 6-step provenance trail.
 */

const STATUS_COLORS = {
  MANUFACTURED:  "bg-blue-100 text-blue-700 border-blue-200",
  QC_TESTED:     "bg-purple-100 text-purple-700 border-purple-200",
  DISPATCHED:    "bg-amber-100 text-amber-700 border-amber-200",
  IN_TRANSIT:    "bg-sky-100 text-sky-700 border-sky-200",
  RECEIVED:      "bg-teal-100 text-teal-700 border-teal-200",
  VERIFIED:      "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const EVENT_ICONS = {
  MANUFACTURED: "🏭",
  QC_TESTED:    "🔬",
  DISPATCHED:   "📦",
  IN_TRANSIT:   "🚚",
  RECEIVED:     "📥",
  VERIFIED:     "✅",
};

const QRScanner = () => {
  const [scanning, setScanning]         = useState(false);
  const [scannedId, setScannedId]       = useState("");
  const [manualId, setManualId]         = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [provenance, setProvenance]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [cameraError, setCameraError]   = useState("");
  const scannerRef                      = useRef(null);
  const html5QrRef                      = useRef(null);

  // ── Start real camera QR scanning ────────────────────────────────────
  const startCamera = async () => {
    setCameraError("");
    setError("");
    setVerifyResult(null);
    setProvenance([]);

    try {
      // Dynamically import html5-qrcode so it doesn't break if not installed
      const { Html5Qrcode } = await import("html5-qrcode");

      if (html5QrRef.current) {
        await html5QrRef.current.stop().catch(() => {});
      }

      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;
      setScanning(true);

      await scanner.start(
        { facingMode: "environment" }, // use back camera on phone
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // QR code successfully scanned
          setScannedId(decodedText);
          setScanning(false);
          await scanner.stop();
          await verifyDrug(decodedText);
        },
        (errorMessage) => {
          // Scanning frame errors are normal — ignore them
        }
      );
    } catch (err) {
      setScanning(false);
      if (err.message?.includes("html5-qrcode")) {
        setCameraError(
          "QR library not installed. Run: npm install html5-qrcode"
        );
      } else if (err.name === "NotAllowedError") {
        setCameraError(
          "Camera access denied. Please allow camera permission and try again."
        );
      } else if (err.name === "NotFoundError") {
        setCameraError(
          "No camera found. Use manual entry below to enter batch ID."
        );
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  };

  // ── Stop camera ───────────────────────────────────────────────────────
  const stopCamera = async () => {
    if (html5QrRef.current) {
      await html5QrRef.current.stop().catch(() => {});
    }
    setScanning(false);
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ── Verify drug on blockchain ─────────────────────────────────────────
  const verifyDrug = async (batchId) => {
    if (!batchId.trim()) {
      setError("Please enter or scan a batch ID.");
      return;
    }
    setLoading(true);
    setError("");
    setVerifyResult(null);
    setProvenance([]);

    try {
      // Call blockchain verification endpoint
      const verifyRes = await verifyBatch(batchId.trim());
      setVerifyResult(verifyRes.data);

      // Get full 6-step provenance trail
      const provRes = await getProvenance(batchId.trim());
      const trail =
        provRes.data?.provenance_trail ||
        provRes.data?.events ||
        [];
      setProvenance(trail);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Verification failed. Check backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setScannedId(manualId);
    verifyDrug(manualId);
  };

  const reset = () => {
    setScannedId("");
    setManualId("");
    setVerifyResult(null);
    setProvenance([]);
    setError("");
    setCameraError("");
    stopCamera();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Drug Batch Verification
        </h1>
        <p className="mt-1 text-slate-500">
          Scan a drug QR code with your camera or enter the batch ID manually
          to verify authenticity via blockchain.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Scanner */}
        <div className="space-y-4">
          {/* Camera QR Scanner */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📷 Camera QR Scanner
            </h2>

            {/* Camera viewfinder */}
            <div
              id="qr-reader"
              ref={scannerRef}
              className={`w-full rounded-2xl overflow-hidden border-2 ${
                scanning
                  ? "border-teal-400 bg-black"
                  : "border-dashed border-slate-300 bg-slate-50"
              }`}
              style={{ minHeight: "250px" }}
            >
              {!scanning && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <svg
                    className="w-16 h-16 mb-3 text-slate-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M3 3h6v6H3V3zm0 12h6v6H3v-6zm12-12h6v6h-6V3zm0 12h6v6h-6v-6zM9 9h1v1H9V9zm5 0h1v1h-1V9zm-5 5h1v1H9v-1zm5 0h1v1h-1v-1z"
                    />
                  </svg>
                  <p className="text-sm font-medium">Camera preview appears here</p>
                  <p className="text-xs mt-1">Click Start Camera to scan</p>
                </div>
              )}
            </div>

            {/* Camera error */}
            {cameraError && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                ⚠️ {cameraError}
              </div>
            )}

            {/* Scanner buttons */}
            <div className="mt-4 flex gap-3">
              {!scanning ? (
                <button
                  onClick={startCamera}
                  className="flex-1 rounded-2xl bg-teal-600 text-white py-3 font-semibold hover:bg-teal-700 transition-colors"
                >
                  📷 Start Camera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex-1 rounded-2xl bg-red-600 text-white py-3 font-semibold hover:bg-red-700 transition-colors"
                >
                  ⏹ Stop Camera
                </button>
              )}
            </div>

            {/* Scanning status */}
            {scanning && (
              <div className="mt-3 flex items-center gap-2 text-teal-600 text-sm font-medium">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
                </span>
                Scanning... Point camera at QR code on drug box
              </div>
            )}
          </div>

          {/* Manual Entry */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              ⌨️ Manual Entry
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Try: C-003 · AMX-2024 · A-441 · BAT-2026-0001
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value.toUpperCase())}
                placeholder="Enter Batch ID (e.g. C-003)"
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={loading || !manualId.trim()}
                className="rounded-2xl bg-slate-900 text-white px-5 py-2.5 font-semibold text-sm hover:bg-slate-800 disabled:opacity-50"
              >
                Verify
              </button>
            </form>

            {scannedId && (
              <div className="mt-3 flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-2">
                <p className="text-sm text-teal-700">
                  Scanned: <span className="font-mono font-bold">{scannedId}</span>
                </p>
                <button
                  onClick={reset}
                  className="text-xs text-teal-500 hover:text-teal-700 underline"
                >
                  Clear
                </button>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                ❌ {error}
              </div>
            )}
          </div>
        </div>

        {/* Right: Verification Result */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Verification Result
          </h2>

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4" />
              <p className="text-sm">Verifying on Hyperledger Fabric...</p>
            </div>
          )}

          {!loading && !verifyResult && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300 text-center px-8">
              <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <p className="text-slate-400">
                Scan a QR code or enter a batch ID to verify drug authenticity
              </p>
            </div>
          )}

          {!loading && verifyResult && (
            <div className="space-y-4">
              {/* Valid/Invalid badge */}
              <div
                className={`rounded-2xl p-4 flex items-center gap-4 ${
                  verifyResult.is_valid
                    ? "bg-emerald-50 border border-emerald-300"
                    : "bg-red-50 border border-red-300"
                }`}
              >
                <div
                  className={`h-14 w-14 rounded-full flex items-center justify-center text-2xl shrink-0 ${
                    verifyResult.is_valid ? "bg-emerald-500" : "bg-red-500"
                  }`}
                >
                  {verifyResult.is_valid ? "✓" : "✗"}
                </div>
                <div>
                  <p className={`text-xl font-bold ${verifyResult.is_valid ? "text-emerald-700" : "text-red-700"}`}>
                    {verifyResult.is_valid ? "Authentic Drug" : "Verification Failed"}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    Batch: {verifyResult.batch_id}
                  </p>
                  {verifyResult.tx_hash && (
                    <p className="text-xs font-mono text-slate-400 truncate max-w-xs">
                      TX: {verifyResult.tx_hash?.slice(0, 20)}...
                    </p>
                  )}
                </div>
              </div>

              {/* Drug details */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Drug Name",     verifyResult.drug_name],
                  ["Manufacturer",  verifyResult.manufacturer],
                  ["Expiry Date",   verifyResult.expiry_date?.slice(0, 10)],
                  ["Blockchain",    verifyResult.blockchain],
                  ["Verified At",   verifyResult.verified_at
                    ? new Date(verifyResult.verified_at).toLocaleTimeString("en-IN")
                    : "—"],
                  ["Status",        verifyResult.current_status || "VERIFIED"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5 truncate">
                      {value || "—"}
                    </p>
                  </div>
                ))}
              </div>

              {/* 6-step Provenance Trail */}
              {provenance.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                    Blockchain Provenance Trail ({provenance.length} events)
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {provenance.map((step, idx) => {
                      const evtType = step.event_type || step.event || "EVENT";
                      const statusCls = STATUS_COLORS[evtType] || "bg-slate-100 text-slate-600 border-slate-200";
                      const icon = EVENT_ICONS[evtType] || "📋";
                      return (
                        <div
                          key={idx}
                          className="relative pl-8 pb-3 border-l-2 border-slate-100 last:border-0"
                        >
                          <div className="absolute -left-[11px] top-0 h-5 w-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-xs">
                            {icon}
                          </div>
                          <div className={`rounded-xl border px-3 py-2 ${statusCls}`}>
                            <p className="text-xs font-bold">{evtType.replace(/_/g, " ")}</p>
                            <p className="text-xs mt-0.5 opacity-80">
                              {step.location} · {step.actor_role || step.actor}
                            </p>
                            <p className="text-xs font-mono opacity-60 mt-0.5 truncate">
                              TX: {step.tx_hash?.slice(0, 20)}...
                            </p>
                            {step.timestamp && (
                              <p className="text-xs opacity-50 mt-0.5">
                                {new Date(step.timestamp).toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={reset}
                className="w-full rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Verify Another Drug
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Installation note */}
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
        <p className="font-bold mb-1">📦 One-time setup required:</p>
        <p>Run this in your frontend folder: <code className="bg-white rounded px-2 py-0.5 font-mono text-xs">npm install html5-qrcode</code></p>
        <p className="mt-1 text-xs text-blue-500">
          Works with laptop camera and phone camera. Scans any QR code — drug boxes, printed QR codes, phone screen QR codes.
        </p>
      </div>
    </div>
  );
};

export default QRScanner;
