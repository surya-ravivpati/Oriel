import type { Decision, InterviewState, SeatedInterviewer } from "@/lib/interview/controller";
import { PERSONAS, PANEL_ROLE_LABEL } from "@/lib/interview/personas";
import { PRESSURE_LABELS } from "@/lib/interview/pressure";
import { mulberry32 } from "@/lib/interview/controller";
import type { LanguageModelProvider, LlmUsage } from "./providers/types";

/**
 * The Interviewer: turns a controller Decision into one spoken utterance.
 * It phrases; it does not decide. Two renderers share the same contract:
 *   - LLM renderer (persona voice, natural phrasing)
 *   - Template renderer (deterministic; used with mock providers and as the fallback
 *     when the model times out, so the conversation never stalls)
 */

export interface RenderContext {
  state: InterviewState;
  decision: Decision;
  candidateName: string;
  lastQuestion: string | null;
  lastAnswer: string | null;
  recentTurns: { speaker: "interviewer" | "candidate"; text: string }[];
}

export interface RenderedUtterance {
  text: string;
  source: "llm" | "template";
  usage: LlmUsage | null;
  latencyMs: number;
  /** Separately speakable parts (template renders) — lets fixed phrases hit the speech cache. */
  segments?: string[];
  firstTokenMs?: number | null;
  error?: string;
}

/** Fixed phrases the template renderer uses; prewarmed into the speech cache per voice. */
export const ACK_WARM = ["Thanks, that's helpful.", "Got it, thank you."];
export const ACK_BRIEF = ["Okay.", "Right."];
export const CLOSING_LINE = "We're coming up on time. What questions do you have for me?";
export const CURVEBALL_PREFIX = ["Different question.", "Let me change direction.", "Something else."];

/** Intents rendered from templates even when a model is available (fast, cacheable, already well-phrased). */
export const TEMPLATE_INTENTS: Decision["intent"][] = ["ask_primary", "curveball", "invite_questions"];

function seatOf(state: InterviewState, seat: number): SeatedInterviewer {
  return state.interviewers.find((i) => i.seat === seat) ?? state.interviewers[0];
}

const firstName = (n: string) => n.split(" ")[0];
const callName = (i: SeatedInterviewer) => i.callName ?? firstName(i.name);

// ─── LLM renderer ──────────────────────────────────────────────────────────

const INTENT_BRIEF: Record<Decision["intent"], string> = {
  open_interview: "Open the interview.",
  ask_primary: "Ask the next main question.",
  ask_specifics: "The answer was vague. Ask for concrete specifics: names, numbers, scope, what exactly happened.",
  ask_personal_role: "The answer described the team. Ask what the candidate personally did.",
  ask_result: "The answer had no clear result. Ask what the outcome was and how they know.",
  probe_number: "Probe the number the candidate stated: how it was measured, baseline, or what it meant.",
  challenge_claim: "Skeptically challenge the stated claim — how do they know it was their doing and not luck or the team?",
  redirect_after_interrupt: "You are interrupting a long or unfocused answer. Cut in politely but firmly and ask for the point or the result.",
  clarify_short: "The answer was too short. Ask them to expand with a specific example.",
  memory_callback: "Return to something the candidate said earlier (the claim given) and probe it.",
  curveball: "Ask this unexpected question.",
  cross_question: "You are a different panelist cutting in on your colleague's thread to test the claim.",
  invite_questions: "Wrap up and invite the candidate's questions.",
  farewell: "Respond briefly to what the candidate asked or said, then thank them and close the interview. Do not ask another question. If they asked something you cannot know (salary bands, team details), say the team will cover it in the next conversation.",
};

