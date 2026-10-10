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
        <p className="mt-3 max-w-xl text-stone">{history.length} analysed session{history.length > 1 ? "s" : ""}. Comparisons are always with your own history, never other people.</p>
      </header>

      {first && latest && history.length > 1 && (
        <div className="border-y border-divider">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-divider px-1 py-2 text-meta text-stone-dim">
            <span>Measure</span><span>First session</span><span>Latest</span>
          </div>
          {PROGRESS_METRICS.map((m) => {
            const a = first.metrics[m.key], b = latest.metrics[m.key];
            if (a == null && b == null) return null;
            const better = a != null && b != null && (m.better === "lower" ? b < a : m.better === "higher" ? b > a : Math.abs(b - (m.target ?? 0)) < Math.abs(a - (m.target ?? 0)));
            return (
              <div key={m.key} className="grid grid-cols-[1.2fr_1fr_1fr] items-center border-b border-divider px-1 py-3 last:border-0">
                <span className="text-ui font-medium text-ivory">{m.label}</span>
                <span className="font-mono text-ui text-stone-dim tabular">{a == null ? "n/a" : m.format(a)}</span>
                <span className={`font-mono text-ui tabular ${better ? "text-signal-good" : "text-ivory"}`}>{b == null ? "n/a" : m.format(b)}{better ? " · better" : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      <section className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {PROGRESS_METRICS.map((m) => {
          const series = history.map((h) => h.metrics[m.key]).filter((v): v is number => typeof v === "number");
          if (!series.length) return null;
          const b = baseline[m.key];
          return (
            <div key={m.key} className="border-t border-divider pb-6 pt-4">
              <div className="flex items-baseline justify-between"><p className="text-ui font-medium text-ivory">{m.label}</p><p className="text-meta text-stone-dim">{m.better === "lower" ? "lower is better" : m.better === "higher" ? "higher is better" : `aim for about ${m.target}`}</p></div>
              <p className="mt-2 font-mono text-[26px] tabular text-ivory">{m.format(series.at(-1)!)}</p>
              <Sparkline values={series} baseline={b ?? null} better={m.better} className="mt-4 h-14 w-full" />
              <p className="mt-2 text-meta text-stone-dim">{b != null ? `Baseline ${m.format(b)}` : "Baseline after two sessions"}</p>
            </div>
          );
        })}
      </section>
      <p className="text-ui text-stone-dim">{sessions.filter((s) => s.status === "ended").length} completed sessions in total. Camera engagement is an estimate and only appears when camera signals were on.</p>
    </div>
  );
}
