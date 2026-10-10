import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { InterviewerStage } from "@/components/avatar/InterviewerStage";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";

/*
 * The landing page after the hero: one idea per section, in the order a session happens.
 * Who interviews you, what you get back, what you practise next, how your data is handled, what
 * it costs. Every section opens the same way (a title, then a short lead beneath it, on the left
 * edge) and then shows its idea once, with a composition chosen for that content. Every claim
 * comes from the product (personas, the Read, lessons, the privacy policy, the plan data), and
 * every sample is labelled as one.
 */

const linkCls = "text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory";

function Opening({ id, title, children }: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="max-w-[40rem]">
      <h2 id={id} className="text-display-l text-ivory">{title}</h2>
      <p className="mt-5 text-body-l text-stone">{children}</p>
    </div>
  );
}

// ─── The interviewers ─────────────────────────────────────────────────────────

/** The cast, in the order the Ladder introduces them, each with how they interview (from their persona). */
const CAST: [PersonaId, string][] = [
  ["warm_recruiter", "Relaxed and encouraging. Checks how clearly you tell your story."],
  ["hiring_manager", "Neutral and direct. Wants to know what you actually did."],
  ["direct_manager", "Short on time. Redirects rambling and asks for the point."],
  ["skeptic", "Hard to read. Tests your claims, your numbers and your part in them."],
  ["peer", "Collegial and practical. Asks how the work really got done."],
  ["executive", "Few words, long pauses. Cares about judgement and scope."],
];

export function Interviewers() {
  return (
    <section id="how" aria-labelledby="cast-title" className="pt-section">
      <div className="frame">
        <Opening id="cast-title" title="Choose who sits across from you.">
          Six interviewers, from a friendly recruiter to a skeptic who tests every number. Each one listens, remembers what you said and follows up when an answer is thin.
        </Opening>

        <ul className="mt-group grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-6">
          {CAST.map(([id, how]) => {
            const p = PERSONAS[id];
            return (
              <li key={id} className="flex flex-col items-center text-center">
                <InterviewerStage personaIds={[id]} still={`/interviewer/${id}.webp`} className="aspect-square w-full max-w-[8.5rem] sm:max-w-[11rem]" />
                <p className="-mt-1 text-display-m text-ivory">{p.name.split(" ")[0]}</p>
                <p className="mt-0.5 text-ui text-stone">{p.title.charAt(0) + p.title.slice(1).toLowerCase()}</p>
                <p className="mt-3 max-w-[13rem] text-ui text-stone-dim">{how}</p>
              </li>
            );
          })}
        </ul>

        <p className="mt-group max-w-[40rem] text-body text-stone">
          Add your resume and the job description, and the questions are about your work. Turn up the pressure and they interrupt long answers, let silence sit and test every number. Up to four can sit on a panel.
        </p>
      </div>
    </section>
  );
}

// ─── The Read ─────────────────────────────────────────────────────────────────

const markCls = "bg-transparent text-ivory underline decoration-olive-light decoration-1 underline-offset-[0.25em]";
const noteNo = "text-meta text-olive-light";

/** Three measures from the same sample Read: what was measured, against what, and how far to trust it. */
const MEASURES: [string, string, string][] = [
  ["Pace", "142 words a minute", "Target 120 to 160. High confidence."],
  ["Filler words", "2.1 a minute", "Target under 3. High confidence."],
  ["Answer structure", "Outcome missing in 2 of 3 answers", "Target: all four parts. Medium confidence."],
];

export function Feedback() {
  return (
    <section id="read" aria-labelledby="read-title" className="pt-section">
      <div className="frame">
        <Opening id="read-title" title="Evidence, not adjectives.">
          After every interview you get the Read: the moments that mattered in your answers, each with one change to try. Every measure says how far to trust it.
        </Opening>

        <figure className="mt-group">
          <figcaption className="text-meta text-stone-dim">From a sample Read</figcaption>
          <div className="page-grid mt-4 gap-y-8 border-t border-divider pt-8">
            {/* Your words on the left; Oriel's notes beside them, numbered to the marked phrases. */}
            <blockquote className="col-span-4 sm:col-span-8 lg:col-span-7">
              <p className="hang-sans text-body-l text-stone">
                “Last spring we had two weeks to decide whether to retire our old onboarding flow. The usage data was incomplete, so{" "}
                <mark className={markCls}>I set a decision date and agreed up front on what result would change our minds</mark>
                <sup className={`${noteNo} ml-0.5`}>1</sup>. We ran the holdout for a week, and{" "}
                <mark className={markCls}>I think in the end we kept parts of both</mark>
                <sup className={`${noteNo} ml-0.5`}>2</sup>.”
              </p>
            </blockquote>
            <ol className="col-span-4 space-y-6 sm:col-span-6 lg:col-span-4 lg:col-start-9">
              <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline">
                <span className={noteNo} aria-hidden>1</span>
                <p className="text-body text-stone"><span className="block text-ui font-medium text-ivory">Strength</span>You set a decision date and defined what would change your mind before running the test.</p>
              </li>
              <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline">
                <span className={noteNo} aria-hidden>2</span>
                <p className="text-body text-stone"><span className="block text-ui font-medium text-ivory">Next time</span>You explained the process but not the result. Close with the outcome and what you learned.</p>
              </li>
            </ol>
          </div>

          <dl className="mt-12 grid gap-y-6 sm:grid-cols-3 sm:gap-x-6">
            {MEASURES.map(([name, value, note]) => (
              <div key={name} className="border-t border-divider pt-4">
                <dt className="text-ui text-stone">{name}</dt>
                <dd className="mt-1 text-body-l text-ivory">{value}</dd>
                <dd className="mt-1 text-meta text-stone-dim">{note}</dd>
              </div>
            ))}
          </dl>
        </figure>

        <p className="mt-10 max-w-[40rem] text-ui text-stone">
          Never measured: attractiveness, age, race, emotion, personality or accent.{" "}
          <Link href="/trust" className={`${linkCls} whitespace-nowrap`}>How accurate is the Read</Link>
        </p>
      </div>
    </section>
  );
}

