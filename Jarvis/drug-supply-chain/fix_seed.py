"""
Complete DB fix + seed script — run once to fix all loading... issues.
"""
import psycopg2
from datetime import datetime, timedelta

conn = psycopg2.connect("postgresql://jarvis_admin:SecretPassword123@localhost:5432/drug_supply_chain")
conn.autocommit = False
cur = conn.cursor()
now = datetime.now()

def run(sql, params=None, label=""):
    try:
        cur.execute(sql, params)
        conn.commit()
        print(f"  OK: {label or sql[:60]}")
        return True
    except Exception as e:
        conn.rollback()
        print(f"  Skip ({label}): {str(e)[:100]}")
        return False

print("\n1. Creating missing tables...")
run("""CREATE TABLE IF NOT EXISTS supplier_performance (
    id SERIAL PRIMARY KEY,
    supplier_id TEXT UNIQUE,
    supplier_name TEXT,
    rating_score REAL DEFAULT 4.5,
    on_time_delivery_pct REAL DEFAULT 95.0,
    cold_chain_compliance_score REAL DEFAULT 98.0,
    average_lead_time_days REAL DEFAULT 5.0,
    total_shipments INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    last_rating_date TEXT
)""", label="supplier_performance")

run("""CREATE TABLE IF NOT EXISTS stock_requests (
    id SERIAL PRIMARY KEY,
    drug_id INTEGER,
    drug_name TEXT,
    batch_no TEXT,
    quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    requested_by TEXT,
    distributor_id INTEGER,
    priority TEXT DEFAULT 'Normal',
    created_at TIMESTAMP DEFAULT NOW()
)""", label="stock_requests")

# Add missing columns
for col_sql in [
    "ALTER TABLE anomaly_logs ADD COLUMN IF NOT EXISTS batch_id TEXT",
    "ALTER TABLE anomaly_logs ADD COLUMN IF NOT EXISTS anomaly_score REAL DEFAULT 0.0",
    "ALTER TABLE anomaly_logs ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE anomaly_logs ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE anomaly_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'warning'",
    "ALTER TABLE anomaly_logs ALTER COLUMN confidence_score SET DEFAULT 0.0",
]:
    run(col_sql)

print("\n2. Seeding users...")
users = [
    (1, "System Admin",         "admin@gmail.com",  "admin@12",  "admin",       "ADM-2024-001"),
    (2, "PharmaPrime Vendor",   "vendor@gmail.com", "vendor@12", "vendor",      "VEN-2024-001"),
    (3, "MediHub Distributor",  "dis@gmail.com",    "dis@12",    "distributor", "DIS-2024-001"),
    (4, "CDSCO Regulator",      "reg@gmail.com",    "reg@12",    "regulator",   "REG-2024-001"),
]
import sys, os
sys.path.insert(0, r"c:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain")
os.chdir(r"c:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain")
from backend.services.security import get_password_hash
for uid, name, email, pwd, role, lic in users:
    run("""INSERT INTO users (id, name, email, password, role, license_no, verified)
           VALUES (%s,%s,%s,%s,%s,%s,true)
           ON CONFLICT (id) DO UPDATE SET password=EXCLUDED.password, verified=true""",
        (uid, name, email, get_password_hash(pwd), role, lic), f"user {email}")

