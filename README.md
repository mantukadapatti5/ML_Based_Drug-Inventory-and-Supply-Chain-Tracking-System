# 💊 ML-Based Drug Inventory & Supply Chain Tracking System

A full-stack pharmaceutical supply-chain management platform designed to provide **end-to-end visibility of drug inventory, distribution, cold-chain conditions, anomaly detection, QR-based verification, and supply-chain operations**.

The system combines a modern web dashboard with backend APIs, machine-learning/data-analysis capabilities, real-time/telemetry-oriented infrastructure, CSV fallback data services, and role-based dashboards for different supply-chain stakeholders.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Problem Statement](#-problem-statement)
- [Objectives](#-objectives)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Application Modules](#-application-modules)
- [User Roles](#-user-roles)
- [Machine Learning & Analytics](#-machine-learning--analytics)
- [Cold Chain & IoT](#-cold-chain--iot)
- [Blockchain & QR Verification](#-blockchain--qr-verification)
- [CSV Fallback Architecture](#-csv-fallback-architecture)
- [Data Sources](#-data-sources)
- [Backend Architecture](#-backend-architecture)
- [Frontend Architecture](#-frontend-architecture)
- [Infrastructure](#-infrastructure)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Running the Application](#-running-the-application)
- [Docker Setup](#-docker-setup)
- [Environment Configuration](#-environment-configuration)
- [Testing](#-testing)
- [Application Workflow](#-application-workflow)
- [Data Flow](#-data-flow)
- [Security](#-security)
- [Fallback & Fault Tolerance](#-fallback--fault-tolerance)
- [Performance](#-performance)
- [Current Implementation Status](#-current-implementation-status)
- [Known Limitations](#-known-limitations)
- [Future Enhancements](#-future-enhancements)
- [Use Cases](#-use-cases)
- [Project Highlights](#-project-highlights)
- [License](#-license)
- [Author](#-author)

---

# 🚀 Overview

The **ML-Based Drug Inventory & Supply Chain Tracking System** is a pharmaceutical supply-chain management application intended to improve visibility and traceability throughout the lifecycle of medicines.

The platform brings together multiple supply-chain activities into a unified dashboard:

- Drug inventory management
- Product and batch tracking
- Supplier/distributor operations
- Cold-chain monitoring
- Anomaly detection
- QR-code based drug verification
- Blockchain-oriented transaction tracking
- Supply-chain analytics
- Role-based dashboards
- CSV-based data fallback
- Real-time infrastructure support
- Administrative reporting

The project is implemented as a web-based application with a **React/Vite frontend** and **Python/FastAPI backend**, with additional infrastructure support for PostgreSQL, InfluxDB, MongoDB, Kafka/Redpanda and MQTT through Docker.

---

# 🎯 Problem Statement

Pharmaceutical supply chains involve multiple stakeholders and require reliable tracking of:

1. Drug batches
2. Inventory quantities
3. Expiry information
4. Distribution activities
5. Storage conditions
6. Temperature and humidity
7. Suspicious or anomalous activities
8. Product authenticity
9. Supply-chain events
10. Data consistency across different systems

Traditional systems can suffer from:

- Fragmented data
- Poor visibility across supply-chain stages
- Delayed anomaly identification
- Lack of centralized monitoring
- Difficulty tracking environmental conditions
- Database availability issues
- Manual verification of drug batches

This project addresses these challenges by providing a centralized digital platform for pharmaceutical inventory and supply-chain monitoring.

---

# 🎯 Objectives

The major objectives of the system are:

- Build a centralized pharmaceutical supply-chain platform.
- Track drugs and batches across supply-chain stages.
- Monitor inventory and stock levels.
- Monitor cold-chain conditions such as temperature and humidity.
- Detect potentially anomalous supply-chain activities.
- Provide QR-based drug/batch verification.
- Provide blockchain-oriented traceability.
- Provide role-specific dashboards.
- Provide analytics and reporting.
- Support fallback data sources when the primary database is unavailable.
- Create an architecture that can be extended toward real-time IoT and event-stream processing.

---

# ✨ Key Features

## 📦 Drug Inventory Management

The system provides inventory visibility for pharmaceutical products.

Features include:

- Drug/product information
- Batch information
- Stock quantities
- Expiry information
- Inventory dashboards
- Inventory APIs
- CSV fallback inventory data
- Supplier/distributor inventory visibility

---

## 🚚 Supply Chain Tracking

The platform is designed around pharmaceutical supply-chain movement.

Supply-chain stages can include:

```text
Manufacturer
     ↓
Supplier
     ↓
Distributor
     ↓
Warehouse
     ↓
Pharmacy / Healthcare Facility
     ↓
Patient / End User
