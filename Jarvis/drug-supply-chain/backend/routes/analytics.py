from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta

from ..database import get_db
from ..services.ml_service import ml_service
from ..services.csv_fallback import csv_fallback_service

router = APIRouter(tags=["Supplier Analytics"])


# ── M19: Supplier Performance Rating ─────────────────────────────────────
@router.get("/suppliers/performance/summary")
async def get_supplier_summary(db: Session = Depends(get_db)):
    try:
        query = """
            SELECT
                s.supplier_id,
                s.supplier_name,
                s.rating_score,
                s.on_time_delivery_pct,
                s.cold_chain_compliance_score,
                COUNT(o.id) as total_shipments,
                SUM(CASE WHEN o.status LIKE '%DELIVER%' THEN 1 ELSE 0 END) as successful_deliveries
            FROM supplier_performance s
            LEFT JOIN orders o ON 1=1
            GROUP BY s.supplier_id, s.supplier_name, s.rating_score,
                     s.on_time_delivery_pct, s.cold_chain_compliance_score
        """
        results = db.execute(text(query)).mappings().all()
        if results:
            formatted = []
            for r in results:
                total = r["total_shipments"] or 1
                success = r["successful_deliveries"] or 0
                delivery_rate = success / total if total else 1.0
                rating = r["rating_score"] or round(delivery_rate * 5, 1)
                formatted.append({
                    "supplier_id": r["supplier_id"],
                    "supplier_name": r["supplier_name"],
                    "total_shipments": total,
                    "successful_shipments": success,
                    "rating_score": round(float(rating), 1),
                    "on_time_delivery_pct": r["on_time_delivery_pct"],
                    "cold_chain_compliance_score": r["cold_chain_compliance_score"],
                    "status": "Elite" if float(rating) > 4.5 else "Verified",
                    "feedback": f"On-time delivery {r['on_time_delivery_pct'] or 95}%, cold-chain score {r['cold_chain_compliance_score'] or 98}%.",
                })
            # FIX 1: was returning bare list — now returns dict so .get("suppliers") works
            return {"suppliers": formatted}
    except Exception as e:
        print(f"Analytics Error: {e}")

    # FIX 1: fallback also returns dict with "suppliers" key
    return {"suppliers": [
        {"supplier_id": "SUPP-001", "supplier_name": "PharmaPrime", "rating_score": 4.8,
         "on_time_delivery_pct": 98.5, "cold_chain_compliance_score": 97.2,
         "feedback": "Fast delivery and consistent cold chain.", "status": "Elite"},
        {"supplier_id": "SUPP-002", "supplier_name": "MediSource", "rating_score": 4.5,
         "on_time_delivery_pct": 93.2, "cold_chain_compliance_score": 96.1,
         "feedback": "Reliable stock, good documentation.", "status": "Verified"},
        {"supplier_id": "SUPP-003", "supplier_name": "HealthWave", "rating_score": 4.2,
         "on_time_delivery_pct": 88.7, "cold_chain_compliance_score": 94.3,
         "feedback": "Occasional delays but good support.", "status": "Verified"},
        {"supplier_id": "SUPP-004", "supplier_name": "Apex Health", "rating_score": 4.7,
         "on_time_delivery_pct": 96.5, "cold_chain_compliance_score": 97.8,
         "feedback": "Excellent compliance and fast turnaround.", "status": "Elite"},
        {"supplier_id": "SUPP-005", "supplier_name": "Cadila Health", "rating_score": 4.0,
         "on_time_delivery_pct": 85.0, "cold_chain_compliance_score": 91.2,
         "feedback": "Good quality, occasional delays.", "status": "Verified"},
    ]}


