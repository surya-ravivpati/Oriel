import Link from "next/link";
import { InterviewPreview } from "./InterviewPreview";

/**
 * The promise and the proof, as one composition on the page grid. The headline holds column 1;
 * the copy and the call to action step in to column 7, the same edge where the preview's
 * conversation begins, so the eye runs headline → copy → the interview itself.
 */
export function Hero({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="frame pb-section pt-[calc(var(--header-h)+var(--spacing-hero))]">
      <h1 id="hero-title" className="-ml-[0.035em] max-w-[11.5em] text-display-xl text-ivory">
        Practice for <em>the&nbsp;room</em> before you’re in&nbsp;it.
      </h1>
      <div className="page-grid mt-6 sm:mt-8">
        <div className="col-span-4 sm:col-span-6 sm:col-start-3 lg:col-span-6 lg:col-start-7">
          <p className="max-w-[34rem] text-body-l text-stone">
            Oriel is an AI interviewer for anyone with an interview coming up. It asks the follow-ups a real interviewer would, then shows you what landed and what to change.
          </p>
          <div className="mt-6 flex items-center gap-6">
            <Link href={cta} className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-button border border-transparent bg-ivory px-6 text-ui font-medium text-ink transition-[background-color,transform] duration-[var(--dur-press)] hover:bg-ivory-press active:scale-[0.97] min-[480px]:w-auto lg:h-11">
              {signedIn ? "Practice an interview" : "Start practicing free"}
            </Link>
            {/* On a phone the preview is the next thing on screen, so the second action steps aside. */}
            <a href="#session" className="hidden whitespace-nowrap text-ui text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory min-[480px]:inline">See how it works</a>
          </div>
          {!signedIn && <p className="mt-3 text-ui text-stone-dim">Free: one 10-minute interview a week. No&nbsp;card&nbsp;required.</p>}
        </div>
      </div>
      <div className="mt-12">
        <InterviewPreview />
      </div>
    </section>
  );
}
