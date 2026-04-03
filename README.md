# Streetmp OS 🚀

**The AI Career Intelligence Platform — Phase 1 MVM**

> BYOK · Deterministic JSON · Full Cost Transparency

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10
- Docker Desktop (for PostgreSQL)

### 1. Environment Setup

```bash
# Copy the template and fill in your values
cp .env.example .env
```

**Required variables in `.env`:**

```bash
# Master encryption key (64-char hex)
STREETMP_MASTER_KEY=$(openssl rand -hex 32)

# JWT signing secret (min 32 chars)
JWT_SECRET=$(openssl rand -hex 32)

# Internal service authentication
INTERNAL_ROUTER_SECRET=$(openssl rand -hex 32)

# Database
DB_USER=streetmp
DB_PASS=your_secure_password
DB_NAME=streetmp_os
DB_HOST=localhost
DB_PORT=5432
```

> **Note:** This monorepo uses a single root `.env` file. All 5 microservices
> load it automatically via `@streetmp-os/config/env` — no scattered `.env` files.

### 2. Install Dependencies

```bash
npm install
```

### 3. Boot the Full Stack

```bash
# One command boots PostgreSQL + all 6 servers simultaneously
npm run dev
```

This executes:
1. `docker-compose up -d` → PostgreSQL on port 5432
2. `sleep 3` → Wait for Postgres to accept connections
3. `turbo run dev` → All 6 dev servers in parallel

---

## Service Architecture

```
Layer 1 (Next.js)
  └── apps/web                  → http://localhost:3000

Layer 2 (OS Kernel Microservices)
  ├── auth-service              → http://localhost:4001
  ├── vault-service             → http://localhost:4002
  ├── router-service            → http://localhost:4000
  ├── enforcer-service          → http://localhost:4003
  └── usage-service             → http://localhost:4004

Infrastructure
  └── postgres-vault (Docker)  ← localhost:5432
```

---

## Database Commands

```bash
npm run db:up      # Start PostgreSQL
npm run db:down    # Stop (data preserved)
npm run db:logs    # Tail PostgreSQL logs
npm run db:reset   # ⚠️  Wipe all data and restart
npm run db:shell   # psql interactive shell
```

---

## Development Commands

```bash
npm run dev            # Full stack (DB + all services)
npm run dev:services   # Services only (skip Docker)
npm run build          # Build all workspaces
npm run type-check     # TypeScript check all workspaces
npm run lint           # Lint all workspaces
npm run clean          # Clean all build artifacts
```

---

## Security

| Secret | How to Generate |
|--------|----------------|
| `STREETMP_MASTER_KEY` | `openssl rand -hex 32` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `INTERNAL_ROUTER_SECRET` | `openssl rand -hex 32` |

> ⚠️ **Never commit `.env` to version control.** It is in `.gitignore`.

---

## Phase 2 Roadmap

- [ ] httpOnly cookie auth (eliminate localStorage XSS exposure)
- [ ] Usage summary dashboard
- [ ] HCQ (Hallucination Correction Quotient) scoring
- [ ] Docker Compose for all services (full containerization)
- [ ] Rate limiting per tier (free: 100/day, pro: 10k/day)
