"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { Thinking } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";
import { InterviewerStage } from "@/components/avatar/InterviewerStage";
import { LiveTranscriber } from "@/features/room/engine/speech";
import { api, ApiError } from "@/lib/client/api";
import type { LoopView, AttemptView } from "@/server/training/service";
import type { CriterionLevel, Evaluation, Outcome } from "@/lib/training/engine";
import { CATEGORIES } from "@/lib/training/competencies";

/*
 * One practice loop, one question at a time. While you answer, nothing is shown but the
 * interviewer and the question: no rubric, no hints, no skill name. After each answer, one
 * note; the retry asks you to apply a principle, never to copy an answer; the transfer arrives
 * as the next question, unannounced. The skill is named only at the end.
 */

const LEVEL_WORD = (l: CriterionLevel) => (l === 2 ? "clearly shown" : l === 1 ? "partly shown" : l === 0 ? "not shown" : "couldn't tell");
const OUTCOME_WORD: Record<"same" | "new" | "later", Record<Outcome, string>> = {
  same: { yes: "Improved when you tried again", no: "Didn't improve on the retry", not_assessed: "Not assessed" },
  new: { yes: "Carried over to a question you hadn't seen", no: "Didn't carry over yet", not_assessed: "Not assessed" },
  later: { yes: "Held after the delay", no: "Didn't hold after the delay", not_assessed: "Not assessed" },
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const key = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function TrainingSession({ initial }: { initial: LoopView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const started = useRef<number | null>(null);
  const submission = useRef(key());
  const rec = useRef<LiveTranscriber | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setCanDictate(LiveTranscriber.supported()));
    return () => { cancelAnimationFrame(id); rec.current?.abort(); };
  }, []);

  function toggleDictation() {
    if (listening) {
      void rec.current?.stop().then((t) => { if (t) setAnswer((a) => (a ? `${a} ${t}` : t)); });
      setListening(false);
      return;
    }
    const base = answer;
    const r = new LiveTranscriber();
    r.onUpdate = (t) => setAnswer(base ? `${base} ${t}` : t);
    r.onFatal = () => { setListening(false); setError("Dictation stopped. You can keep typing."); };
    rec.current = r;
    r.start();
    started.current ??= performance.now();
    setMode("voice");
    setListening(true);
  }

  async function submit() {
    if (!answer.trim() || busy) return;
    if (listening) { rec.current?.abort(); setListening(false); }
    setBusy(true);
    setError(null);
    try {
      const next = await api<LoopView>(`/api/training/${view.id}/attempts`, {
        method: "POST",
        json: { response: answer.trim(), inputMode: mode, durationMs: started.current ? performance.now() - started.current : 0, clientKey: submission.current },
      });
      setView(next);
      setAnswer("");
      setMode("text");
      started.current = null;
      submission.current = key();
      requestAnimationFrame(() => box.current?.focus());
    } catch (e) {
      // The same key is reused on a retry of this submission, so it can't be counted twice.
      setError(e instanceof ApiError ? e.message : "Something went wrong. Your answer is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  const last = view.attempts.at(-1) ?? null;
  const category = CATEGORIES.find((c) => c.id === view.category)?.label ?? view.category;
  const done = view.stage === "done";

  return (
    <div className="mx-auto max-w-[48rem]">
      <Link href="/train" className="-ml-1 inline-flex h-9 items-center rounded-control px-1 text-ui text-stone transition-colors duration-[var(--dur-press)] hover:text-ivory">← Training</Link>
      <p className="mt-4 text-ui text-stone-dim">{view.kind === "review" ? "Review" : "Practice"} · {category}</p>

      {done ? <Summary view={view} /> : (
        <>
          {/* The note on your last answer, before the next attempt. Never on the first question. */}
          {last?.evaluation && <Note view={view} attempt={last} />}

          <section aria-labelledby="question" className="mt-10">
            <p className="text-meta text-stone-dim" aria-live="polite">{transitionLine(view, last)}</p>
            <div className="mt-3 flex items-start gap-4 sm:gap-6">
              <InterviewerStage personaIds={["hiring_manager"]} className="aspect-square w-20 shrink-0 sm:w-28" />
              <h1 id="question" key={view.question.text} className="pt-2 text-display-m text-ivory motion-safe:animate-[enter_var(--dur-panel)_var(--ease-enter)]">{view.question.text}</h1>
            </div>
            {view.scaffold && (
              <p className="mt-5 border-t border-divider pt-4 text-ui text-stone"><span className="font-medium text-ivory">To help: </span>{view.scaffold}</p>
            )}
          </section>

          <form className="mt-8" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <label htmlFor="answer" className="sr-only">Your answer</label>
            <textarea id="answer" ref={box} value={answer} disabled={busy} autoFocus
              onChange={(e) => { started.current ??= performance.now(); setAnswer(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
              placeholder={listening ? "Listening…" : "Answer as you would in the room."}
              className="min-h-44 w-full resize-y rounded-control border border-control bg-surface-1 px-4 py-3.5 text-body leading-relaxed text-ivory placeholder:text-stone-dim transition-colors duration-[var(--dur-press)] hover:border-stone-dim disabled:opacity-60" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" loading={busy} disabled={!answer.trim()}>Submit answer</Button>
              {canDictate && (
                <Button type="button" variant="secondary" size="lg" onClick={toggleDictation} disabled={busy} aria-pressed={listening}>
                  {listening ? <><span className="size-1.5 rounded-full bg-signal-bad" aria-hidden />Stop speaking</> : "Speak instead"}
                </Button>
              )}
              <span className="hidden text-meta text-stone-dim pointer-fine:inline">⌘ Enter submits</span>
            </div>
            {busy && <Thinking label="Reading your answer" className="mt-5" />}
            {error && <FieldError>{error}</FieldError>}
          </form>
        </>
      )}

      {view.attempts.length > 0 && (
        <details className="mt-16 border-t border-divider pt-4">
          <summary className="cursor-pointer text-ui text-stone hover:text-ivory">Your answers so far ({view.attempts.length})</summary>
          <ol className="mt-4 space-y-6">
            {view.attempts.map((a) => (
              <li key={a.id}>
                <p className="text-meta text-stone-dim">{STAGE_WORD[a.stage]}{a.questionSource === "generated" ? " · a generated question" : ""}</p>
                <p className="mt-1 font-display text-body-l text-stone">{a.question}</p>
                <p className="mt-2 whitespace-pre-line text-body text-ivory">{a.response}</p>
              </li>
            ))}
          </ol>
          <DeleteLoop id={view.id} onDone={() => router.push("/train")} />
        </details>
      )}
    </div>
  );
}

const STAGE_WORD = { initial: "First answer", retry: "Retry", transfer: "New question", review: "Review" } as const;

function transitionLine(view: LoopView, last: AttemptView | null): string {
  if (!last) return view.kind === "review" ? "A question to answer cold, as before." : "Answer as you would in the room. Feedback comes after.";
  if (view.step?.kind === "reassess" || (last.evaluation && !last.evaluation.enoughEvidence)) return "Same question. Give it a full answer.";
  if (view.stage === "retry") return "Same question. Answer it again, your way.";
  if (view.stage === "transfer") return "Next question.";
  return "";
}

/** One note on the last answer: what was seen, the words it was seen in, why it matters, what to do next. */
function Note({ view, attempt }: { view: LoopView; attempt: AttemptView }) {
  const e = attempt.evaluation!;
  if (!e.enoughEvidence) {
    return (
      <section aria-label="About your last answer" className="mt-8 border-t border-divider pt-6">
        <p className="text-body-l text-ivory">{e.insufficientReason ?? "There wasn't enough in that answer to judge."}</p>
        <p className="mt-2 text-ui text-stone">That isn&rsquo;t counted against you.</p>
      </section>
    );
  }
  // After a retry, the comparison on the targeted point comes first, fairly in both directions.
  const prev = view.attempts.filter((a) => a.stage === "initial" && a.evaluation?.enoughEvidence).at(-1)?.evaluation;
  const targetId = view.target?.id ?? e.primary?.criterionId ?? null;
  const level = (ev: Evaluation | null | undefined) => (ev && targetId ? ev.criteria.find((c) => c.id === targetId)?.level ?? null : null);
  const showComparison = attempt.stage === "retry" && prev && targetId;
  const p = e.primary;
  const quote = p ? e.criteria.find((c) => c.id === p.criterionId)?.evidence : null;
  return (
    <section aria-label="About your last answer" className="mt-8 border-t border-divider pt-6">
      {showComparison && (
        <p className="mb-5 text-ui text-stone">
          <span className="text-ivory">{view.target?.label ?? "The point you worked on"}:</span> {LEVEL_WORD(level(prev))} before, {LEVEL_WORD(level(e))} now.
          {view.stage === "transfer" && level(e) !== 2 && " Moving on to a new question rather than repeating this one."}
        </p>
      )}
      {p && view.stage === "retry" ? (
        <>
          <p className="text-body-l text-ivory">{p.observation}</p>
          {quote && (
            <figure className="mt-4">
              <blockquote className="hang-sans text-body text-stone">“{quote}”</blockquote>
              <figcaption className="mt-1 text-meta text-stone-dim">From your answer</figcaption>
            </figure>
          )}
          <p className="mt-4 text-ui text-stone">{p.whyItMatters}</p>
          <p className="mt-4 text-body text-ivory"><span className="font-medium">Next attempt: </span>{p.instruction}</p>
        </>
      ) : !showComparison && (
        <p className="text-body-l text-ivory">{view.stage === "transfer" ? "That answer covered the ground. Here\u2019s a different one." : ""}</p>
      )}
      {e.secondary.length > 0 && view.stage === "retry" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-meta text-stone hover:text-ivory">More notes</summary>
          <ul className="mt-2 space-y-1.5 text-ui text-stone">{e.secondary.map((s) => <li key={s}>{s}</li>)}</ul>
        </details>
      )}
      <Assessor e={e} />
    </section>
  );
}

function Assessor({ e }: { e: Evaluation }) {
  return (
    <p className="mt-4 text-meta text-stone-dim">
      {e.evaluator === "model" ? `Assessed by the AI against a fixed rubric, ${e.confidence} confidence.` : "Assessed by pattern rules, not the AI; treat it as approximate."}
      {e.limitations ? ` ${e.limitations}` : ""}
    </p>
  );
}

/** The end of a loop: the three outcomes kept apart, what carried over, and when it comes back. */
function Summary({ view }: { view: LoopView }) {
  const o = view.outcome;
  const transfer = view.attempts.filter((a) => a.stage === "transfer" || a.stage === "review").at(-1)?.evaluation;
  const rows: [string, string][] = view.kind === "review"
    ? [["After a delay", OUTCOME_WORD.later[o?.retained ?? "not_assessed"]]]
    : [["On the same question", OUTCOME_WORD.same[o?.improvedOnRetry ?? "not_assessed"]], ["On a new question", OUTCOME_WORD.new[o?.transferred ?? "not_assessed"]]];
  return (
    <section aria-labelledby="summary-title" className="mt-6">
      <h1 id="summary-title" className="text-display-l text-ivory">{view.competency.label}</h1>
      <p className="mt-4 text-body-l text-stone">{view.competency.summary}{view.target ? ` This time: ${view.target.label.toLowerCase()}.` : ""}</p>
      <dl className="mt-10 border-t border-divider">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 border-b border-divider py-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <dt className="text-ui text-stone">{k}</dt>
            <dd className="text-body text-ivory">{v}</dd>
          </div>
        ))}
        <div className="grid gap-1 border-b border-divider py-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <dt className="text-ui text-stone">{view.kind === "review" ? "Next look" : "After a delay"}</dt>
          <dd className="text-body text-ivory">{view.nextReview ? `A review on ${fmtDate(view.nextReview)}, with a different question` : "Nothing scheduled: there wasn't enough to assess"}</dd>
        </div>
      </dl>
      {transfer?.enoughEvidence && (
        <div className="mt-10">
          <h2 className="text-ui font-medium text-ivory">{view.kind === "review" ? "On the review question" : "On the new question"}</h2>
          <ul className="mt-3 space-y-3">
            {transfer.criteria.map((c) => (
              <li key={c.id} className="grid gap-1 sm:grid-cols-[14rem_minmax(0,1fr)]">
                <span className={cn("text-ui", c.level === 2 ? "text-ivory" : "text-stone")}>{c.label}</span>
                <span className="text-ui text-stone">{LEVEL_WORD(c.level)}{c.evidence ? `: “${c.evidence}”` : ""}</span>
              </li>
            ))}
          </ul>
          <Assessor e={transfer} />
        </div>
      )}
      <p className="mt-10 text-meta text-stone-dim">These are observations about answers, not a grade of you or a prediction of any interview.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/train" size="lg">Back to training</ButtonLink>
      </div>
    </section>
  );
}

function DeleteLoop({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="danger" size="sm" className="mt-6" loading={busy} onClick={async () => {
      if (!window.confirm("Delete this practice, its answers and its scheduled review? This can't be undone.")) return;
      setBusy(true);
      await api(`/api/training/${id}`, { method: "DELETE" }).catch(() => null);
      onDone();
    }}>Delete this practice</Button>
  );
}
