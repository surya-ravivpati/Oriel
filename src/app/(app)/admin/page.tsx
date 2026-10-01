import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { adminOverview } from "@/server/admin";
import { providerStatus } from "@/lib/ai/providers/registry";
import { Card, Eyebrow, Badge } from "@/components/ui/Card";

export const metadata = { title: "Admin" };

const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`);

export default async function AdminPage() {
  await requireAdmin();
  const o = adminOverview();
  const ps = providerStatus();
  const total = o.sessions.reduce((a, s) => a + s.usd, 0);
  return (
    <div className="space-y-12">
      <header>
        <Eyebrow>Admin · debug console</Eyebrow>
        <h1 className="mt-3 font-display text-5xl">Under the hood.</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge tone={ps.llmMock ? "warn" : "good"}>LLM: {ps.llm}</Badge><Badge tone={ps.ttsMock ? "warn" : "good"}>TTS: {ps.tts}</Badge><Badge tone={ps.sttMock ? "warn" : "good"}>STT: {ps.stt}</Badge><Badge>Avatar: local WebGL (managed vendor not configured)</Badge>
          {o.jobs.map((j) => <Badge key={j.status}>jobs {j.status}: {j.n}</Badge>)}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <Eyebrow>Latency (measured)</Eyebrow>
          <div className="overflow-x-auto"><table className="mt-4 w-full min-w-[420px] text-sm">
            <thead className="text-left text-xs text-mist-400"><tr><th className="pb-2 font-normal">Stage</th><th className="font-normal">n</th><th className="font-normal">p50</th><th className="font-normal">p90</th></tr></thead>
            <tbody className="font-mono">
              {o.latencySummary.map((l) => <tr key={l.name} className="border-t hairline"><td className="py-2 pr-4 font-sans text-mist-200">{l.name}</td><td className="pr-3">{l.n}</td><td className="whitespace-nowrap pr-3">{l.p50 === null ? "—" : `${l.p50} ms`}</td><td className="whitespace-nowrap">{l.p90 === null ? "—" : `${l.p90} ms`}</td></tr>)}
            </tbody>
          </table></div>
          <p className="mt-3 text-xs text-mist-400">Target conversational latency ≈ 1,200 ms (business plan budget: endpointing 250 · LLM 400 · voice 150 · avatar 300 · network 100). Endpointing silence is added on top of these server figures.</p>
        </Card>
        <Card className="p-6">
          <Eyebrow>Cost by provider</Eyebrow>
          <div className="overflow-x-auto"><table className="mt-4 w-full min-w-[420px] text-sm">
            <thead className="text-left text-xs text-mist-400"><tr><th className="pb-2 font-normal">Category</th><th className="font-normal">Provider</th><th className="font-normal">Units</th><th className="font-normal text-right">USD</th></tr></thead>
            <tbody>
              {o.costByCategory.map((c, i) => <tr key={i} className="border-t hairline"><td className="py-2">{c.category}</td><td className="font-mono text-xs text-mist-300">{c.provider}</td><td className="font-mono text-xs">{Math.round(c.units)} {c.unit}</td><td className="text-right font-mono">{usd(c.usd)}</td></tr>)}
            </tbody>
          </table></div>
          <p className="mt-3 text-sm text-mist-300">Total across listed sessions: <span className="font-mono">{usd(total)}</span></p>
        </Card>
      </section>

      <section>
        <Eyebrow>Sessions</Eyebrow>
        <div className="mt-4 overflow-x-auto rounded-2xl border hairline">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="text-left text-xs text-mist-400"><tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-normal"><th>When</th><th>User</th><th>Role</th><th>Mode</th><th>Status</th><th>Analysis</th><th>Degraded</th><th className="text-right">Cost</th></tr></thead>
            <tbody>
              {o.sessions.map((s) => (
                <tr key={s.id} className="border-t hairline hover:bg-white/[0.02] [&>td]:px-4 [&>td]:py-3">
                  <td><Link href={`/admin/sessions/${s.id}`} className="text-mist-100 underline-offset-4 hover:underline">{s.createdAt.toLocaleString()}</Link></td>
                  <td className="text-mist-300">{s.email}</td><td>{s.role}</td><td>{s.mode} · p{s.pressure}</td><td>{s.status}</td>
                  <td><Badge tone={s.analysis === "complete" ? "good" : s.analysis === "failed" ? "bad" : "neutral"}>{s.analysis}</Badge></td>
                  <td className="text-mist-400">{s.degraded ?? "—"}</td><td className="text-right font-mono">{usd(s.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <Eyebrow>Recent errors &amp; fallbacks</Eyebrow>
        <ul className="mt-4 divide-y divide-white/[0.05] rounded-2xl border hairline text-sm">
          {o.errors.length ? o.errors.map((e) => <li key={e.id} className="px-5 py-3"><span className="font-mono text-xs text-mist-400">{e.createdAt.toLocaleString()}</span> <Badge tone={e.type === "error" ? "bad" : "warn"}>{e.type}</Badge> <span className="text-mist-200">{e.name}</span> <span className="font-mono text-xs text-mist-400">{JSON.stringify(e.data).slice(0, 220)}</span></li>) : <li className="px-5 py-4 text-mist-400">None.</li>}
        </ul>
      </section>
    </div>
  );
}
