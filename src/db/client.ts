import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as schema from "./schema";
import { seedCatalog } from "./catalog-seed";

/*
 * One database, two homes. Locally (and in tests) a SQLite file; deployed, a Turso database
 * (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN), which speaks the same SQL. Queries are async either way.
 *
 * Before the first query runs, migrations are applied and the catalog is seeded: every query made
 * through `getDb()` waits for that, so callers never see a half-built schema.
 *
 * Deletion relies on ON DELETE CASCADE, so foreign keys must be on. Locally the client keeps a
 * single connection and the pragma is set on it once; Turso enforces foreign keys itself, and the
 * startup check below reports loudly if it ever doesn't.
 */

export type DB = LibSQLDatabase<typeof schema>;

const g = globalThis as unknown as { __orielDb?: DB; __orielReady?: Promise<void>; __orielClient?: Client };

function url(): { url: string; authToken?: string; remote: boolean } {
  if (process.env.TURSO_DATABASE_URL) return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN, remote: true };
  const file = databasePath();
  if (file === ":memory:") {
    // Tests: an isolated file per process (an in-memory database can't be shared across a pool).
    const tmp = path.join(os.tmpdir(), `oriel-test-${process.pid}-${Math.random().toString(36).slice(2)}.db`);
    return { url: `file:${tmp}`, remote: false };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return { url: `file:${file}`, remote: false };
}

export function databasePath() {
  // Ignored by build tracing so a local database is never packaged into a deployment.
  return process.env.DATABASE_PATH ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "oriel.db");
}

/** A client whose queries wait until the database is ready. */
function gated(raw: Client, ready: Promise<void>): Client {
  const waits = new Set(["execute", "batch", "transaction", "executeMultiple", "migrate"]);
  return new Proxy(raw, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && waits.has(prop) && typeof v === "function") {
        return async (...args: unknown[]) => { await ready; return (v as (...a: unknown[]) => unknown).apply(target, args); };
      }
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

function open() {
  const cfg = url();
  // One connection locally: transactions serialise and pragmas stick.
  const raw = createClient({ url: cfg.url, authToken: cfg.authToken, concurrency: cfg.remote ? undefined : 1 });
  const setupDb = drizzle(raw, { schema });
  const ready = (async () => {
    if (!cfg.remote) {
      await raw.execute("PRAGMA journal_mode = WAL");
      await raw.execute("PRAGMA busy_timeout = 5000");
      await raw.execute("PRAGMA foreign_keys = ON");
    }
    await migrate(setupDb, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    await seedCatalog(setupDb);
    const fk = await raw.execute("PRAGMA foreign_keys");
    if (Number(fk.rows[0]?.[0] ?? 0) !== 1) console.error("[db] foreign keys are OFF: deletions will not cascade. Enable foreign keys on this database.");
  })();
  ready.catch((e) => console.error("[db] setup failed", e));
  return { db: drizzle(gated(raw, ready), { schema }), ready, raw };
}

/** Process-wide DB handle (survives Next dev hot reloads). Queries wait for migrations. */
export function getDb(): DB {
  if (!g.__orielDb) {
    const o = open();
    g.__orielDb = o.db;
    g.__orielReady = o.ready;
    g.__orielClient = o.raw;
  }
  return g.__orielDb;
}

/** Resolves once migrations and the catalog seed have run. */
export async function dbReady(): Promise<void> {
  getDb();
  await g.__orielReady;
}

export { schema };
