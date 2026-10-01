import { getCurrentUser } from "@/lib/auth/session";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { HeroInterviewer } from "@/components/marketing/HeroInterviewer";
import { PressureDemo } from "@/components/marketing/PressureDemo";
import { RoomPreview } from "@/components/marketing/RoomPreview";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { DRILLS, LADDER } from "@/lib/practice/catalog";
import { PLANS } from "@/lib/billing/plans";

export default async function Landing() {
  const user = await getCurrentUser();
  const cta = user ? "/practice" : "/signup";
  return (
    <>
      <SiteHeader signedIn={!!user} />
      <main className="overflow-x-clip">
        {/* ── Hero ── */}
        <section className="relative min-h-[100dvh] pt-16">
          <div className="absolute inset-0 window-light" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-5 sm:px-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.05fr_1fr]">
            <div className="pt-10 pb-4 lg:py-0">
              <Eyebrow className="rise">/ˈôrēəl/ · a window that juts out, so you can see and be seen</Eyebrow>
              <h1 className="rise mt-6 font-display text-[clamp(3rem,7.2vw,6.4rem)] leading-[0.95] tracking-[-0.02em] text-balance" style={{ animationDelay: "80ms" }}>
                Practice for the room <em className="text-lume">before</em> you&apos;re in it.
              </h1>
              <p className="rise mt-7 max-w-xl text-lg leading-relaxed text-mist-300" style={{ animationDelay: "180ms" }}>
                Oriel simulates realistic interviews, adapts pressure to your performance, and shows you exactly what happened in your own recording.
              </p>
              <div className="rise mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: "280ms" }}>
                <ButtonLink href={cta} variant="lume" size="lg">Practice an Interview</ButtonLink>
                <ButtonLink href="#how" variant="ghost" size="lg">See how it works ↓</ButtonLink>
              </div>
              <p className="rise mt-6 text-xs text-mist-400" style={{ animationDelay: "380ms" }}>Your interviewer is an AI. Practice only — never a live-interview copilot.</p>
            </div>
            <div className="relative h-[62vh] min-h-[420px] lg:h-[82vh]">
              <div className="absolute inset-x-[6%] top-[4%] bottom-[10%] rounded-[48px] border hairline bg-gradient-to-b from-lume/[0.07] to-transparent" aria-hidden />
              <HeroInterviewer />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
              <div className="absolute bottom-[12%] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border hairline bg-ink-900/70 px-3 py-1.5 backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-lume" />
                <span className="font-mono text-[11px] tracking-wide text-mist-300">Tom · Senior Manager · listening</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Problem ── */}
        <section id="how" className="mx-auto max-w-7xl px-5 py-32 sm:px-8">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-5 max-w-4xl font-display text-[clamp(2.2rem,4.6vw,4rem)] leading-[1.02] text-balance">
            Most people who fail interviews know their material. <span className="text-mist-400">They lose the room.</span>
          </h2>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border hairline bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Three-minute loops", "Answers that circle without landing a point."],
              ["Flat delivery", "The right story, told like a list of facts."],
              ["Avoiding the lens", "Looking away exactly when it matters."],
              ["Freezing on the follow-up", "The first answer was fine. The second question wasn't."],
            ].map(([t, d]) => (
              <div key={t} className="bg-ink-950 p-7">
                <p className="text-[15px] text-mist-100">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-mist-400">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-mist-300 leading-relaxed">
            Chatbots train the answer, but typing creates no pressure. Coaches train the delivery, but are too expensive to use often. And feedback usually arrives as adjectives — &ldquo;be more confident&rdquo; — instead of evidence you can act on.
          </p>
        </section>

        {/* ── Pressure ── */}
        <section className="border-y hairline bg-ink-900/60">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-28 sm:px-8 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>Pressure</Eyebrow>
              <h2 className="mt-5 font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02]">A dial that actually changes the person across from you.</h2>
              <p className="mt-6 max-w-lg text-mist-300 leading-relaxed">
                Pressure isn&apos;t a colour on a slider. It changes when the interviewer interrupts, how long they let silence sit, how hard they test the numbers you give, and how much reassurance you get. And it adapts: strong answers earn a harder interviewer.
              </p>
            </div>
            <PressureDemo />
          </div>
        </section>

        {/* ── The Room ── */}
        <section id="room" className="mx-auto max-w-7xl px-5 py-32 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow>The Room</Eyebrow>
              <h2 className="mt-5 font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02]">Someone is waiting for you to answer.</h2>
              <ul className="mt-8 space-y-5 text-mist-300">
                {[
                  ["It remembers.", "“Earlier you mentioned managing a team of twelve. What specifically changed because of you?”"],
                  ["It pushes back.", "Vague claims get a follow-up. Numbers get tested. Long answers get interrupted — when the pressure calls for it."],
                  ["It can be a panel.", "Two to four interviewers with different agendas who hand off, cut across and cross-question you."],
                  ["It stays out of the way.", "No scores on screen during the interview. You experience it first. The analysis comes after."],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-4"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-lume" /><p><span className="text-mist-100">{t}</span> {d}</p></li>
                ))}
              </ul>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border hairline-strong bg-ink-900 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)]">
              <div className="absolute inset-0 window-light" />
              <div className="absolute inset-x-0 top-5 flex justify-center"><span className="rounded-full border hairline bg-ink-950/60 px-3 py-1 font-mono text-[10px] tracking-widest text-mist-400">INTERVIEWER · AI</span></div>
              <RoomPreview />
              <div className="absolute bottom-[16%] right-[5%] aspect-video w-[26%] rounded-xl border hairline-strong bg-gradient-to-br from-ink-600 to-ink-800"><span className="absolute bottom-1.5 left-2 font-mono text-[9px] text-mist-400">You</span></div>
              <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">{["Mic", "Camera", "End"].map((b) => <span key={b} className="rounded-full border hairline bg-ink-950/70 px-3 py-1 text-[11px] text-mist-300">{b}</span>)}</div>
            </div>
          </div>
        </section>

        {/* ── The Read ── */}
        <section id="read" className="border-y hairline bg-ink-900/60">
          <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
            <Eyebrow>The Read</Eyebrow>
            <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02]">Measured behaviour, with the uncertainty left in.</h2>
            <p className="mt-6 max-w-2xl text-mist-300 leading-relaxed">Only things you can change. Ranges instead of face scores. Every signal says how much to trust it — and camera-based signals can be switched off.</p>
            <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Pace & pauses", "Words per minute, silence length, where pauses fall.", "High"],
                ["Filler & hedging", "“um”, “like”, “kind of”, “I think maybe” — per minute, with your worst moments.", "High"],
                ["Answer structure", "Situation, action, result, outcome — which part was missing.", "Medium"],
                ["Specificity", "Numbers, names and scope versus generalities.", "Medium"],
                ["Camera engagement", "Estimated head and gaze toward the lens. Webcams misread gaze; we say so.", "Medium"],
                ["Posture & movement", "Lean, slouch, sway and fidgeting as a timeline — not a grade.", "Medium"],
                ["Vocal variety", "Pitch and volume range; flat stretches flagged.", "Medium"],
                ["Recovery", "Time to your first word after a hard question, against your own history.", "Medium"],
                ["Setup", "Lighting, framing, background and audio level, with fixes.", "High"],
              ].map(([t, d, c]) => (
                <div key={t} className="rounded-2xl border hairline bg-ink-950/60 p-6">
                  <div className="flex items-center justify-between"><p className="text-mist-100">{t}</p><span className={`font-mono text-[10px] uppercase tracking-widest ${c === "High" ? "text-signal-good" : "text-signal-warn"}`}>{c}</span></div>
                  <p className="mt-2 text-sm leading-relaxed text-mist-400">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-mist-400">Never measured: attractiveness, age, race, emotion, personality, accent.</p>
          </div>
        </section>

        {/* ── Playback ── */}
        <section id="playback" className="mx-auto max-w-7xl px-5 py-32 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>Playback</Eyebrow>
              <h2 className="mt-5 font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02]">Not a score. <em className="text-lume">A moment</em> you can watch and fix.</h2>
              <p className="mt-6 max-w-lg text-mist-300 leading-relaxed">After every session Oriel picks the three to five moments that matter, jumps your recording to each one, and attaches one specific change to try. Plus a rewrite of your weakest answer — using only your own facts.</p>
            </div>
            <div className="space-y-3">
              {[
                ["08:42", "Salary expectations", "You paused for 4.8 seconds, then opened with three qualifiers.", "State your range first, then explain why."],
                ["12:10", "A time you failed", "Two minutes forty with no stated result.", "Finish with the outcome and what it meant."],
                ["15:31", "Team of twelve", "The interviewer asked how you measured it. You said “we”, eleven times.", "Separate your action from the team’s."],
              ].map(([ts, title, obs, fix], i) => (
                <div key={ts} className={`rounded-2xl border p-5 ${i === 0 ? "border-lume/30 bg-lume/[0.05]" : "hairline bg-white/[0.02]"}`}>
                  <p className="flex items-baseline gap-3"><span className="font-mono text-sm text-lume">{ts}</span><span className="text-mist-100">{title}</span></p>
                  <p className="mt-2 text-sm text-mist-300">{obs}</p>
                  <p className="mt-2 text-sm text-mist-100"><span className="text-lume">Try:</span> {fix}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Drills & Ladder ── */}
        <section className="border-y hairline bg-ink-900/60">
          <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
            <div className="grid gap-16 lg:grid-cols-2">
              <div>
                <Eyebrow>Drills</Eyebrow>
                <h2 className="mt-5 font-display text-4xl leading-tight">Five minutes on the one thing holding you back.</h2>
                <ul className="mt-8 divide-y divide-white/[0.06] border-y hairline">
                  {DRILLS.map((d) => (
                    <li key={d.id} className="flex items-baseline justify-between gap-6 py-4"><span className="text-mist-100">{d.title}</span><span className="text-right text-sm text-mist-400">{d.objective}</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <Eyebrow>The Ladder</Eyebrow>
                <h2 className="mt-5 font-display text-4xl leading-tight">From friendly recruiter to curveball panel.</h2>
                <ol className="mt-8 space-y-2">
                  {LADDER.map((l) => (
                    <li key={l.level} className="flex items-center gap-4 rounded-xl border hairline bg-ink-950/60 px-4 py-3" style={{ marginLeft: `${(l.level - 1) * 14}px` }}>
                      <span className="font-mono text-xs text-lume">{String(l.level).padStart(2, "0")}</span>
                      <span className="text-mist-100">{l.name}</span>
                      <span className="ml-auto hidden text-xs text-mist-400 sm:block">{l.mode === "panel" ? `${l.personaIds.length}-person panel` : "one-on-one"}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 text-sm text-mist-400">Unlock the next rung after two sessions above your own baseline. Progress is measured against you — never against other people.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust ── */}
        <section id="trust" className="mx-auto max-w-7xl px-5 py-32 sm:px-8">
          <Eyebrow>Trust</Eyebrow>
          <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02]">Private by default. Practice only.</h2>
          <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["An honest AI", "Every session opens by telling you the interviewer is an AI. We never feed answers during real interviews."],
              ["Consent before the camera", "A standalone consent screen names what is measured, why, how long it is kept, and how to delete it."],
              ["On-device analysis", "Face and pose landmarks are processed in your browser. Only derived numbers leave it — never face geometry."],
              ["30-day raw video", "Recordings are encrypted and deleted after 30 days by default. Shorten it, or delete in one click."],
              ["Never sold", "We never sell biometric data, and never share individual results with employers without your explicit consent."],
              ["Opt out of any signal", "Turn off gaze or posture metrics and still practice — no penalty for looking away."],
            ].map(([t, d]) => (
              <div key={t}><p className="text-mist-100">{t}</p><p className="mt-2 text-sm leading-relaxed text-mist-400">{d}</p></div>
            ))}
          </div>
          <p className="mt-12 text-sm text-mist-300">We test the Read against known ground truth and across accents, skin tones, eyewear and head coverings, and publish the results — <a href="/trust" className="text-lume underline-offset-4 hover:underline">see how accurate it is</a> · <a href="/privacy" className="text-lume underline-offset-4 hover:underline">privacy &amp; biometric policy</a>.</p>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="border-y hairline bg-ink-900/60">
          <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-5 font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02]">Pay for the interview you have coming up.</h2>
            <div className="mt-14 grid gap-4 lg:grid-cols-4">
              {(["free", "sprint", "pro", "executive"] as const).map((id) => {
                const p = PLANS[id];
                const featured = id === "sprint";
                return (
                  <div key={id} className={`relative flex flex-col rounded-3xl border p-7 ${featured ? "border-lume/40 bg-lume/[0.05]" : "hairline bg-ink-950/60"}`}>
                    {featured && <span className="absolute -top-3 left-7 rounded-full bg-lume px-2.5 py-0.5 text-[11px] font-medium text-ink-950">Most popular</span>}
                    <p className="text-mist-100">{p.name}</p>
                    <p className="mt-4 flex items-baseline gap-2"><span className="font-display text-5xl">{p.price}</span><span className="text-sm text-mist-400">{p.cadence}</span></p>
                    <p className="mt-2 text-sm text-mist-400">{p.blurb}</p>
                    <ul className="mt-6 flex-1 space-y-2.5 text-sm text-mist-300">{p.features.map((f) => <li key={f} className="flex gap-2.5"><span className="text-lume">—</span>{f}</li>)}</ul>
                    <ButtonLink href={id === "executive" ? "mailto:hello@oriel.example" : cta} variant={featured ? "lume" : "secondary"} className="mt-8">{id === "free" ? "Start free" : id === "executive" ? "Talk to us" : `Choose ${p.name}`}</ButtonLink>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-sm text-mist-400">Campus seats for career centers are quoted per student per year, with aggregate reporting and no individual data shared without consent.</p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 window-light opacity-80" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-5 py-40 text-center sm:px-8">
            <h2 className="font-display text-[clamp(2.6rem,6vw,5rem)] leading-[1] text-balance">When you walk in, it won&apos;t be the first time.</h2>
            <div className="mt-10 flex justify-center"><ButtonLink href={cta} variant="lume" size="lg">Practice an Interview</ButtonLink></div>
          </div>
        </section>
      </main>
      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10 text-sm text-mist-400 sm:px-8">
          <Logo />
          <p>Practice only. Your interviewer is an AI. <a href="/privacy" className="underline-offset-4 hover:text-mist-100 hover:underline">Privacy &amp; biometric policy</a></p>
          <p>© {new Date().getFullYear()} Oriel</p>
        </div>
      </footer>
    </>
  );
}
