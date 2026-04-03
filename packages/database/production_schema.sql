-- Identity & RBAC Support
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  sessionToken TEXT NOT NULL UNIQUE,
  userId INTEGER NOT NULL,
  expires TIMESTAMP NOT NULL
);

-- Telemetry & Execution Tracking
CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantId INTEGER NOT NULL,
  model TEXT NOT NULL,
  trustScore FLOAT NOT NULL,
  cost FLOAT NOT NULL,
  latencyMs INTEGER NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pii_events (
  id SERIAL PRIMARY KEY,
  executionId UUID REFERENCES executions(id),
  type TEXT NOT NULL,
  masked BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_events (
  id SERIAL PRIMARY KEY,
  executionId UUID REFERENCES executions(id),
  rule TEXT NOT NULL,
  action TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Onboarding Update
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login_complete BOOLEAN DEFAULT FALSE NOT NULL;
