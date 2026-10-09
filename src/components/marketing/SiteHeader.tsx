"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";

const LINKS = [["/#session", "How it works"], ["/#read", "The Read"], ["/#privacy", "Privacy"], ["/#pricing", "Pricing"]] as const;

/** A plain bar: transparent over the first screen, solid with a hairline once you scroll. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    const first = requestAnimationFrame(on);
    window.addEventListener("scroll", on, { passive: true });
    return () => { cancelAnimationFrame(first); window.removeEventListener("scroll", on); };
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) window.addEventListener("keydown", esc);
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <>
      <header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200", scrolled || open ? "border-line bg-ink-950" : "border-transparent bg-transparent")}>
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="Oriel home" className="shrink-0" onClick={() => setOpen(false)}><Logo /></Link>
          <nav aria-label="Main" className="hidden items-center gap-7 text-[14px] text-mist-300 md:flex">
            {LINKS.map(([href, label]) => <a key={href} href={href} className="transition-colors hover:text-mist-100">{label}</a>)}
          </nav>
          <div className="flex items-center gap-4">
            {signedIn ? <ButtonLink href="/home" size="sm" className="hidden sm:inline-flex">Open Oriel</ButtonLink> : (
              <>
                <Link href="/login" className="hidden text-[14px] text-mist-300 transition-colors hover:text-mist-100 sm:block">Sign in</Link>
                <ButtonLink href="/signup" size="sm" className="hidden sm:inline-flex">Start practicing</ButtonLink>
              </>
            )}
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-menu"
              className="h-8 rounded-md border border-line-strong px-3 text-[13px] font-medium text-mist-100 transition-colors hover:border-ink-500 md:hidden">
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div id="site-menu" className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto bg-ink-950 animate-[enter_220ms_var(--ease-out-expo)] md:hidden">
          <nav aria-label="Menu" className="flex flex-col px-5 pb-10 pt-2 sm:px-8">
            {LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="border-b border-line py-4 font-display text-[28px] leading-tight text-mist-100">{label}</a>
            ))}
            <div className="mt-8 flex flex-col gap-3">
              {signedIn ? <ButtonLink href="/home" size="lg">Open Oriel</ButtonLink> : (
                <>
                  <ButtonLink href="/signup" size="lg">Start practicing</ButtonLink>
                  <ButtonLink href="/login" variant="secondary" size="lg">Sign in</ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
