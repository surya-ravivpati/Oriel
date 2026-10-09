"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "motion/react";
import { BotAvatar } from "@/components/avatar/BotAvatar";
import { TextLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { AvatarStore } from "@/lib/avatar/store";
import { PERSONAS } from "@/lib/interview/personas";
import { PRESSURE_DESCRIPTIONS, PRESSURE_LABELS, pressurePolicy, type PressureLevel } from "@/lib/interview/pressure";
import { LADDER } from "@/lib/practice/catalog";
import { Heading } from "./Section";

const EASE = [0.16, 1, 0.3, 1] as const;
const CHAPTERS = [
  { id: "in-the-room", n: "01", label: "In the room" },
  { id: "read", n: "02", label: "The Read" },
  { id: "playback", n: "03", label: "Playback" },
  { id: "practice", n: "04", label: "Practice" },
];

/**
 * One session, told in the order you live it. The margin keeps an index of where you are,
 * the way a transcript keeps its timecodes.
 */
export function Session() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(CHAPTERS.findIndex((c) => c.id === e.target.id));
    }, { rootMargin: "-40% 0px -55% 0px" });
    for (const c of CHAPTERS) { const el = document.getElementById(c.id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, []);
  return (
    <section id="session" aria-label="A session, start to finish" className="scroll-mt-14 border-t border-line">
      <div className="mx-auto grid max-w-[1240px] px-5 sm:px-8 lg:grid-cols-12 lg:gap-x-8">
        <nav aria-label="Chapters" className="hidden lg:col-span-3 lg:block">
          <p className="pt-[var(--space-section)] text-[13px] font-medium text-mist-400">A session, start to finish</p>
          <ol className="sticky top-24 mt-6 space-y-2.5">
            {CHAPTERS.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} aria-current={i === active ? "step" : undefined} className={cn("flex items-baseline gap-3 text-[15px] transition-colors duration-200", i === active ? "text-mist-100" : "text-mist-400 hover:text-mist-200")}>
                  <span className={cn("font-mono text-[12px] transition-colors duration-200", i === active && "text-lume")}>{c.n}</span>{c.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 lg:col-span-9">
          <Chapter id="in-the-room" index={0}>
            <Heading title="It listens, remembers and follows up.">
              The interviewer talks, waits and reacts while you answer. It keeps track of what you claimed and comes back to it. Turn the pressure up and it interrupts long answers, holds the silence and tests your numbers.
            </Heading>
            <PressureDemo />
            <p className="mt-8 max-w-[40rem] text-callout text-mist-300">Up to four interviewers can sit on a panel, each with a different agenda. They hand off to each other and cross-question you.</p>
          </Chapter>
          <Chapter id="read" index={1}>
            <Heading title="Evidence, not adjectives.">
              Afterwards, the Read: what you did, measured, with how far to trust each number. It only measures things you can change.
            </Heading>
            <Transcript />
            <Measures />
          </Chapter>
          <Chapter id="playback" index={2}>
            <Heading title="Watch the moment. Fix the moment.">
              Oriel picks the three to five moments that mattered, jumps your recording to each one, and attaches one specific change. Your weakest answer comes back rewritten, using only your own facts.
            </Heading>
            <Moments />
          </Chapter>
          <Chapter id="practice" index={3}>
            <Heading title="Then practise the one thing, in your own words.">
              Each lesson starts from what you actually said. A five-minute drill follows, measured by the same code as the interview.
            </Heading>
            <Markup />
            <Ladder />
          </Chapter>
        </div>
      </div>
    </section>
  );
}

function Chapter({ id, index, children }: { id: string; index: number; children: React.ReactNode }) {
  const c = CHAPTERS[index];
  return (
    <article id={id} aria-label={c.label} className={cn("scroll-mt-14 py-[var(--space-section)]", index > 0 && "border-t border-line")}>
      <p className="mb-6 flex items-baseline gap-3 text-[13px] font-medium text-mist-400 lg:hidden"><span className="font-mono text-[12px] text-lume">{c.n}</span>{c.label}</p>
      {children}
    </article>
  );
}

// ─── 01 · The pressure dial: the person across from you changes ──────────────

function PressureDemo() {
  const [level, setLevel] = useState<PressureLevel>(3);
  const store = useMemo(() => {
    const s = new AvatarStore();
    s.setMode("listening");
    s.candidateSpeaking = true;
    return s;
  }, []);
  const seats = useMemo(() => [{ seat: 0, personaId: "skeptic", name: PERSONAS.skeptic.name, accent: "#A3AB8B", expressiveness: PERSONAS.skeptic.expressiveness, warmth: PERSONAS.skeptic.warmth, skepticism: PERSONAS.skeptic.skepticism }], []);
  useEffect(() => {
    store.configure({ pressure: level, stillness: 0.15 + level * 0.15 });
    if (level >= 4) store.fireCue("brow_raise");
    else if (level <= 2) store.fireCue("nod");
  }, [level, store]);
  const p = pressurePolicy(level, PERSONAS.skeptic);
  const secs = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60} s` : ""}` : `${n} s`);
  const rows: [string, string][] = [
    ["Cuts in on a long answer after", p.interruptAfterSec ? secs(p.interruptAfterSec) : "never"],
    ["Silence before the next question", `${(p.preResponseSilenceMs / 1000).toFixed(1)} s`],
    ["Follow-ups on one question", `up to ${p.maxFollowUpDepth}`],
    ["Tests the numbers you give", `${Math.round(p.numericProbeRate * 100)}% of the time`],
  ];
  return (
    <div className="mt-12 grid gap-8 border-t border-line pt-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-12">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-[30px] leading-none text-mist-100">{PRESSURE_LABELS[level]}</p>
          <p className="font-mono text-[13px] text-mist-400">pressure {level}/5</p>
        </div>
        <input aria-label="Pressure" aria-valuetext={`${PRESSURE_LABELS[level]}, ${level} of 5`} type="range" min={1} max={5} step={1} value={level}
          onChange={(e) => setLevel(Number(e.target.value) as PressureLevel)} className="dial mt-5 w-full" style={{ ["--fill" as string]: `${((level - 1) / 4) * 100}%` }} />
        <p className="mt-2 min-h-[3.2em] text-callout text-mist-300">{PRESSURE_DESCRIPTIONS[level]}</p>
        <dl className="mt-5 border-t border-line" aria-live="polite">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6 border-b border-line py-3">
              <dt className="text-callout text-mist-300">{k}</dt>
              <dd className="font-mono text-[14px] tabular text-mist-100">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figure className="relative aspect-square overflow-hidden rounded-lg border border-line bg-ink-900">
        <figcaption className="absolute left-4 top-3.5 z-10 text-[12px] text-mist-300">Tom Hadley · Senior Manager <span className="ml-1 font-mono text-[11px] text-mist-400">AI</span></figcaption>
        <div className="absolute inset-[11%]" aria-hidden><BotAvatar store={store} seats={seats} compact className="absolute inset-0" /></div>
      </figure>
    </div>
  );
}

