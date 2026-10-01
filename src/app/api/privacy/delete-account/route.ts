import { z } from "zod";
import { authed, json, parseBody } from "@/lib/api/http";
import { destroySession } from "@/lib/auth/session";
import { deleteAccount } from "@/server/privacy/deletion";

const Body = z.object({ confirm: z.literal("DELETE") });

/** One-click account deletion: media files first, then all rows (FK cascades). */
export const POST = authed(async (req, { user }) => {
  await parseBody(req, Body);
  await destroySession();
  deleteAccount(user.id, user.email.split("@")[1] ?? null);
  return json({ ok: true });
}, { limit: 5 });
