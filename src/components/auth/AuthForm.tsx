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
        <Label htmlFor="password" hint={mode === "signup" ? "8+ characters" : undefined}>Password</Label>
        <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {mode === "signup" && (
        <label className="flex items-start gap-3 text-[13px] leading-relaxed text-mist-300">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 accent-[var(--color-lume)]" />
          <span>I understand Oriel is a practice tool with an AI interviewer, and I agree to the terms and the <a href="/privacy" target="_blank" className="text-mist-100 underline underline-offset-2">privacy &amp; biometric policy</a>. Camera and microphone are only used after I consent in the Room.</span>
        </label>
      )}
      <FieldError>{error}</FieldError>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email || !password || (mode === "signup" && !accept)}>
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-mist-400">
        {mode === "signup" ? <>Already have an account? <Link href="/login" className="text-mist-100 underline-offset-4 hover:underline">Sign in</Link></> : <>New to Oriel? <Link href="/signup" className="text-mist-100 underline-offset-4 hover:underline">Create an account</Link></>}
      </p>
    </form>
  );
}
