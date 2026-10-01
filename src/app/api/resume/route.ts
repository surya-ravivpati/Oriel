import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { authed, HttpError, json } from "@/lib/api/http";
import { extractDocumentText } from "@/server/documents/extract";
import { parseResume } from "@/lib/ai/analyzers";
import { getLanguageModel } from "@/lib/ai/providers/registry";
import { recordTokenCost } from "@/lib/costs/record";
import { logEvent } from "@/lib/costs/events";
import { audit } from "@/lib/security/audit";

/** Upload (multipart "file") or paste (multipart "text") a resume; returns the parsed structure. */
export const POST = authed(async (req, { user }) => {
  const form = await req.formData().catch(() => { throw new HttpError(400, "Expected a form upload"); });
  const file = form.get("file");
  const pasted = form.get("text");
  let rawText: string;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  if (file instanceof File && file.size > 0) {
    rawText = await extractDocumentText(file);
    fileName = file.name.slice(0, 200);
    mimeType = file.type || null;
  } else if (typeof pasted === "string" && pasted.trim().length >= 40) {
    rawText = pasted.trim().slice(0, 40000);
  } else {
    throw new HttpError(400, "Add a resume file or paste at least a few lines of text");
  }
  const llm = getLanguageModel();
  const parsed = await parseResume(llm, rawText);
  if (parsed.usage) recordTokenCost({ userId: user.id }, llm.id, "analysis", "resume_parser", parsed.usage);
  logEvent("llm_output", "resume_parser", { userId: user.id, durationMs: parsed.latencyMs, data: { source: parsed.source, roles: parsed.data.roles.length, error: parsed.error ?? null } });
  const db = getDb();
  const id = newId("res");
  db.transaction((tx) => {
    tx.update(schema.resumes).set({ isActive: false }).where(and(eq(schema.resumes.userId, user.id), eq(schema.resumes.isActive, true))).run();
    tx.insert(schema.resumes).values({ id, userId: user.id, fileName, mimeType, rawText, parsed: parsed.data }).run();
  });
  audit("resume.upload", { userId: user.id, target: id, data: { fileName, chars: rawText.length } });
  return json({ id, parsed: parsed.data, chars: rawText.length });
}, { limit: 10 });
