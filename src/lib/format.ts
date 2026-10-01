export function mmss(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function relDate(d: Date | null | undefined) {
  if (!d) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** relDate for the middle of a sentence: "today", "3 days ago", "on Sep 30". */
export function relPhrase(d: Date | null | undefined) {
  const r = relDate(d);
  return r === "Today" || r === "Yesterday" ? r.toLowerCase() : /ago$/.test(r) || !r ? r : `on ${r}`;
}

export const TYPE_LABEL: Record<string, string> = { behavioral: "Behavioral", technical: "Technical", case: "Case", leadership: "Leadership", mixed: "Mixed" };
