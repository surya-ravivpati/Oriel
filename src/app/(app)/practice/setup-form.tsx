"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge, Card, Eyebrow } from "@/components/ui/Card";
import { FieldError, Input, Label, Segmented, Toggle } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/client/api";
import { PRESSURE_DESCRIPTIONS, PRESSURE_LABELS, type PressureLevel } from "@/lib/interview/pressure";
import { ROLE_TO_DOMAIN } from "@/lib/interview/domain-packs";
import { PANEL_ROLE_LABEL, PANEL_ROLE_PERSONA, PERSONAS, panelRolesForSize, type PersonaId } from "@/lib/interview/personas";
import { styleFor } from "@/lib/avatar/style";
import { AvatarStudio, type SavedStyles } from "@/components/avatar/AvatarStudio";
import { BotStill } from "@/components/avatar/BotStill";
import { cn } from "@/components/ui/cn";

const SINGLE: { id: PersonaId; label: string; hint: string; walkingInto: string }[] = [
  { id: "warm_recruiter", label: "Warm Recruiter", hint: "Relaxed, encouraging, checks your story", walkingInto: "a warm recruiter" },
  { id: "hiring_manager", label: "Hiring Manager", hint: "Neutral and direct: what did you do?", walkingInto: "a hiring manager" },
  { id: "skeptic", label: "Skeptic", hint: "Minimal reactions, tests every claim", walkingInto: "a skeptical manager" },
  { id: "executive", label: "Executive", hint: "Controlled, sparse, deliberate pauses", walkingInto: "an executive" },
];

const ROLES = ["Software Engineer", "Product Manager", "Consultant", "Finance", "Research", "Clinical", "Executive", "Custom"] as const;