// ─── 02 · The Read: a transcript, marked up ───────────────────────────────────

type Span = [string, boolean];
const SCRIPT: { t: string; who: "Daniel" | "You"; say: string | Span[]; note?: [string, string] }[] = [
  { t: "00:41", who: "Daniel", say: "Earlier you said you managed twelve people. What changed because of you?" },
  {
    t: "00:49", who: "You",
    say: [["I think", true], [" we, ", false], ["um", true], [", ", false], ["basically", true], [" improved onboarding, and ", false], ["I guess", true], [" it went okay.", false]],
    note: ["4.2 s before your first word, then three hedges and a filler.", "No result stated."],
  },
  { t: "01:22", who: "Daniel", say: "How did you measure that?" },
  { t: "01:25", who: "You", say: "Activation went from 31 to 44 percent in one quarter. I led the redesign.", note: ["A number, a timeframe and your own action.", "Lead with this one."] },
];

function Transcript() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
  return (
    <div ref={ref} className="mt-12 border-t border-line" role="table" aria-label="Part of a transcript, with Oriel's notes">
      <div role="row" className="hidden grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_minmax(0,14rem)] gap-x-5 border-b border-line py-2 text-[12px] text-mist-400 md:grid">
        <span role="columnheader">Time</span><span role="columnheader">Speaker</span><span role="columnheader">Said</span><span role="columnheader">Oriel’s note</span>
      </div>
      {SCRIPT.map((l, i) => (
        <div key={l.t} role="row" className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-b border-line py-4 md:grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_minmax(0,14rem)] md:gap-x-5">
          <span role="cell" className="pt-1 font-mono text-[13px] tabular text-mist-400">{l.t}</span>
          <span role="cell" className={cn("pt-1 text-[13px] font-medium md:block", l.who === "You" ? "text-mist-100" : "text-mist-400")}>{l.who}</span>
          <p role="cell" className={cn("col-start-2 font-display text-[19px] leading-snug md:col-start-auto", l.who === "You" ? "text-mist-100" : "text-mist-300")}>
            {typeof l.say === "string" ? l.say : l.say.map(([w, marked], k) => (
              <span key={k} className={cn(marked && "decoration-2 underline-offset-[0.24em] transition-[text-decoration-color] duration-500", marked && "underline", marked && (seen ? "decoration-lume" : "decoration-transparent"))} style={marked ? { transitionDelay: `${300 + k * 120}ms` } : undefined}>{w}</span>
            ))}
          </p>
          <div role="cell" className="col-start-2 md:col-start-auto">
            {l.note && (
              <motion.p className="mt-2 text-callout md:mt-1" initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ duration: 0.5, ease: EASE, delay: 0.5 + i * 0.25 }}>
                <span className="text-mist-300">{l.note[0]}</span> <span className="font-medium text-mist-100">{l.note[1]}</span>
              </motion.p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const STAND: { part: string; verdict: string; marks: ("on" | "off" | "open")[]; why: string }[] = [
  { part: "Delivery", verdict: "3 of 4 on target", marks: ["on", "on", "off", "on"], why: "Off target: pauses" },
  { part: "Content", verdict: "1 of 3 on target", marks: ["off", "on", "off"], why: "Off target: structure, specificity" },
  { part: "Composure", verdict: "On target", marks: ["on"], why: "How you handle a hard question" },
  { part: "Presence", verdict: "On target", marks: ["open", "on", "on"], why: "Calibrated to your lens" },
];
const NEXT = [
  "Finish every story with the result, then what it meant.",
  "Put a number on it: the change, the scope and the timeframe.",
  "Start sooner. Under two seconds before your first word is enough.",
];

/** The top of a Read, as the product lays it out: where you stand, and what to do next. */
function Measures() {
  return (
    <div className="mt-14">
      <figure>
        <div className="overflow-hidden rounded-lg border border-line-strong bg-ink-900">
          <div className="border-b border-line px-5 py-4 sm:px-7 sm:py-5">
            <p className="text-[12px] text-mist-400">Playback · Product Manager · Behavioral · Daniel · pressure 3/5</p>
            <p className="mt-2 max-w-[30ch] font-display text-[23px] leading-tight text-mist-100 sm:text-[28px]">Clear on what you did, vague on what it changed.</p>
          </div>
          <div className="grid gap-8 px-5 py-5 sm:px-7 sm:py-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-10">
            <div>
              <p className="text-[12px] font-medium text-mist-400">Where you stand</p>
              <ul className="mt-2 border-t border-line">
                {STAND.map((r) => (
                  <li key={r.part} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 border-b border-line py-3">
                    <span className="font-medium text-mist-100">{r.part}</span>
                    <span className="flex items-center gap-2.5">
                      <span className={cn("text-[13px]", r.verdict === "On target" ? "text-lume" : "text-mist-300")}>{r.verdict}</span>
                      <span className="flex gap-1" aria-hidden>{r.marks.map((x, i) => <span key={i} className={cn("h-3 w-1.5 rounded-[1px]", x === "on" ? "bg-lume" : x === "off" ? "bg-signal-warn" : "bg-mist-400")} />)}</span>
                    </span>
                    <span className="col-span-2 text-[13px] text-mist-400">{r.why}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-medium text-mist-400">Next steps</p>
              <ol className="mt-2 border-t border-line">
                {NEXT.map((n, i) => (
                  <li key={n} className="grid grid-cols-[2rem_minmax(0,1fr)] border-b border-line py-3">
                    <span className="pt-0.5 font-mono text-[12px] text-lume">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-callout text-mist-100">{n}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 flex flex-wrap gap-2 text-[12px]" aria-hidden>
                <span className="rounded-md bg-mist-100 px-2.5 py-1.5 font-medium text-ink-950">Drill: Land the result</span>
                <span className="rounded-md border border-line-strong px-2.5 py-1.5 font-medium text-mist-100">Practice again</span>
              </p>
            </div>
          </div>
        </div>
        <figcaption className="mt-3 text-caption text-mist-400">The top of a Read. Beneath it: your recording, every measure with its range and confidence, and the full transcript.</figcaption>
      </figure>
      <p className="mt-6 max-w-[42rem] text-callout text-mist-400">
        Never measured: attractiveness, age, race, emotion, personality, accent. <TextLink href="/trust">How accurate is the Read</TextLink>
      </p>
    </div>
  );
}

// ─── 03 · Playback: the moments that mattered ─────────────────────────────────

const MOMENTS = [
  { at: "08:42", pct: 0.38, title: "Salary expectations", saw: "A 4.8-second pause, then three qualifiers before any number.", fix: "State your range first, then explain why." },
  { at: "12:10", pct: 0.55, title: "A time you failed", saw: "Two minutes forty seconds with no stated result.", fix: "Finish with the outcome and what it meant." },
  { at: "15:31", pct: 0.72, title: "Team of twelve", saw: "Asked how you measured it, you said “we” eleven times.", fix: "Separate your action from the team’s." },
];

function Moments() {
  const [active, setActive] = useState(0);
  const m = MOMENTS[active];
  return (
    <div className="mt-12 grid gap-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-10">
      <div>
        <div className="relative aspect-video overflow-hidden rounded-lg border border-line-strong bg-ink-900">
          <Image src="/media/playback-frame.jpg" alt="A candidate answering at their desk, as their webcam recorded them" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
          <span className="absolute left-3 top-3 rounded-sm bg-ink-950/85 px-1.5 py-0.5 font-mono text-[12px] tabular text-mist-100">{m.at}</span>
        </div>
        <div className="relative mt-4 h-5" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
          <div className="absolute inset-x-0 top-1/2 h-px origin-left bg-mist-300 transition-transform duration-500 ease-[var(--ease-out-expo)]" style={{ transform: `scaleX(${m.pct})` }} />
          {MOMENTS.map((x, i) => (
            <span key={x.at} className={cn("absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 transition-colors duration-300", i === active ? "bg-lume" : "bg-lume-deep")} style={{ left: `${x.pct * 100}%` }} />
          ))}
        </div>
        <p className="mt-1 flex justify-between font-mono text-[11px] text-mist-400"><span>00:00</span><span>22:48</span></p>
      </div>
      <ol className="border-t border-line">
        {MOMENTS.map((x, i) => (
          <li key={x.at} className="border-b border-line">
            <button type="button" onClick={() => setActive(i)} aria-pressed={i === active}
              className={cn("grid w-full grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 px-1 py-4 text-left transition-colors duration-150", i !== active && "hover:bg-ink-900")}>
              <span className={cn("pt-0.5 font-mono text-[13px] tabular", i === active ? "text-lume" : "text-mist-400")}>{x.at}</span>
              <span>
                <span className="block font-medium text-mist-100">{x.title}</span>
                {i === active && (
                  <>
                    <span className="mt-1.5 block text-callout text-mist-300">{x.saw}</span>
                    <span className="mt-1.5 block text-callout text-mist-100"><span className="font-medium text-lume">Try:</span> {x.fix}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── 04 · Practice: the lesson is your own sentence, edited ───────────────────

const SAID: Span[] = [["I think", true], [" I ", false], ["maybe", true], [" ", false], ["just", true], [" helped with the launch, and ", false], ["I guess", true], [" it ", false], ["probably", true], [" went okay. People liked it.", false]];

function Markup() {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
  return (
    <figure ref={ref} className="mt-12 border-t border-line pt-8">
      <figcaption className="text-[13px] font-medium text-mist-400">From a lesson: <span className="text-mist-200">Say it like you mean it</span></figcaption>
      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <p className="text-caption text-mist-400">What you said</p>
          <blockquote className="mt-2 font-display text-[22px] leading-snug text-mist-200">
            “{SAID.map(([w, hedge], k) => hedge
              ? <del key={k} className={cn("no-underline decoration-2 transition-[text-decoration-color,color] duration-500", seen ? "text-mist-400 line-through decoration-lume" : "decoration-transparent")} style={{ transitionDelay: `${200 + k * 90}ms` }}>{w}</del>
              : <span key={k}>{w}</span>)}”
          </blockquote>
        </div>
        <div>
          <p className="text-caption text-lume">Without the softeners</p>
          <blockquote className="mt-2 font-display text-[22px] leading-snug text-mist-100">“I helped with the launch, and it went okay. People liked it.”</blockquote>
          <p className="mt-3 text-caption text-mist-400">Same facts, same claim. Only the softeners are gone.</p>
        </div>
      </div>
      <ol className="mt-8 grid grid-cols-3 gap-4 text-[13px]" aria-label="How a lesson is finished">
        {["Learn it", "Practise it twice", "Use it in an interview"].map((s, i) => (
          <li key={s}>
            <span className={cn("block h-0.5", i < 2 ? "bg-lume" : "bg-line-strong")} />
            <span className={cn("mt-2 block", i < 2 ? "text-mist-200" : "text-mist-400")}>{s}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Ladder() {
  return (
    <div className="mt-16">
      <p className="max-w-[42rem] text-callout text-mist-300">
        <span className="font-medium text-mist-100">Then climb the Ladder.</span> Six rooms, from a friendly recruiter to a curveball panel. Each one opens after two sessions above your own baseline, never anyone else’s.
      </p>
      <ol className="mt-8 grid grid-cols-2 items-end gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
        {LADDER.map((l, i) => (
          <li key={l.level} className="border-t border-mist-400 pt-3 lg:mb-[var(--rise)]" style={{ ["--rise" as string]: `${i * 14}px` }}>
            <span className="font-mono text-[12px] text-mist-400">{String(l.level).padStart(2, "0")}</span>
            <span className="mt-0.5 block text-[14px] font-medium text-mist-100">{l.name}</span>
            <span className="block text-[12px] text-mist-400">{l.mode === "panel" ? `${l.personaIds.length}-person panel` : "one-on-one"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
