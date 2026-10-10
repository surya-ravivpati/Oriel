"use client";
/* eslint-disable react-hooks/immutability -- AvatarStore is an external mutable object read by the avatar's render loop, not React state. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BotAvatar } from "@/components/avatar/BotAvatar";
import { AvatarStore } from "@/lib/avatar/store";
import { PERSONAS } from "@/lib/interview/personas";
import { cn } from "@/components/ui/cn";

/*
 * The hero's proof: Daniel, the Classic face every new account meets, drawn and animated by the
 * same engine as the Room (its blinks, its listening nods, the light that breathes with its voice).
 * Below him the conversation runs like subtitles: his question in the serif, your answer in the
 * sans. Illustrative content, labelled as a sample. Rendered complete on the server (with a still
 * of the same face until the canvas takes over); with scripts and motion allowed it plays one slow
 * loop (question, answer at ~150 words a minute, follow-up, pause) that the visitor can pause, and
 * that pauses itself on hover, focus, off-screen and in hidden tabs.
 */
const QUESTION = "Tell me about a time you had to make a decision without all the data you wanted.";
const FOLLOW_UP = "What would you have done if the holdout had been inconclusive?";
const ANSWER = "Last spring we had two weeks to decide whether to retire our old onboarding flow. The usage data was incomplete, so I set a decision date, ran a one-week holdout with ten percent of new users, and agreed with the team up front on what result would change our minds…".split(" ");
const STILL = 15; // the composed state: the answer's first sentence, "…to retire our old onboarding flow."
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
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLParagraphElement>(null);
  const running = motionOk && !userPaused && !held.hover && !held.focus && inView && visible;
  const said = scene.phase === "answer" ? scene.shown : 0;

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

  // The interviewer: the avatar engine reads this store every frame. Speaking drives the voice light
  // with a synthetic level; listening nods now and then while you talk, as it does in the Room.
  const store = useMemo(() => {
    const s = new AvatarStore();
    s.pressure = 2;
    s.stillness = 0.35;
    return s;
  }, []);
  useEffect(() => {
    const t0 = performance.now();
    const wave = (t: number) => Math.max(0, Math.sin(t / 95) * 0.45 + Math.sin(t / 41) * 0.25);
    store.setLevel(() => (store.mode === "speaking" ? wave(performance.now() - t0) : 0));
  }, [store]);
  const seats = useMemo(() => {
    const p = PERSONAS.hiring_manager;
    return [{ seat: 0, personaId: p.id, name: p.name, accent: p.accent, expressiveness: p.expressiveness, warmth: p.warmth, skepticism: p.skepticism }];
  }, []);
  useEffect(() => {
    const speaking = scene.phase === "ask" || scene.phase === "follow";
    store.candidateSpeaking = scene.phase === "answer";
    store.setMode(speaking ? "speaking" : "listening");
    if (scene.phase === "follow") store.fireCue("lean_in");
    if (scene.phase === "answer" && (scene.shown === 18 || scene.shown === 40)) store.fireCue("nod");
  }, [scene, store]);

  // The answer scrolls like captions. Every word is laid out from the start (unspoken ones are
  // transparent), and a new line lifts the text with a transform, never a layout change, so the
  // loop causes no layout shift. Earlier lines fade at the top only once the text has lifted.
  useLayoutEffect(() => {
    const b = box.current, p = words.current;
    if (!b || !p) return;
    const place = () => {
      const last = said > 0 ? (p.children[said - 1] as HTMLElement | undefined) : undefined;
      const line = parseFloat(getComputedStyle(p).lineHeight);
      const lift = last ? Math.max(0, (Math.floor(last.offsetTop / line) + 1) * line - b.clientHeight) : 0;
      p.style.transition = said === 0 ? "none" : "";
      p.style.transform = lift ? `translateY(${-lift}px)` : "";
      b.dataset.lifted = String(lift > 0);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(b);
    return () => ro.disconnect();
  }, [said]);

  const question = scene.phase === "follow" || scene.phase === "rest" ? FOLLOW_UP : QUESTION;

  return (
    <section ref={root} aria-labelledby="sample-title" className="mx-auto flex max-w-[32rem] flex-col items-center"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setHeld((h) => ({ ...h, hover: true })); }}
      onPointerLeave={() => setHeld((h) => ({ ...h, hover: false }))}
      onFocus={() => setHeld((h) => ({ ...h, focus: true }))}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld((h) => ({ ...h, focus: false })); }}>
      <h2 id="sample-title" className="sr-only">Sample interview</h2>
      <p className="sr-only">
        A sample interview for a product manager, behavioral round, with Daniel, an AI hiring manager. Daniel asks: “{QUESTION}” You answer: “{ANSWER.join(" ")}” Daniel follows up: “{FOLLOW_UP}”
      </p>

      {/* The face fills ~0.74 of its square, its floor shadow below; a still of the same frame waits under the canvas.
          On a phone the still is the largest thing on the first screen, so it is fetched first. */}
      <div className="relative aspect-square w-[min(100%,15rem)] sm:w-[18rem] lg:w-[21rem]" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size still under the canvas, not content */}
        <img src="/interviewer/daniel-still.webp" alt="" width={672} height={672} fetchPriority="high" className="absolute inset-0 size-full" />
        <BotAvatar store={store} seats={seats} paused={!running} compact className="absolute inset-0" />
      </div>

      {/* The nameplate, centred under the face; the play control hangs after it without moving it. */}
      <div className="-mt-1 grid grid-cols-[2.75rem_auto_2.75rem] items-center">
        <p className="col-start-2 text-center text-ui text-stone-dim" aria-hidden>Sample interview with Daniel, a hiring&nbsp;manager</p>
        {/* Always laid out, so its arrival after hydration moves nothing; hidden (and unfocusable) without motion. */}
        <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? "Play the sample interview" : "Pause the sample interview"}
          className={cn("grid size-11 place-items-center rounded-full text-stone transition-colors duration-[var(--dur-press)] hover:text-ivory", !motionOk && "invisible")}>
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            {userPaused ? <path d="M3.5 1.8v8.4l6.5-4.2z" fill="currentColor" /> : <path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" />}
          </svg>
        </button>
      </div>

      {/* The conversation, as subtitles: his line in the serif, yours in the sans. */}
      <div className="mt-6 w-full" aria-hidden>
        {/* Both questions share one cell, so the line keeps the taller one's height at every width. */}
        <div className="grid text-display-m">
          <p className="hang invisible col-start-1 row-start-1">“{QUESTION}”</p>
          <p className="hang invisible col-start-1 row-start-1">“{FOLLOW_UP}”</p>
          <p key={question} className={cn("hang col-start-1 row-start-1 text-ivory", running && "animate-[fade-in_var(--dur-panel)_var(--ease-enter)]")}>“{question}”</p>
        </div>
        <p className="mt-5 text-meta text-stone-dim">You</p>
        <div ref={box} className="relative mt-1 h-[3.2em] overflow-hidden text-body data-[lifted=true]:[mask-image:linear-gradient(to_bottom,transparent,black_45%)]">
          <p ref={words} className="text-stone [text-wrap:wrap] transition-transform duration-[var(--dur-panel)] ease-[var(--ease-enter)]">
            {ANSWER.map((w, i) => (
              <span key={i} className={cn(i >= said ? "opacity-0" : i >= said - LIVE && "text-ivory")}>{w} </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
