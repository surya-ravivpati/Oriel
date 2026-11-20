import Link from "next/link";
import { cn } from "@/components/ui/cn";

/**
 * Practice comes in three kinds. Each says when to reach for it, so nobody has to try all three to
 * find out. Sits above every Practice page; the current kind is marked, the others are one tap away.
 */
const MODES = [
  { href: "/train", name: "Skill practice", when: "When one skill keeps slipping. Answer, get a note, try again." },
  { href: "/lessons", name: "Lessons", when: "After an interview. Fixes built from your own answers." },
  { href: "/drills", name: "Quick drills", when: "When you have five minutes. One habit, one number to beat." },
] as const;

export function PracticeModes({ current }: { current: (typeof MODES)[number]["href"] }) {
  const here = MODES.find((m) => m.href === current)!;
  return (
    <nav aria-label="Kinds of practice" className="mb-group">
      <ul className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line">
        {MODES.map((m) => {
          const on = m.href === current;
          return (
            <li key={m.href}>
              <Link href={m.href} aria-current={on ? "page" : undefined}
                className={cn("relative -mb-px inline-flex min-h-11 items-center border-b text-ui transition-colors duration-press", on ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
                {m.name}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-meta text-fg-subtle">{here.when}</p>
    </nav>
  );
}
