import { z } from "zod";
import { authed, json, parseBody } from "@/lib/api/http";
import { avatarStyleSchema, personaIdSchema } from "@/lib/avatar/style-schema";
import { saveStyle } from "@/server/avatar-styles";

/** The person's own look and name for an interviewer. */
export const PUT = authed(async (req, { user }) => {
  const body = await parseBody(req, z.object({ personaId: personaIdSchema, style: avatarStyleSchema }));
  return json({ styles: saveStyle(user.id, body.personaId, body.style) });
}, { limit: 60 });

/** Back to the persona's default look and name. */
export const DELETE = authed(async (req, { user }) => {
  const body = await parseBody(req, z.object({ personaId: personaIdSchema }));
  return json({ styles: saveStyle(user.id, body.personaId, null) });
}, { limit: 60 });
