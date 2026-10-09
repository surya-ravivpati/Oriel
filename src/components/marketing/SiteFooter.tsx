import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** The colophon: what Oriel is and isn't, then a directory in small type. */
export function SiteFooter({ signedIn }: { signedIn: boolean }) {
  const columns: [string, [string, string][]][] = [
    ["Product", [["/#in-the-room", "In the room"], ["/#read", "The Read"], ["/#playback", "Playback"], ["/#practice", "Lessons and drills"]]],
    ["Practice", signedIn
      ? [["/home", "Open Oriel"], ["/practice", "Practice an interview"], ["/progress", "Your progress"]]
      : [["/signup", "Start practicing"], ["/login", "Sign in"], ["/#pricing", "Pricing"]]],
    ["Trust", [["/#privacy", "How your data is handled"], ["/trust", "How accurate is the Read"], ["/privacy", "Privacy and biometric policy"]]],
    ["Contact", [["mailto:hello@oriel.example", "hello@oriel.example"], ["mailto:hello@oriel.example?subject=Campus", "Career centers"]]],
  ];
  return (
    <footer className="border-t border-line text-[13px] leading-relaxed text-mist-400">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="grid gap-y-10 py-12 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-3">
            <Link href="/" aria-label="Oriel home"><Logo /></Link>
            <p className="mt-4 max-w-[30ch]">Practice only. Your interviewer is an AI, and every session says so.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:col-span-9">
            {columns.map(([title, links]) => (
              <div key={title}>
                <p className="font-medium text-mist-200">{title}</p>
                <ul className="mt-3 space-y-2">
                  {links.map(([href, label]) => (
                    <li key={href}>
                      {href.startsWith("mailto:")
                        ? <a href={href} className="transition-colors hover:text-mist-100">{label}</a>
                        : <Link href={href} className="transition-colors hover:text-mist-100">{label}</Link>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap justify-between gap-x-8 gap-y-2 border-t border-line py-6">
          <p>© {new Date().getFullYear()} Oriel</p>
          <p>Not used to screen candidates. Never feeds you answers in a real interview.</p>
        </div>
      </div>
    </footer>
  );
}
