import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;

const EXPECTED_TABLES = [
  "waitlist_leads",
  "farmers",
  "produce_listings",
  "reservations",
  "agent_call_requests",
];

function safeDbUrl(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("ERROR: SUPABASE_DB_URL is not set.");
    process.exit(1);
  }
  return url;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`;
  } catch {
    return "[invalid url]";
  }
}

async function getClient(): Promise<pg.Client> {
  const url = safeDbUrl();
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected to database:", maskUrl(url));
  return client;
}

function sqlFilePath(name: string): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, "../../supabase", name);
}

async function runSqlFile(client: pg.Client, filename: string): Promise<void> {
  const filePath = sqlFilePath(filename);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: SQL file not found: ${filePath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(filePath, "utf-8");
  console.log(`Running ${filename}...`);
  try {
    await client.query(sql);
    console.log(`${filename} completed successfully.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ERROR running ${filename}: ${msg}`);
    await client.end();
    process.exit(1);
  }
}

async function verifyTables(client: pg.Client): Promise<void> {
  console.log("\nVerifying RaithuFresh tables...");
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const existing = rows.map((r) => r.tablename);

  let allOk = true;
  for (const table of EXPECTED_TABLES) {
    if (existing.includes(table)) {
      console.log(`  [OK] ${table}`);
    } else {
      console.error(`  [MISSING] ${table}`);
      allOk = false;
    }
  }

  const unexpected = existing.filter(
    (t) => !EXPECTED_TABLES.includes(t) && !t.startsWith("_")
  );
  if (unexpected.length > 0) {
    console.log(`  [INFO] Other tables present (not RaithuFresh): ${unexpected.join(", ")}`);
  }

  if (!allOk) {
    console.error("\nERROR: Some RaithuFresh tables are missing. Run db:schema first.");
    process.exit(1);
  }
  console.log("\nAll RaithuFresh tables verified successfully.");
}

async function countRows(client: pg.Client): Promise<void> {
  console.log("\nRow counts:");
  for (const table of EXPECTED_TABLES) {
    try {
      const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ${table}: ${rows[0].count} rows`);
    } catch {
      console.log(`  ${table}: (could not count)`);
    }
  }
}

const command = process.argv[2];

async function main() {
  const client = await getClient();
  try {
    if (command === "schema") {
      await runSqlFile(client, "schema.sql");
    } else if (command === "seed") {
      await runSqlFile(client, "seed.sql");
    } else if (command === "setup") {
      await runSqlFile(client, "schema.sql");
      await runSqlFile(client, "seed.sql");
    } else if (command === "verify") {
      await verifyTables(client);
      await countRows(client);
    } else {
      console.error(`Unknown command: ${command}`);
      console.error("Usage: tsx src/db-setup.ts schema|seed|setup|verify");
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
