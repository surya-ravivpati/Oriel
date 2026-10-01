import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listSessions, sessionInterviewers } from "@/server/queries";
import { Badge, Eyebrow } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { relDate, TYPE_LABEL } from "@/lib/format";
import { callName } from "@/lib/avatar/style";

export const metadata = { title: "Playback" };

export default async function PlaybackIndex() {
  const user = await requireUser();
  const sessions = listSessions(user.id);
  const ivs = sessionInterviewers(sessions.map((s) => s.id));
  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><Eyebrow>Playback</Eyebrow><h1 className="mt-3 font-display text-5xl">Every session, with evidence.</h1></div>
        <ButtonLink href="/practice" variant="lume">New session</ButtonLink>
      </header>
      <ul className="mt-10 divide-y divide-white/[0.06] rounded-2xl border hairline">
        {sessions.length === 0 && <li className="px-6 py-10 text-center text-mist-400">No sessions yet. Your first one sets your baseline.</li>}
        {sessions.map((s) => (
          <li key={s.id}>
            <Link href={s.status === "ended" ? `/playback/${s.id}` : `/room/${s.id}`} className="grid gap-2 px-6 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-mist-100">{s.summary?.headline ?? `${s.role} · ${TYPE_LABEL[s.type] ?? s.type}`}</p>
                <p className="mt-1 text-sm text-mist-400">{relDate(s.createdAt)} · {s.role} · {(ivs.get(s.id) ?? []).map((i) => callName(i.name, i.style)).join(", ")} · pressure {s.pressure}/5{s.ladderLevel ? ` · Ladder ${s.ladderLevel}` : ""}</p>
              </div>
              <div>{s.status !== "ended" ? <Badge tone="warn">Unfinished — rejoin</Badge> : s.analysisStatus === "complete" ? <Badge tone="good">Read ready</Badge> : s.analysisStatus === "failed" ? <Badge tone="bad">Analysis failed — retry</Badge> : <Badge>Analysing</Badge>}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
