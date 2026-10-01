import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/db/client";
import { lessonsFor } from "@/server/lessons";
import { LESSONS, LESSON_ORDER, TRACKS } from "@/lib/lessons/library";
import type { LessonKey, Track } from "@/lib/lessons/types";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";
import { LessonCard, LessonSteps, TrackLabel, summarize } from "@/components/app/lessons";
import { relPhrase } from "@/lib/format";

export const metadata = { title: "Lessons" };

const TRACK_ORDER: Track[] = ["responses", "delivery", "presence"];
const NOT_MEASURED: Record<Track, string> = {
  responses: "Not measured — your last interview had too few full answers.",
  delivery: "Not measured — speak your answers so we can hear your delivery.",
  presence: "Not measured in your last interview — allow camera signals in the Room for presence lessons.",
};

export default async function LessonsPage() {
  const user = await requireUser();
  const rows = lessonsFor(user.id);
  const latest = getDb().select({ id: schema.interviewSessions.id, endedAt: schema.interviewSessions.endedAt, createdAt: schema.interviewSessions.createdAt })
    .from(schema.interviewSessions).where(and(eq(schema.interviewSessions.userId, user.id), eq(schema.interviewSessions.analysisStatus, "complete")))
    .orderBy(desc(schema.interviewSessions.createdAt)).get();
  const open = rows.filter((r) => r.status !== "mastered");
  const mastered = rows.filter((r) => r.status === "mastered");
  const first = open.find((r) => r.status === "active");
  const latestMetrics = latest ? getDb().select({ key: schema.metrics.key, value: schema.metrics.value }).from(schema.metrics).where(eq(schema.metrics.sessionId, latest.id)).all() : [];
  const has = (k: string) => latestMetrics.some((m) => m.key === k && m.value !== null);
  // Say "not measured" rather than "on target" when an interview couldn't measure a track.
  const measured: Record<Track, boolean> = {
    responses: has("structure_score") || has("specificity"),
    delivery: has("filler_per_min") || has("pace_wpm"),
    presence: has("camera_engagement") || has("movement") || latestMetrics.some((m) => m.key === "setup"),
  };

  if (!latest) {
    return (
      <div>
        <Eyebrow>Lessons</Eyebrow>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-tight">Your lessons start with one interview.</h1>
        <p className="mt-4 max-w-2xl text-mist-300">Lessons are built from what we measure while you practise — your pace and fillers, how your answers land, your posture and eye contact on camera. Do one interview and we&apos;ll pick the skills that will make the biggest difference for you, using your own answers as the examples.</p>
        <ButtonLink href="/practice" variant="lume" size="lg" className="mt-8">Start an interview</ButtonLink>
        <Library title="What you could learn" />
      </div>
    );
  }

  return (
    <div>
      <Eyebrow>Lessons</Eyebrow>
      <h1 className="mt-3 font-display text-5xl leading-tight">Built from how you interviewed.</h1>
      <p className="mt-3 max-w-2xl text-mist-300">
        {open.length
          ? <>From your interview {relPhrase(latest.endedAt ?? latest.createdAt)}: the skills furthest from target, taught with your own answers. Learn it, pass the practice twice, then use it in your next interview — that&apos;s where we confirm it.</>
          : <>Every skill we measured in your interview {relPhrase(latest.endedAt ?? latest.createdAt)} was on target. Raise the pressure next time — new lessons appear when something slips.</>}
      </p>

      {first && (() => {
        const def = LESSONS[first.lessonKey as LessonKey];
        return (
          <Link href={`/lessons/${first.lessonKey}`} className="group relative mt-10 block overflow-hidden rounded-[28px] border hairline-strong p-8 transition-colors hover:bg-white/[0.02] sm:p-10">
            <div className="absolute inset-0 window-light opacity-70" aria-hidden />
            <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lume">Start here · <TrackLabel track={def.track} className="text-lume" /></p>
                <p className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{def.title}</p>
                <p className="mt-3 max-w-xl text-mist-300">{def.promise}</p>
              </div>
              <div>
                <p className="text-sm text-mist-400">In your interview</p>
                <p className="mt-1 font-display text-3xl text-mist-100">{first.evidence.display}</p>
                <p className="text-sm text-mist-400">target {first.evidence.target}</p>
                <LessonSteps l={summarize(first)} className="mt-5" />
                <span className="mt-5 inline-block text-sm text-lume group-hover:underline group-hover:underline-offset-4">Open the lesson →</span>
              </div>
            </div>
          </Link>
        );
      })()}

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {TRACK_ORDER.map((t) => {
          const ls = open.filter((r) => r.track === t && r.lessonKey !== first?.lessonKey);
          const done = mastered.filter((r) => r.track === t);
          return (
            <section key={t}>
              <div className="flex items-baseline justify-between border-b hairline pb-3">
                <h2 className="font-display text-2xl">{TRACKS[t].label}</h2>
                <span className="text-xs text-mist-400">{TRACKS[t].blurb}</span>
              </div>
              <div className="mt-4 space-y-3">
                {ls.map((r) => <LessonCard key={r.id} l={summarize(r)} />)}
                {!ls.length && <p className="rounded-2xl border border-dashed hairline p-5 text-sm text-mist-400">{first?.track === t ? "Your first lesson is above." : !measured[t] ? NOT_MEASURED[t] : done.length ? "On target — nicely done." : "On target in your last interview."}</p>}
              </div>
            </section>
          );
        })}
      </div>

      {mastered.length > 0 && (
        <section className="mt-14">
          <Eyebrow>Mastered</Eyebrow>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mastered.map((r) => <LessonCard key={r.id} l={summarize(r)} />)}
          </div>
        </section>
      )}

      <Library title="Every lesson" />
    </div>
  );
}

/** The whole library, so any lesson can be read — personal evidence appears only where we measured a need. */
function Library({ title }: { title: string }) {
  return (
    <section className="mt-16">
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        {TRACK_ORDER.map((t) => (
          <Card key={t} className="p-5">
            <TrackLabel track={t} />
            <ul className="mt-3 space-y-2.5">
              {LESSON_ORDER.filter((k) => LESSONS[k].track === t).map((k) => (
                <li key={k}><Link href={`/lessons/${k}`} className="block text-sm text-mist-200 hover:text-white">{LESSONS[k].title}<span className="block text-xs text-mist-400">{LESSONS[k].promise}</span></Link></li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
