import { ButtonLink } from "@/components/ui/Button";
import { InterviewPreview } from "./InterviewPreview";

/**
 * What Oriel is, in the words a visitor would use to describe it, beside the interviewer itself
 * (the same avatar engine as the real interview). One action; the second link goes to evidence.
 */
export function Hero({ cta, signedIn }: { cta: string; signedIn: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="frame pt-[calc(var(--header-h)+var(--spacing-hero))]">
      <div className="page-grid items-center gap-y-12">
        <div className="col-span-4 sm:col-span-8 lg:col-span-6">
          <h1 id="hero-title" className="max-w-[14em] text-balance text-display-section text-fg">
            Mock interviews that follow up on your&nbsp;answers.
          </h1>
          <p className="mt-6 max-w-prose text-body-l text-fg-muted">
            Pick a role and one of six AI interviewers, then answer out loud or by typing. When you finish, you get the
            transcript, the moments that cost you, and your weakest answer rewritten with your own&nbsp;facts.
          </p>
          <div className="mt-8 flex flex-col gap-x-6 gap-y-3 min-[480px]:flex-row min-[480px]:items-center">
            <ButtonLink href={cta} size="lg">{signedIn ? "Start an interview" : "Start a free mock interview"}</ButtonLink>
            <a href="#how" className="inline-flex min-h-11 items-center text-ui text-fg-muted underline decoration-accent decoration-1 underline-offset-text transition-colors duration-press hover:text-accent">
              See a real session
            </a>
          </div>
          {!signedIn && <p className="mt-4 text-meta text-fg-subtle">Free while Oriel is in beta. No card.</p>}
        </div>
        <div className="col-span-4 sm:col-span-8 lg:col-span-6">
          <InterviewPreview />
        </div>
      </div>
    </section>
  );
}
