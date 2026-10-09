"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";

const LINKS = [
  ["/home", "Home"], ["/practice", "Practice"], ["/lessons", "Lessons"], ["/playback", "Playback"], ["/drills", "Drills"],
  ["/ladder", "Ladder"], ["/progress", "Progress"],
] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

/** A solid bar ruled off from the page: sections in the middle, the account on the right; a full-screen sheet on phones. */
export function AppNav({ isAdmin, name, mockProviders }: { isAdmin: boolean; name: string | null; mockProviders: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isOn = (href: string) => path === href || path.startsWith(`${href}/`);
  const account: [string, string][] = [["/profile", "Profile & settings"], ...(isAdmin ? [["/admin", "Admin"] as [string, string]] : [])];

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    const first = requestAnimationFrame(on);
    window.addEventListener("scroll", on, { passive: true });
    return () => { cancelAnimationFrame(first); window.removeEventListener("scroll", on); };
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = sheet ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [sheet]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
    <header className={cn("sticky top-0 z-40 border-b bg-ink-950 transition-colors duration-200", scrolled || sheet ? "border-line" : "border-transparent")}>
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-5 sm:px-8">
        <Link href="/home" aria-label="Oriel home" className="shrink-0" onClick={() => setSheet(false)}><Logo /></Link>
        <nav aria-label="Main" className="mx-auto hidden h-full items-stretch gap-6 lg:flex">
          {LINKS.map(([href, label]) => {
            const on = isOn(href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={cn("relative flex items-center text-[14px] transition-colors duration-200", on ? "text-mist-100" : "text-mist-400 hover:text-mist-100")}>
                {label}
                {on && <motion.span layoutId="nav-mark" className="absolute inset-x-0 -bottom-px h-0.5 bg-lume" transition={{ duration: 0.3, ease: EASE }} />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {mockProviders && <span title="No AI provider key configured: the interviewer uses deterministic templates and heuristics." className="hidden font-mono text-[12px] text-signal-warn sm:block">mock AI</span>}
          <AccountMenu name={name} links={account} onSignOut={signOut} active={isOn("/profile") || isOn("/admin")} />
          <button type="button" onClick={() => setSheet(!sheet)} aria-expanded={sheet} aria-controls="app-sheet" aria-label={sheet ? "Close menu" : "Open menu"}
            className="h-8 rounded-md border border-line-strong px-3 text-[13px] font-medium text-mist-100 transition-colors hover:border-ink-500 lg:hidden">
            {sheet ? "Close" : "Menu"}
          </button>
        </div>
      </div>
    </header>
      <AnimatePresence>
        {sheet && (
          <motion.div id="app-sheet" className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto bg-ink-950 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <motion.nav aria-label="Menu" className="flex flex-col px-8 pb-10 pt-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.035 } } }}>
              {[...LINKS, ...account].map(([href, label]) => (
                <motion.div key={href} variants={{ hidden: { opacity: 0, y: -8 }, shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
                  <Link href={href} onClick={() => setSheet(false)} aria-current={isOn(href) ? "page" : undefined}
                    className={cn("block border-b border-line py-3.5 font-display text-[26px] leading-tight", isOn(href) ? "text-lume" : "text-mist-100")}>{label}</Link>
                </motion.div>
              ))}
              <motion.div variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }} className="mt-8 flex items-center justify-between">
                <span className="text-callout text-mist-400">{name ?? "Signed in"}</span>
                <button type="button" onClick={signOut} className="h-9 rounded-md border border-line-strong px-4 text-callout font-medium text-mist-100 hover:border-ink-500">Sign out</button>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AccountMenu({ name, links, onSignOut, active }: { name: string | null; links: [string, string][]; onSignOut: () => void; active: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); button.current?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(box.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    const first = requestAnimationFrame(() => box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus());
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(first); document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  const initial = (name?.trim()[0] ?? "Y").toUpperCase();
  return (
    <div ref={box} className="relative hidden lg:block">
      <button ref={button} type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Account"
        className={cn("grid size-8 place-items-center rounded-md border font-display text-[16px] transition-colors duration-200",
          active || open ? "border-lume text-lume" : "border-line-strong text-mist-100 hover:border-ink-500")}>
        {initial}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" aria-label="Account" className="absolute right-0 top-11 w-60 origin-top-right rounded-lg bg-ink-900 p-1.5 shadow-sheet"
            initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -4 }} transition={{ duration: 0.18, ease: EASE }}>
            <p className="px-3 pb-2 pt-2.5 text-caption text-mist-400">{name ? <>Signed in as <span className="font-medium text-mist-100">{name}</span></> : "Signed in"}</p>
            <div className="my-1 h-px bg-line" />
            {links.map(([href, label]) => (
              <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-callout text-mist-100 outline-none hover:bg-ink-800 focus-visible:bg-ink-800">{label}</Link>
            ))}
            <button type="button" role="menuitem" onClick={onSignOut} className="block w-full rounded-md px-3 py-2 text-left text-callout text-mist-100 outline-none hover:bg-ink-800 focus-visible:bg-ink-800">Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
