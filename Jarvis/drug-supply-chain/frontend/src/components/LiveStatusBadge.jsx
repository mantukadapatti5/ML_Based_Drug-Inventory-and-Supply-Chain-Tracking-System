const STYLES = {
  LIVE: {
    label: "LIVE",
    wrap: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
  },
  SYNC: {
    label: "SYNC",
    wrap: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    ping: "bg-amber-400",
  },
  STALE: {
    label: "STALE",
    wrap: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    ping: "bg-red-400",
  },
  ALERT: {
    label: "ALERT",
    wrap: "bg-red-100 text-red-800 border-red-300",
    dot: "bg-red-600",
    ping: "bg-red-500",
  },
};

export default function LiveStatusBadge({ status = "SYNC", className = "" }) {
  const theme = STYLES[status] || STYLES.SYNC;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${theme.wrap} ${className}`}
      title={`Connection status: ${theme.label}`}
    >
      <span className="relative flex h-3 w-3">
        {(status === "LIVE" || status === "ALERT") && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.ping}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${theme.dot}`} />
      </span>
      [{theme.label}]
    </div>
  );
}
