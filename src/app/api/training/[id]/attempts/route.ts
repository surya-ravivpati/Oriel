import { z } from "zod";
import { authed, json, parseBody, type IdParams } from "@/lib/api/http";
import { submitAttempt } from "@/server/training/service";

const Body = z.object({
  response: z.string().trim().min(1, "We didn't get an answer. Try again.").max(12000),
  inputMode: z.enum(["voice", "text"]),
  durationMs: z.number().min(0).max(30 * 60_000),
  // One key per submission, so a resent request never creates a second attempt.
  clientKey: z.string().min(8).max(80),
});

export const POST = authed<IdParams>(async (req, { params, user }) => {
  const { id } = await params;
  const body = await parseBody(req, Body);
  return json(await submitAttempt(user.id, id, body));
}, { limit: 30, name: "training-attempt" });
