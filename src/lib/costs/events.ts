import "server-only";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";

export type EventType = "decision" | "latency" | "error" | "llm_output" | "fallback" | "pipeline" | "provider" | "training";

/** Structured event for the admin/debug console. Never throws, and never makes the caller wait. */
export function logEvent(type: EventType, name: string, opts: { sessionId?: string | null; userId?: string | null; durationMs?: number; data?: Record<string, unknown> } = {}) {
  try {
    void getDb().insert(schema.providerEvents).values({
      id: newId("evt"), type, name, sessionId: opts.sessionId ?? null, userId: opts.userId ?? null,
      durationMs: opts.durationMs === undefined ? null : Math.round(opts.durationMs), data: opts.data ?? null,
    }).run().catch((err: unknown) => console.error("[events] failed", type, name, err));
  } catch (err) {
    console.error("[events] failed", type, name, err);
  }
}
