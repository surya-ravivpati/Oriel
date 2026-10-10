import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/db/client";
import { ButtonLink, TextLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { DrillCard, PlaybackClipCard } from "@/components/app/cards";
import { ladderState, listSessions, progressSummary, recentClips } from "@/server/queries";
import { PROGRESS_METRICS, recommendDrill } from "@/lib/practice/progress";
import { getDrill } from "@/lib/practice/catalog";
import { relDate, TYPE_LABEL } from "@/lib/format";
import { nextLesson } from "@/server/lessons";
import { LessonCard, summarize } from "@/components/app/lessons";
import { BotStill } from "@/components/avatar/BotStill";
import { savedStyles } from "@/server/avatar-styles";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";
import { callName } from "@/lib/avatar/style";

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
  const next = current.personaIds[0];
  const styles = savedStyles(user.id);

  return (
    <div>
      <section className="grid gap-10 border-b border-divider pb-12 lg:grid-cols-12 lg:items-end lg:gap-x-8">
        <div className="lg:col-span-8">
          <p className="text-meta font-medium text-stone-dim">{profile?.targetRole ?? "Practice"} · Ladder {current.level} of 6</p>
          <h1 className="mt-3 text-display-l text-ivory">Ready for the room{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}?</h1>
          <p className="mt-4 max-w-[40rem] text-body-l text-stone">{history.length ? `${history.length} session${history.length > 1 ? "s" : ""} analysed. Next up: ${current.name.toLowerCase()}.` : "Your first session sets your baseline. Everything after is measured against you."}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
            <ButtonLink href="/practice" size="lg">Start practice</ButtonLink>
            {sessions[0]?.analysisStatus === "complete" && <TextLink href={`/playback/${sessions[0].id}`}>Open your last Playback</TextLink>}
          </div>
        </div>
        <figure className="lg:col-span-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-control border border-divider bg-surface-1" aria-hidden>
            <div className="absolute inset-x-[18%] bottom-[2%] top-[6%]"><BotStill personaId={next} style={styles[next as PersonaId]} className="size-full" /></div>
          </div>
          <figcaption className="mt-3 text-meta text-stone-dim">
            Next up: <span className="text-ivory">{callName(PERSONAS[next as PersonaId]?.name ?? "Your interviewer", styles[next as PersonaId])}</span>{current.mode === "panel" ? `, leading a ${current.personaIds.length}-person panel` : `, ${PERSONAS[next as PersonaId]?.title ?? ""}`}
          </figcaption>
        </figure>
      </section>

      <Band title="Since your baseline" link={["/progress", "All progress"]}>
        {latest && history.length > 1 ? (
          <table className="w-full max-w-[44rem] text-left">
            <thead>
              <tr className="border-b border-divider text-meta text-stone-dim"><th scope="col" className="pb-2 font-normal">Measure</th><th scope="col" className="pb-2 font-normal">Latest</th><th scope="col" className="pb-2 font-normal">Baseline</th><th scope="col" className="pb-2 text-right font-normal">Change</th></tr>
            </thead>
            <tbody>
              {PROGRESS_METRICS.slice(0, 4).map((m) => {
                const c = vsBaseline.find((x) => x.key === m.key);
                const v = latest.metrics[m.key];
                return (
                  <tr key={m.key} className="border-b border-divider">
                    <th scope="row" className="py-3 pr-4 text-ui font-medium text-ivory">{m.label}</th>
                    <td className="py-3 pr-4 font-mono text-ui tabular text-ivory">{v == null ? "n/a" : m.format(v)}</td>
                    <td className="py-3 pr-4 font-mono text-ui tabular text-stone-dim">{baseline[m.key] == null ? "not yet" : m.format(baseline[m.key]!)}</td>
                    <td className={`py-3 text-right text-meta font-medium ${c?.improved ? "text-signal-good" : "text-stone-dim"}`}>{c?.improved ? "Better" : c?.improved === false ? "Not yet" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="max-w-[40rem] text-body text-stone">{latest ? "One session in. Your baseline is set; the next session shows what has changed." : "Complete a session to see your baseline."}</p>
        )}
        {improved.length > 0 && <p className="mt-4 text-ui text-stone">Better than your baseline on {improved.map((c) => c.label.toLowerCase()).join(", ")}.</p>}
      </Band>

      <Band title={lesson ? "Your next lesson" : "A drill for today"} link={lesson ? ["/lessons", "All lessons"] : ["/drills", "All drills"]}>
        <div className="max-w-[36rem]">{lesson ? <LessonCard l={summarize(lesson)} /> : <DrillCard drill={drill} recommended={rec.reason} />}</div>
      </Band>

      <section className="grid gap-12 pt-12 lg:grid-cols-12 lg:gap-x-8">
        <div className="lg:col-span-7">
          <div className="flex items-baseline justify-between gap-4"><h2 className="text-meta font-medium text-stone-dim">What you struggled with</h2><TextLink href="/playback" className="text-meta">All Playback</TextLink></div>
          <div className="mt-3 border-b border-divider">
            {clips.length ? clips.map((c) => <PlaybackClipCard key={c.id} clip={c} href={`/playback/${c.sessionId}?t=${c.startMs}&clip=${c.id}`} />) : <p className="border-t border-divider py-5 text-ui text-stone-dim">Your Playback moments will appear here after your first session.</p>}
          </div>
        </div>
        <div className="lg:col-span-5">
          <h2 className="text-meta font-medium text-stone-dim">Recent sessions</h2>
          <ul className="mt-3 border-t border-divider">
            {sessions.length ? sessions.map((s) => (
              <li key={s.id} className="border-b border-divider">
                <Link href={s.status === "ended" ? `/playback/${s.id}` : `/room/${s.id}`} className="flex items-center gap-4 px-1 py-3.5 transition-colors hover:bg-surface-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui text-ivory">{s.role} · {TYPE_LABEL[s.type] ?? s.type}{s.mode === "panel" ? " · panel" : ""}</p>
                    <p className="mt-0.5 font-mono text-meta text-stone-dim">{relDate(s.createdAt)} · pressure {s.pressure}/5</p>
                  </div>
                  {s.status !== "ended" ? <Badge tone="warn">Unfinished</Badge> : s.analysisStatus === "complete" ? <Badge tone="good">Read ready</Badge> : s.analysisStatus === "failed" ? <Badge tone="bad">Needs retry</Badge> : <Badge>Analysing</Badge>}
                </Link>
              </li>
            )) : <li className="py-5 text-ui text-stone-dim">No sessions yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}

/** A row of the page: its label in the left margin, its content beside it. */
function Band({ title, link, children }: { title: string; link?: [string, string]; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-b border-divider py-12 lg:grid-cols-12 lg:gap-x-8">
      <div className="flex items-baseline justify-between gap-4 lg:col-span-3 lg:block">
        <h2 className="text-meta font-medium text-stone-dim">{title}</h2>
        {link && <TextLink href={link[0]} className="text-meta lg:mt-2 lg:inline-block">{link[1]}</TextLink>}
      </div>
      <div className="min-w-0 lg:col-span-9">{children}</div>
    </section>
  );
}
