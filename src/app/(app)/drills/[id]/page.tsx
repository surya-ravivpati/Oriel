import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDrill } from "@/lib/practice/catalog";
import { getSpeechToText } from "@/lib/ai/providers/registry";
import { LESSONS } from "@/lib/lessons/library";
import type { LessonKey } from "@/lib/lessons/types";
import { DrillRunner } from "@/features/drills/DrillRunner";

export const metadata = { title: "Drill" };

export default async function DrillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; lesson?: string }> }) {
  await requireUser();
  const { id } = await params;
  const { from, lesson } = await searchParams;
  const drill = getDrill(id);
  if (!drill) notFound();
  const def = lesson && lesson in LESSONS ? LESSONS[lesson as LessonKey] : null;
  return <DrillRunner drill={drill} sourceSessionId={from ?? null} serverStt={!getSpeechToText().isMock} lesson={def && def.drillId === drill.id ? { key: def.key, title: def.title } : null} />;
}
