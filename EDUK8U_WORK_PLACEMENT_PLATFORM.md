# EDUK8U Work Placement Intelligence Platform — Release 1.0 Specification & QA Guide

**Target Application:** Australian RTO Work Placement Intelligence & Compliance Platform  
**Compliance Standards:** ASQA Standards for RTOs 2025, National Vocational Education and Training Regulator Act 2011, CRICOS 500  
**Live Production URL:** [`http://64.176.80.212:8080`](http://64.176.80.212:8080)  
**Lead QA Engineer:** Ameer Danial (`amerdnl`)  

---

## 1. System Architecture & Live Infrastructure

The EDUK8U Work Placement platform is deployed in a hardened containerized stack on Vultr VPS (`64.176.80.212`):

```text
Internet
   │
   ▼ (Port 8080)
┌────────────────────────────────────────────────────────┐
│ Nginx Reverse Proxy (eduk8u_prod_nginx)               │
├──────────────────────────┬─────────────────────────────┤
│                          │                             │
│ /api/*                   │ /* (Static Assets & SPA)    │
▼                          ▼                             │
┌────────────────────────┐ ┌───────────────────────────┐ │
│ Express API Service    │ │ Vite/React 19 SPA         │ │
│ (eduk8u_prod_api:3000) │ │ (eduk8u_prod_frontend:80) │ │
└──────────┬─────────────┘ └───────────────────────────┘ │
           │                                             │
           ▼                                             │
┌────────────────────────┐                               │
│ PostgreSQL 15 Database │                               │
│ (eduk8u_prod_db:5432)  │                               │
└────────────────────────┘                               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Pre-Seeded Test Credentials

The database is pre-populated with active demonstration accounts for immediate role validation:

| User Tier | Email | Password | Role Description |
|---|---|---|---|
| **Super Admin** | `admin@eduk8u.edu.au` | `Admin@123456` | Platform-wide administration, tenant lifecycle, global audits |
| **College Admin** | `college@eduk8u.edu.au` | `College@123456` | RTO institution management, courses, student enrolments |
| **Trainer / Assessor** | `trainer@eduk8u.edu.au` | `Trainer@123456` | Student assessments, logbook approvals, workplace site visits |
| **Student** | `student@eduk8u.edu.au` | `Student@123456` | Placement onboarding, hours logging, geofenced attendance |
| **Host Supervisor** | `supervisor@eduk8u.edu.au` | `Supervisor@123456` | Host facility supervisor, weekly sign-offs, performance ratings |

---

## 3. End-to-End QA Test Journeys

### Journey 1: College Admin Course & Placement Workflow Setup
1. Log in as `college@eduk8u.edu.au` / `College@123456`.
2. Navigate to **Workflows / Courses**.
3. Verify course configuration (e.g. *CHC33021 Certificate III in Individual Support* with 120 required placement hours).
4. Verify required documentation steps:
   - Police Check (CA 0391)
   - Working With Children Check (WWCC)
   - NDIS Worker Screening Check
   - Immunisation & Vaccination Evidence

### Journey 2: Host Employer Accreditation (Form CA 0393)
1. Navigate to **Host Employers / Facilities**.
2. Open **St Jude Aged Care Centre**.
3. Inspect the **Suitability Assessment**:
   - Physical Environment Score (1–5)
   - Supervision Ratio & Capacity
   - Public Liability Insurance ($20M AUD policy)
   - Workplace Agreement (Form CA 0316) status: `ACTIVE`

### Journey 3: Student Geofenced Attendance & Hours Logging
1. Log in as `student@eduk8u.edu.au` / `Student@123456`.
2. Navigate to **My Placement / Timesheets**.
3. Log hours with activities (e.g., *Personal Care Support, Meal Delivery*).
4. Verify geofence coordinate matching against facility GPS boundaries.
5. Check progress bar: Accumulated vs. Required Hours (e.g. 84 / 120 hrs).

### Journey 4: Supervisor Digital Verification
1. Log in as `supervisor@eduk8u.edu.au` / `Supervisor@123456`.
2. Navigate to **Pending Verifications**.
3. Review student timesheets and logbook entries.
4. Execute digital signature sign-off.
5. Verify status shifts to `VERIFIED` and cannot be modified by student.

### Journey 5: Trainer Competency Sign-Off & ASQA Compliance Export
1. Log in as `trainer@eduk8u.edu.au` / `Trainer@123456`.
2. Open Student Assessment Portfolio.
3. Review competency units:
   - `CHCCCS015`: Provide individualised support
   - `CHCCCS011`: Meet personal support needs
   - `HLTWHS002`: Follow safe work practices for direct client care
4. Execute Trainer Competency Determination (`SATISFACTORY`).
5. Click **Export ASQA Audit Pack** (Generates compliant PDF + Cryptographic Audit Manifest).

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate user & return JWT token |
| `GET` | `/api/v1/tenants/current` | Retrieve active RTO tenant details |
| `GET` | `/api/v1/placements` | List all student placements |
| `GET` | `/api/v1/placements/:id` | Retrieve placement details with hours summary |
| `POST` | `/api/v1/placements/:id/hours` | Log student placement hours |
| `PATCH` | `/api/v1/placement-hours/:id/verify`| Host supervisor verification |
| `GET` | `/api/v1/host-facilities` | List accredited host facilities |
| `GET` | `/api/v1/compliance/radar` | Real-time ASQA compliance risk calculation |
| `GET` | `/api/v1/audit/logs` | Immutable audit trail query |
