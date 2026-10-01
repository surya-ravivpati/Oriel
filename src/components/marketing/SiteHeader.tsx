import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Oriel home"><Logo /></Link>
        <nav className="hidden items-center gap-8 text-[13px] text-mist-300 md:flex">
          <a href="#room" className="hover:text-mist-100">The Room</a>
          <a href="#read" className="hover:text-mist-100">The Read</a>
          <a href="#playback" className="hover:text-mist-100">Playback</a>
          <a href="#trust" className="hover:text-mist-100">Trust</a>
          <a href="#pricing" className="hover:text-mist-100">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? <ButtonLink href="/home" size="sm">Open Oriel</ButtonLink> : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
              <ButtonLink href="/signup" size="sm">Start practicing</ButtonLink>
            </>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-ink-950 via-ink-950/80 to-transparent" />
    </header>
  );
}
