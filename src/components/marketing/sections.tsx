import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";
import { contactEmail, paymentsLive } from "@/lib/site";

/*
 * The landing page after the hero shows one real session, in order, then answers the three
 * questions a careful visitor has left: what does it measure, what happens to my recordings,
 * what does it cost. The screenshots and the quoted exchange are from a practice run on Oriel
 * itself (sample answers, real interviewer, real feedback), and the page says so.
 *
 * No section ornaments: headings are plain statements of what the section shows, and the accent
 * marks only actions and the words the interviewer picked up on.
 */

const linkCls = "text-fg-muted underline decoration-accent decoration-1 underline-offset-text transition-colors duration-press hover:text-accent";
const frame = "overflow-hidden rounded-panel border border-line bg-page";

function Heading({ id, children, sub }: { id: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="max-w-lead">
      <h2 id={id} className="text-balance text-display-section text-fg">{children}</h2>
      {sub && <p className="mt-5 max-w-prose text-body-l text-fg-muted">{sub}</p>}
    </div>
  );
}

function Step({ n, title, children, className }: { n: number; title: string; children: React.ReactNode; className?: string }) {
  return (
    <li className={cn("border-t border-line pt-8", className)}>
      <h3 className="flex items-baseline gap-4 text-display-m text-fg">
        <span className="font-sans text-ui tabular-nums text-fg-subtle">{n}</span>
        {title}
      </h3>
      <div className="mt-6">{children}</div>
    </li>
  );
}

// ─── One session ──────────────────────────────────────────────────────────────

/** Everyone you can face, in the order the Ladder introduces them. */
const CAST: PersonaId[] = ["warm_recruiter", "hiring_manager", "direct_manager", "skeptic", "peer", "executive"];

/** Two lines from the practice run's transcript; `mark` are the words Daniel picked up on. */
const ANSWER = ["For the last three years I've ", { mark: "owned onboarding for clinics" }, ", and the result I'm known for is taking activation from ", { mark: "31 percent" }, " to 44 percent in one quarter by cutting the setup from nine steps to six."] as const;
const FOLLOW_UP = "Right. You mentioned that you owned onboarding for clinics for the last three years. How did you define and measure the baseline for that 31 percent activation rate before you implemented the changes?";

