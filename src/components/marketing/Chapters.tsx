import { BotStill } from "@/components/avatar/BotStill";
import { ButtonLink, TextLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { PLANS } from "@/lib/billing/plans";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";
import { Heading, Section } from "./Section";

// ─── Why practise out loud ────────────────────────────────────────────────────

export function Why() {
  return (
    <Section label="Why practise out loud">
      <p className="max-w-[20ch] text-display text-mist-100">Most people who fail interviews know their material. <span className="text-mist-400">They lose the room.</span></p>
      <dl className="mt-14 grid border-t border-line sm:grid-cols-3">
        {[
          ["Chatbots train the answer.", "But typing creates no pressure."],
          ["Coaches train the delivery.", "But they cost too much to use often."],
          ["Feedback arrives as adjectives.", "“Be more confident” is not evidence."],
        ].map(([a, b], i) => (
          <div key={a} className={cn("border-b border-line py-5 sm:border-b-0 sm:pr-6", i > 0 && "sm:border-l sm:pl-6")}>
            <dt className="font-medium text-mist-100">{a}</dt>
            <dd className="mt-1 text-callout text-mist-300">{b}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

// ─── The interviewers ─────────────────────────────────────────────────────────

const CAST: PersonaId[] = ["warm_recruiter", "hiring_manager", "direct_manager", "skeptic", "executive", "peer"];

export function Cast() {
  return (
    <Section id="interviewers" label="The interviewers">
      <Heading title="Six interviewers. Make any of them yours.">Change the shape, colour, voice and name. How each one interviews stays the same.</Heading>
      <ul className="mt-12 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {CAST.map((id) => {
          const p = PERSONAS[id];
          return (
            <li key={id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-4 border-t border-line py-5">
              <BotStill personaId={id} accent={p.accent} className="aspect-square w-full" />
              <div className="min-w-0">
                <p className="font-display text-[20px] leading-tight text-mist-100">{p.name}</p>
                <p className="text-[13px] text-mist-300">{p.title} <span className="font-mono text-[11px] text-mist-400">· {p.voice}</span></p>
                <p className="mt-2 hidden text-[13px] leading-snug text-mist-400 sm:block">{p.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ─── Privacy ──────────────────────────────────────────────────────────────────

/** A face and shoulders as the on-device models see them: points, not pixels. */
const MESH: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const ring = (n: number, cx: number, cy: number, rx: number, ry: number) => {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  };
  ring(34, 50, 46, 25, 32);
  ring(22, 50, 49, 16, 22);
  ring(8, 40, 41, 5, 2.4);
  ring(8, 60, 41, 5, 2.4);
  for (const cx of [40, 60]) for (let i = 0; i < 5; i++) pts.push([cx - 7 + i * 3.5, 35.5 - Math.sin((i / 4) * Math.PI) * 2]);
  for (let i = 0; i < 4; i++) pts.push([50, 42 + i * 4]);
  pts.push([46.5, 57], [53.5, 57]);
  ring(12, 50, 66, 8, 2.6);
  return pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
})();
const POSE: [number, number][] = [[42, 82], [58, 82], [17, 101], [83, 101], [33, 101], [67, 101]];
const EDGES: [number, number][] = (() => {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  MESH.forEach(([x, y], i) => {
    MESH.map(([u, v], j) => [j, (u - x) ** 2 + (v - y) ** 2] as const).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(k)) { seen.add(k); out.push([i, j]); }
    });
  });
  return out;
})();

const RECEIVED: [string, string][] = [["Head toward the lens", "0.92"], ["Engagement estimate", "64%"], ["Lean", "+2.1°"], ["Shoulder movement", "0.04"]];

const PROMISES: [string, string][] = [
  ["It always says it is an AI.", "Every session opens by saying so. Oriel is for practice only, never a copilot in a real interview."],
  ["Consent comes before the camera.", "A separate screen names what is measured, why, how long it is kept, and how to delete it."],
  ["Recordings expire.", "Encrypted, and deleted after 30 days by default. Make it a day, or delete in one click."],
  ["Nothing is sold or shared.", "Not your biometrics, not your results. Nothing reaches an employer without your explicit consent."],
  ["Any signal can be switched off.", "Turn off gaze or posture and keep practicing. Looking away costs you nothing."],
  ["The tests are published.", "Measured against ground truth across accents, skin tones, eyewear and head coverings, failures included."],
];

export function Privacy() {
  return (
    <Section id="privacy" label="Privacy">
      <Heading title="Your face never leaves your browser.">Face and pose landmarks are computed on your device and discarded frame by frame. Oriel receives a handful of numbers, never an image of your face.</Heading>
      <div className="mt-12 grid items-start gap-10 border-t border-line pt-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-14">
        <figure>
          <svg viewBox="0 0 100 112" className="w-full max-w-[15rem]" role="img" aria-label="A face and shoulders drawn as tracking points">
            <g stroke="var(--color-lume-deep)" strokeWidth="0.35">
              {EDGES.map(([a, b]) => <line key={`${a}-${b}`} x1={MESH[a][0]} y1={MESH[a][1]} x2={MESH[b][0]} y2={MESH[b][1]} />)}
              <path d="M42 82 58 82M42 82 17 101M58 82 83 101M33 101 42 82M67 101 58 82" />
            </g>
            {[...MESH, ...POSE].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i >= MESH.length ? 1.2 : 0.7} fill="var(--color-lume)" />)}
          </svg>
          <figcaption className="mt-3 text-caption text-mist-400">On your device: points like these, computed and thrown away every frame.</figcaption>
        </figure>
        <div>
          <p className="text-[13px] font-medium text-mist-400">What Oriel receives, moment by moment</p>
          <dl className="mt-3 border-t border-line">
            {RECEIVED.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6 border-b border-line py-3">
                <dt className="text-callout text-mist-300">{k}</dt>
                <dd className="font-mono text-[14px] tabular text-mist-100">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-caption text-mist-400">Derived numbers only. No face geometry, and never a score for your face.</p>
        </div>
      </div>
      <dl className="mt-14 grid gap-x-10 sm:grid-cols-2">
        {PROMISES.map(([t, d]) => (
          <div key={t} className="border-t border-line py-5">
            <dt className="font-medium text-mist-100">{t}</dt>
            <dd className="mt-1 text-callout text-mist-300">{d}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-callout">
        <TextLink href="/trust">How accurate is the Read</TextLink>
        <TextLink href="/privacy">Privacy and biometric policy</TextLink>
      </p>
    </Section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const TIERS = ["free", "sprint", "pro", "executive"] as const;
/** Hairlines between columns: two columns on tablets, four on desktop. */
const COLUMN = ["sm:pr-6", "sm:border-l sm:px-6", "sm:pr-6 lg:border-l lg:px-6", "sm:border-l sm:px-6"];

export function Pricing({ cta }: { cta: string }) {
  return (
    <Section id="pricing" label="Pricing" wide={<PlanTable cta={cta} />}>
      <Heading title="Pay for the interview you have coming up.">Start free. Take a two-week sprint before the one that matters, or keep building month to month.</Heading>
    </Section>
  );
}

function PlanTable({ cta }: { cta: string }) {
  return (
    <>
      <div className="mt-8 grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((id, i) => {
          const p = PLANS[id];
          const featured = id === "sprint";
          return (
            <div key={id} className={cn("relative flex flex-col border-b border-line py-7 lg:border-b-0", COLUMN[i])}>
              {featured && <span className="absolute inset-x-0 -top-px h-0.5 bg-lume sm:inset-x-6" aria-hidden />}
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-[16px] font-medium text-mist-100">{p.name}</span>
              </p>
              <p className="mt-1 text-caption text-mist-400">{p.blurb}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-none text-mist-100">{p.price}</span>
                {p.cadence && <span className="text-caption text-mist-400">{p.cadence}</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-callout text-mist-300">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <ButtonLink href={id === "executive" ? "mailto:hello@oriel.example" : cta} variant={featured ? "primary" : "secondary"} className="mt-8 self-start">
                {id === "free" ? "Start free" : id === "executive" ? "Talk to us" : `Choose ${p.name}`}
              </ButtonLink>
            </div>
          );
        })}
      </div>
      <p className="mt-6 max-w-[44rem] text-callout text-mist-400">Career centers: campus seats are quoted per student, per year, with aggregate reporting and no individual data shared without consent.</p>
    </>
  );
}

// ─── The last word ────────────────────────────────────────────────────────────

export function Closing({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <Section>
      <p className="max-w-[18ch] text-display text-mist-100">When you walk in, it won’t be the first time.</p>
      <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
        <ButtonLink href={cta} size="lg">{signedIn ? "Practice an interview" : "Start practicing free"}</ButtonLink>
        {!signedIn && <TextLink href="/login" className="text-[16px]">Sign in</TextLink>}
      </div>
    </Section>
  );
}