// ─── Lessons and drills ───────────────────────────────────────────────────────

const blank = "text-olive-light";

export function Practice() {
  return (
    <section id="practice" aria-labelledby="practice-title" className="pt-section">
      <div className="frame">
        <Opening id="practice-title" title="Then practice the one thing that matters.">
          Oriel picks the skills furthest from target and teaches each one with your own answers. A five-minute drill follows, measured the same way as the interview.
        </Opening>

        <figure className="mt-group">
          <figcaption className="text-meta text-stone-dim">From the lesson “Land the result”</figcaption>
          <div className="page-grid mt-4 gap-y-8 border-t border-divider pt-8">
            <div className="col-span-4 sm:col-span-4 lg:col-span-5">
              <p className="text-ui text-stone">Your words</p>
              <p className="hang-sans mt-2 text-body-l text-stone">“We ran the holdout for a week, and I think in the end we kept parts of both.”</p>
            </div>
            <div className="col-span-4 sm:col-span-4 lg:col-span-6 lg:col-start-7">
              <p className="text-ui text-stone">Same story, with the lesson</p>
              <p className="hang-sans mt-2 text-body-l text-ivory">“We ran the holdout for a week and kept <span className={blank}>[what you kept]</span>. As a result, <span className={blank}>[what changed, with a number]</span>.”</p>
              <p className="mt-4 text-meta text-stone-dim">Anything in brackets is yours to fill in. Oriel never adds facts.</p>
            </div>
          </div>
        </figure>
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
    <section id="privacy" aria-labelledby="privacy-title" className="pt-section">
      <div className="frame page-grid gap-y-group">
        <div className="col-span-4 sm:col-span-8 lg:col-span-5">
          <h2 id="privacy-title" className="max-w-[12em] text-display-l text-ivory">Private by default. Practice only.</h2>
          <p className="mt-5 text-ui"><Link href="/privacy" className={linkCls}>Read the privacy and biometric policy</Link></p>
        </div>
        <dl className="col-span-4 grid gap-x-6 gap-y-10 sm:col-span-8 sm:grid-cols-2 lg:col-span-7 lg:col-start-6 xl:col-span-6 xl:col-start-7">
          {PRIVACY.map(([t, d]) => (
            <div key={t}>
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
/** The plan data's cadence, said as a phrase beside the price. */
const CADENCE: Partial<Record<PlanId, string>> = { sprint: "once, for 14 days", pro: "per month", executive: "add-on" };

export function Pricing({ cta }: { cta: string }) {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="pt-section">
      <div className="frame">
        <Opening id="pricing-title" title={<>Pay for the interview you have coming&nbsp;up.</>}>
          Start free. Take a two-week sprint before the one that matters, or keep practicing month to month.
        </Opening>
        <ul className="mt-group grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((id) => {
            const p = PLANS[id];
            // The plan built for an interview on the calendar carries the page's one filled action.
            const featured = id === "sprint";
            return (
              <li key={id} className="flex flex-col border-t border-divider pt-6">
                <h3 className="text-display-m text-ivory">{p.name}</h3>
                <p className="mt-1 text-ui text-stone">{p.blurb}</p>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="text-display-l leading-none text-ivory">{p.price}</span>
                  {CADENCE[id] && <span className="text-ui text-stone">{CADENCE[id]}</span>}
                </p>
                <ul className="mt-6 flex-1 space-y-2 text-ui text-stone">
                  {p.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <ButtonLink href={id === "executive" ? "mailto:hello@oriel.example" : cta} variant={featured ? "primary" : "secondary"} className="mt-8 self-start">
                  {id === "free" ? "Start free" : id === "executive" ? "Talk to us" : `Choose ${p.name}`}
                </ButtonLink>
              </li>
            );
          })}
        </ul>
        <p className="mt-14 max-w-[40rem] text-ui text-stone">Career centers: campus seats are quoted per student, per year, with aggregate reporting and no individual data shared without consent.</p>
      </div>
    </section>
  );
}

// ─── The last line ────────────────────────────────────────────────────────────

export function Closing({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <section aria-labelledby="closing-title" className="py-section">
      <div className="frame flex flex-col items-center text-center">
        <h2 id="closing-title" className="text-display-xl text-ivory">Walk in ready.</h2>
        <ButtonLink href={cta} size="lg" className="mt-8 w-full min-[480px]:w-auto">
          {signedIn ? "Practice an interview" : "Start practicing free"}
        </ButtonLink>
        {!signedIn && <p className="mt-3 text-ui text-stone-dim">Free: one 10-minute interview a week. No&nbsp;card&nbsp;required.</p>}
      </div>
    </section>
  );
}
