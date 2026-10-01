export type Track = "delivery" | "responses" | "presence";

export type LessonKey =
  | "fillers" | "pace" | "vocal_variety"
  | "structure" | "specificity" | "hedging" | "recovery" | "concision" | "opener"
  | "eye_contact" | "posture" | "setup";

/** A verbatim excerpt from the person's own interview, with where it happened. */
export interface LessonQuote {
  sessionId: string;
  answerId: string | null;
  question: string | null;
  text: string;
  startMs: number | null;
  note: string | null; // what was measured there, e.g. "5 fillers in 40 seconds"
  typed?: boolean; // typed answers have no voice to hear in Playback
}

/** What was measured — only numbers the Read produced and words the person said. */
export interface LessonEvidence {
  value: number | null;
  unit: string;
  display: string; // "6.2 per minute"
  target: string; // "under 3 per minute"
  confidence: "high" | "medium" | "low";
  facts: string[]; // short measured facts the writer may restate
  quotes: LessonQuote[];
  moments: { sessionId: string; startMs: number; label: string }[]; // timestamps worth replaying (posture, etc.)
}

/** The personal part of a lesson, written by the model (checked) or from templates. */
export interface LessonContent {
  observation: string;
  tip: string;
  rewrite: { before: string; after: string; note: string } | null;
  source: "llm" | "heuristic";
}
