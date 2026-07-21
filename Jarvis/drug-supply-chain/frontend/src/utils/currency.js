/** Format amounts in Indian Rupees (en-IN locale). */
export const formatINR = (amount) => {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatINRCompact = (amount) => {
  const value = Number(amount) || 0;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

/** Extract user-visible message from API errors (avoids React crash on object detail). */
export const apiErrorMessage = (err, fallback = "Request failed.") => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  if (detail && typeof detail === "object") return detail.message || JSON.stringify(detail);
  return err?.message || fallback;
};
