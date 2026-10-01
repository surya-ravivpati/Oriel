import { authed, HttpError, ndjson, type IdParams } from "@/lib/api/http";
import { getDrill } from "@/lib/practice/catalog";
import { PERSONAS } from "@/lib/interview/personas";
import { speak, type RoomEvent } from "@/server/interview/service";

/** Speak a drill's prompt in an interviewer voice (only fixed catalog prompts can be spoken). */
export const POST = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  const drill = getDrill(id);
  if (!drill) throw new HttpError(404, "Unknown drill");
  const voice = drill.id === "hard_recovery" ? PERSONAS.skeptic.voice : PERSONAS.hiring_manager.voice;
  return ndjson<RoomEvent>(speak(null, user.id, drill.prompt, voice, drill.id === "hard_recovery" ? 5 : 2));
}, { limit: 30, name: "drill-speak" });
