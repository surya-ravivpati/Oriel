import "server-only";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { tokenCost, PRICES } from "./pricing";

export interface Usage { model: string; inputTokens: number; outputTokens: number }
export interface CostScope { userId?: string | null; sessionId?: string | null }

export function recordTokenCost(scope: CostScope, provider: string, category: string, operation: string, usage: Usage) {
  const usd = tokenCost(usage.model, usage.inputTokens, usage.outputTokens);
  const db = getDb();
  const base = { userId: scope.userId ?? null, sessionId: scope.sessionId ?? null, provider: `${provider}:${usage.model}`, category, operation };
  db.insert(schema.costRecords).values([
    { id: newId("cst"), ...base, units: usage.inputTokens, unitName: "input_tokens", usd: tokenCost(usage.model, usage.inputTokens, 0) },
    { id: newId("cst"), ...base, units: usage.outputTokens, unitName: "output_tokens", usd: usd - tokenCost(usage.model, usage.inputTokens, 0) },
  ]).run();
  return usd;
}

export function recordUnitCost(scope: CostScope, provider: string, category: string, operation: string, units: number, unitName: string, usd: number) {
  getDb().insert(schema.costRecords).values({
    id: newId("cst"), userId: scope.userId ?? null, sessionId: scope.sessionId ?? null, provider, category, operation, units, unitName, usd,
  }).run();
}

export function avatarMinuteRate(provider: string) {
  return PRICES[provider]?.perMinute ?? 0;
}
