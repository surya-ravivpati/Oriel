import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** Sign-in sits beside a page from Playback: what you get after your first interview. Phones get the form alone. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden border-r border-line bg-ink-900 px-10 py-6 lg:flex lg:flex-col lg:justify-between xl:px-14">
        <Link href="/" aria-label="Oriel home" className="self-start"><Logo /></Link>
        <figure className="max-w-[34rem] py-10">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-line-strong bg-ink-950">
            <Image src="/media/playback-frame.jpg" alt="A candidate answering at their desk, as their webcam recorded them" fill priority sizes="(min-width: 1280px) 540px, 45vw" className="object-cover" />
            <span className="absolute left-3 top-3 rounded-sm bg-ink-950/85 px-1.5 py-0.5 font-mono text-[12px] tabular text-mist-100">12:10</span>
          </div>
          <div className="relative mt-4 h-4" aria-hidden>
            <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            <div className="absolute inset-x-0 top-1/2 h-px origin-left scale-x-[0.55] bg-mist-300" />
            {[38, 55, 72].map((x) => <span key={x} className={`absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 ${x === 55 ? "bg-lume" : "bg-lume-deep"}`} style={{ left: `${x}%` }} />)}
          </div>
          <figcaption className="mt-7 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3">
            <span className="pt-0.5 font-mono text-[13px] text-lume">12:10</span>
            <div>
              <p className="font-medium text-mist-100">A time you failed</p>
              <p className="mt-1 text-callout text-mist-300">Two minutes forty seconds with no stated result.</p>
              <p className="mt-4 font-display text-[clamp(1.5rem,1.1rem+0.9vw,2rem)] leading-snug text-mist-100"><span className="text-lume">Try:</span> finish with the outcome, and what it meant.</p>
            </div>
          </figcaption>
        </figure>
        <p className="text-caption text-mist-400">A moment from Playback, after a practice interview.</p>
      </aside>
      <div className="relative flex min-h-dvh flex-col px-5 sm:px-8">
        <header className="flex h-14 items-center lg:hidden"><Link href="/" aria-label="Oriel home"><Logo /></Link></header>
        <main className="m-auto w-full max-w-[400px] py-12">{children}</main>
        <p className="pb-6 text-center text-caption text-mist-400">Practice only. Your interviewer is an AI.</p>
      </div>
    </div>
  );
}
