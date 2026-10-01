import { z } from "zod";
import { authed, json, parseBody } from "@/lib/api/http";
import { recordSetupCheck } from "@/server/lessons";

/** The setup lesson's practice: a live camera check judged on the device with the Read's own thresholds. */
export const POST = authed(async (req, { user }) => {
  const body = await parseBody(req, z.object({ passed: z.boolean() }));
  return json({ lesson: recordSetupCheck(user.id, body.passed) });
}, { limit: 20 });