function systemPrompt(ctx: RenderContext): string {
  const { state, decision } = ctx;
  const me = seatOf(state, decision.seat);
  const persona = PERSONAS[me.personaId];
  const panel = state.interviewers.length > 1
    ? `This is a panel interview. Panelists: ${state.interviewers.map((i) => `${i.name} (${i.panelRole ? PANEL_ROLE_LABEL[i.panelRole] : PERSONAS[i.personaId].title})`).join(", ")}. You are ${me.name}.`
    : `You are ${me.name}, ${persona.title}.`;
  return [
    `You are an interviewer in a realistic spoken practice interview for a ${state.role} role (${state.level.replace("_", " ")} round, ${state.type} interview).`,
    panel,
    `Your manner: ${persona.style}`,
    `Pressure: ${PRESSURE_LABELS[decision.pressure]} (${decision.pressure}/5). ${decision.pressure >= 4 ? "Be economical and unsentimental. No praise." : decision.pressure <= 1 ? "Be patient and encouraging." : "Be professional."}`,
    "Rules:",
    "- You are speaking out loud. Output only the words you say. No stage directions, no quotes, no markdown, no emoji.",
    "- One to three short sentences. At most one question, and it must be the last sentence (except when closing).",
    "- Never give feedback, scores, or coaching. You are an interviewer, not a coach.",
    "- Never invent facts about the candidate. Only reference what they actually said, and only the claim text you are given.",
    "- Do not repeat the candidate's answer back at length. Do not start with 'Great question'.",
    decision.acknowledgement === "warm" ? "- Begin with a short, genuine acknowledgement." : decision.acknowledgement === "brief" ? "- You may begin with a two-or-three word acknowledgement." : "- Do not acknowledge or praise the previous answer.",
  ].join("\n");
}

function userPrompt(ctx: RenderContext): string {
  const { state, decision } = ctx;
  const me = seatOf(state, decision.seat);
  const lines: string[] = [];
  if (ctx.recentTurns.length) {
    lines.push("Recent conversation:");
    for (const t of ctx.recentTurns.slice(-6)) lines.push(`${t.speaker === "candidate" ? "Candidate" : "Interviewer"}: ${t.text}`);
    lines.push("");
  }
  lines.push(`Your task: ${INTENT_BRIEF[decision.intent]}`);
  if (decision.intent === "open_interview") {
    lines.push(`Say: hello to ${ctx.candidateName}, your name and role${state.interviewers.length > 1 ? " and that your colleagues are on the panel" : ""}, one sentence stating plainly that you are an AI interviewer for practice, then ask the opening question.`);
  }
  if (decision.baseQuestion) lines.push(`Question to ask (keep its meaning; you may lightly rephrase in your voice): "${decision.baseQuestion}"`);
  if (decision.claim) lines.push(`Candidate's claim (verbatim — reference it faithfully, do not add details): "${decision.claim.text}"`);
  if (decision.handoffFromSeat !== null && decision.handoffFromSeat !== decision.seat) {
    const from = seatOf(state, decision.handoffFromSeat);
    lines.push(decision.intent === "cross_question"
      ? `You are cutting in on ${callName(from)}'s line of questioning. Signal that briefly (e.g. "Let me jump in").`
      : `You are taking over from ${callName(from)}. You may signal the handoff in a few words.`);
  }
  if (decision.intent === "open_interview" && me) lines.push(`Your name: ${me.name}.`);
  return lines.join("\n");
}

