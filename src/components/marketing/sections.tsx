import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { PRESSURE_LABELS, pressurePolicy, type PressureLevel } from "@/lib/interview/pressure";

/*
 * The landing page after the hero. Server components only: no client JavaScript below the fold.
 * Voice-mapped type: Oriel's lines and section statements in the serif; yours and the interface
 * in the sans. Every claim here comes from the product (setup, the Room, the Read, Playback,
 * lessons, the privacy policy, the plan data); samples are labelled as samples.
 */

const linkCls = "text-ui text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory";

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS: { title: string; body: string; id?: string }[] = [
  { title: "Set the room", body: "Choose the role, the round and your interviewer. Add your resume and the job description, and the questions become yours." },
  { title: "Answer out loud", body: "Speak your answers, or type them. The interviewer follows up, remembers what you said and tests your numbers." },
  { title: "Read it back", body: "See the moments that mattered in your recording, what landed, and one specific change to try at each." },
  { title: "Practise the one thing", body: "Short lessons built from your own answers, then five-minute drills measured by the same code as the interview.", id: "practice" },
];

export function HowItWorks() {
  return (
    <section id="session" aria-labelledby="how-title" className="border-t border-divider pb-[var(--space-section)] pt-[calc(var(--space-section)*0.85)]">
      <div className="frame">
        <div className="page-grid gap-y-6">
          <h2 id="how-title" className="col-span-4 max-w-[18em] text-display-l text-ivory sm:col-span-8 lg:col-span-7">
            Most people who fail interviews know their material. They lose the&nbsp;room.
          </h2>
          <p className="col-span-4 max-w-[34rem] self-end text-body-l text-stone sm:col-span-6 sm:col-start-3 lg:col-span-5 lg:col-start-8">
            Oriel puts you in the room before the real one: a full interview, out loud, with someone who listens and pushes back. Then it shows you what happened.
          </p>
        </div>
        <ol className="mt-16 grid gap-y-10 border-t border-divider pt-0 lg:mt-24 lg:grid-cols-4 lg:gap-x-6 lg:border-t-0">
          {STEPS.map((s, i) => (
            <li key={s.title} id={s.id} className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-b border-divider pb-8 pt-8 lg:block lg:border-b-0 lg:border-t lg:pb-0 lg:pt-6">
              <span className="font-display text-display-m leading-none text-olive-light" aria-hidden>{i + 1}</span>
              <div className="lg:mt-6">
                <h3 className="text-body-l font-medium text-ivory">{s.title}</h3>
                <p className="mt-2 max-w-[30rem] text-body text-stone">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── The interview: why it feels real ─────────────────────────────────────────

const LEVELS: PressureLevel[] = [1, 3, 5];
const secs = (n: number | null) => (n === null ? "Never" : n >= 60 ? `After ${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60} s` : ""}` : `After ${n} s`);

export function Interview() {
  const rows: [string, (l: PressureLevel) => string][] = [
    ["Cuts in on a long answer", (l) => secs(pressurePolicy(l).interruptAfterSec)],
    ["Silence before the next question", (l) => `${(pressurePolicy(l).preResponseSilenceMs / 1000).toFixed(1)} s`],
    ["Follow-ups on one question", (l) => `Up to ${pressurePolicy(l).maxFollowUpDepth}`],
    ["Tests the numbers you give", (l) => `${Math.round(pressurePolicy(l).numericProbeRate * 100)}% of the time`],
  ];
  return (
    <section id="in-the-room" aria-labelledby="interview-title" className="border-t border-divider py-[var(--space-section)]">
      <div className="frame page-grid gap-y-12">
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <h2 id="interview-title" className="text-display-l text-ivory">It listens, and it follows&nbsp;up.</h2>
          <p className="mt-6 max-w-[30rem] text-body text-stone">
            Oriel keeps track of what you claim and comes back to it. Turn the pressure up and it interrupts long answers, lets silence sit and tests every number. Up to four interviewers can sit on a panel.
          </p>
        </div>

        <figure className="col-span-4 sm:col-span-8 lg:col-span-7 lg:col-start-6">
          <figcaption className="text-meta text-stone-dim">Sample exchange</figcaption>
          <ol className="mt-4 space-y-7 border-t border-divider pt-7">
            <li>
              <p className="text-ui text-stone-dim">Oriel</p>
              <p className="mt-1 text-display-m text-ivory">“Walk me through the launch you led. What changed because of&nbsp;you?”</p>
            </li>
            <li>
              <p className="text-ui text-stone-dim">You</p>
              <p className="mt-1 text-body-l text-stone">“We improved onboarding, and people seemed to like it.”</p>
            </li>
            <li>
              <p className="text-ui text-stone-dim">Oriel</p>
              <p className="mt-1 text-display-m text-ivory">“Earlier you said activation was the goal. How far did it move, and what did you do that the team&nbsp;didn’t?”</p>
              <p className="mt-3 text-ui text-stone-dim">A thin answer gets a sharper question.</p>
            </li>
          </ol>
        </figure>

        <div className="col-span-4 sm:col-span-8 lg:col-span-7 lg:col-start-6">
          <table className="w-full text-left">
            <caption className="pb-3 text-left text-ui text-stone">Three of the five pressure levels <span className="text-stone-dim">(your interviewer shifts these slightly)</span></caption>
            <thead>
              <tr className="border-b border-divider">
                <td className="py-2" />
                {LEVELS.map((l) => <th key={l} scope="col" className="py-2 pl-3 text-ui font-medium text-ivory">{PRESSURE_LABELS[l]}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-divider">
                  <th scope="row" className="py-3 pr-3 text-ui font-normal text-stone">{label}</th>
                  {LEVELS.map((l) => <td key={l} className="py-3 pl-3 text-ui tabular-nums text-ivory">{value(l)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── The feedback: an annotated answer ────────────────────────────────────────

export function Feedback() {
  return (
    <section id="read" aria-labelledby="read-title" className="bg-surface-1 py-[var(--space-section)]">
      <div className="frame page-grid gap-y-10">
        <div className="col-span-4 sm:col-span-8 lg:col-span-6">
          <h2 id="read-title" className="text-display-l text-ivory">Evidence, not adjectives.</h2>
          <p className="mt-6 max-w-[34rem] text-body-l text-stone">
            After every interview, Oriel marks the moments that mattered in your answers and attaches one change to each. Every measure says how far to trust it.
          </p>
        </div>

        <figure id="playback" className="col-span-4 scroll-mt-24 sm:col-span-8 lg:col-span-12">
          <figcaption className="text-meta text-stone-dim">Example feedback</figcaption>
          <div className="mt-4 grid gap-x-6 gap-y-6 border-t border-divider pt-7 lg:grid-cols-12">
            <blockquote className="text-body-l text-stone lg:col-span-7">
              <p className="mb-3 text-ui text-stone-dim">You, at <span className="font-mono text-meta tabular-nums">12:10</span></p>
              “Last spring we had two weeks to decide whether to retire our old onboarding flow. The usage data was incomplete, so{" "}
              <mark className="bg-transparent text-ivory underline decoration-olive-light decoration-1 underline-offset-[0.25em]">I set a decision date and agreed up front on what result would change our minds<sup className="ml-0.5 font-mono text-[0.75rem] text-olive-light no-underline">1</sup></mark>.
              We ran the holdout for a week, and{" "}
              <mark className="bg-transparent text-ivory underline decoration-olive-light decoration-1 underline-offset-[0.25em]">I think in the end we kept parts of both<sup className="ml-0.5 font-mono text-[0.75rem] text-olive-light no-underline">2</sup></mark>.”
            </blockquote>
            <ol className="space-y-6 lg:col-span-4 lg:col-start-9">
              <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
                <span className="font-mono text-meta text-olive-light" aria-hidden>1</span>
                <p className="text-body text-stone"><span className="block text-ui font-medium text-ivory">Strength</span>You set a decision date and defined what would change your mind before running the test.</p>
              </li>
              <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
                <span className="font-mono text-meta text-olive-light" aria-hidden>2</span>
                <p className="text-body text-stone"><span className="block text-ui font-medium text-ivory">Next time</span>You explained the process but not the result. Close with the outcome and what you learned.</p>
              </li>
            </ol>
          </div>
        </figure>

        <div className="col-span-4 sm:col-span-8 lg:col-span-7">
          <table className="w-full text-left">
            <caption className="pb-3 text-left text-ui text-stone">From the same Read</caption>
            <thead className="sr-only"><tr><th scope="col">Measure</th><th scope="col">This session</th><th scope="col">Target</th><th scope="col">How far to trust it</th></tr></thead>
            <tbody className="border-t border-divider">
              {[
                ["Pace", "142 words a minute", "120 to 160", "High confidence"],
                ["Fillers", "2.1 a minute", "Under 3", "High confidence"],
                ["Answer structure", "Outcome missing in 2 of 3 answers", "All four parts", "Medium confidence"],
              ].map(([k, v, t, c]) => (
                <tr key={k} className="border-b border-divider">
                  <th scope="row" className="py-3 pr-4 text-ui font-medium text-ivory">{k}</th>
                  <td className="py-3 pr-4 text-ui tabular-nums text-stone">{v}</td>
                  <td className="hidden py-3 pr-4 text-ui text-stone-dim sm:table-cell">{t}</td>
                  <td className="py-3 text-right text-ui text-stone-dim">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 max-w-[40rem] text-ui text-stone">
            Never measured: attractiveness, age, race, emotion, personality, accent. <Link href="/trust" className={linkCls}>How accurate is the Read</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Trust and privacy ────────────────────────────────────────────────────────

const PRIVACY: [string, string][] = [
  ["Your interviewer is an AI, and says so.", "Every session opens by telling you. Oriel is for practice; it is not used to screen candidates."],
  ["The camera waits for your consent.", "A separate consent screen comes before each session, and you can always answer by typing instead."],
  ["Your face stays on your device.", "Face and body landmarks are processed in your browser and never leave it. Oriel keeps only derived numbers."],
  ["You decide what’s kept.", "Recordings are deleted after 30 days by default, sooner if you choose. Delete any session, or your account, at any time."],
];

export function Privacy() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="py-[var(--space-section)]">
      <div className="frame page-grid gap-y-10">
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <h2 id="privacy-title" className="text-display-l text-ivory">Private by default. Practice only.</h2>
          <p className="mt-6"><Link href="/privacy" className={linkCls}>Read the privacy and biometric policy</Link></p>
        </div>
        <dl className="col-span-4 grid gap-x-6 gap-y-8 sm:col-span-8 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          {PRIVACY.map(([t, d]) => (
            <div key={t} className="border-t border-divider pt-5">
              <dt className="text-body-l text-ivory">{t}</dt>
              <dd className="mt-2 text-body text-stone">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const TIERS: PlanId[] = ["free", "sprint", "pro", "executive"];
/** Inclusions aligned across plans, from each plan's limits and features in lib/billing/plans. */
const INCLUDES: [string, Record<string, string>][] = [
  ["Practice", { free: "One 10-minute session a week", sprint: "14 days, sessions up to 45 minutes", pro: "Sessions up to 45 minutes", executive: "Sessions up to 60 minutes" }],
  ["The Read and Playback", { free: "Basic Read, three Playback moments", sprint: "Full Read and Playback", pro: "Full Read and Playback", executive: "Full Read and Playback" }],
  ["Panel interviews", { free: "—", sprint: "Up to three interviewers", pro: "—", executive: "Up to four interviewers" }],
  ["Drills", { free: "One a day", sprint: "Two a day", pro: "No daily limit", executive: "No daily limit" }],
  ["The Ladder", { free: "—", sprint: "Included", pro: "Included, with progress tracking", executive: "Included" }],
  ["Extras", { free: "—", sprint: "120 avatar minutes", pro: "60 avatar minutes a month", executive: "All domain packs, and one session reviewed by a human coach" }],
];

export function Pricing({ cta }: { cta: string }) {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="border-t border-divider py-[var(--space-section)]">
      <div className="frame">
        <div className="page-grid gap-y-6">
          <h2 id="pricing-title" className="col-span-4 text-display-l text-ivory sm:col-span-8 lg:col-span-6">Pay for the interview you have coming&nbsp;up.</h2>
          <p className="col-span-4 max-w-[30rem] self-end text-body-l text-stone sm:col-span-6 lg:col-span-5 lg:col-start-8">Start free. Take a two-week sprint before the one that matters, or keep building month to month.</p>
        </div>
        <div className="mt-14 grid gap-y-12 lg:grid-cols-4 lg:grid-rows-[auto_repeat(6,auto)_auto] lg:gap-x-6 lg:gap-y-0">
          {TIERS.map((id) => {
            const p = PLANS[id];
            const featured = id === "sprint";
            return (
              <div key={id} className={cn("border-t pt-6 lg:row-span-8 lg:grid lg:grid-rows-subgrid", featured ? "border-olive-light" : "border-divider")}>
                <div className="pb-6">
                  <h3 className="font-display text-[1.75rem] leading-tight text-ivory">{p.name}</h3>
                  <p className="mt-1 text-ui text-stone-dim">{p.blurb}</p>
                  <p className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-[2.75rem] leading-none tabular-nums text-ivory">{p.price}</span>
                    {p.cadence && <span className="text-ui text-stone">{p.cadence}</span>}
                  </p>
                </div>
                {INCLUDES.map(([label, by]) => (
                  <div key={label} className="border-t border-divider py-3">
                    <p className="text-meta text-stone-dim">{label}</p>
                    <p className={cn("mt-0.5 text-ui", by[id] === "—" ? "text-stone-dim" : "text-stone")}>{by[id] === "—" ? <><span aria-hidden>—</span><span className="sr-only">Not included</span></> : by[id]}</p>
                  </div>
                ))}
                <div className="pt-6">
                  <Link href={id === "executive" ? "mailto:hello@oriel.example" : cta}
                    className={cn("inline-flex h-11 items-center justify-center rounded-button px-5 text-ui font-medium transition-colors duration-[var(--dur-press)]",
                      featured ? "bg-ivory text-ink hover:bg-mist-200" : "border border-control text-ivory hover:border-stone")}>
                    {id === "free" ? "Start free" : id === "executive" ? "Talk to us" : `Choose ${p.name}`}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-10 max-w-[44rem] text-ui text-stone">Career centers: campus seats are quoted per student, per year, with aggregate reporting and no individual data shared without consent.</p>
      </div>
    </section>
  );
}

// ─── The last line ────────────────────────────────────────────────────────────

export function Closing({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <section aria-labelledby="closing-title" className="border-t border-divider py-[var(--space-section)]">
      <div className="frame flex flex-col items-start gap-8 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="closing-title" className="text-display-l text-ivory">Walk in ready.</h2>
        <Link href={cta} className="inline-flex h-12 w-full items-center justify-center rounded-button bg-ivory px-6 text-ui font-medium text-ink transition-[background-color,transform] duration-[var(--dur-press)] hover:bg-mist-200 active:scale-[0.985] min-[480px]:w-auto lg:h-11">
          {signedIn ? "Practice an interview" : "Start practicing free"}
        </Link>
      </div>
    </section>
  );
}
