import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/db/client";
import { DRILLS } from "@/lib/practice/catalog";
import { recommendDrill } from "@/lib/practice/progress";
import { progressSummary } from "@/server/queries";
import { DrillCard } from "@/components/app/cards";
import { Eyebrow } from "@/components/ui/Card";
import { relDate } from "@/lib/format";

export const metadata = { title: "Drills" };

export default async function DrillsPage() {
  const user = await requireUser();
  const attempts = getDb().select().from(schema.drillAttempts).where(eq(schema.drillAttempts.userId, user.id)).orderBy(desc(schema.drillAttempts.createdAt)).limit(50).all();
  const { latest } = progressSummary(user.id);
  const rec = recommendDrill(latest?.metrics ?? {});
  const last = (id: string) => {
    const a = attempts.find((x) => x.drillId === id);
    if (!a) return null;
    const unit = (a.result as { unit?: string } | null)?.unit ?? "";
    return `${a.value ?? "—"} ${unit}${a.passed ? " ✓" : ""}`.trim();
  };
  return (
    <div>
      <Eyebrow>Drills</Eyebrow>
      <h1 className="mt-3 font-display text-5xl">Five minutes on one thing.</h1>
      <p className="mt-3 max-w-xl text-mist-300">Each drill has one objective, one measurement and your baseline to beat.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...DRILLS].sort((a, b) => (a.id === rec.drillId ? -1 : b.id === rec.drillId ? 1 : 0)).map((d) => (
          <DrillCard key={d.id} drill={d} recommended={d.id === rec.drillId ? rec.reason : null} lastValue={last(d.id)} />
        ))}
      </div>
      {attempts.length > 0 && (
        <section className="mt-16">
          <Eyebrow>Recent attempts</Eyebrow>
          <ul className="mt-4 divide-y divide-white/[0.06] rounded-2xl border hairline">
            {attempts.slice(0, 8).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4 text-sm">
                <span className="w-40 text-mist-100">{DRILLS.find((d) => d.id === a.drillId)?.title}</span>
                <span className="font-mono text-mist-300">{a.value ?? "—"} {(a.result as { unit?: string } | null)?.unit}</span>
                <span className="text-mist-400">{a.baselineValue !== null ? `baseline ${Math.round(a.baselineValue * 10) / 10}` : "first attempt"}</span>
                <span className={a.passed ? "text-signal-good" : "text-mist-400"}>{a.passed ? "Target met" : a.passed === false ? "Not yet" : ""}</span>
                <span className="ml-auto text-mist-400">{relDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