export async function renderUtterance(ctx: RenderContext, llm: LanguageModelProvider, timeoutMs = 3500): Promise<RenderedUtterance> {
  if (llm.isMock) return renderTemplate(ctx);
  try {
    const res = await llm.generateText({
      tier: "realtime",
      system: systemPrompt(ctx),
      messages: [{ role: "user", content: userPrompt(ctx) }],
      maxTokens: ctx.decision.intent === "open_interview" ? 220 : 140,
      temperature: 0.7,
      timeoutMs,
    });
    const text = sanitize(res.text);
    if (!text) throw new Error("empty after sanitize");
    return { text, source: "llm", usage: res.usage, latencyMs: res.latencyMs };
  } catch (err) {
    const t = renderTemplate(ctx);
    return { ...t, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Strip anything that should not be spoken. */
export function sanitize(text: string): string {
  return text
    .replace(/\*[^*]+\*/g, "")
    .replace(/\([^)]*(?:pause|smiles?|nods?|leans?|beat)[^)]*\)/gi, "")
    .replace(/^(?:interviewer|[A-Z][a-z]+ [A-Z][a-z]+)\s*:\s*/i, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Template renderer (deterministic) ────────────────────────────────────

export function renderTemplate(ctx: RenderContext): RenderedUtterance {
  const { state, decision } = ctx;
  const rng = mulberry32(state.rngSeed + state.answerSeq * 31 + decision.seat);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const me = seatOf(state, decision.seat);
  const persona = PERSONAS[me.personaId];
  const warm = persona.warmth >= 0.6 && decision.pressure <= 2;
  const ackPhrase = decision.acknowledgement === "warm" ? pick(ACK_WARM) : decision.acknowledgement === "brief" ? pick(ACK_BRIEF) : "";
  const ack = ackPhrase ? ackPhrase + " " : "";
  let handoffPhrase = "";
  if (decision.handoffFromSeat !== null && decision.handoffFromSeat !== decision.seat) {
    handoffPhrase = decision.intent === "cross_question" ? pick(["Let me jump in there.", "Can I cut in for a second?"]) : pick(handoffPhrases(state, decision.handoffFromSeat));
  }
  const handoff = handoffPhrase ? handoffPhrase + " " : "";
  const claim = decision.claim?.text;
  let text: string;
  switch (decision.intent) {
    case "open_interview": {
      const others = state.interviewers.filter((i) => i.seat !== me.seat).map((i) => callName(i));
      text = `Hi ${ctx.candidateName}, I'm ${callName(me)}, ${persona.title.toLowerCase() === "recruiter" ? "one of the recruiters" : `the ${persona.title.toLowerCase()}`} for this role.` +
        (others.length ? ` ${others.join(" and ")} ${others.length > 1 ? "are" : "is"} joining me on the panel.` : "") +
        ` Just so you know, I'm an AI interviewer, here so you can practice. ${warm ? "Take your time. " : ""}${decision.baseQuestion}`;
      break;
    }
    case "ask_primary":
    case "curveball": {
      const prefix = decision.intent === "curveball" ? pick(CURVEBALL_PREFIX) : "";
      const segments = [ackPhrase, handoffPhrase, prefix, decision.baseQuestion ?? ""].filter(Boolean);
      return { text: segments.join(" "), segments, source: "template", usage: null, latencyMs: 0 };
    }
    case "ask_specifics":
      text = `${ack}${pick(decision.pressure >= 4
        ? ["That's quite general. What specifically happened?", "I'm not hearing specifics. Give me one concrete example.", "Be more precise. What exactly did you do, and what changed?"]
        : ["Can you make that more concrete? Walk me through one specific example.", "What would that look like in practice? Give me a specific moment.", "Help me picture it. What specifically did you do?"])}`;
      break;
    case "ask_personal_role":
      text = `${ack}${pick(["You mentioned what the team did. What did you personally do?", "What was your specific part in that?", "Separate yourself from the team for a second. What did you own?"])}`;
      break;
    case "ask_result":
      text = `${ack}${pick(["And what was the result?", "How did it turn out? What changed as a result?", "What was the outcome, and how did you measure it?"])}`;
      break;
    case "probe_number":
      text = `${pick([`You said ${claim}. How did you measure that?`, `${capitalize(claim ?? "That number")} — what was the starting point?`, `Tell me more about ${claim}. How much of that was down to you?`])}`;
      break;
    case "challenge_claim":
      text = `${pick([`You said ${claim}. How do you know that was your doing and not something else?`, `I'm not sure I buy that yet. ${capitalize(claim ?? "That")} — what's the evidence?`, `${capitalize(claim ?? "That")}. What would your manager say about that number?`])}`;
      break;
    case "cross_question":
      text = `${handoff}${pick([`You said ${claim}. What's the evidence that was you?`, `On ${claim}, how was that actually measured?`])}`;
      break;
    case "redirect_after_interrupt":
      text = pick(["Let me stop you there. What was the result?", "I'm going to jump in. What's the one thing you want me to take from this?", "Sorry to cut in. Bottom line: what did you do, and what happened?"]);
      break;
    case "clarify_short":
      text = pick(["Can you say more about that? Give me a specific example.", "Keep going. What's an example of that?", "Say more. What happened?"]);
      break;
    case "memory_callback":
      text = `${ack}${pick([`Earlier you mentioned ${claim}. What specifically changed because of you?`, `I want to go back to something. You said ${claim}. Walk me through that.`, `Going back to ${claim}. How did that actually play out?`])}`;
      break;
    case "invite_questions": {
      const segments = [ackPhrase, CLOSING_LINE].filter(Boolean);
      return { text: segments.join(" "), segments, source: "template", usage: null, latencyMs: 0 };
    }
    case "farewell":
      text = warm ? "Thanks, that's a good question. The team can go deeper on that in the next conversation. Thank you for your time today, it was good to meet you." : "Noted. The team will cover that in the next conversation. Thank you for your time today.";
      break;
    default:
      text = decision.baseQuestion ?? "Tell me more.";
  }
  return { text: text.replace(/\s+/g, " ").trim(), source: "template", usage: null, latencyMs: 0 };
}

export function handoffPhrases(state: InterviewState, fromSeat: number) {
  return ["I'll pick it up from here.", `Thanks, ${callName(seatOf(state, fromSeat))}.`];
}

/** Everything the template renderer might say verbatim for a seat — prewarmed into the speech cache. */
export function cacheablePhrases(state: InterviewState, seat: number): string[] {
  const others = state.interviewers.filter((i) => i.seat !== seat).flatMap((i) => handoffPhrases(state, i.seat).slice(0, 1));
  // Most-used first: prewarming stops when the TTS budget runs low.
  return [ACK_BRIEF[0], ACK_WARM[0], ACK_BRIEF[1], ...others, ACK_WARM[1], CLOSING_LINE];
}

// ─── Streaming render ─────────────────────────────────────────────────────

/**
 * Yields the utterance sentence by sentence so speech can start on the first one.
 * Returns the complete rendering (text, source, usage) when done.
 */
export async function* streamUtterance(ctx: RenderContext, llm: LanguageModelProvider, timeoutMs = 6000): AsyncGenerator<string, RenderedUtterance> {
  const template = () => renderTemplate(ctx);
  if (llm.isMock || !llm.streamText || TEMPLATE_INTENTS.includes(ctx.decision.intent)) {
    const t = template();
    for (const seg of t.segments ?? [t.text]) yield seg;
    return t;
  }
  const t0 = performance.now();
  const spoken: string[] = [];
  let buf = "";
  let usage: LlmUsage | null = null;
  let firstTokenMs: number | null = null;
  try {
    const gen = llm.streamText({
      tier: "realtime", system: systemPrompt(ctx), messages: [{ role: "user", content: userPrompt(ctx) }],
      maxTokens: ctx.decision.intent === "open_interview" ? 220 : 140, temperature: 0.7, timeoutMs,
    });
    let r = await gen.next();
    while (!r.done) {
      buf += r.value;
      const [done, rest] = splitSentencesLocal(buf);
      buf = rest;
      for (const sentence of done) {
        const clean = sanitize(sentence);
        if (clean) { spoken.push(clean); yield clean; }
      }
      r = await gen.next();
    }
    usage = r.value.usage;
    firstTokenMs = r.value.firstTokenMs;
    const tail = sanitize(buf);
    if (tail) { spoken.push(tail); yield tail; }
    if (!spoken.length) throw new Error("empty response");
    return { text: spoken.join(" "), source: "llm", usage, latencyMs: performance.now() - t0, firstTokenMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (spoken.length) return { text: spoken.join(" "), source: "llm", usage, latencyMs: performance.now() - t0, firstTokenMs, error };
    const t = template();
    for (const seg of t.segments ?? [t.text]) yield seg;
    return { ...t, error };
  }
}

function splitSentencesLocal(buf: string): [string[], string] {
  const out: string[] = [];
  let rest = buf;
  const re = /^(.+?[.!?])(\s+)/s;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    out.push(m[1].trim());
    rest = rest.slice(m[0].length);
  }
  return [out, rest];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
