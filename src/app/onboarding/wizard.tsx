"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Segmented, Select, Textarea } from "@/components/ui/Field";
import { Badge, Eyebrow } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { api, ApiError } from "@/lib/client/api";
import type { ParsedJobDescription, ParsedResume } from "@/db/schema";
import { DOMAIN_OPTIONS } from "@/lib/interview/domain-packs";

type Profile = {
  name: string; targetRole: string; domain: string; experienceLevel: "early" | "mid" | "senior" | "executive";
  preferredInterviewType: "behavioral" | "technical" | "case" | "leadership" | "mixed";
  preferredPersona: "warm_recruiter" | "hiring_manager" | "skeptic" | "executive";
};

const STEPS = ["You", "Resume", "The role", "The interviewer"];

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({ name: defaultName, targetRole: "", domain: "software", experienceLevel: "mid", preferredInterviewType: "behavioral", preferredPersona: "hiring_manager" });
  const [resumeText, setResumeText] = useState("");
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [jdText, setJdText] = useState("");
  const [jd, setJd] = useState<ParsedJobDescription | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  async function uploadResume(file?: File) {
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      else form.set("text", resumeText);
      const r = await api<{ parsed: ParsedResume }>("/api/resume", { method: "POST", body: form });
      setResume(r.parsed);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitJd() {
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ parsed: ParsedJobDescription }>("/api/job-description", { method: "POST", json: { text: jdText } });
      setJd(r.parsed);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't read that job description");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/onboarding", { method: "POST", json: p });
      router.push("/practice?first=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your profile");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-10">
        <div className="mb-3 flex justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-mist-400">
          <span>Step {step + 1} of {STEPS.length}</span><span>{STEPS[step]}</span>
        </div>
        <ProgressBar value={step + 1} max={STEPS.length} label="Onboarding progress" />
      </div>

      {step === 0 && (
        <section className="rise space-y-6">
          <h1 className="font-display text-5xl leading-tight">Who&apos;s walking into the room?</h1>
          <p className="text-mist-300">Only what the first interview needs. You can change all of it later.</p>
          <div><Label htmlFor="name">Your name</Label><Input id="name" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="How the interviewer should greet you" autoComplete="given-name" /></div>
          <div><Label htmlFor="role">Target role</Label><Input id="role" value={p.targetRole} onChange={(e) => set("targetRole", e.target.value)} placeholder="e.g. Senior Product Manager" /></div>
          <div><Label htmlFor="domain">Field</Label>
            <Select id="domain" value={p.domain} onChange={(e) => set("domain", e.target.value)}>{DOMAIN_OPTIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select>
          </div>
          <div><Label>Experience</Label>
            <Segmented name="Experience" value={p.experienceLevel} onChange={(v) => set("experienceLevel", v)} options={[
              { value: "early", label: "Early career" }, { value: "mid", label: "Mid-level" }, { value: "senior", label: "Senior" }, { value: "executive", label: "Executive" },
            ]} />
          </div>
          <Nav onNext={() => setStep(1)} nextDisabled={!p.name.trim() || p.targetRole.trim().length < 2} />
        </section>
      )}

      {step === 1 && (
        <section className="rise space-y-6">
          <h1 className="font-display text-5xl leading-tight">Your resume.</h1>
          <p className="text-mist-300">The interviewer uses it to ask about your real experience. We only extract what&apos;s written — nothing is invented.</p>
          {!resume ? (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center transition hover:border-lume/40 hover:bg-lume/[0.03]">
                <span className="text-mist-100">{busy ? "Reading your resume…" : "Upload PDF or DOCX"}</span>
                <span className="mt-1 text-sm text-mist-400">Up to 8 MB</span>
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadResume(f); }} />
              <div className="flex items-center gap-4 text-xs text-mist-400"><span className="h-px flex-1 bg-white/10" />or paste it<span className="h-px flex-1 bg-white/10" /></div>
              <Textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={7} placeholder="Paste your resume text" />
              <FieldError>{error}</FieldError>
              <Nav onBack={() => setStep(0)} onNext={() => uploadResume()} nextLabel="Read resume" nextDisabled={resumeText.trim().length < 40} busy={busy} onSkip={() => setStep(2)} />
            </>
          ) : (
            <>
              <ResumeSummary r={resume} />
              <Nav onBack={() => setResume(null)} backLabel="Replace" onNext={() => setStep(2)} />
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="rise space-y-6">
          <h1 className="font-display text-5xl leading-tight">The job you&apos;re going for.</h1>
          <p className="text-mist-300">Paste the job description. We pull out the competencies the interviewer should probe.</p>
          {!jd ? (
            <>
              <Textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={10} placeholder="Paste the job description" />
              <FieldError>{error}</FieldError>
              <Nav onBack={() => setStep(1)} onNext={submitJd} nextLabel="Read job description" nextDisabled={jdText.trim().length < 40} busy={busy} onSkip={() => setStep(3)} />
            </>
          ) : (
            <>
              <div className="rounded-2xl border hairline bg-white/[0.02] p-6">
                <div className="flex items-center justify-between"><p className="text-mist-100">{jd.title ?? "Job description"}</p><Badge tone={jd.source === "llm" ? "lume" : "neutral"}>{jd.source === "llm" ? "AI-parsed" : "Pattern-parsed"}</Badge></div>
                <Eyebrow className="mt-5">What they&apos;ll probe</Eyebrow>
                <ul className="mt-3 space-y-2">{jd.competencies.map((c) => <li key={c.key} className="text-sm"><span className="text-mist-100">{c.label}</span> <span className="text-mist-400">— “{c.evidence}”</span></li>)}</ul>
                {!jd.competencies.length && <p className="mt-2 text-sm text-mist-400">No clear competencies found — the interviewer will use the standard set for your field.</p>}
              </div>
              <Nav onBack={() => setJd(null)} backLabel="Replace" onNext={() => setStep(3)} />
            </>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="rise space-y-8">
          <h1 className="font-display text-5xl leading-tight">How should they interview you?</h1>
          <div><Label>Interview type</Label>
            <Segmented name="Interview type" value={p.preferredInterviewType} onChange={(v) => set("preferredInterviewType", v)} options={[
              { value: "behavioral", label: "Behavioral" }, { value: "technical", label: "Technical" }, { value: "case", label: "Case" }, { value: "leadership", label: "Leadership" }, { value: "mixed", label: "Mixed" },
            ]} />
          </div>
          <div><Label>Interviewer style</Label>
            <Segmented name="Interviewer style" value={p.preferredPersona} onChange={(v) => set("preferredPersona", v)} className="grid sm:grid-cols-2" options={[
              { value: "warm_recruiter", label: "Warm Recruiter", hint: "Friendly, checks fit and story" },
              { value: "hiring_manager", label: "Hiring Manager", hint: "Neutral, wants what you actually did" },
              { value: "skeptic", label: "Skeptic", hint: "Tests every claim and number" },
              { value: "executive", label: "Executive", hint: "Few words, long pauses, big picture" },
            ]} />
          </div>
          <FieldError>{error}</FieldError>
          <Nav onBack={() => setStep(2)} onNext={finish} nextLabel="Set up my first interview" busy={busy} />
        </section>
      )}
    </div>
  );
}

function Nav({ onBack, onNext, onSkip, nextLabel = "Continue", backLabel = "Back", nextDisabled, busy }: { onBack?: () => void; onNext: () => void; onSkip?: () => void; nextLabel?: string; backLabel?: string; nextDisabled?: boolean; busy?: boolean }) {
  return (
    <div className="flex items-center justify-between pt-4">
      <div>{onBack && <Button variant="ghost" onClick={onBack}>{backLabel}</Button>}</div>
      <div className="flex items-center gap-2">
        {onSkip && <Button variant="ghost" onClick={onSkip}>Skip for now</Button>}
        <Button onClick={onNext} disabled={nextDisabled} loading={busy}>{nextLabel}</Button>
      </div>
    </div>
  );
}

function ResumeSummary({ r }: { r: ParsedResume }) {
  return (
    <div className="rounded-2xl border hairline bg-white/[0.02] p-6">
      <div className="flex items-center justify-between"><p className="text-mist-100">{r.headline ?? "Your resume"}</p><Badge tone={r.source === "llm" ? "lume" : "neutral"}>{r.source === "llm" ? "AI-parsed" : "Pattern-parsed"}</Badge></div>
      <Eyebrow className="mt-5">Roles found</Eyebrow>
      <ul className="mt-3 space-y-3">
        {r.roles.slice(0, 5).map((ro, i) => (
          <li key={i}>
            <p className="text-sm text-mist-100">{ro.title}{ro.organization ? <span className="text-mist-400"> · {ro.organization}</span> : null}<span className="ml-2 font-mono text-xs text-mist-400">{[ro.start, ro.end].filter(Boolean).join("–")}</span></p>
            {ro.highlights[0] && <p className="mt-0.5 text-[13px] text-mist-400">{ro.highlights[0]}</p>}
          </li>
        ))}
        {!r.roles.length && <li className="text-sm text-mist-400">We couldn&apos;t confidently identify roles. The interviewer won&apos;t reference specific jobs.</li>}
      </ul>
      {r.metrics.length > 0 && (<><Eyebrow className="mt-5">Numbers you&apos;ve claimed</Eyebrow><ul className="mt-2 space-y-1">{r.metrics.slice(0, 4).map((m, i) => <li key={i} className="text-[13px] text-mist-300">“{m}”</li>)}</ul></>)}
    </div>
  );
}
