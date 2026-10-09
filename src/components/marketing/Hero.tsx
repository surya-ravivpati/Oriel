"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { BotAvatar } from "@/components/avatar/BotAvatar";
import { ButtonLink, TextLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";
import { AvatarStore } from "@/lib/avatar/store";
import { PERSONAS } from "@/lib/interview/personas";

const EASE = [0.16, 1, 0.3, 1] as const;

/** What the interviewer says in the frame: it remembers, it tests numbers, it lets silence work. */
const LINES = [
  "Walk me through a decision you made. Not the team’s.",
  "You said the launch went well. What number tells you that?",
  "Take a moment. Then tell me what you’d do differently.",
];

/** The first screen says what Oriel is in a sentence, and shows it: the Room, mid-interview. */
export function Hero({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-28 sm:px-8 sm:pt-32 lg:pb-20 lg:pt-36">
        <h1 className="text-hero text-mist-100">Practice for the room <br className="hidden md:block" /><em>before</em> you’re in&nbsp;it.</h1>
        <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-4">
            <p className="max-w-[36rem] text-lead text-mist-300">
              Oriel is a mock interview with an AI interviewer who listens, follows up and pushes back. Afterwards you get the evidence: your recording, the moments that mattered, and what to change.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4 lg:flex-col lg:items-start">
              <ButtonLink href={cta} size="lg">{signedIn ? "Practice an interview" : "Start practicing free"}</ButtonLink>
              <TextLink href="#session" external className="text-[16px]">See a session, start to finish</TextLink>
            </div>
            {!signedIn && <p className="mt-6 font-mono text-[12px] text-mist-400">Free: one 10-minute interview a week. No card.</p>}
          </div>
          <div className="lg:col-span-8">
            <RoomFrame />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The Room as the product draws it: session bar, interviewer, the question, the controls. */
function RoomFrame() {
  const store = useMemo(() => {
    const s = new AvatarStore();
    s.configure({ pressure: 3, stillness: 0.4 });
    return s;
  }, []);
  const seats = useMemo(() => [{
    seat: 0, personaId: "hiring_manager", name: PERSONAS.hiring_manager.name, accent: "#A3AB8B",
    expressiveness: PERSONAS.hiring_manager.expressiveness, warmth: PERSONAS.hiring_manager.warmth, skepticism: PERSONAS.hiring_manager.skepticism,
  }], []);
  const [line, setLine] = useState(0);
  const [speaking, setSpeaking] = useState(true);
  const [clock, setClock] = useState(252);

  useEffect(() => {
    const t0 = performance.now();
    store.setLevel(() => (store.mode === "speaking" ? Math.max(0, Math.sin((performance.now() - t0) / 95) * 0.45 + Math.sin((performance.now() - t0) / 41) * 0.25) : 0));
    const tick = setInterval(() => setClock((c) => c + 1), 1000);
    const next = setInterval(() => { setLine((l) => (l + 1) % LINES.length); setSpeaking(true); }, 6500);
    return () => { clearInterval(tick); clearInterval(next); };
  }, [store]);
  useEffect(() => {
    // Speak the line, then listen: the mouth moves only while words are arriving.
    store.setMode("speaking");
    const quiet = setTimeout(() => { store.setMode("listening"); setSpeaking(false); }, 450 + LINES[line].split(" ").length * 170);
    return () => clearTimeout(quiet);
  }, [line, store]);

  const words = LINES[line].split(" ");
  // Four minutes in: earlier questions are already on the rail.
  const asked: [string, string][] = [["0:41", "Tell me about yourself, in about two minutes."], ["2:16", "Why this team, and why now?"], ...LINES.slice(0, line).map((q, i): [string, string] => [["3:05", "3:48"][i] ?? "4:02", q])];
  return (
    <figure>
      <div className="overflow-hidden rounded-lg border border-line-strong bg-ink-950">
        <div className="flex h-10 items-center justify-between gap-3 border-b border-line px-3.5 text-[12px]" aria-hidden>
          <span className="flex min-w-0 items-center gap-2 truncate text-mist-300"><LogoMark className="size-4 shrink-0" /><span className="font-medium text-mist-100">Mock interview</span><span className="hidden sm:inline">· Product Manager</span></span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1.5 text-mist-300"><span className="size-1.5 rounded-full bg-signal-bad" />Recording</span>
            <span className="font-mono tabular text-mist-100">{Math.floor(clock / 60)}:{String(clock % 60).padStart(2, "0")}</span>
          </span>
        </div>
        <div className="flex">
          <div className="relative min-w-0 flex-1">
            <div className="relative aspect-[16/9]" aria-hidden>
              <div className="absolute inset-x-[18%] inset-y-[6%]"><BotAvatar store={store} seats={seats} compact className="absolute inset-0" /></div>
              <div className="absolute bottom-3 right-3 aspect-[4/3] w-[24%] overflow-hidden rounded-md border border-line-strong">
                <Image src="/media/playback-frame.jpg" alt="" fill sizes="180px" className="object-cover object-[50%_30%]" />
                <span className="absolute bottom-1 left-1.5 text-[10px] font-medium text-mist-100">You</span>
              </div>
            </div>
            <div className="px-4 pb-4 sm:px-6 sm:pb-5">
              <p className="flex items-center gap-2 text-[12px]">
                <span className={cn("size-1.5 rounded-full transition-colors duration-300", speaking ? "bg-mist-100" : "bg-lume")} aria-hidden />
                <span className="font-medium text-mist-100">Daniel Reyes · Hiring Manager</span>
                <span className="font-mono text-[10px] text-mist-400">AI</span>
              </p>
              <AnimatePresence mode="wait">
                <motion.p key={line} className="mt-1.5 min-h-[2.7em] font-display text-[17px] leading-snug text-mist-100 sm:text-[21px]" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                  {words.map((w, i) => (
                    <motion.span key={i} className="inline-block pr-[0.24em]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.16, duration: 0.25, ease: EASE }}>{w}</motion.span>
                  ))}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className="hidden w-[34%] max-w-[220px] shrink-0 border-l border-line px-3.5 py-3 md:block" aria-hidden>
            <p className="text-[11px] font-medium text-mist-400">Questions so far</p>
            <ol className="mt-2.5 space-y-3">
              {asked.map(([t, q], i) => (
                <li key={q} className="grid grid-cols-[2.1rem_minmax(0,1fr)] gap-x-1.5">
                  <span className="pt-px font-mono text-[10px] text-mist-400">{t}</span>
                  <span className={cn("font-display text-[13px] leading-snug", i === asked.length - 1 ? "text-mist-100" : "text-mist-300")}>{q}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-t border-line px-3 py-2.5 text-[11px]" aria-hidden>
          <span className="flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2 font-medium text-mist-100">
            <span className="flex h-3 items-center gap-[2px]">{[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-full w-[2px] origin-center rounded-full", speaking ? "scale-y-[0.25] bg-mist-400" : "bg-lume motion-safe:animate-[meter_0.9s_ease-in-out_infinite]")} style={{ animationDelay: `${i * 120}ms` }} />)}</span>
            Mic
          </span>
          <span className="flex h-7 items-center rounded-md border border-line-strong px-2 font-medium text-mist-200">CC</span>
          <span className="min-w-0 flex-1 text-center text-mist-300">{speaking ? "Speaking" : "Listening"}</span>
          <span className="hidden h-7 items-center rounded-md border border-line-strong px-2 font-medium text-mist-100 sm:flex">Done answering</span>
          <span className="flex h-7 items-center rounded-md border border-signal-bad/45 px-2.5 font-medium text-signal-bad">End</span>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-caption text-mist-400">
        <span>The Room, mid-interview. The question stays readable once it has been asked; no scores while you talk.</span>
        <span className="font-mono">pressure 3/5</span>
      </figcaption>
    </figure>
  );
}
