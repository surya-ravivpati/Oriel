import { requireUser } from "@/lib/auth/session";
import { ladderState } from "@/server/queries";
import { loadEntitlementContext } from "@/lib/billing/entitlement-context";
import { canUseLadder } from "@/lib/billing/entitlements";
import { LadderStep } from "@/components/app/cards";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Card";

export const metadata = { title: "Ladder" };

export default async function LadderPage() {
  const user = await requireUser();
  const { steps, current } = ladderState(user.id);
  const allowed = canUseLadder(loadEntitlementContext(user.id));
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Eyebrow>The Ladder</Eyebrow>
        <h1 className="mt-3 font-display text-5xl leading-tight">From friendly recruiter to curveball panel.</h1>
        <p className="mt-4 text-mist-300">Each rung is a harder room. You unlock the next after two sessions above your own baseline — measured against you, never against anyone else.</p>
        <div className="mt-8 rounded-2xl border border-lume/30 bg-lume/[0.05] p-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-lume">You&apos;re on</p>
          <p className="mt-2 font-display text-3xl">{String(current.level).padStart(2, "0")} · {current.name}</p>
          <p className="mt-2 text-sm text-mist-300">{current.description}</p>
          {allowed.allowed ? <ButtonLink href={`/practice?ladder=${current.level}`} variant="lume" className="mt-6">Practice this rung</ButtonLink> : (
            <><p className="mt-4 text-sm text-mist-400">{allowed.reason}</p><ButtonLink href="/profile#plan" variant="secondary" className="mt-4">See plans</ButtonLink></>
          )}
        </div>
      </div>
      <ol className="space-y-3">
        {steps.map((s) => <li key={s.level}><LadderStep step={s} current={s.level === current.level} /></li>)}
      </ol>
    </div>
  );
}
