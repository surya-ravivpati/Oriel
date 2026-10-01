import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { authed, json, parseBody } from "@/lib/api/http";
import { parseJobDescription } from "@/lib/ai/analyzers";
import { getLanguageModel } from "@/lib/ai/providers/registry";
import { recordTokenCost } from "@/lib/costs/record";
import { logEvent } from "@/lib/costs/events";

const Body = z.object({ text: z.string().trim().min(40, "Paste the job description (at least a few lines)").max(30000) });

export const POST = authed(async (req, { user }) => {
  const { text } = await parseBody(req, Body);
  const llm = getLanguageModel();
  const parsed = await parseJobDescription(llm, text);
  if (parsed.usage) recordTokenCost({ userId: user.id }, llm.id, "analysis", "jd_parser", parsed.usage);
  logEvent("llm_output", "jd_parser", { userId: user.id, durationMs: parsed.latencyMs, data: { source: parsed.source, competencies: parsed.data.competencies, error: parsed.error ?? null } });
  const db = getDb();
  const id = newId("jd");
  db.transaction((tx) => {
    tx.update(schema.jobDescriptions).set({ isActive: false }).where(and(eq(schema.jobDescriptions.userId, user.id), eq(schema.jobDescriptions.isActive, true))).run();
    tx.insert(schema.jobDescriptions).values({ id, userId: user.id, rawText: text, parsed: parsed.data }).run();
  });
  return json({ id, parsed: parsed.data });
}, { limit: 10 });