export function Session() {
  return (
    <section id="how" aria-labelledby="how-title" className="pt-section">
      <div className="frame">
        <Heading id="how-title" sub="Screens from a practice run on Oriel: a senior product manager interview with Daniel, the hiring manager. The answers were samples; the interviewer and the feedback are exactly what Oriel produced.">
          One session, start to finish
        </Heading>

        <ol className="mt-14 grid gap-y-16">
          <Step n={1} title="Choose the interview">
            <p className="max-w-prose text-body text-fg-muted">
              A role, the kind of interview (behavioral, technical, case or leadership), 10 to 30 minutes, and who sits across from you.
            </p>
            <ul className="mt-8 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-6">
              {CAST.map((id) => (
                <li key={id} className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small stills rendered by the avatar engine */}
                  <img src={`/interviewer/${id}.webp`} alt="" width={352} height={352} loading="lazy" decoding="async" className="mx-auto size-20 sm:size-24" />
                  <p className="mt-1 text-ui text-fg">{PERSONAS[id].name.split(" ")[0]}</p>
                  <p className="text-meta text-fg-subtle">{PERSONAS[id].label}</p>
                </li>
              ))}
            </ul>
          </Step>

          <Step n={2} title="Answer. It asks about what you said.">
            <div className="page-grid gap-y-6">
              <dl className="col-span-4 space-y-6 sm:col-span-8 lg:col-span-8">
                <div className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-ui text-fg-subtle">You</dt>
                  <dd className="text-body-l text-fg-muted">
                    “{ANSWER.map((part, i) => typeof part === "string" ? part : <mark key={i} className="bg-transparent text-fg underline decoration-accent decoration-2 underline-offset-[0.25em]">{part.mark}</mark>)}”
                  </dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-ui text-fg-subtle">Daniel</dt>
                  <dd className="font-display text-display-m text-fg">“{FOLLOW_UP}”</dd>
                </div>
              </dl>
              <p className="col-span-4 text-ui text-fg-subtle sm:col-span-8 lg:col-span-3 lg:col-start-10">
                Follow-ups come from your own words, so vague answers get pressed and numbers get checked. Speak, or type if you’d rather not use a microphone.
              </p>
            </div>
          </Step>

          {/* The step the product exists for: the largest thing on the page. */}
          <Step n={3} title="Read what it noticed">
            <p className="max-w-prose text-body text-fg-muted">
              In this run the answer to Daniel’s question never gave the baseline. The feedback caught it.
            </p>
            <figure className="mt-8">
              {/* A phone gets the two parts that stay readable at its width: the verdict and the next steps. */}
              <div className={cn(frame, "sm:hidden")}>
                <Image src="/product/feedback-summary-phone-title.png" width={1240} height={330} sizes="100vw" alt="Feedback page headline: “Strengthen response specificity and directly address the prompts.”" />
                <Image src="/product/feedback-summary-phone-steps.png" width={980} height={520} sizes="100vw" alt="Next steps: answer the interviewer’s exact question directly; replace vague phrases like ‘various stuff’ with specific actions and outcomes." />
              </div>
              <div className={cn(frame, "hidden sm:block")}>
                <Image src="/product/feedback-summary.png" width={2360} height={1420} sizes="(min-width: 1240px) 1240px, 100vw"
                  alt="Feedback page: “Strengthen response specificity and directly address the prompts.” Delivery on target, content 2 of 3 on target, and next steps: answer the interviewer’s exact question, replace vague phrases with specific actions and outcomes." />
              </div>
              <figcaption className="mt-3 text-meta text-fg-subtle">The top of the feedback page, seconds after the interview ended.</figcaption>
            </figure>
            <div className="page-grid mt-12 items-start gap-y-6">
              <div className="col-span-4 sm:col-span-8 lg:col-span-4">
                <p className="text-body text-fg">Each key moment says what was missing and one thing to try.</p>
                <p className="mt-3 text-ui text-fg-muted">Every moment links to the second it happened in your recording, and says how sure the measurement is.</p>
              </div>
              <figure className="col-span-4 sm:col-span-8 lg:col-span-7 lg:col-start-6">
                {/* Unframed: the moments already carry their own rules, and a frame around them reads as a box in a box. */}
                <div>
                  <Image src="/product/feedback-moments.png" width={960} height={830} sizes="(min-width: 1024px) 620px, 100vw"
                    alt="Two key moments. 00:27, baseline measurement definition: a 27-second answer with no stated result; try answering the baseline question directly. 00:40, stakeholder example: no concrete number, name or timeframe; try a specific request, the reason for saying no and the result." />
                </div>
              </figure>
            </div>
          </Step>

          <Step n={4} title="Fix the weakest answer">
            <figure>
              <div className={cn(frame, "sm:hidden")}>
                <Image src="/product/feedback-rewrite-phone.png" width={1170} height={520} sizes="100vw"
                  alt="Same facts, tighter: a rewrite with brackets for the project, the request, the reason and the result, which only you can fill in." />
              </div>
              <div className={cn(frame, "hidden sm:block")}>
                <Image src="/product/feedback-rewrite.png" width={2360} height={780} sizes="(min-width: 1240px) 1240px, 100vw"
                  alt="Your weakest answer, tightened. What you said: a vague answer about doing various things on a project. Same facts, tighter: a rewrite with brackets for the project, the request, the reason and the result." />
              </div>
            </figure>
            <p className="mt-6 max-w-prose text-body text-fg-muted">
              Brackets mark facts only you know; Oriel never invents them. Lessons and five-minute drills then practice the same skill, and your next interview checks whether it stuck.
            </p>
          </Step>
        </ol>
      </div>
    </section>
  );
}

// ─── What it measures ─────────────────────────────────────────────────────────

const MEASURED: [string, string][] = [
  ["Pace and pauses", "From your voice. Not measured when you type."],
  ["Filler words and hedging", "“Um”, “kind of”, “I think”, counted per minute."],
  ["Story structure and specificity", "Whether a story has a situation, your action and a result, with numbers."],
  ["Recovery", "How you handle a hard follow-up, from your voice."],
  ["Eye contact and posture", "Only if you turn camera signals on. Estimated in your browser."],
];

