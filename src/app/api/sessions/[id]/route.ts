import { authed, HttpError, json, type IdParams } from "@/lib/api/http";
import { deleteSession } from "@/server/privacy/deletion";

/** Permanently delete one session: recording, transcript, metrics, clips. */
export const DELETE = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  if (!deleteSession(user.id, id)) throw new HttpError(404, "Session not found");
  return json({ ok: true });
}, { limit: 20, name: "session-delete" });
