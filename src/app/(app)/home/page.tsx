import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/db/client";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Eyebrow, Badge } from "@/components/ui/Card";
import { DrillCard, PlaybackClipCard } from "@/components/app/cards";
import { ladderState, listSessions, progressSummary, recentClips } from "@/server/queries";
import { PROGRESS_METRICS, recommendDrill } from "@/lib/practice/progress";
import { getDrill } from "@/lib/practice/catalog";
import { relDate, TYPE_LABEL } from "@/lib/format";
import { nextLesson } from "@/server/lessons";
import { LessonCard, summarize } from "@/components/app/lessons";

export const metadata = { title: "Home" };

export default async function Home() {
  const user = await requireUser();
  const profile = getDb().select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get();
  const sessions = listSessions(user.id, 5);
  const { latest, baseline, vsBaseline, history } = progressSummary(user.id);
  const { current } = ladderState(user.id);
  const clips = recentClips(user.id, 3);
  const rec = recommendDrill(latest?.metrics ?? {});
  const drill = getDrill(rec.drillId)!;
  const improved = vsBaseline.filter((c) => c.improved === true);
  const lesson = nextLesson(user.id);

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-[32px] border hairline px-8 py-14 sm:px-12">
        <div className="absolute inset-0 window-light" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <Eyebrow>{profile?.targetRole ?? "Practice"} · Ladder {String(current.level).padStart(2, "0")} — {current.name}</Eyebrow>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,5rem)] leading-[0.95]">Ready for the room{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}?</h1>
            <p className="mt-4 max-w-lg text-mist-300">{history.length ? `${history.length} session${history.length > 1 ? "s" : ""} analysed. Next up: ${current.name.toLowerCase()}.` : "Your first session sets your baseline. Everything after is measured against you."}</p>
          </div>
          <div className="flex gap-3">
            <ButtonLink href="/practice" variant="lume" size="lg">Start Practice</ButtonLink>
            {sessions[0]?.analysisStatus === "complete" && <ButtonLink href={`/playback/${sessions[0].id}`} variant="secondary" size="lg">Last Playback</ButtonLink>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between"><Eyebrow>How you&apos;re improving</Eyebrow><Link href="/progress" className="text-[13px] text-mist-400 hover:text-mist-100">All progress →</Link></div>
          {latest && history.length > 1 ? (
            <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {PROGRESS_METRICS.slice(0, 4).map((m) => {
                const c = vsBaseline.find((x) => x.key === m.key);
                const v = latest.metrics[m.key];
                return (
                  <div key={m.key}>
                    <p className="text-[13px] text-mist-400">{m.label}</p>
                    <p className="mt-1 font-display text-3xl tabular">{v == null ? "—" : m.format(v)}</p>
                    <p className={`mt-1 text-xs ${c?.improved ? "text-signal-good" : c?.improved === false ? "text-mist-400" : "text-mist-400"}`}>
                      {baseline[m.key] == null ? "no baseline yet" : `baseline ${m.format(baseline[m.key]!)}`}{c?.improved ? " · better" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 text-mist-400">{latest ? "One session in. Your baseline is set — the next session shows what's changed." : "Complete a session to see your baseline."}</p>
          )}
          {improved.length > 0 && <p className="mt-6 text-sm text-mist-300">Better than your baseline on {improved.map((c) => c.label.toLowerCase()).join(", ")}.</p>}
        </Card>
        {lesson ? (
          <div>
            <div className="mb-3 flex items-center justify-between"><Eyebrow>Your next lesson</Eyebrow><Link href="/lessons" className="text-[13px] text-mist-400 hover:text-mist-100">All lessons →</Link></div>
            <LessonCard l={summarize(lesson)} />
          </div>
        ) : <DrillCard drill={drill} recommended={rec.reason} />}
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="flex items-center justify-between"><Eyebrow>What you struggled with</Eyebrow><Link href="/playback" className="text-[13px] text-mist-400 hover:text-mist-100">All Playback →</Link></div>
          <div className="mt-4 space-y-3">
            {clips.length ? clips.map((c) => <PlaybackClipCard key={c.id} clip={c} href={`/playback/${c.sessionId}?t=${c.startMs}&clip=${c.id}`} />) : <p className="rounded-2xl border hairline p-6 text-sm text-mist-400">Your Playback moments will appear here after your first session.</p>}
          </div>
        </div>
        <div>
          <Eyebrow>Recent sessions</Eyebrow>
          <ul className="mt-4 divide-y divide-white/[0.06] rounded-2xl border hairline">
            {sessions.length ? sessions.map((s) => (
              <li key={s.id}>
                <Link href={s.status === "ended" ? `/playback/${s.id}` : `/room/${s.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-mist-100">{s.role} · {TYPE_LABEL[s.type] ?? s.type}{s.mode === "panel" ? " · panel" : ""}</p>
                    <p className="mt-0.5 text-xs text-mist-400">{relDate(s.createdAt)} · pressure {s.pressure}/5</p>
                  </div>
                  {s.status !== "ended" ? <Badge tone="warn">Unfinished</Badge> : s.analysisStatus === "complete" ? <Badge tone="good">Read ready</Badge> : s.analysisStatus === "failed" ? <Badge tone="bad">Needs retry</Badge> : <Badge>Analysing</Badge>}
                </Link>
              </li>
            )) : <li className="px-5 py-6 text-sm text-mist-400">No sessions yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
