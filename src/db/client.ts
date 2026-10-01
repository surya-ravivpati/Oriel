import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seedCatalog } from "./catalog-seed";

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __orielDb?: DB; __orielSqlite?: Database.Database };

function open(file: string): { db: DB; sqlite: Database.Database } {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  seedCatalog(db);
  return { db, sqlite };
}

export function databasePath() {
  // Ignored by build tracing so a local database is never packaged into a deployment.
  return process.env.DATABASE_PATH ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "oriel.db");
}

/** Process-wide DB handle (survives Next dev hot reloads). */
export function getDb(): DB {
  if (!globalForDb.__orielDb) {
    const { db, sqlite } = open(databasePath());
    globalForDb.__orielDb = db;
    globalForDb.__orielSqlite = sqlite;
  }
  return globalForDb.__orielDb;
}

/** Fresh isolated database for tests. */
export function createTestDb(): DB {
  return open(":memory:").db;
}

/** Allows tests to inject an in-memory database as the process-wide handle. */
export function setDbForTesting(db: DB) {
  globalForDb.__orielDb = db;
}

export { schema };