export function Measures() {
  return (
    <section id="accuracy" aria-labelledby="accuracy-title" className="pt-section">
      <div className="frame">
        <Heading id="accuracy-title">What it measures, and what it never does</Heading>
        <div className="page-grid mt-12 gap-y-10">
          <dl className="col-span-4 divide-y divide-line border-y border-line sm:col-span-8 lg:col-span-7">
            {MEASURED.map(([what, how]) => (
              <div key={what} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-6">
                <dt className="text-body text-fg">{what}</dt>
                <dd className="text-ui text-fg-muted">{how}</dd>
              </div>
            ))}
          </dl>
          <div className="col-span-4 sm:col-span-8 lg:col-span-4 lg:col-start-9">
            <p className="text-body text-fg">Never measured: appearance, age, race, emotion or accent.</p>
            <p className="mt-3 text-ui text-fg-muted">Every number comes with how far to trust it, and you’re only ever compared with your own earlier sessions.</p>
            <p className="mt-6 text-ui"><Link href="/trust" className={linkCls}>How accurate it is, with our test results</Link></p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Privacy ──────────────────────────────────────────────────────────────────

export function Privacy() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="pt-section">
      <div className="frame">
        <div className="page-grid gap-y-8">
          <h2 id="privacy-title" className="col-span-4 text-display-section text-fg sm:col-span-8 lg:col-span-5">What happens to your recordings</h2>
          <div className="col-span-4 max-w-prose space-y-4 text-body text-fg-muted sm:col-span-8 lg:col-span-6 lg:col-start-7 lg:pt-3">
            <p>Your camera and microphone stay off until you agree, every session. Face and posture tracking runs in your browser; only the numbers leave it, never images of your face.</p>
            <p>Recordings are encrypted and deleted after 30 days, or sooner if you choose. You can delete any session, or your whole account, from your profile.</p>
            <p className="text-ui"><Link href="/privacy" className={linkCls}>Read the privacy and biometric policy</Link></p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Price ────────────────────────────────────────────────────────────────────

const TIERS: PlanId[] = ["free", "sprint", "pro"];
const CADENCE: Partial<Record<PlanId, string>> = { sprint: "once, for 14 days", pro: "a month" };

/** Until payments are live there is nothing to choose between, so the page says so plainly. */
export function Pricing({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  const contact = contactEmail();
  if (!paymentsLive()) {
    return (
      <section id="pricing" aria-labelledby="pricing-title" className="py-section">
        <div className="frame">
          <div className="border-t border-line pt-12">
            <h2 id="pricing-title" className="text-display-section text-fg">Free during the beta</h2>
            <p className="mt-5 max-w-prose text-body-l text-fg-muted">Every feature is free while Oriel is in beta, with no card. Paid plans will come later, and you’ll hear about them before anything changes.</p>
            <ButtonLink href={cta} size="lg" className="mt-8 w-full min-[480px]:w-auto">{signedIn ? "Start an interview" : "Start a free mock interview"}</ButtonLink>
            {contact && <p className="mt-6 text-ui text-fg-subtle">Career centers: <a href={`mailto:${contact}?subject=Campus`} className={linkCls}>ask about campus seats</a>.</p>}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="py-section">
      <div className="frame">
        <Heading id="pricing-title">Price</Heading>
        <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-3">
          {TIERS.map((id) => {
            const p = PLANS[id];
            return (
              <li key={id} className="flex flex-col border-t border-line pt-6">
                <h3 className="text-ui font-medium text-fg">{p.name}</h3>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-display-l leading-none text-fg">{p.price}</span>
                  {CADENCE[id] && <span className="text-ui text-fg-muted">{CADENCE[id]}</span>}
                </p>
                <ul className="mt-6 flex-1 space-y-2 text-ui text-fg-muted">{p.features.slice(0, 3).map((f) => <li key={f}>{f}</li>)}</ul>
                <ButtonLink href={cta} variant={id === "sprint" ? "primary" : "secondary"} className="mt-8 self-start">{id === "free" ? "Start free" : `Choose ${p.name}`}</ButtonLink>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
