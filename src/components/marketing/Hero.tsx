import { ButtonLink } from "@/components/ui/Button";
import { InterviewPreview } from "./InterviewPreview";

/**
 * The first screen holds two things: the promise, and the interviewer who keeps it. On desktop they
 * sit side by side, centred on each other, so the headline and the face are read in one glance;
 * on narrower screens the interviewer follows the call to action.
 */
export function Hero({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="frame pt-[calc(var(--header-h)+var(--spacing-hero))]">
      <div className="page-grid items-center gap-y-16 lg:min-h-[min(calc(100svh-var(--header-h)-2*var(--spacing-hero)),38rem)]">
        <div className="col-span-4 sm:col-span-7 lg:col-span-7">
          <h1 id="hero-title" className="max-w-[10em] text-display-xl text-ivory">
            Practice for the&nbsp;room before you’re in&nbsp;it.
          </h1>
          <p className="mt-6 max-w-[33rem] text-body-l text-stone">
            Oriel is an AI interviewer for anyone with an interview coming up. It asks the follow-ups a real interviewer would, then shows you what landed and what to change.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <ButtonLink href={cta} size="lg" className="w-full min-[480px]:w-auto">
              {signedIn ? "Practice an interview" : "Start practicing free"}
            </ButtonLink>
            {/* On a phone the interviewer is the next thing on screen, so the second action steps aside. */}
            <a href="#how" className="hidden whitespace-nowrap text-ui text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory min-[480px]:inline">See how it works</a>
          </div>
          {!signedIn && <p className="mt-3 text-ui text-stone-dim">Free: one 10-minute interview a week. No&nbsp;card&nbsp;required.</p>}
        </div>
        <div className="col-span-4 sm:col-span-8 lg:col-span-5">
          <InterviewPreview />
        </div>
      </div>
    </section>
  );
}
