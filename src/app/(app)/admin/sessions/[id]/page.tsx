import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { adminSession } from "@/server/admin";
import { Card, Eyebrow, Badge } from "@/components/ui/Card";
import { RetryButton } from "@/components/admin/RetryButton";
import { mmss } from "@/lib/format";

export const metadata = { title: "Admin · session" };

export default async function AdminSessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = adminSession(id);
  if (!d) notFound();
  const total = d.costs.reduce((a, c) => a + c.usd, 0);
  const byCat = Object.entries(d.costs.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.category]: (acc[c.category] ?? 0) + c.usd }), {}));
  const answersByQ = new Map(d.answers.map((a) => [a.questionId, a]));
  return (
    <div className="space-y-10">
      <Link href="/admin" className="text-sm text-mist-400 hover:text-mist-100">← Admin</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Session {id}</Eyebrow>
          <h1 className="mt-3 font-display text-4xl">{d.interview.role} · {d.interview.mode} · pressure {d.interview.pressure}</h1>
          <div className="mt-3 flex flex-wrap gap-2"><Badge>{d.session.status}</Badge><Badge tone={d.session.analysisStatus === "complete" ? "good" : d.session.analysisStatus === "failed" ? "bad" : "neutral"}>analysis {d.session.analysisStatus}</Badge><Badge>llm {d.session.llmProvider}</Badge><Badge>tts {d.session.ttsProvider}</Badge><Badge>avatar {d.session.avatarProvider ?? "—"}</Badge>{d.signals.map((s) => <Badge key={s.kind}>{s.kind} batches {s.n}</Badge>)}</div>
          {d.session.analysisError && <p className="mt-2 font-mono text-xs text-signal-bad">{d.session.analysisError}</p>}
        </div>
        <RetryButton sessionId={id} />
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><Eyebrow>Cost record</Eyebrow><p className="mt-2 font-display text-4xl">${total.toFixed(4)}</p><ul className="mt-3 space-y-1 text-sm text-mist-300">{byCat.map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">${v.toFixed(4)}</span></li>)}</ul></Card>
        <Card className="p-5"><Eyebrow>Pipeline</Eyebrow>{d.jobs.map((j) => <div key={j.id} className="mt-2 text-sm"><p>{j.status} · attempts {j.attempts}</p>{j.error && <p className="font-mono text-xs text-signal-bad">{j.error}</p>}<ul className="mt-2 space-y-0.5 font-mono text-xs text-mist-400">{Object.entries(j.stepTimings ?? {}).map(([k, v]) => <li key={k}>{k}: {v}ms</li>)}</ul></div>)}</Card>
        <Card className="p-5"><Eyebrow>Memory ledger (claims)</Eyebrow><ul className="mt-2 space-y-1 text-sm">{d.claims.map((c) => <li key={c.id}><Badge tone={c.status === "weak" ? "warn" : c.status === "probed" ? "lume" : c.status === "supported" ? "good" : "neutral"}>{c.status}</Badge> <span className="text-mist-300">#{c.answerSeq} {c.text}</span></li>)}</ul></Card>
      </section>

      <section>
        <Eyebrow>Conversation &amp; interviewer decisions</Eyebrow>
        <ol className="mt-4 space-y-3">
          {d.questions.map((q) => {
            const a = answersByQ.get(q.id);
            return (
              <li key={q.id} className="rounded-2xl border hairline p-5 text-sm">
                <p className="font-mono text-xs text-mist-400">{mmss(q.askedAtMs)} · {q.kind} · {q.competency ?? "—"} · difficulty {q.difficulty}</p>
                <p className="mt-1 text-lume/90">Decision: {q.decisionReason}</p>
                <p className="mt-2 text-mist-100">Q: {q.text}</p>
                {a && <div className="mt-3 border-t hairline pt-3"><p className="text-mist-300">A ({a.inputMode}{a.interrupted ? ", interrupted" : ""}, first word {a.firstWordLatencyMs ?? "—"}ms): {a.text}</p>{a.serverText && a.serverText !== a.text && <p className="mt-1 text-mist-400">Server transcript: {a.serverText}</p>}<p className="mt-1 font-mono text-xs text-mist-400">flags {JSON.stringify(a.flags)}</p>{a.analysis && <p className="mt-1 font-mono text-xs text-mist-400">analyzer {JSON.stringify(a.analysis).slice(0, 400)}</p>}</div>}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><Eyebrow>Metrics &amp; confidence</Eyebrow><ul className="mt-3 space-y-1.5 text-sm">{d.metrics.map((m) => <li key={m.id} className="flex justify-between gap-4"><span>{m.key}</span><span className="font-mono text-mist-300">{m.value ?? "—"} {m.unit} [{m.low ?? "·"}–{m.high ?? "·"}] · {m.confidence}</span></li>)}</ul></Card>
        <Card className="p-5"><Eyebrow>Playback generation</Eyebrow><ul className="mt-3 space-y-3 text-sm">{d.clips.map((c) => <li key={c.id}><p className="font-mono text-xs text-mist-400">{mmss(c.startMs)}–{mmss(c.endMs)} · {c.signal} · {c.confidence} · {c.source}</p><p className="text-mist-100">{c.title}</p><p className="text-mist-300">{c.observed}</p><p className="text-mist-300">{c.suggestion}</p></li>)}</ul></Card>
      </section>

      <section>
        <Eyebrow>Event log (decisions, latency, AI outputs, errors)</Eyebrow>
        <ol className="mt-4 max-h-[600px] overflow-y-auto rounded-2xl border hairline font-mono text-xs">
          {d.events.map((e) => <li key={e.id} className="border-b hairline px-4 py-2"><span className="text-mist-400">{e.createdAt.toLocaleTimeString()}</span> <span className={e.type === "error" ? "text-signal-bad" : e.type === "fallback" ? "text-signal-warn" : e.type === "latency" ? "text-signal-good" : "text-lume"}>{e.type}</span> {e.name} {e.durationMs !== null ? `${e.durationMs}ms` : ""} <span className="text-mist-400">{JSON.stringify(e.data).slice(0, 500)}</span></li>)}
        </ol>
      </section>
    </div>
  );
}