print("\n3. Seeding drugs catalog...")
drugs = [
    (1,   "Amoxicillin 250mg",       "AMX-2024", "PharmaCorp",    "2027-12-31", 1000, 15.5,  2),
    (2,   "Paracetamol 500mg",       "PAR-2024", "MediSource",    "2027-06-15", 800,   9.0,  2),
    (3,   "Insulin Glargine",         "INS-2024", "HealthWave",    "2027-01-20", 400,  45.0,  2),
    (156, "Cold Chain Vaccine Serum", "C-003",    "Biomed Labs",   "2027-08-14", 500, 250.0,  2),
    (157, "Paracetamol Infusion Pack","P-911",    "Apex Health",   "2028-01-20", 750,  45.0,  2),
    (158, "Amoxicillin 500mg",        "A-441",    "PharmaPrime",   "2027-06-30", 620, 120.0,  2),
    (159, "Azithromycin 250mg",       "AZ-201",   "MediCore",      "2027-09-15", 300,  85.0,  2),
    (160, "Metformin 500mg",          "MF-330",   "Cadila Health", "2028-03-01", 900,  30.0,  2),
    (161, "Atorvastatin 10mg",        "AT-100",   "Sun Pharma",    "2028-06-01", 1200, 55.0,  2),
    (162, "Omeprazole 20mg",          "OM-200",   "Cipla Ltd",     "2028-03-15", 850,  28.0,  2),
    (163, "Amlodipine 5mg",           "AM-050",   "Lupin Pharma",  "2028-09-01", 700,  38.0,  2),
    (164, "Metronidazole 400mg",      "MT-400",   "MediCore",      "2027-11-01", 600,  18.0,  2),
    (165, "Cetirizine 10mg",          "CZ-100",   "Cadila Health", "2028-01-01", 1000, 12.0,  2),
    (166, "Pantoprazole 40mg",        "PT-400",   "Sun Pharma",    "2028-07-01", 750,  42.0,  2),
    (167, "Clopidogrel 75mg",         "CL-750",   "Lupin Pharma",  "2028-05-01", 400,  88.0,  2),
    (168, "Glibenclamide 5mg",        "GL-050",   "PharmaCorp",    "2028-02-01", 500,  22.0,  2),
    (169, "Doxycycline 100mg",        "DX-100",   "MediSource",    "2028-04-01", 350,  65.0,  2),
    (170, "Ranitidine 150mg",         "RN-150",   "HealthWave",    "2027-10-01", 900,  15.0,  2),
]
for d in drugs:
    run("""INSERT INTO drugs (id,name,batch_no,manufacturer,expiry_date,quantity,price,vendor_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""", d, f"drug {d[1]}")

