"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";

const LINKS = [
  ["/home", "Home"], ["/practice", "Practice"], ["/lessons", "Lessons"], ["/playback", "Playback"], ["/drills", "Drills"],
  ["/ladder", "Ladder"], ["/progress", "Progress"], ["/profile", "Profile"],
] as const;

export function AppNav({ isAdmin, name, mockProviders }: { isAdmin: boolean; name: string | null; mockProviders: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const links = isAdmin ? [...LINKS, ["/admin", "Admin"] as const] : LINKS;
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Link href="/home" aria-label="Oriel home" className="shrink-0"><Logo /></Link>
        <nav aria-label="Main" className="-mx-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
          {links.map(([href, label]) => {
            const on = path === href || path.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={cn("relative shrink-0 rounded-full px-3 py-1.5 text-[13px] transition-colors", on ? "bg-white/[0.07] text-mist-100" : "text-mist-400 hover:text-mist-100")}>
                {label}
              </Link>
            );
          })}
        </nav>
        {mockProviders && <span title="No AI provider key configured: interviewer uses deterministic templates and heuristics." className="hidden shrink-0 rounded-full border border-signal-warn/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-signal-warn sm:block">mock AI</span>}
        <button onClick={signOut} className="shrink-0 text-[13px] text-mist-400 hover:text-mist-100" title={name ?? undefined}>Sign out</button>
      </div>
    </header>
  );
}
