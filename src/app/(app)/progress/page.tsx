import { requireUser } from "@/lib/auth/session";
import { progressSummary, listSessions } from "@/server/queries";
import { PROGRESS_METRICS } from "@/lib/practice/progress";
import { Card, Eyebrow } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Sparkline } from "@/components/app/Sparkline";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const { history, latest, first, baseline } = progressSummary(user.id);
  const sessions = listSessions(user.id, 200);
  if (history.length === 0) {
    return (
      <div className="py-20 text-center">
        <Eyebrow>Progress</Eyebrow>
        <h1 className="mt-3 font-display text-5xl">Your baseline starts with your first session.</h1>
        <ButtonLink href="/practice" variant="lume" className="mt-8">Start Practice</ButtonLink>
      </div>
    );
  }
  return (
    <div className="space-y-12">
      <header>
        <Eyebrow>Progress</Eyebrow>
        <h1 className="mt-3 font-display text-5xl">{history.length > 1 ? "You against you." : "Baseline set."}</h1>
        <p className="mt-3 max-w-xl text-mist-300">{history.length} analysed session{history.length > 1 ? "s" : ""}. Comparisons are always with your own history — never other people.</p>
      </header>

      {first && latest && history.length > 1 && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b hairline px-6 py-3 font-mono text-[11px] uppercase tracking-widest text-mist-400">
            <span>Measure</span><span>First session</span><span>Latest</span>
          </div>
          {PROGRESS_METRICS.map((m) => {
            const a = first.metrics[m.key], b = latest.metrics[m.key];
            if (a == null && b == null) return null;
            const better = a != null && b != null && (m.better === "lower" ? b < a : m.better === "higher" ? b > a : Math.abs(b - (m.target ?? 0)) < Math.abs(a - (m.target ?? 0)));
            return (
              <div key={m.key} className="grid grid-cols-[1.2fr_1fr_1fr] items-center border-b hairline px-6 py-4 last:border-0">
                <span className="text-mist-200">{m.label}</span>
                <span className="font-mono text-mist-400 tabular">{a == null ? "—" : m.format(a)}</span>
                <span className={`font-mono tabular ${better ? "text-signal-good" : "text-mist-100"}`}>{b == null ? "—" : m.format(b)}{better ? " · better" : ""}</span>
              </div>
            );
          })}
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROGRESS_METRICS.map((m) => {
          const series = history.map((h) => h.metrics[m.key]).filter((v): v is number => typeof v === "number");
          if (!series.length) return null;
          const b = baseline[m.key];
          return (
            <Card key={m.key} className="p-5">
              <div className="flex items-baseline justify-between"><p className="text-sm text-mist-300">{m.label}</p><p className="font-mono text-xs text-mist-400">{m.better === "lower" ? "lower is better" : m.better === "higher" ? "higher is better" : `aim ~${m.target}`}</p></div>
              <p className="mt-2 font-display text-3xl tabular">{m.format(series.at(-1)!)}</p>
              <Sparkline values={series} baseline={b ?? null} better={m.better} className="mt-4 h-14 w-full" />
              <p className="mt-2 text-xs text-mist-400">{b != null ? `Baseline ${m.format(b)}` : "Baseline after two sessions"}</p>
            </Card>
          );
        })}
      </section>
      <p className="text-sm text-mist-400">{sessions.filter((s) => s.status === "ended").length} completed sessions in total. Camera engagement is an estimate and only appears when camera signals were on.</p>
    </div>
  );
}
