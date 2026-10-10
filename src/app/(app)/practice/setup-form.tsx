"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { FieldError, Input, Segmented, Toggle } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/client/api";
import { PRESSURE_DESCRIPTIONS, PRESSURE_LABELS, type PressureLevel } from "@/lib/interview/pressure";
import { ROLE_TO_DOMAIN } from "@/lib/interview/domain-packs";
import { PANEL_ROLE_LABEL, PANEL_ROLE_PERSONA, PERSONAS, panelRolesForSize, type PersonaId } from "@/lib/interview/personas";
import { AvatarStudio, type SavedStyles } from "@/components/avatar/AvatarStudio";
import { BotStill } from "@/components/avatar/BotStill";
import { InterviewerStage } from "@/components/avatar/InterviewerStage";
import { cn } from "@/components/ui/cn";

const SINGLE: { id: PersonaId; label: string; hint: string; walkingInto: string }[] = [
  { id: "warm_recruiter", label: "Warm Recruiter", hint: "Relaxed, encouraging, checks your story", walkingInto: "a warm recruiter" },
  { id: "hiring_manager", label: "Hiring Manager", hint: "Neutral and direct: what did you do?", walkingInto: "a hiring manager" },
  { id: "skeptic", label: "Skeptic", hint: "Minimal reactions, tests every claim", walkingInto: "a skeptical manager" },
  { id: "executive", label: "Executive", hint: "Controlled, sparse, deliberate pauses", walkingInto: "an executive" },
];

const TYPE_LABELS: Record<string, string> = { behavioral: "Behavioral", technical: "Technical", case: "Case", leadership: "Leadership", mixed: "Mixed" };

const ROLES = ["Software Engineer", "Product Manager", "Consultant", "Finance", "Research", "Clinical", "Executive", "Custom"] as const;

type Props = {
  profile: { targetRole: string; domain: string; type: string; persona: string; experience: string; cameraMetrics: boolean };
  resume: { name: string; roles: number } | null;
  jd: { title: string; competencies: string[] } | null;
  ladder: { level: number; name: string; unlocked: boolean; mode: string; pressure: number; personaIds: string[] }[];
  currentLadder: number;
  initialLadder: number | null;
  firstRun: boolean;
  limits: { plan: string; canStart: string | null; panel: boolean; maxPanel: number; ladder: boolean; maxMinutes: number };
  styles: SavedStyles;
};