print("\n4. Seeding anomaly logs...")
anomalies = [
    ("BATCH-A01", 1,   "TEMPERATURE_BREACH",   0.92, 0.88, "ACTIVE",   False, "Temperature 8.5C exceeded 2-8C limit",    "critical"),
    ("PAR-2024",  2,   "DEMAND_SPIKE",          0.78, 0.74, "ACTIVE",   False, "Sales 350% above 7-day forecast",         "warning"),
    ("INS-2024",  3,   "EXPIRY_RISK",           0.88, 0.85, "ACTIVE",   False, "37 days to expiry, 180 units remaining",  "critical"),
    ("C-003",     156, "COLD_CHAIN_BREACH",     0.71, 0.68, "RESOLVED", True,  "Humidity exceeded 75% for 20 minutes",   "warning"),
    ("A-441",     158, "SUPPLY_CHAIN_ANOMALY",  0.65, 0.60, "ACTIVE",   False, "Unusual order pattern detected",          "warning"),
]
for i, (bid,did,atype,score,conf,status,resolved,notes,sev) in enumerate(anomalies):
    run("""INSERT INTO anomaly_logs
           (batch_id,drug_id,anomaly_type,anomaly_score,confidence_score,
            status,resolved,notes,triggered_at,severity)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (bid,did,atype,score,conf,status,resolved,notes, now-timedelta(hours=i*3), sev),
        f"anomaly {atype}")

print("\n5. Seeding supplier performance...")
suppliers = [
    ("SUPP-001","PharmaPrime Global",   4.8, 97.0, 98.5, 3.2, 48, 46),
    ("SUPP-002","MediSource India",     4.5, 93.2, 96.1, 5.1, 32, 30),
    ("SUPP-003","HealthWave Pharma",    4.2, 88.7, 94.3, 6.4, 21, 19),
    ("SUPP-004","Apex Health Solutions",4.7, 96.5, 97.8, 4.0, 38, 37),
    ("SUPP-005","Cadila Health Ltd",    4.0, 85.0, 91.2, 7.5, 15, 13),
]
for s in suppliers:
    run("""INSERT INTO supplier_performance
           (supplier_id,supplier_name,rating_score,on_time_delivery_pct,
            cold_chain_compliance_score,average_lead_time_days,
            total_shipments,successful_deliveries)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
           ON CONFLICT (supplier_id) DO UPDATE SET rating_score=EXCLUDED.rating_score""",
        s, f"supplier {s[1]}")

print("\n6. Seeding inventory expiry batches...")
expiry = [
    ("BATCH-A01","1",  "Amoxicillin 250mg",      (now+timedelta(days=10)).date(), 10, 220, "Cold-A"),
    ("PAR-2024", "2",  "Paracetamol 500mg",      (now+timedelta(days=16)).date(), 16,  95, "Dry-B"),
    ("INS-2024", "3",  "Insulin Glargine",        (now+timedelta(days=37)).date(), 37, 180, "Cold-B"),
    ("C-003",    "156","Cold Chain Vaccine Serum",(now+timedelta(days=55)).date(), 55, 500, "Cold-A"),
    ("P-911",    "157","Paracetamol Infusion",    (now+timedelta(days=18)).date(), 18, 200, "Dry-A"),
    ("A-441",    "158","Amoxicillin 500mg",       (now+timedelta(days=45)).date(), 45, 620, "WH-A"),
    ("MF-330",   "160","Metformin 500mg",         (now+timedelta(days=120)).date(),120,900, "WH-B"),
]
for b in expiry:
    run("""INSERT INTO inventory_expiry
           (batch_id,drug_id,drug_name,expiry_date,days_until_expiry,quantity_units,storage_zone)
           VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (batch_id) DO NOTHING""", b, f"expiry {b[0]}")

print("\n7. Seeding orders...")
orders = [
    (156, 200, "DELIVERED",         3, 2, "2026-07-01 10:00:00", "TX-DEMO-001"),
    (158, 500, "PENDING_APPROVAL",  3, 2, "2026-07-05 14:30:00", "TX-DEMO-002"),
    (157, 100, "IN_TRANSIT",        3, 2, "2026-07-07 09:15:00", "TX-DEMO-003"),
    (160, 300, "DELIVERED",         3, 2, "2026-07-08 16:00:00", "TX-DEMO-004"),
    (159, 150, "PENDING_APPROVAL",  3, 2, "2026-07-09 08:00:00", "TX-DEMO-005"),
]
for drug_id,qty,status,dist,vid,created,bc in orders:
    run("""INSERT INTO orders (drug_id,quantity,status,distributor_id,vendor_id,blockchain_order_id,created_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (drug_id,qty,status,dist,vid,bc,created), f"order {status}")

print("\n8. Seeding sales...")
sales = [(3,156,200,50000.0),(3,157,500,5625.0),(3,158,100,12000.0),(3,160,300,9000.0),(3,159,80,6800.0)]
for dist,drug,qty,amt in sales:
    run("INSERT INTO sales (distributor_id,drug_id,quantity,amount,sale_date) VALUES (%s,%s,%s,%s,NOW())",
        (dist,drug,qty,amt), f"sale drug {drug}")

print("\n9. Seeding shipments...")
for sid,st,ori,dest in [("SHIP-001","In Transit","Delhi Warehouse","Mumbai Hub"),
                         ("SHIP-002","Delivered","Mumbai DC","Pune Clinic"),
                         ("SHIP-003","Ordered","Bangalore Facility","Chennai Depot")]:
    run("INSERT INTO shipments (id,status,origin,destination) VALUES (%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
        (sid,st,ori,dest), f"shipment {sid}")

print("\n10. Seeding stock requests...")
for did,dn,qty,by in [(156,"Cold Chain Vaccine Serum",100,"distributor"),
                       (158,"Amoxicillin 500mg",250,"distributor"),
                       (157,"Paracetamol Infusion",180,"distributor")]:
    run("INSERT INTO stock_requests (drug_id,drug_name,quantity,status,requested_by,distributor_id,created_at) VALUES (%s,%s,%s,'PENDING',%s,3,NOW())",
        (did,dn,qty,by), f"request {dn}")

print("\n=== FINAL ROW COUNTS ===")
for tbl in ["users","drugs","orders","sales","anomaly_logs","supplier_performance",
            "inventory_expiry","shipments","stock_requests"]:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        print(f"  {tbl}: {cur.fetchone()[0]} rows")
    except Exception as e:
        conn.rollback()
        print(f"  {tbl}: ERROR {e}")

cur.close()
conn.close()
print("\nSEED COMPLETE! All panels should now load data.")
