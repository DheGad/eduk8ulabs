# EDUK8U Ecosystem & FLOW OS — Master Enterprise Platform

[![Architecture](https://img.shields.io/badge/Architecture-Turborepo%20Monorepo-blue.svg)](https://turbo.build/)
[![Live Target](https://img.shields.io/badge/Production%20Live-http%3A%2F%2F64.176.80.212%3A8080-brightgreen.svg)](http://64.176.80.212:8080)
[![Compliance](https://img.shields.io/badge/Compliance-ASQA%20%7C%20Standards%20for%20RTOs%202025-blueviolet.svg)](#-project-1-eduk8u-work-placement-intelligence-platform-release-10)
[![Lead QA](https://img.shields.io/badge/Lead%20QA-Ameer%20Danial-orange.svg)](#-qa-validation-handover-for-ameer-danial)

---

## 🎯 Master Navigation: Solving QA & Stakeholder Ambiguity

To ensure immediate clarity for **Ameer Danial (Lead QA Engineer)**, technical leadership, and auditors, this repository serves as the **Master Core Monorepo for the EDUK8U and FLOW OS Technology Stack**.

The platform ecosystem comprises three clearly delineated projects:

| # | Project Name | Description & Primary Focus | Target Environment & URL | Repository / Location | Dedicated Documentation |
|---|---|---|---|---|---|
| **1** | **EDUK8U Work Placement Platform** | Australian RTO Work Placement Intelligence & Compliance Platform (Standards for RTOs 2025, CRICOS 500). Full logbooks, student/trainer/supervisor portals, and ASQA audit exports. | **Live Production VPS:**<br>[`http://64.176.80.212:8080`](http://64.176.80.212:8080) | `DheGad/eduk8ulabs`<br>*(Branch: `release/eduk8u-work-placement-v1.0`)* | [`EDUK8U_WORK_PLACEMENT_PLATFORM.md`](./EDUK8U_WORK_PLACEMENT_PLATFORM.md) |
| **2** | **FLOW OS (Enterprise Kernel)** | Declarative state-machine orchestration engine, AI Gateway, BullMQ background processor, Titan HQ, and cryptographic execution verifier. | **Turborepo Monorepo:**<br>`apps/os-kernel`, `packages/workflow-engine` | `DheGad/eduk8ulabs`<br>*(Branch: `main`)* | [`QA_MASTER_HANDOVER_GUIDE.md`](./QA_MASTER_HANDOVER_GUIDE.md) |
| **3** | **HRManager4U.ai** | Multi-tenant AI-Powered Global Human Resource & Statutory Compliance Management Platform (Malaysia Employment Act 1955 & AU Fair Work Act 2009). | **Live Production VPS:**<br>[`http://66.42.62.57`](http://66.42.62.57) | [`DheGad/hrmanager`](https://github.com/DheGad/hrmanager)<br>*(Branch: `main`)* | [HRManager4U QA Guide](https://github.com/DheGad/hrmanager/blob/main/QA_HANDOVER_GUIDE.md) |

---

## 🏛️ Project 1: EDUK8U Work Placement Intelligence Platform (Release 1.0)

The **EDUK8U Work Placement Intelligence Platform** is fully deployed, active, and operational at:
👉 **[`http://64.176.80.212:8080`](http://64.176.80.212:8080)**

### 🔑 Verified Demo Credentials for Independent QA Validation

All five user tiers are pre-seeded in the live production PostgreSQL database:

| Role | Email | Password | Primary QA Verification Focus |
|---|---|---|---|
| **Super Admin** | `admin@eduk8u.edu.au` | `Admin@123456` | Full platform governance, tenant configuration, system logs, master compliance audits. |
| **College Admin** | `college@eduk8u.edu.au` | `College@123456` | RTO institution management, student enrolments, course setup, trainer allocations. |
| **Trainer / Assessor** | `trainer@eduk8u.edu.au` | `Trainer@123456` | Student competency assessments, logbook reviews, workplace visit audits, verification sign-offs. |
| **Student** | `student@eduk8u.edu.au` | `Student@123456` | Placement onboarding, geofenced timesheet check-in, competency evidence uploads, supervisor signatures. |
| **Host Supervisor** | `supervisor@eduk8u.edu.au` | `Supervisor@123456` | Host facility profile, timesheet approvals, weekly student performance evaluations. |

*For complete end-to-end testing workflows and API schemas, see [`EDUK8U_WORK_PLACEMENT_PLATFORM.md`](./EDUK8U_WORK_PLACEMENT_PLATFORM.md).*

---

## ⚡ Project 2: FLOW OS — Enterprise Orchestration & Sovereign Kernel

FLOW OS is built inside this monorepo as a high-performance **Turborepo** architecture designed to coordinate work between disparate enterprise applications without replacing them.

### Monorepo Structure

```text
eduk8ulabs/ (FLOW OS Monorepo)
├── apps/
│   ├── api-gateway/       # Stateless ingress & rate-limiting proxy
│   ├── os-kernel/         # Core orchestration services (Router, Sentinel, Usage, Policy)
│   ├── titan-hq/          # Administrative & Sovereign command center
│   ├── web/               # Next.js frontend dashboard (Workflow visualizer, Approvals)
│   └── nemo-guard/        # Model safety and injection firewall
└── packages/
    ├── database/          # Prisma database client & multi-tenant isolation
    ├── workflow-engine/   # Deterministic state-machine runner & verifier
    ├── streetmp-sdk/      # TypeScript SDK for external application integration
    ├── vault-pro/         # Zero-knowledge cryptographic document storage
    └── security-pro/      # AES-256-GCM encryption & audit hashing
```

---

## 📋 Project 3: HRManager4U.ai

HRManager4U.ai is hosted in its dedicated repository [`DheGad/hrmanager`](https://github.com/DheGad/hrmanager) and live at [`http://66.42.62.57`](http://66.42.62.57). 

- **Primary Demo Login:** `admin@democorp.com` / `DemoCorp@2026`
- **Modules Under Test:** 9-Step Onboarding Wizard, Employee 360° Dossier, Statutory Compliance Radar (MY/AU), Leave Ledger, and Human-in-the-Loop AI Assistant.

---

## 🧑‍💻 QA Validation Handover for Ameer Danial

Refer to [`QA_MASTER_HANDOVER_GUIDE.md`](./QA_MASTER_HANDOVER_GUIDE.md) for the centralized, cross-project QA test execution checklists, expected results, defect severity ratings, and acceptance reporting guidelines.
