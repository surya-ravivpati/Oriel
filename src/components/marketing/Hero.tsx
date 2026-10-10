import Link from "next/link";
import { InterviewPreview } from "./InterviewPreview";

/**
 * The promise and the proof, as one composition on the page grid. The headline holds column 1;
 * the copy and the call to action step in to column 7, the same edge where the preview's
 * conversation begins, so the eye runs headline → copy → the interview itself.
 */
export function Hero({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="frame pb-[var(--space-section)] pt-[calc(var(--header-h)+clamp(2rem,0.5rem+4vw,4rem))]">
      <h1 id="hero-title" className="-ml-[0.045em] max-w-[11.5em] text-display-xl text-ivory">
        Practice for <em>the&nbsp;room</em> before you’re in&nbsp;it.
      </h1>
      <div className="page-grid mt-6 sm:mt-8">
        <div className="col-span-4 sm:col-span-6 sm:col-start-3 lg:col-span-6 lg:col-start-7">
          <p className="max-w-[34rem] text-body-l text-stone">
            Oriel is an AI interviewer for anyone with an interview coming up. It asks the follow-ups a real interviewer would, then shows you what landed and what to change.
          </p>
          <div className="mt-6 flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-6">
            <Link href={cta} className="inline-flex h-12 items-center justify-center rounded-button bg-ivory px-6 text-ui font-medium text-ink transition-[background-color,transform] duration-[var(--dur-press)] hover:bg-mist-200 active:scale-[0.985] lg:h-11">
              {signedIn ? "Practice an interview" : "Start practicing free"}
            </Link>
            <a href="#session" className="self-center text-ui text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory min-[480px]:self-auto">See how it works</a>
          </div>
          {!signedIn && <p className="mt-3 text-ui text-stone-dim">Free: one 10-minute interview a week. No card required.</p>}
        </div>
      </div>
      <div className="mt-12">
        <InterviewPreview />
      </div>
    </section>
  );
}
