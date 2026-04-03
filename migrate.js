const fs = require('fs');
const { Client } = require('pg');

async function run() {
  console.log("=== EXECUTING MIGRATIONS ===");
  const client = new Client({
    connectionString: "postgresql://streetmp:streetmp_dev_password@localhost:5432/streetmp_os?connect_timeout=5"
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    const migrations = [
      'apps/os-kernel/services/router-service/src/sentinel/migrations/004_usage_plans_and_quotas.sql',
      'apps/os-kernel/services/router-service/src/sentinel/migrations/007_titan_hq.sql',
      // And the auto-generated one for execution_costs
      'packages/database/migrations/20260403_execution_costs.sql'
    ];

    for (const file of migrations) {
      if (fs.existsSync(file)) {
        console.log(`Executing ${file}...`);
        const sql = fs.readFileSync(file, 'utf8');
        await client.query(sql);
        console.log(`✅ Success: ${file}`);
      } else {
        console.log(`⚠️ Missing file: ${file}`);
      }
    }
  } catch (err) {
    console.error("Migration execution failed:", err.message);
  } finally {
    await client.end().catch(()=>{});
  }
}
run();
