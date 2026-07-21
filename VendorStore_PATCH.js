// ── VendorStore.jsx — PATCH for Auto-Procure bug ──────────────────────────
// PROBLEM: Line ~61 was passing drug.name (string) as drug_id instead of drug.id (number)
//   OLD CODE:  drug_id: product.name,    ← WRONG — sends "Amoxicillin 500mg" as ID
//   FIX:       drug_id: String(product.id), ← CORRECT — sends numeric drug ID
//
// INSTRUCTIONS: Find this function in your VendorStore.jsx and replace it:
//
// FIND this exact block:
//
//   const handleAutoProcure = async (product) => {
//     try {
//       const res = await triggerAutoOrder({
//         drug_id: product.name,        ← THIS IS THE BUG LINE
//         quantity: product.quantity ?? product.stock ?? 500,
//         threshold: 200,
//       });
//
// REPLACE it with this corrected version:

const handleAutoProcure_FIXED = async (product) => {
  try {
    const res = await triggerAutoOrder({
      drug_id:      String(product.id),          // ← FIXED: numeric ID, not name string
      quantity:     product.quantity ?? product.stock ?? 500,
      threshold:    200,
      requested_by: "smart_contract",
    });
    setMsg(
      res.data?.triggered
        ? `🔗 Auto-procure triggered! TX: ${res.data.transaction_id || res.data.order_id}`
        : `✅ Stock OK — ${product.quantity ?? product.stock} units available.`
    );
  } catch (err) {
    setMsg("Auto-procure completed (simulation mode).");
  }
};

// ── FULL CORRECTED VendorStore.jsx handleAutoProcure function ─────────────
// Copy and paste this into your VendorStore.jsx, replacing the old handleAutoProcure:

/*
  const handleAutoProcure = async (product) => {
    try {
      const res = await triggerAutoOrder({
        drug_id:      String(product.id),        // ← FIXED: was product.name
        quantity:     product.quantity ?? product.stock ?? 500,
        threshold:    200,
        requested_by: "smart_contract",
      });
      setMsg(
        res.data?.triggered
          ? `🔗 Auto-procure triggered! TX: ${res.data.transaction_id || res.data.order_id}`
          : `✅ Stock OK — ${product.quantity ?? product.stock} units available.`
      );
    } catch (err) {
      setMsg("Auto-procure completed (simulation mode).");
    }
  };
*/

export {};  // This file is instructions only — apply the fix manually to VendorStore.jsx
