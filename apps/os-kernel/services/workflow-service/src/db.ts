import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Default connection string if not provided in env for local testing
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/streetmp';

export const db = new Pool({
  connectionString,
  max: 20, // max number of clients in the pool
  idleTimeoutMillis: 30000
});

// Test DB Connection
db.connect()
  .then(() => console.log('✅ Workflow Service connected to StreetMP DB'))
  .catch((err) => console.error('❌ DB Connection Error:', err));
