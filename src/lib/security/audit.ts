import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";

export function audit(action: string, opts: { userId?: string | null; target?: string; ip?: string | null; data?: Record<string, unknown> } = {}) {
  try {
    getDb().insert(schema.auditLogs).values({
      id: newId("aud"), action, userId: opts.userId ?? null, target: opts.target ?? null,
      ip: opts.ip ?? null, data: opts.data ?? null,
    }).run();
  } catch (err) {
    console.error("[audit] failed to write", action, err);
  }
}
