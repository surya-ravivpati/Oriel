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
import { InterviewerStage } from "@/components/avatar/InterviewerStage";
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
      {/* The promise of the page, and the interviewer it promises: standing on the page, not boxed. */}
      <section className="page-grid items-center gap-y-6 pb-[var(--spacing-group)]">
        <div className="col-span-4 sm:col-span-8 lg:col-span-6">
          <p className="text-ui text-stone">{profile?.targetRole ?? "Practice"} · Ladder {current.level} of 6</p>
          <h1 className="mt-3 text-display-l text-ivory">Ready for the room{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}?</h1>
          <p className="mt-5 max-w-[34rem] text-body-l text-stone">{history.length ? `${history.length} session${history.length > 1 ? "s" : ""} analyzed. Next on the Ladder: ${current.name}, pressure ${current.pressure} of 5.` : "Your first session sets your baseline. Everything after is measured against you."}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href="/practice" size="lg">Start practice</ButtonLink>
            {sessions[0]?.analysisStatus === "complete" && <TextLink href={`/playback/${sessions[0].id}`} className="text-ui">Open your last Playback</TextLink>}
          </div>
        </div>
        <figure className="col-span-4 sm:col-span-8 lg:col-span-6">
          <InterviewerStage personaIds={current.personaIds} styles={styles} className="mx-auto h-[clamp(13rem,9rem+12vw,22rem)] w-full max-w-[34rem]" />
          <figcaption className="-mt-1 text-center text-ui text-stone">
            <span className="text-ivory">{callName(PERSONAS[next as PersonaId]?.name ?? "Your interviewer", styles[next as PersonaId])}</span>
            {current.mode === "panel" ? `, leading a ${current.personaIds.length}-person panel` : `, ${PERSONAS[next as PersonaId]?.title ?? ""}`}
          </figcaption>
        </figure>
      </section>

      <Band title="Since your baseline" link={["/progress", "All progress"]}>
        {latest && history.length > 1 ? (
          <table className="w-full max-w-[46rem] text-left">
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
                    <td className="py-3 pr-4 text-ui text-ivory">{v == null ? "n/a" : m.format(v)}</td>
                    <td className="py-3 pr-4 text-ui text-stone-dim">{baseline[m.key] == null ? "not yet" : m.format(baseline[m.key]!)}</td>
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

      {/* The two lists close the page side by side, each under its own rule, aligned to the 12-column grid. */}
      <section className="page-grid gap-y-12 border-t border-divider pt-12">
        <div className="col-span-4 sm:col-span-8 lg:col-span-7">
          <div className="flex items-baseline justify-between gap-4"><h2 className="text-ui font-medium text-ivory">What you struggled with</h2><TextLink href="/playback" className="text-meta">All Playback</TextLink></div>
          <div className="mt-3 border-b border-divider">
            {clips.length ? clips.map((c) => <PlaybackClipCard key={c.id} clip={c} compact href={`/playback/${c.sessionId}?t=${c.startMs}&clip=${c.id}`} />) : <p className="border-t border-divider py-5 text-ui text-stone-dim">Your Playback moments will appear here after your first session.</p>}
          </div>
        </div>
        <div className="col-span-4 sm:col-span-8 lg:col-span-5">
          <h2 className="text-ui font-medium text-ivory">Recent sessions</h2>
          <ul className="mt-3 border-t border-divider">
            {sessions.length ? sessions.map((s) => (
              <li key={s.id} className="border-b border-divider">
                <Link href={s.status === "ended" ? `/playback/${s.id}` : `/room/${s.id}`} className="-mx-2 flex items-center gap-4 rounded-control px-2 py-3.5 transition-colors duration-[var(--dur-press)] hover:bg-surface-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui text-ivory">{s.role} · {TYPE_LABEL[s.type] ?? s.type}{s.mode === "panel" ? " · panel" : ""}</p>
                    <p className="mt-0.5 text-meta text-stone-dim">{relDate(s.createdAt)} · pressure {s.pressure} of 5</p>
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

/** A section of the page as a document reads: its title in the margin (columns 1–3), its content from column 4. */
function Band({ title, link, children }: { title: string; link?: [string, string]; children: React.ReactNode }) {
  return (
    <section className="page-grid gap-y-5 border-t border-divider py-12">
      <div className="col-span-4 flex items-baseline justify-between gap-4 sm:col-span-8 lg:col-span-3 lg:block">
        <h2 className="text-ui font-medium text-ivory">{title}</h2>
        {link && <TextLink href={link[0]} className="text-meta lg:mt-1.5 lg:inline-block">{link[1]}</TextLink>}
      </div>
      <div className="col-span-4 min-w-0 sm:col-span-8 lg:col-span-9">{children}</div>
    </section>
  );
}
