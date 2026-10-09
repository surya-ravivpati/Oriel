"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/client/api";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await api("/api/auth/signup", { method: "POST", json: { email, password, acceptTerms: accept } });
        router.push("/onboarding");
      } else {
        const r = await api<{ onboarded: boolean }>("/api/auth/login", { method: "POST", json: { email, password } });
        router.push(r.onboarded ? "/home" : "/onboarding");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </div>
      <div>
        <Label htmlFor="password" hint={mode === "signup" ? "8 or more characters" : undefined}>Password</Label>
        <div className="relative">
          <Input id="password" type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-20" />
          <button type="button" onClick={() => setShow(!show)} aria-pressed={show} aria-controls="password"
            className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-sm px-2.5 text-[13px] font-medium text-mist-300 transition-colors hover:bg-ink-800 hover:text-mist-100">{show ? "Hide" : "Show"}</button>
        </div>
      </div>
      {mode === "signup" && (
        <label className="flex cursor-pointer items-start gap-3 text-caption leading-relaxed text-mist-300">
          <span className="relative mt-0.5 grid shrink-0 place-items-center">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
              className="peer size-[18px] cursor-pointer appearance-none rounded-sm border border-ink-500 bg-ink-900 transition-colors checked:border-lume checked:bg-lume" />
            <svg viewBox="0 0 12 12" className="pointer-events-none absolute size-3 text-ink-950 opacity-0 transition-opacity peer-checked:opacity-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m2.5 6.2 2.3 2.3 4.7-5" /></svg>
          </span>
          <span>I understand Oriel is a practice tool with an AI interviewer, and I agree to the terms and the <a href="/privacy" target="_blank" className="text-mist-100 underline decoration-lume underline-offset-2 hover:text-lume-soft">privacy and biometric policy</a>. Camera and microphone are only used after I consent in the Room.</span>
        </label>
      )}
      <FieldError>{error}</FieldError>
      <Button type="submit" size="lg" variant="lume" className="w-full" loading={busy} disabled={!email || !password || (mode === "signup" && !accept)}>
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <p className="pt-2 text-center text-callout text-mist-400">
        {mode === "signup" ? <>Already have an account? <Link href="/login" className="font-medium text-mist-100 underline decoration-lume underline-offset-4 hover:text-lume-soft">Sign in</Link></> : <>New to Oriel? <Link href="/signup" className="font-medium text-mist-100 underline decoration-lume underline-offset-4 hover:text-lume-soft">Create an account</Link></>}
      </p>
    </form>
  );
}
