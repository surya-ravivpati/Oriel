import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { lessonFor } from "@/server/lessons";
import { LESSONS, PRACTICE_PASSES_NEEDED, TRACKS, formatMeasure } from "@/lib/lessons/library";
import type { LessonKey } from "@/lib/lessons/types";
import { getDrill } from "@/lib/practice/catalog";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card, Eyebrow } from "@/components/ui/Card";
import { LessonSteps, summarize } from "@/components/app/lessons";
import { SetupCheck } from "@/features/lessons/SetupCheck";
import { relDate, relPhrase } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return { title: LESSONS[key as LessonKey]?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireUser();
  const { key } = await params;
  if (!(key in LESSONS)) notFound();
  const def = LESSONS[key as LessonKey];
  const found = lessonFor(user.id, key);
  const l = found?.lesson ?? null;
  const drill = def.drillId ? getDrill(def.drillId) : null;
  const passes = l?.practicePasses ?? 0;
  const status = l?.status ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/lessons" className="text-sm text-mist-400 hover:text-mist-100">← Lessons</Link>
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-mist-400">
        {TRACKS[def.track].label} · {status === "active" ? <span className="text-lume">In your plan</span> : status === "queued" ? "Up next" : status === "mastered" ? <span className="text-signal-good">Mastered</span> : "Lesson"}
      </p>
      <h1 className="mt-3 font-display text-5xl leading-tight sm:text-6xl">{def.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-mist-300">{def.promise}</p>
      {l && <LessonSteps l={{ ...summarize(l), viewed: true }} className="mt-8 max-w-xl" />}

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-12">
          {l ? (
            <Card className="p-7">
              <Eyebrow>What we saw in your interview</Eyebrow>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="font-display text-5xl tabular text-mist-100">{l.evidence.display}</p>
                <p className="text-sm text-mist-400">target {l.evidence.target}{l.evidence.confidence !== "high" ? ` · ${l.evidence.confidence} confidence` : ""}</p>
              </div>
              {l.startValue !== null && l.latestValue !== null && l.startValue !== l.latestValue && <p className="mt-2 text-sm text-mist-400">{l.status === "mastered" ? `Was ${formatMeasure(l.metricKey, l.startValue)} — now ${formatMeasure(l.metricKey, l.latestValue)}.` : `When this lesson started: ${formatMeasure(l.metricKey, l.startValue)}.`}</p>}
              <p className="mt-5 leading-relaxed text-mist-200">{l.content.observation}</p>
              {l.evidence.quotes.length > 0 && (
                <ul className="mt-6 space-y-4">
                  {l.evidence.quotes.map((q, i) => (
                    <li key={i} className="border-l-2 border-lume/40 pl-4">
                      {q.question && <p className="text-xs text-mist-400">Answering “{q.question}”</p>}
                      <p className="mt-1 text-[15px] leading-relaxed text-mist-100">“{q.text}”</p>
                      <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-mist-400">
                        {q.note && <span>{q.note}</span>}
                        {q.startMs !== null && <Link href={`/playback/${q.sessionId}?t=${q.startMs}`} className="text-lume hover:underline hover:underline-offset-4">{found?.recorded && !q.typed ? "Hear it in Playback →" : "See it in Playback →"}</Link>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {l.evidence.moments.length > 0 && (
                <ul className="mt-6 space-y-2">
                  {l.evidence.moments.map((m, i) => (
                    <li key={i}><Link href={`/playback/${m.sessionId}?t=${m.startMs}`} className="text-sm text-mist-200 hover:text-white">{m.label} <span className="text-lume">→</span></Link></li>
                  ))}
                </ul>
              )}
              <p className="mt-6 text-xs text-mist-400">Measured {relPhrase(l.updatedAt)}. Your numbers only — never compared with other people.</p>
            </Card>
          ) : (
            <Card className="p-7">
              <Eyebrow>Not in your plan</Eyebrow>
              <p className="mt-3 leading-relaxed text-mist-300">We haven&apos;t measured a need for this one — it was on target, or your interviews haven&apos;t measured it yet (typed answers have no pace or voice; camera skills need the camera). The technique below still works.</p>
            </Card>
          )}

          <section>
            <h2 className="font-display text-3xl">Why it matters</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-mist-300">{def.why}</p>
          </section>

          <section>
            <h2 className="font-display text-3xl">How to do it</h2>
            <ol className="mt-5 space-y-5">
              {def.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border hairline-strong font-mono text-xs text-lume">{i + 1}</span>
                  <div><p className="text-mist-100">{s.title}</p><p className="mt-1 text-sm leading-relaxed text-mist-400">{s.body}</p></div>
                </li>
              ))}
            </ol>
            {l?.content.tip && <p className="mt-6 rounded-2xl border border-lume/20 bg-lume/[0.05] p-4 text-sm leading-relaxed text-mist-200"><span className="text-lume">For you: </span>{l.content.tip}</p>}
          </section>

          {l?.content.rewrite && (
            <section>
              <h2 className="font-display text-3xl">Your answer, rewritten</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Card className="p-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">What you said</p><p className="mt-3 text-[15px] leading-relaxed text-mist-300">“{l.content.rewrite.before}”</p></Card>
                <Card className="border-lume/25 p-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lume">Same story, with the lesson</p><p className="mt-3 text-[15px] leading-relaxed text-mist-100">“{l.content.rewrite.after}”</p></Card>
              </div>
              <p className="mt-3 text-xs text-mist-400">{l.content.rewrite.note}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <Eyebrow>Practise it</Eyebrow>
            {drill ? (
              <>
                <p className="mt-3 font-display text-2xl">{drill.title}</p>
                <p className="mt-1 text-sm text-mist-400">{drill.objective}</p>
                <p className="mt-3 text-xs text-mist-400">Pass: {drill.passRule}</p>
                <ButtonLink href={`/drills/${drill.id}?lesson=${def.key}${l?.sourceSessionId ? `&from=${l.sourceSessionId}` : ""}`} variant="lume" className="mt-5 w-full">Start practice</ButtonLink>
                {l && <p className="mt-3 text-center text-xs text-mist-400">{passes >= PRACTICE_PASSES_NEEDED ? "Practised — now use it in an interview." : `${passes} of ${PRACTICE_PASSES_NEEDED} passes`}</p>}
                {found && found.attempts.length > 0 && (
                  <ul className="mt-5 space-y-2 border-t hairline pt-4 text-sm">
                    {found.attempts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3">
                        <span className="font-mono text-mist-200">{a.value ?? "—"} {(a.result as { unit?: string } | null)?.unit}</span>
                        <span className="text-xs text-mist-400">{relDate(a.createdAt)}</span>
                        <Badge tone={a.passed ? "good" : "neutral"}>{a.passed ? "Pass" : a.passed === false ? "Not yet" : "—"}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <SetupCheck passes={passes} needed={PRACTICE_PASSES_NEEDED} inPlan={!!l && l.status !== "mastered"} />
            )}
          </Card>
          <Card className="p-6">
            <Eyebrow>The goal</Eyebrow>
            <p className="mt-3 text-mist-200">{def.goal}</p>
            <p className="mt-2 text-sm text-mist-400">{status === "mastered" && l?.masteredAt ? `Confirmed in your interview ${relPhrase(l.masteredAt)}.` : "Your next interview confirms it — lessons are only marked mastered when the skill shows up in a real interview."}</p>
            {status !== "mastered" && <ButtonLink href="/practice" variant="secondary" size="sm" className="mt-4">Practice an interview</ButtonLink>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
