-- PostgreSQL schema for Drug Supply Chain System

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(180) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    license_no VARCHAR(80),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drugs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    batch_no VARCHAR(120) NOT NULL UNIQUE,
    manufacturer VARCHAR(180) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vendor_id INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    location VARCHAR(180) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rfid_tag VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL REFERENCES users(id),
    distributor_id INTEGER NOT NULL REFERENCES users(id),
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    quantity INTEGER NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'Placed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    distributor_id INTEGER NOT NULL REFERENCES users(id),
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    quantity INTEGER NOT NULL,
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    amount NUMERIC(12, 2) NOT NULL
);

CREATE TABLE cold_chain_logs (
    id SERIAL PRIMARY KEY,
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    temperature NUMERIC(5, 2) NOT NULL,
    humidity NUMERIC(5, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    alert_triggered BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE anomaly_logs (
    id SERIAL PRIMARY KEY,
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    anomaly_type VARCHAR(120) NOT NULL,
    confidence_score NUMERIC(5, 2) NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_ratings (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL REFERENCES users(id),
    distributor_id INTEGER NOT NULL REFERENCES users(id),
    score NUMERIC(3, 2) NOT NULL,
    feedback VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_trail (
    id SERIAL PRIMARY KEY,
    action VARCHAR(180) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    entity VARCHAR(120) NOT NULL,
    entity_id INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blockchain_hash VARCHAR(128)
);

-- Phase 0 Data Security: transactional outbox (prevents data loss during outages)
CREATE TABLE IF NOT EXISTS outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  VARCHAR(64) NOT NULL,
    aggregate_id    VARCHAR(128) NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL,
    idempotency_key VARCHAR(256) UNIQUE NOT NULL,
    status          VARCHAR(20) DEFAULT 'PENDING',
    fabric_tx_id    VARCHAR(128) DEFAULT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    published_at    TIMESTAMPTZ DEFAULT NULL,
    confirmed_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status) WHERE status = 'PENDING';

-- Phase 7/8: GxP Part 11 append-only audit trail (FDA 21 CFR Part 11)
CREATE TABLE IF NOT EXISTS gxp_audit_trail (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username VARCHAR(100) NOT NULL,
    action_type VARCHAR(80) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    record_id VARCHAR(128) NOT NULL,
    pre_image JSONB,
    post_image JSONB NOT NULL,
    reason_notes VARCHAR(2000),
    electronic_signature_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(64),
    session_correlation_id VARCHAR(64),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gxp_audit_record ON gxp_audit_trail(record_id);
CREATE INDEX IF NOT EXISTS idx_gxp_audit_user ON gxp_audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_gxp_audit_timestamp ON gxp_audit_trail(timestamp DESC);

-- Production hardening: run backend/sql/gxp_hardening.sql after first deploy
