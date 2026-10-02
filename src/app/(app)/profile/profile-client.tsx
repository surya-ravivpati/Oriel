"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge, Card, Eyebrow } from "@/components/ui/Card";
import { FieldError, Input, Segmented, Textarea, Toggle } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/client/api";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";
import { AvatarStudio, type SavedStyles } from "@/components/avatar/AvatarStudio";
import { BotStill } from "@/components/avatar/BotStill";
import { voiceFor } from "@/lib/avatar/style";

type Privacy = { cameraMetricsEnabled: boolean; gazeMetricEnabled: boolean; postureMetricEnabled: boolean; recordVideo: boolean; videoRetentionDays: number };

export function ProfileClient(p: {
  privacy: Privacy; resume: { name: string; roles: string[]; createdAt: string } | null; jd: { title: string; competencies: string[] } | null;
  plan: { id: PlanId; name: string; periodEnd: string | null; sessionsThisWeek: number; drillsToday: number }; storedRecordings: number;
  consents: { id: string; kind: string; granted: boolean; version: string; at: string }[];
  styles: SavedStyles;
}) {
  const router = useRouter();
  const [privacy, setPrivacy] = useState(p.privacy);
  const [saving, setSaving] = useState<string | null>(null);
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [docError, setDocError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [styles, setStyles] = useState<SavedStyles>(p.styles);
  const [editing, setEditing] = useState<PersonaId | null>(null);

  async function savePrivacy(patch: Partial<Privacy>) {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    setSaving(Object.keys(patch)[0]);
    try { await api("/api/privacy/settings", { method: "PATCH", json: patch }); } finally { setSaving(null); }
  }

  async function uploadResume(file?: File) {
    setDocError(null);
    setBusy("resume");
    try {
      const form = new FormData();
      if (file) form.set("file", file); else form.set("text", resumeText);
      await api("/api/resume", { method: "POST", body: form });
      setResumeText("");
      router.refresh();
    } catch (e) { setDocError(e instanceof ApiError ? e.message : "Upload failed"); } finally { setBusy(null); }
  }

  async function saveJd() {
    setDocError(null);
    setBusy("jd");
    try { await api("/api/job-description", { method: "POST", json: { text: jdText } }); setJdText(""); router.refresh(); }
    catch (e) { setDocError(e instanceof ApiError ? e.message : "Couldn't save"); } finally { setBusy(null); }
  }

  async function choosePlan(plan: PlanId) {
    setBusy(plan);
    try { await api("/api/billing/checkout", { method: "POST", json: { plan } }); router.refresh(); }
    catch (e) { setDocError(e instanceof ApiError ? e.message : "Checkout failed"); } finally { setBusy(null); }
  }

  async function deleteAccount() {
    setBusy("delete");
    await api("/api/privacy/delete-account", { method: "POST", json: { confirm: "DELETE" } });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
      <nav className="hidden text-sm lg:block"><ul className="sticky top-24 space-y-2 text-mist-400">{[["documents", "Resume & role"], ["interviewers", "Your interviewers"], ["privacy", "Privacy"], ["plan", "Plan"], ["data", "Your data"]].map(([id, l]) => <li key={id}><a href={`#${id}`} className="hover:text-mist-100">{l}</a></li>)}</ul></nav>
      <div className="space-y-16">
        <section id="documents" className="scroll-mt-24">
          <h2 className="font-display text-3xl">Resume &amp; role</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between"><Eyebrow>Resume</Eyebrow>{p.resume && <Badge tone="good">Active</Badge>}</div>
              {p.resume ? (<><p className="mt-3 text-mist-100">{p.resume.name}</p><ul className="mt-2 space-y-1 text-sm text-mist-400">{p.resume.roles.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul></>) : <p className="mt-3 text-sm text-mist-400">No resume yet.</p>}
              <div className="mt-5 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={busy === "resume"}>Upload PDF / DOCX</Button>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadResume(f); }} />
              </div>
              <Textarea className="mt-3" rows={3} value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="…or paste resume text" />
              {resumeText.trim().length >= 40 && <Button size="sm" className="mt-2" onClick={() => uploadResume()} loading={busy === "resume"}>Save pasted resume</Button>}
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between"><Eyebrow>Job description</Eyebrow>{p.jd && <Badge tone="good">Active</Badge>}</div>
              {p.jd ? (<><p className="mt-3 text-mist-100">{p.jd.title}</p><p className="mt-2 text-sm text-mist-400">{p.jd.competencies.join(" · ") || "No specific competencies found"}</p></>) : <p className="mt-3 text-sm text-mist-400">No job description yet.</p>}
              <Textarea className="mt-5" rows={4} value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste a job description" />
              <Button size="sm" className="mt-2" onClick={saveJd} disabled={jdText.trim().length < 40} loading={busy === "jd"}>Save job description</Button>
            </Card>
          </div>
          <FieldError>{docError}</FieldError>
        </section>

        <section id="interviewers" className="scroll-mt-24">
          <h2 className="font-display text-3xl">Your interviewers</h2>
          <p className="mt-2 max-w-2xl text-sm text-mist-400">Give any of them a new shape, colour, name and voice. They keep their interviewing style; the look and sound are yours.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {(Object.keys(PERSONAS) as PersonaId[]).map((id) => {
              const name = styles[id]?.name ?? PERSONAS[id].name.split(" ")[0];
              return (
                <Card key={id} className="flex flex-col items-center px-3 pb-4">
                  <BotStill personaId={id} style={styles[id]} accent={PERSONAS[id].accent} className="aspect-square w-full max-w-[150px]" />
                  <p className="max-w-full truncate font-display text-2xl leading-tight">{name}</p>
                  <p className="mt-0.5 text-xs text-mist-400">{PERSONAS[id].title} · {voiceFor(id, styles[id])} voice</p>
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => setEditing(id)} aria-label={`Customize ${name}`}>Customize</Button>
                </Card>
              );
            })}
          </div>
          <AvatarStudio personaId={editing} saved={styles} onClose={() => setEditing(null)} onSaved={setStyles} />
        </section>

        <section id="privacy" className="scroll-mt-24">
          <h2 className="font-display text-3xl">Privacy</h2>
          <p className="mt-2 max-w-2xl text-sm text-mist-400">Camera signals are computed on your device; only derived numbers are stored. We never sell biometric data or share individual results with employers.</p>
          <Card className="mt-6 divide-y divide-white/[0.06] px-6">
            <Toggle checked={privacy.cameraMetricsEnabled} onChange={(v) => savePrivacy({ cameraMetricsEnabled: v })} label="Camera-based signals" description="Estimate camera engagement and posture. Off: you still see yourself and can record, but no camera measurements are made." />
            <Toggle checked={privacy.gazeMetricEnabled} disabled={!privacy.cameraMetricsEnabled} onChange={(v) => savePrivacy({ gazeMetricEnabled: v })} label="Camera engagement (gaze)" description="Turn off if you avoid eye contact for cultural, neurological or personal reasons — nothing is penalised." />
            <Toggle checked={privacy.postureMetricEnabled} disabled={!privacy.cameraMetricsEnabled} onChange={(v) => savePrivacy({ postureMetricEnabled: v })} label="Posture & movement" description="Lean, slouch, sway and fidgeting, shown as a timeline." />
            <Toggle checked={privacy.recordVideo} onChange={(v) => savePrivacy({ recordVideo: v })} label="Record sessions" description="Needed for video Playback. Off: you still get the transcript and the Read." />
            <div className="py-4">
              <p className="text-sm text-mist-100">Keep raw video for</p>
              <p className="mt-1 text-[13px] text-mist-400">Recordings are encrypted and deleted automatically after this period. Shortening it applies to existing recordings too.</p>
              <Segmented className="mt-3" name="Retention" value={String(privacy.videoRetentionDays)} onChange={(v) => savePrivacy({ videoRetentionDays: Number(v) as 1 | 7 | 30 | 90 })} options={[{ value: "1", label: "1 day" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
            </div>
          </Card>
          {saving && <p className="mt-2 text-xs text-mist-400">Saving…</p>}
        </section>

        <section id="plan" className="scroll-mt-24">
          <h2 className="font-display text-3xl">Plan</h2>
          <p className="mt-2 text-sm text-mist-400">You&apos;re on <span className="text-mist-100">{p.plan.name}</span>{p.plan.periodEnd ? ` until ${new Date(p.plan.periodEnd).toLocaleDateString()}` : ""}. {p.plan.sessionsThisWeek} session{p.plan.sessionsThisWeek === 1 ? "" : "s"} this week.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {(["free", "sprint", "pro"] as const).map((id) => (
              <Card key={id} className={`flex flex-col p-6 ${p.plan.id === id ? "border-lume/40" : ""}`}>
                <p className="text-mist-100">{PLANS[id].name}</p>
                <p className="mt-2 font-display text-4xl">{PLANS[id].price}<span className="ml-1 text-sm text-mist-400">{PLANS[id].cadence}</span></p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-mist-300">{PLANS[id].features.map((f) => <li key={f}>— {f}</li>)}</ul>
                <Button className="mt-5" size="sm" variant={p.plan.id === id ? "secondary" : "primary"} disabled={p.plan.id === id} loading={busy === id} onClick={() => choosePlan(id)}>{p.plan.id === id ? "Current plan" : `Switch to ${PLANS[id].name}`}</Button>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-xs text-mist-400">Development checkout: plan changes apply immediately with no charge. A payment processor plugs into the same endpoint for production.</p>
        </section>

        <section id="data" className="scroll-mt-24">
          <h2 className="font-display text-3xl">Your data</h2>
          <Card className="mt-6 p-6">
            <p className="text-sm text-mist-300">{p.storedRecordings} encrypted recording{p.storedRecordings === 1 ? "" : "s"} stored. Delete individual sessions from Playback.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/api/privacy/export" className="inline-flex h-10 items-center rounded-full border hairline-strong px-5 text-sm text-mist-100 hover:bg-white/[0.06]">Download my data (JSON)</a>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete my account</Button>
            </div>
          </Card>
          <Eyebrow className="mt-10">Consent history</Eyebrow>
          <ul className="mt-3 divide-y divide-white/[0.05] rounded-2xl border hairline text-sm">
            {p.consents.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-4 px-5 py-3"><span className="w-36 text-mist-200">{c.kind.replace("_", " ")}</span><span className={c.granted ? "text-signal-good" : "text-mist-400"}>{c.granted ? "granted" : "declined"}</span><span className="font-mono text-xs text-mist-400">v{c.version}</span><span className="ml-auto text-mist-400">{new Date(c.at).toLocaleString()}</span></li>
            ))}
          </ul>
        </section>
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete account">
        <div className="p-8">
          <h2 className="font-display text-3xl">Delete your account?</h2>
          <p className="mt-3 text-sm text-mist-300">This permanently deletes your profile, resume, every session, recording, transcript, metric and drill. It can&apos;t be undone.</p>
          <p className="mt-5 text-sm text-mist-300">Type <span className="font-mono text-mist-100">DELETE</span> to confirm.</p>
          <Input className="mt-2" value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} aria-label="Type DELETE to confirm" />
          <div className="mt-7 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" disabled={deleteWord !== "DELETE"} loading={busy === "delete"} onClick={deleteAccount}>Delete everything</Button></div>
        </div>
      </Modal>
    </div>
  );
}