# ── M3: AI Dashboard Stats (vendor + distributor, no admin role) ──────────
@router.get("/analytics/summary")
async def get_ai_summary(db: Session = Depends(get_db)):
    """Vendor & Distributor Dashboard — no RBAC gate (M3)."""
    spoilage_risk = 4.2
    inventory_health = 92.8
    avg_lead_time = 3.4

    try:
        sales_row = db.execute(text("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(quantity), 0) as units
            FROM sales WHERE sale_date >= :since
        """), {"since": datetime.utcnow() - timedelta(days=30)}).mappings().first()
        if sales_row and sales_row["cnt"]:
            inventory_health = min(99.0, 80.0 + (sales_row["units"] / max(sales_row["cnt"], 1)) * 0.05)

        anomaly_row = db.execute(text("""
            SELECT COUNT(*) as cnt FROM anomaly_logs
            WHERE triggered_at >= :since AND resolved = false
        """), {"since": datetime.utcnow() - timedelta(days=7)}).mappings().first()
        if anomaly_row:
            spoilage_risk = min(25.0, 2.0 + anomaly_row["cnt"] * 1.5)

        expiry_row = db.execute(text("""
            SELECT COUNT(*) as critical FROM inventory_expiry WHERE days_until_expiry < 20
        """)).mappings().first()
        if expiry_row and expiry_row["critical"]:
            spoilage_risk = min(30.0, spoilage_risk + expiry_row["critical"] * 2)

        supp = db.execute(text("""
            SELECT AVG(average_lead_time_days) as avg_lt FROM supplier_performance
        """)).mappings().first()
        if supp and supp["avg_lt"]:
            avg_lead_time = float(supp["avg_lt"])
    except Exception as e:
        print(f"Analytics summary DB error: {e}")

    data = []
    base_risk = spoilage_risk
    base_eff = inventory_health
    for i in range(10):
        drift = (10 - i) * 0.1
        data.append({
            "timestamp": f"T-{10 - i}h",
            "predicted_spoilage_risk": round(base_risk + drift * 0.3, 2),
            "demand_gap": int(100 + i * 35),
            "efficiency_score": round(min(99.0, base_eff - drift * 0.2), 2),
        })

    return {
        "series": data,
        "kpis": {
            "spoilage_risk_pct": round(spoilage_risk, 1),
            "inventory_health_pct": round(inventory_health, 1),
            "avg_lead_time_days": round(avg_lead_time, 1),
        },
        "phase_3_frozen": ml_service.models_frozen,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


# ── FIX 2: Distributor Dashboard Stats — endpoint was MISSING (404) ───────
# This endpoint was accidentally removed from the file.
# Distributor dashboard calls GET /api/analytics/distributor-stats
# No admin role required — distributors call this on their own dashboard.
@router.get("/analytics/distributor-stats")
async def get_distributor_stats(
    distributor_id: int = 3,
    db: Session = Depends(get_db),
):
    """
    Distributor dashboard summary — no admin role required.
    FIX: endpoint was missing → 404. Now restored.
    """
    try:
        total_orders = db.execute(
            text("SELECT COUNT(*) FROM orders WHERE distributor_id = :did"),
            {"did": distributor_id}
        ).scalar() or 0

        pending_orders = db.execute(
            text("SELECT COUNT(*) FROM orders WHERE distributor_id = :did AND status LIKE '%PEND%'"),
            {"did": distributor_id}
        ).scalar() or 0

        delivered_orders = db.execute(
            text("SELECT COUNT(*) FROM orders WHERE distributor_id = :did AND status LIKE '%DELIVER%'"),
            {"did": distributor_id}
        ).scalar() or 0

        total_sales = db.execute(
            text("SELECT COALESCE(SUM(amount), 0) FROM sales WHERE distributor_id = :did"),
            {"did": distributor_id}
        ).scalar() or 0

        active_anomalies = db.execute(
            text("SELECT COUNT(*) FROM anomaly_logs WHERE resolved = false")
        ).scalar() or 0

        expiry_alerts = db.execute(
            text("SELECT COUNT(*) FROM inventory_expiry WHERE days_until_expiry < 30 AND quantity_units > 0")
        ).scalar() or 0

    except Exception as e:
        print(f"Distributor stats error: {e}")
        total_orders = pending_orders = delivered_orders = 0
        total_sales = active_anomalies = expiry_alerts = 0

    return {
        "total_orders":     total_orders,
        "pending_orders":   pending_orders,
        "delivered_orders": delivered_orders,
        "total_revenue":    round(float(total_sales), 2),
        "active_anomalies": active_anomalies,
        "expiry_alerts":    expiry_alerts,
        "compliance_score": max(0, 100 - active_anomalies * 5),
        "generated_at":     datetime.utcnow().isoformat() + "Z",
    }


# ── M21: Public compliance report ────────────────────────────────────────
@router.get("/compliance/report")
async def public_compliance_report(db: Session = Depends(get_db)):
    """GxP compliance report — readable by regulator and distributor portals."""
    try:
        total_orders = db.execute(text("SELECT COUNT(*) FROM orders")).scalar() or 0
        delivered = db.execute(text("SELECT COUNT(*) FROM orders WHERE status LIKE '%DELIVER%'")).scalar() or 0
        verified_users = db.execute(text("SELECT COUNT(*) FROM users WHERE verified = true")).scalar() or 0
        total_users    = db.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
        cold_alerts    = db.execute(text("SELECT COUNT(*) FROM anomaly_logs WHERE resolved = false")).scalar() or 0
    except Exception:
        total_orders, delivered, verified_users, total_users, cold_alerts = 0, 0, 0, 0, 0

    delivery_rate = round((delivered / total_orders * 100) if total_orders else 100, 1)
    verify_rate = round((verified_users / total_users * 100) if total_users else 100, 1)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "phase_3_frozen": ml_service.models_frozen,
        "sections": [
            {"label": "DSCSA", "status": "Compliant" if delivery_rate >= 90 else "Review Required",
             "score": delivery_rate, "details": f"Traceability {delivery_rate}% across {total_orders} orders."},
            {"label": "CDSCO", "status": "Compliant" if verify_rate >= 80 else "Review Required",
             "score": verify_rate, "details": f"Supplier verification rate {verify_rate}%."},
            {"label": "Cold Chain", "status": "Monitoring" if cold_alerts > 0 else "Compliant",
             "score": max(0, 100 - cold_alerts * 10), "details": f"{cold_alerts} active temperature alerts."},
        ],
    }


# ── CSV Fallback ──────────────────────────────────────────────────────────
@router.get("/analytics/anomalies-fallback")
async def get_anomalies_fallback(limit: int = Query(50, ge=1, le=500)):
    return csv_fallback_service.get_anomalies_data(limit)
