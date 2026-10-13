import { authed, json, type IdParams } from "@/lib/api/http";
import { startReview } from "@/server/training/service";

/** Start (or resume) a scheduled review. */
export const POST = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  return json({ id: await startReview(user.id, id) });
}, { limit: 20, name: "training-review" });
