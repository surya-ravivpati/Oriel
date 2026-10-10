"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";

const LINKS = [["/#session", "How it works"], ["/#read", "The Read"], ["/#privacy", "Privacy"], ["/#pricing", "Pricing"]] as const;

/**
 * Almost invisible until needed: transparent over the first screen, near-opaque ink with a
 * hairline once you scroll. One filled button, kept smaller than the hero's so the hero leads.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    const first = requestAnimationFrame(on);
    window.addEventListener("scroll", on, { passive: true });
    return () => { cancelAnimationFrame(first); window.removeEventListener("scroll", on); };
  }, []);

  // The menu is a disclosure: focus moves in, Escape closes it, the page behind is locked and inert.
  useEffect(() => {
    if (!open) return;
    const behind = [document.getElementById("content"), document.querySelector("footer")].filter((x): x is HTMLElement => !!x);
    document.documentElement.style.overflow = "hidden";
    behind.forEach((el) => { el.inert = true; });
    const first = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>("a")?.focus());
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => {
      cancelAnimationFrame(first);
      document.documentElement.style.overflow = "";
      behind.forEach((el) => { el.inert = false; });
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => toggle.current?.focus());
  }

  return (
    <>
      <header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-colors duration-[var(--dur-state)]", scrolled || open ? "border-divider bg-ink/95" : "border-transparent bg-transparent")}>
        <div className="frame flex h-16 items-center justify-between gap-6">
          <Link href="/" aria-label="Oriel home" className="-ml-1 shrink-0 rounded-control px-1 py-1" onClick={() => setOpen(false)}><Logo /></Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {LINKS.map(([href, label]) => (
              <a key={href} href={href} className="rounded-control px-3 py-2 text-ui text-stone transition-colors duration-[var(--dur-press)] hover:text-ivory">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link href="/home" className="hidden h-9 items-center rounded-button bg-ivory px-4 text-ui font-medium text-ink transition-colors duration-[var(--dur-press)] hover:bg-mist-200 sm:inline-flex">Open Oriel</Link>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-control px-3 py-2 text-ui text-stone transition-colors duration-[var(--dur-press)] hover:text-ivory sm:block">Sign in</Link>
                <Link href="/signup" className="hidden h-9 items-center rounded-button bg-ivory px-4 text-ui font-medium text-ink transition-colors duration-[var(--dur-press)] hover:bg-mist-200 md:inline-flex">Start practicing</Link>
              </>
            )}
            <button ref={toggle} type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} aria-controls="site-menu"
              className="-mr-2 h-11 rounded-control px-3 text-ui font-medium text-ivory md:hidden">
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div ref={menu} id="site-menu" className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-ink md:hidden">
          <nav aria-label="Menu" className="frame flex flex-col pb-10 pt-2">
            {LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-14 items-center border-b border-divider font-display text-[1.625rem] text-ivory">{label}</a>
            ))}
            <div className="mt-8 flex flex-col gap-3">
              {signedIn ? (
                <Link href="/home" onClick={() => setOpen(false)} className="inline-flex h-12 items-center justify-center rounded-button bg-ivory text-ui font-medium text-ink">Open Oriel</Link>
              ) : (
                <>
                  <Link href="/signup" onClick={() => setOpen(false)} className="inline-flex h-12 items-center justify-center rounded-button bg-ivory text-ui font-medium text-ink">Start practicing</Link>
                  <Link href="/login" onClick={() => setOpen(false)} className="inline-flex h-12 items-center justify-center text-ui text-stone underline decoration-1 underline-offset-[0.2em]">Sign in</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