export function SetupForm(p: Props) {
  const router = useRouter();
  const matchedRole = ROLES.find((r) => ROLE_TO_DOMAIN[r] === p.profile.domain) ?? "Custom";
  const [roleChoice, setRoleChoice] = useState<(typeof ROLES)[number]>(matchedRole);
  const [customRole, setCustomRole] = useState(p.profile.targetRole);
  const [level, setLevel] = useState<"recruiter" | "hiring_manager" | "senior_manager" | "executive">(p.profile.experience === "executive" ? "executive" : p.profile.experience === "senior" ? "senior_manager" : "hiring_manager");
  const [type, setType] = useState(p.profile.type as "behavioral" | "technical" | "case" | "leadership" | "mixed");
  const [persona, setPersona] = useState(p.profile.persona as "warm_recruiter" | "hiring_manager" | "skeptic" | "executive");
  const [pressure, setPressure] = useState<PressureLevel>(p.firstRun ? 2 : 3);
  const [mode, setMode] = useState<"single" | "panel">("single");
  const [panelSize, setPanelSize] = useState(3);
  const [minutes, setMinutes] = useState(Math.min(15, p.limits.maxMinutes));
  const [cameraMetrics, setCameraMetrics] = useState(p.profile.cameraMetrics);
  const [ladderLevel, setLadderLevel] = useState<number | null>(p.initialLadder);
  const [styles, setStyles] = useState<SavedStyles>(p.styles);
  const [editing, setEditing] = useState<PersonaId | null>(null);
  const nameOf = (id: PersonaId) => styles[id]?.name ?? PERSONAS[id].name.split(" ")[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: string } | null>(p.limits.canStart ? { message: p.limits.canStart, upgrade: "sprint" } : null);

  // When the chip matches the user's own field, interview for their actual target role.
  const role = roleChoice === "Custom" ? customRole : ROLE_TO_DOMAIN[roleChoice] === p.profile.domain ? (p.profile.targetRole || roleChoice) : roleChoice;
  const domain = roleChoice === "Custom" ? p.profile.domain : ROLE_TO_DOMAIN[roleChoice];
  const rung = ladderLevel ? p.ladder.find((l) => l.level === ladderLevel) : null;

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ sessionId: string }>("/api/interviews", {
        method: "POST",
        json: { role: role.trim() || "Candidate", domain, level, type, pressure, persona, mode, panelSize, ladderLevel, targetMinutes: minutes, cameraMetrics },
      });
      router.push(`/room/${r.sessionId}`);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setError({ message: err?.message ?? "Couldn't set up the interview", upgrade: err?.code?.startsWith("upgrade:") ? err.code.slice(8) : undefined });
      setBusy(false);
    }
  }

  const walking: string[] = rung?.personaIds?.length ? rung.personaIds : mode === "panel" ? panelRolesForSize(panelSize).map((r) => PANEL_ROLE_PERSONA[r]) : [persona];
  const roles = p.resume?.roles ?? 0;

  return (
    <div className="page-grid gap-y-12">
      <div className="col-span-4 sm:col-span-8 lg:col-span-7">
        <header>
          <h1 className="text-display-l text-ivory">{p.firstRun ? "Your first interview." : "Set up the room."}</h1>
          {p.firstRun && <p className="mt-5 max-w-[36rem] text-body-l text-stone">We&apos;ve started you at Realistic pressure. Speak naturally: the interviewer can hear pauses, follow-ups adapt to what you say, and nothing is scored until afterwards.</p>}
        </header>

        <div className="mt-[var(--spacing-group)] space-y-10">
          {p.limits.ladder && (
            <Group label="Climb the Ladder" hint="Optional: sets the interviewer and pressure for you">
              <Segmented name="Ladder" value={ladderLevel ? String(ladderLevel) : "custom"} onChange={(v) => setLadderLevel(v === "custom" ? null : Number(v))}
                options={[{ value: "custom", label: "Custom" }, ...p.ladder.map((l) => ({ value: String(l.level), label: `${l.level} · ${l.name}`, disabled: !l.unlocked }))]} />
            </Group>
          )}
          <Group label="Role">
            <Segmented name="Role" value={roleChoice} onChange={setRoleChoice} options={ROLES.map((r) => ({ value: r, label: r }))} />
            {roleChoice === "Custom" && <Input className="mt-3 max-w-[26rem]" value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Role title" aria-label="Custom role" />}
          </Group>
          <Group label="Round">
            <Segmented name="Level" value={level} onChange={setLevel} options={[
              { value: "recruiter", label: "Recruiter" }, { value: "hiring_manager", label: "Hiring Manager" }, { value: "senior_manager", label: "Senior Manager" }, { value: "executive", label: "Executive" },
            ]} />
          </Group>
          <Group label="Type">
            <Segmented name="Type" value={type} onChange={setType} options={[
              { value: "behavioral", label: "Behavioral" }, { value: "technical", label: "Technical" }, { value: "case", label: "Case" }, { value: "leadership", label: "Leadership" }, { value: "mixed", label: "Mixed" },
            ]} />
          </Group>

          {!rung && (
            <>
              <Group label="Format">
                <Segmented name="Format" value={mode} onChange={setMode} options={[
                  { value: "single", label: "One interviewer" },
                  { value: "panel", label: "Panel", hint: p.limits.panel ? "2–4 interviewers who cross-question" : "Sprint and Executive plans", disabled: !p.limits.panel },
                ]} />
              </Group>
              {mode === "single" ? (
                <Group label="Interviewer" hint="Choose one, then make it yours">
                  {/* The interviewers stand side by side; the chosen one is lit. Each is the real avatar, as it will appear in the Room. */}
                  <div role="radiogroup" aria-label="Interviewer" className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
                    {SINGLE.map((o) => {
                      const on = persona === o.id;
                      return (
                        <div key={o.id} className="flex flex-col items-center">
                          <button type="button" role="radio" aria-checked={on} aria-label={`${nameOf(o.id)}, ${o.label}: ${o.hint}`} onClick={() => setPersona(o.id as typeof persona)}
                            className={cn("w-full rounded-panel px-2 pb-4 pt-1 text-center transition-colors duration-[var(--dur-state)]", on ? "bg-surface-1" : "hover:bg-surface-1/50")}>
                            <BotStill personaId={o.id} style={styles[o.id]} className={cn("mx-auto aspect-square w-full max-w-[8.5rem] transition-opacity duration-[var(--dur-state)]", !on && "opacity-80")} />
                            <span className={cn("-mt-1 block truncate font-display text-body-l", on ? "text-ivory" : "text-stone")}>{nameOf(o.id)}</span>
                            <span className="mt-0.5 block text-meta text-stone">{o.label}</span>
                            <span className="mt-1 line-clamp-2 block text-meta text-stone-dim">{o.hint}</span>
                          </button>
                          <button type="button" onClick={() => setEditing(o.id)} aria-label={`Customize ${nameOf(o.id)}`}
                            className="mt-1 h-9 rounded-control px-3 text-meta text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory pointer-coarse:h-11">Customize</button>
                        </div>
                      );
                    })}
                  </div>
                </Group>
              ) : (
                <Group label="Panel size">
                  <Segmented name="Panel size" value={String(panelSize)} onChange={(v) => setPanelSize(Number(v))} options={[2, 3, 4].map((n) => ({ value: String(n), label: `${n} interviewers`, hint: ["Hiring manager, Skeptic", "+ Peer", "+ Executive"][n - 2], disabled: n > p.limits.maxPanel }))} />
                  <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
                    {panelRolesForSize(panelSize).map((role) => {
                      const id = PANEL_ROLE_PERSONA[role];
                      return (
                        <div key={role} className="flex flex-col items-center text-center">
                          <BotStill personaId={id} style={styles[id]} className="aspect-square w-full max-w-[8.5rem]" />
                          <p className="-mt-1 max-w-full truncate font-display text-body-l text-ivory">{nameOf(id)}</p>
                          <p className="mt-0.5 text-meta text-stone">{PANEL_ROLE_LABEL[role]}</p>
                          <button type="button" onClick={() => setEditing(id)} aria-label={`Customize ${nameOf(id)}`}
                            className="mt-1 h-9 rounded-control px-3 text-meta text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory pointer-coarse:h-11">Customize</button>
                        </div>
                      );
                    })}
                  </div>
                </Group>
              )}
              <Group label="Pressure" aside={<span className="text-display-m text-ivory">{PRESSURE_LABELS[pressure]}</span>}>
                <input aria-label="Pressure" type="range" min={1} max={5} step={1} value={pressure} onChange={(e) => setPressure(Number(e.target.value) as PressureLevel)} className="dial w-full" />
                <div className="mt-1 flex justify-between text-meta text-stone-dim">{[1, 2, 3, 4, 5].map((l) => <span key={l}>{l}</span>)}</div>
                <p className="mt-3 max-w-[36rem] text-ui text-stone">{PRESSURE_DESCRIPTIONS[pressure]}</p>
              </Group>
            </>
          )}

          <Group label="Length">
            <Segmented name="Length" value={String(minutes)} onChange={(v) => setMinutes(Number(v))} options={[10, 15, 20, 30].map((m) => ({ value: String(m), label: `${m} min`, disabled: m > p.limits.maxMinutes }))} />
          </Group>
          <div className="border-t border-divider">
            <Toggle checked={cameraMetrics} onChange={setCameraMetrics} label="Camera-based signals" description="Estimate camera engagement and posture on your device. Off means no gaze or posture in your Read; you can still see yourself and record." />
          </div>
        </div>
      </div>

      {/* The ticket for this session: who you are about to meet, live, and the one action that matters. */}
      <aside className="col-span-4 sm:col-span-8 lg:col-span-5 lg:col-start-8 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-panel bg-surface-1 px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
          <p className="text-ui text-stone">You&apos;re walking into</p>
          <InterviewerStage personaIds={walking} styles={styles} className="mx-auto h-[clamp(11rem,8rem+8vw,15rem)] w-full" />
          <p className="-mt-2 text-display-m text-ivory">{rung ? rung.name : mode === "panel" ? `A ${panelSize}-person panel` : `${nameOf(persona as PersonaId)}, ${SINGLE.find((o) => o.id === persona)?.walkingInto ?? "an interviewer"}`}</p>
          <p className="mt-2 text-ui text-stone">{role || "Your role"} · {TYPE_LABELS[type]} · {rung ? `pressure ${rung.pressure} of 5` : PRESSURE_LABELS[pressure]} · about {minutes} min</p>
          <dl className="mt-6 divide-y divide-divider border-y border-divider text-ui">
            <div className="flex items-center justify-between py-2.5"><dt className="text-stone">Resume</dt><dd>{p.resume ? <Badge tone="good">{roles ? `${roles} role${roles === 1 ? "" : "s"}` : "Added"}</Badge> : <Link href="/profile#documents" className="text-stone underline decoration-1 underline-offset-[0.2em] hover:text-ivory">Add</Link>}</dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-stone">Job description</dt><dd>{p.jd ? <Badge tone="good">{p.jd.competencies.length} competencies</Badge> : <Link href="/profile#documents" className="text-stone underline decoration-1 underline-offset-[0.2em] hover:text-ivory">Add</Link>}</dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-stone">Plan</dt><dd className="text-ivory">{p.limits.plan}</dd></div>
          </dl>
          {error && (
            <div className="mt-5">
              <FieldError>{error.message}</FieldError>
              {error.upgrade && <Link href="/profile#plan" className="mt-2 inline-block text-ui text-olive-light underline decoration-1 underline-offset-[0.2em]">See plans</Link>}
            </div>
          )}
          <Button size="lg" className="mt-6 w-full" onClick={start} loading={busy} disabled={!!p.limits.canStart}>Enter the Room</Button>
          <p className="mt-3 text-center text-meta text-stone-dim">You&apos;ll confirm camera and microphone consent first.</p>
        </div>
      </aside>
      {/* On phones and tablets the ticket sits after every setting, so its action also rides along at the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-ink/95 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="frame flex h-16 items-center justify-between gap-4">
          <p className="min-w-0 truncate text-ui text-stone"><span className="text-ivory">{rung ? rung.name : mode === "panel" ? `${panelSize}-person panel` : nameOf(persona as PersonaId)}</span> · {minutes} min</p>
          <Button className="shrink-0" onClick={start} loading={busy} disabled={!!p.limits.canStart}>Enter the Room</Button>
        </div>
      </div>
      <div className="h-16 lg:hidden" aria-hidden />
      <AvatarStudio personaId={editing} saved={styles} onClose={() => setEditing(null)} onSaved={setStyles} />
    </div>
  );
}

/** One setting: its label (and optional hint or current value) above the control. */
function Group({ label, hint, aside, children }: { label: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-ui font-medium text-ivory">{label}{hint && <span className="ml-2 font-normal text-stone-dim">{hint}</span>}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
