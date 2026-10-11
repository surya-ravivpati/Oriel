import { authed, json, type IdParams } from "@/lib/api/http";
import { deleteLoop, loopView } from "@/server/training/service";

export const GET = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  return json(loopView(user.id, id));
}, { limit: 120, name: "training-read" });

/** Delete a practice loop with its answers, assessments and scheduled review. */
export const DELETE = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  deleteLoop(user.id, id);
  return json({ ok: true });
}, { limit: 30, name: "training-delete" });
