# EDUK8U Ecosystem — Lead QA Master Handover Dossier

**Prepared for:** Ameer Danial (`amerdnl`), Lead QA Engineer  
**Role:** Independent Quality Assurance & Release Validation  
**Release Target:** Release 1.0 Milestone  
**Generated Date:** September 30, 2026  

---

## 📌 Executive QA Navigation Index

Welcome Ameer. To eliminate any ambiguity across the different platforms, repositories, and servers in our ecosystem, this document provides the single source of truth for your QA assessment.

### System Mapping Matrix

| System | Role in Organization | Live URL | Repository Link | Primary Test Suite |
|---|---|---|---|---|
| **1. EDUK8U Work Placement Platform** | Australian RTO vocational placement & compliance engine (ASQA 2025 compliant) | [`http://64.176.80.212:8080`](http://64.176.80.212:8080) | [`DheGad/eduk8ulabs`](https://github.com/DheGad/eduk8ulabs) | [`EDUK8U_WORK_PLACEMENT_PLATFORM.md`](./EDUK8U_WORK_PLACEMENT_PLATFORM.md) |
| **2. FLOW OS Kernel** | Enterprise orchestration, BullMQ background engine, AI gateway | Monorepo Engine | [`DheGad/eduk8ulabs`](https://github.com/DheGad/eduk8ulabs) | Turborepo Test Suite (`npm test`) |
| **3. HRManager4U.ai** | AI-powered HR platform with MY/AU statutory legal compliance radar | [`http://66.42.62.57`](http://66.42.62.57) | [`DheGad/hrmanager`](https://github.com/DheGad/hrmanager) | [HRManager4U QA Guide](https://github.com/DheGad/hrmanager/blob/main/QA_HANDOVER_GUIDE.md) |

---

## 🔍 Part A: Testing EDUK8U Work Placement (Live VPS: 64.176.80.212:8080)

### 1. Test Accounts
- **Super Admin:** `admin@eduk8u.edu.au` / `Admin@123456`
- **College Admin:** `college@eduk8u.edu.au` / `College@123456`
- **Trainer:** `trainer@eduk8u.edu.au` / `Trainer@123456`
- **Student:** `student@eduk8u.edu.au` / `Student@123456`
- **Supervisor:** `supervisor@eduk8u.edu.au` / `Supervisor@123456`

### 2. High-Priority QA Checkpoints
- [ ] **Cross-Role Isolation:** Verify that Student cannot access Admin or Trainer endpoints.
- [ ] **Geofencing:** Confirm that placement hours submissions check GPS coordinates against host facility latitude/longitude.
- [ ] **Digital Signatures:** Confirm SVG/Base64 digital signature capture on placement agreements and timesheets.
- [ ] **ASQA Audit Readiness:** Validate that the system generates immutable audit events for every status transition.
- [ ] **Zero 500 Errors:** Verify console health across all primary views.

---

## 🔍 Part B: Testing HRManager4U.ai (Live VPS: 66.42.62.57)

### 1. Test Accounts
- **Primary Admin:** `admin@democorp.com` / `DemoCorp@2026`
- **System Admin:** `admin@hrmanager4u.ai` / `Password123!`

### 2. High-Priority QA Checkpoints
- [ ] **Negative Auth:** Confirm that invalid passwords display proper error messages without unhandled exceptions.
- [ ] **9-Step Onboarding Wizard:** Verify draft auto-saving and server-side state persistence.
- [ ] **Employee 360° Profile:** Verify that the employee timeline renders audit records dynamically.
- [ ] **Compliance Radar:** Inspect legal rule calculation (Malaysia Employment Act 1955 vs Australia Fair Work).
- [ ] **Human-in-the-Loop AI:** Confirm that AI queries require human approval before mutating system state.

---

## 📋 Defect Severity Classification

When logging defects in GitHub Issues, please follow these standardized severity levels:

- **P0 (Blocker):** Data loss, security breach, authentication failure, or unhandled 500 error preventing core user workflow.
- **P1 (Critical):** Key business rule calculation error (e.g. incorrect compliance score or timesheet calculation).
- **P2 (Major):** UI component failure or responsive design breakdown on standard viewports (Desktop/Tablet/Mobile).
- **P3 (Minor):** Typographical issues, cosmetic alignment, or non-blocking performance latency.

Thank you for your rigorous QA review!
