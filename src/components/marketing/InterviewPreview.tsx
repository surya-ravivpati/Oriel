"use client";

import { useEffect, useRef, useState } from "react";
import { Interviewer, type InterviewerState } from "@/components/brand/Interviewer";
import { cn } from "@/components/ui/cn";

/*
 * The hero's proof: an interview taking place, Oriel asking, you answering. Illustrative content,
 * labelled as a sample. Rendered complete on the server; with scripts and motion allowed, it
 * plays one slow loop (question, answer at ~150 words a minute, follow-up, pause) that the
 * visitor can pause, and that pauses itself on hover, focus, off-screen and in hidden tabs.
 */
const QUESTION = "Tell me about a time you had to make a decision without all the data you wanted.";
const FOLLOW_UP = "What would you have done if the holdout had been inconclusive?";
const ANSWER = "Last spring we had two weeks to decide whether to retire our old onboarding flow. The usage data was incomplete, so I set a decision date, ran a one-week holdout with ten percent of new users, and agreed with the team up front on what result would change our minds…".split(" ");
const STILL = 33; // the composed state stops mid-answer, after "…ten percent of new users,"
const LIVE = 6;   // the most recent words are set in ivory, as if still being spoken
const WORD_MS = 400;

type Phase = "ask" | "answer" | "follow" | "rest";
interface Scene { phase: Phase; shown: number }

export function InterviewPreview() {
  const [scene, setScene] = useState<Scene>({ phase: "answer", shown: STILL });
  const [motionOk, setMotionOk] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState({ hover: false, focus: false });
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [blink, setBlink] = useState(false);
  const root = useRef<HTMLElement>(null);
  const running = motionOk && !userPaused && !held.hover && !held.focus && inView && visible;

  // Environment: reduced motion, visibility on screen, tab visibility. Read after hydration only.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionOk(!mq.matches);
    const first = requestAnimationFrame(sync);
    mq.addEventListener("change", sync);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    if (root.current) io.observe(root.current);
    const vis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => { cancelAnimationFrame(first); mq.removeEventListener("change", sync); io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  // The loop: one timeout at a time, so pausing simply freezes the scene where it is.
  useEffect(() => {
    if (!running) return;
    const { phase, shown } = scene;
    const next: [number, Scene] =
      phase === "ask" ? [3600, { phase: "answer", shown: 0 }]
      : phase === "answer" ? (shown < ANSWER.length ? [WORD_MS, { phase, shown: shown + 1 }] : [1400, { phase: "follow", shown: 0 }])
      : phase === "follow" ? [4200, { phase: "rest", shown: 0 }]
      : [1600, { phase: "ask", shown: 0 }];
    const id = setTimeout(() => setScene(next[1]), next[0]);
    return () => clearTimeout(id);
  }, [running, scene]);

  // An occasional blink, at irregular intervals of three to seven seconds.
  useEffect(() => {
    if (!running) return;
    let open: ReturnType<typeof setTimeout>;
    const id = setTimeout(() => { setBlink(true); open = setTimeout(() => setBlink(false), 150); }, 3000 + Math.random() * 4000);
    return () => { clearTimeout(id); clearTimeout(open); };
  }, [running, blink]);

  const question = scene.phase === "follow" || scene.phase === "rest" ? FOLLOW_UP : QUESTION;
  const said = scene.phase === "answer" ? scene.shown : 0;
  const state: InterviewerState = scene.phase === "ask" || scene.phase === "follow" ? "speaking" : "listening";
  const label = state === "speaking" ? "Asking" : "Listening";

  return (
    <section ref={root} aria-labelledby="sample-title" className="rounded-panel border border-transparent bg-surface-1"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setHeld((h) => ({ ...h, hover: true })); }}
      onPointerLeave={() => setHeld((h) => ({ ...h, hover: false }))}
      onFocus={() => setHeld((h) => ({ ...h, focus: true }))}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld((h) => ({ ...h, focus: false })); }}>
      <h2 id="sample-title" className="sr-only">Sample interview</h2>
      <p className="sr-only">
        A sample session for a product manager, behavioral round. Oriel asks: “{QUESTION}” You answer: “{ANSWER.join(" ")}” Oriel follows up: “{FOLLOW_UP}”
      </p>

      <div className="flex items-center justify-between gap-4 border-b border-divider px-5 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-4" aria-hidden>
          <p className="text-ui text-stone">Product manager · Behavioral</p>
          <p className="text-meta text-stone-dim sm:hidden">Sample session</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="hidden text-meta text-stone-dim sm:block" aria-hidden>Sample session</p>
          {motionOk && (
            <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? "Play the sample interview" : "Pause the sample interview"}
              className="-my-2.5 -mr-3 grid size-11 place-items-center rounded-control text-stone transition-colors duration-[var(--dur-press)] hover:text-ivory">
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                {userPaused ? <path d="M3 1.8v8.4l7-4.2z" fill="currentColor" /> : <path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" />}
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="page-grid gap-y-6 px-5 py-8 sm:px-6 lg:px-0 lg:py-12" aria-hidden>
        <div className="col-span-4 flex items-center gap-3 sm:col-span-3 sm:flex-col sm:justify-start sm:gap-4 sm:pt-1 lg:col-span-6">
          <Interviewer size={140} state={state} blink={blink && running} className="w-[72px] sm:w-[120px] lg:w-[140px]" />
          <p className="flex items-center gap-2 text-ui text-stone sm:justify-center">
            <span className={cn("size-1.5 rounded-full bg-olive-light transition-opacity duration-[var(--dur-state)]", state === "speaking" && "opacity-40")} />
            {label}
          </p>
        </div>
        <div className="col-span-4 sm:col-span-5 lg:col-span-6 lg:pr-12">
          <p className="text-ui text-stone-dim">Oriel</p>
          <p key={question} className={cn("hang mt-1 min-h-[5em] text-display-m text-ivory sm:min-h-[3.75em]", running && "animate-[fade-in_var(--dur-panel)_var(--ease-enter)]")}>“{question}”</p>
          <p className="mt-6 text-ui text-stone-dim">You</p>
          <div className="mt-1 flex h-[4.8em] flex-col justify-end overflow-hidden text-body [mask-image:linear-gradient(to_bottom,transparent,black_45%)] sm:h-[4.8em]">
            <p className="text-stone">
              {ANSWER.slice(0, said).map((w, i) => <span key={i} className={cn(i >= said - LIVE && "text-ivory")}>{w} </span>)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