type Props = {
  profile: { targetRole: string; domain: string; type: string; persona: string; experience: string; cameraMetrics: boolean };
  resume: { name: string; roles: number } | null;
  jd: { title: string; competencies: string[] } | null;
  ladder: { level: number; name: string; unlocked: boolean; mode: string; pressure: number }[];
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

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-12">
        <header>
          <Eyebrow>Practice</Eyebrow>
          <h1 className="mt-3 font-display text-5xl">{p.firstRun ? "Your first interview." : "Set up the room."}</h1>
          {p.firstRun && <p className="mt-3 max-w-xl text-mist-300">We&apos;ve started you at Realistic pressure. Speak naturally — the interviewer can hear pauses, follow-ups adapt to what you say, and nothing is scored until afterwards.</p>}
        </header>

        {p.limits.ladder && (
          <section>
            <Label>Climb the Ladder <span className="text-mist-400">(optional — sets interviewer and pressure for you)</span></Label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLadderLevel(null)} className={`rounded-full border px-3.5 py-1.5 text-sm ${!ladderLevel ? "border-lume/50 bg-lume/[0.08]" : "hairline-strong text-mist-400"}`}>Custom</button>
              {p.ladder.map((l) => (
                <button key={l.level} type="button" disabled={!l.unlocked} onClick={() => setLadderLevel(l.level)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm disabled:opacity-35 ${ladderLevel === l.level ? "border-lume/50 bg-lume/[0.08]" : "hairline-strong text-mist-300"}`}>
                  {String(l.level).padStart(2, "0")} {l.name}{!l.unlocked ? " 🔒" : ""}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-8">
          <div>
            <Label>Role</Label>
            <Segmented name="Role" value={roleChoice} onChange={setRoleChoice} options={ROLES.map((r) => ({ value: r, label: r }))} />
            {roleChoice === "Custom" && <Input className="mt-3" value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Role title" aria-label="Custom role" />}
          </div>
          <div>
            <Label>Round</Label>
            <Segmented name="Level" value={level} onChange={setLevel} options={[
              { value: "recruiter", label: "Recruiter" }, { value: "hiring_manager", label: "Hiring Manager" }, { value: "senior_manager", label: "Senior Manager" }, { value: "executive", label: "Executive" },
            ]} />
          </div>
          <div>
            <Label>Type</Label>
            <Segmented name="Type" value={type} onChange={setType} options={[
              { value: "behavioral", label: "Behavioral" }, { value: "technical", label: "Technical" }, { value: "case", label: "Case" }, { value: "leadership", label: "Leadership" }, { value: "mixed", label: "Mixed" },
            ]} />
          </div>
        </section>

        {!rung && (
          <section className="space-y-8">
            <div>
              <Label>Format</Label>
              <Segmented name="Format" value={mode} onChange={setMode} options={[
                { value: "single", label: "One interviewer" },
                { value: "panel", label: "Panel", hint: p.limits.panel ? "2–4 interviewers who cross-question" : "Sprint and Executive plans", disabled: !p.limits.panel },
              ]} />
            </div>
            {mode === "single" ? (
              <div>
                <Label hint="Choose one, then make it yours">Interviewer</Label>
                <div role="radiogroup" aria-label="Interviewer" className="grid gap-3 sm:grid-cols-2">
                  {SINGLE.map((o) => {
                    const on = persona === o.id;
                    return (
                      <div key={o.id} className={cn("relative flex items-center gap-3 rounded-2xl border py-2 pl-2 pr-3 transition-all duration-200", on ? "border-lume/50 bg-lume/[0.07] shadow-[0_0_0_3px_rgba(233,184,114,0.06)]" : "hairline-strong bg-white/[0.02] hover:bg-white/[0.05]")}>
                        <button type="button" role="radio" aria-checked={on} aria-label={`${nameOf(o.id)}, ${o.label} — ${o.hint}`} onClick={() => setPersona(o.id as typeof persona)} className="absolute inset-0 rounded-2xl" />
                        <BotStill personaId={o.id} style={styles[o.id]} className="pointer-events-none size-[72px] shrink-0" />
                        <div className="pointer-events-none min-w-0 flex-1">
                          <p className="truncate font-display text-xl leading-tight text-mist-100">{nameOf(o.id)}</p>
                          <p className="mt-0.5 text-xs text-mist-400"><span className="text-mist-300">{o.label}</span> · {o.hint}</p>
                        </div>
                        <button type="button" onClick={() => setEditing(o.id)} aria-label={`Customize ${nameOf(o.id)}`}
                          className="relative shrink-0 rounded-full border hairline-strong px-3 py-1 text-xs text-mist-300 transition-colors hover:border-lume/40 hover:text-mist-100">Customize</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <Label>Panel size</Label>
                <Segmented name="Panel size" value={String(panelSize)} onChange={(v) => setPanelSize(Number(v))} options={[2, 3, 4].map((n) => ({ value: String(n), label: `${n} interviewers`, hint: ["Hiring manager, Skeptic", "+ Peer", "+ Executive"][n - 2], disabled: n > p.limits.maxPanel }))} />
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {panelRolesForSize(panelSize).map((role) => {
                    const id = PANEL_ROLE_PERSONA[role];
                    return (
                      <div key={role} className="flex flex-col items-center rounded-2xl border hairline-strong bg-white/[0.02] px-2 pb-3">
                        <BotStill personaId={id} style={styles[id]} className="aspect-square w-full max-w-[110px]" />
                        <p className="max-w-full truncate font-display text-lg leading-tight">{nameOf(id)}</p>
                        <p className="text-[11px] text-mist-400">{PANEL_ROLE_LABEL[role]}</p>
                        <button type="button" onClick={() => setEditing(id)} aria-label={`Customize ${nameOf(id)}`} className="mt-2 rounded-full border hairline-strong px-3 py-1 text-xs text-mist-300 transition-colors hover:border-lume/40 hover:text-mist-100">Customize</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-baseline justify-between">
                <Label>Pressure</Label>
                <span className="font-display text-2xl">{PRESSURE_LABELS[pressure]}</span>
              </div>
              <input aria-label="Pressure" type="range" min={1} max={5} step={1} value={pressure} onChange={(e) => setPressure(Number(e.target.value) as PressureLevel)} className="dial w-full" />
              <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-mist-400">{[1, 2, 3, 4, 5].map((l) => <span key={l}>{l}</span>)}</div>
              <p className="mt-3 text-sm text-mist-300">{PRESSURE_DESCRIPTIONS[pressure]}</p>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div>
            <Label>Length</Label>
            <Segmented name="Length" value={String(minutes)} onChange={(v) => setMinutes(Number(v))} options={[10, 15, 20, 30].map((m) => ({ value: String(m), label: `${m} min`, disabled: m > p.limits.maxMinutes }))} />
          </div>
          <Card className="px-5">
            <Toggle checked={cameraMetrics} onChange={setCameraMetrics} label="Camera-based signals" description="Estimate camera engagement and posture on your device. Off means no gaze or posture in your Read — you can still see yourself and record." />
          </Card>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <Eyebrow>You&apos;re walking into</Eyebrow>
          {!rung && (
            <div className="mt-4 flex -space-x-3">
              {(mode === "panel" ? panelRolesForSize(panelSize).map((r) => PANEL_ROLE_PERSONA[r]) : [persona as PersonaId]).map((id) => (
                <BotStill key={id} personaId={id} style={styles[id]} className="size-16" />
              ))}
            </div>
          )}
          <p className="mt-3 font-display text-3xl leading-tight">{rung ? rung.name : mode === "panel" ? `A ${panelSize}-person panel` : `${nameOf(persona as PersonaId)}, ${SINGLE.find((o) => o.id === persona)?.walkingInto ?? "an interviewer"}`}</p>
          <p className="mt-2 text-sm text-mist-400">{role || "—"} · {type} · {rung ? `pressure ${rung.pressure}/5` : PRESSURE_LABELS[pressure].toLowerCase()} · ~{minutes} min</p>
          <div className="mt-6 space-y-3 border-t hairline pt-5 text-sm">
            <div className="flex items-center justify-between"><span className="text-mist-400">Resume</span>{p.resume ? <Badge tone="good">{p.resume.roles ? `${p.resume.roles} roles` : "Added"}</Badge> : <Link href="/profile#documents" className="text-mist-300 underline-offset-4 hover:underline">Add</Link>}</div>
            <div className="flex items-center justify-between"><span className="text-mist-400">Job description</span>{p.jd ? <Badge tone="good">{p.jd.competencies.length} competencies</Badge> : <Link href="/profile#documents" className="text-mist-300 underline-offset-4 hover:underline">Add</Link>}</div>
            <div className="flex items-center justify-between"><span className="text-mist-400">Plan</span><span className="text-mist-300">{p.limits.plan}</span></div>
          </div>
          {error && (
            <div className="mt-5">
              <FieldError>{error.message}</FieldError>
              {error.upgrade && <Link href="/profile#plan" className="mt-2 inline-block text-sm text-lume underline-offset-4 hover:underline">See plans →</Link>}
            </div>
          )}
          <Button variant="lume" size="lg" className="mt-6 w-full" onClick={start} loading={busy} disabled={!!p.limits.canStart}>Enter the Room</Button>
          <p className="mt-3 text-center text-xs text-mist-400">You&apos;ll confirm camera and microphone consent first.</p>
        </Card>
      </aside>
      <AvatarStudio personaId={editing} saved={styles} onClose={() => setEditing(null)} onSaved={setStyles} />
    </div>
  );
}
