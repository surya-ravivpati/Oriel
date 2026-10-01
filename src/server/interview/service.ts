import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { HttpError } from "@/lib/api/errors";
import { audit } from "@/lib/security/audit";
import { logEvent } from "@/lib/costs/events";
import { recordTokenCost } from "@/lib/costs/record";
import { analyzeAnswer } from "@/lib/analysis/text";
import { analyzeAnswerWithModel } from "@/lib/ai/analyzers";
import { cacheablePhrases, renderTemplate, streamUtterance, type RenderedUtterance } from "@/lib/ai/interviewer";
import { prewarm, synth } from "./speech";
import { getLanguageModel, getTextToSpeech } from "@/lib/ai/providers/registry";
import {
  decide, initialState, listeningPolicy, openingDecision, recordAsked,
  type Decision, type InterviewState, type OpenClaim, type SeatedInterviewer,
} from "@/lib/interview/controller";
import { getPack, type InterviewType } from "@/lib/interview/domain-packs";
import { PERSONAS, panelRolesForSize, PANEL_ROLE_PERSONA, type PersonaId } from "@/lib/interview/personas";
import { clampPressure } from "@/lib/interview/pressure";
import { LADDER } from "@/lib/practice/catalog";
import {
  canStartSession, canUseDomainPack, canUseLadder, canUsePanelMode, maxSessionMinutes,
} from "@/lib/billing/entitlements";
import { loadEntitlementContext } from "@/lib/billing/entitlement-context";
import { savedStyles } from "@/server/avatar-styles";

// ─── Types sent to the Room ───────────────────────────────────────────────

export type RoomEvent =
  | { type: "decision"; seat: number; interviewerId: string; action: Decision["action"]; intent: Decision["intent"]; avatarCue: Decision["avatarCue"]; preSilenceMs: number; pressure: number; answerId: string | null }
  | { type: "text"; questionId: string; text: string; source: RenderedUtterance["source"]; seat: number }
  | { type: "audio"; seq: number; sampleRate: number; pcm: string }
  | { type: "audio_end"; chunks: number }
  | { type: "tts_fallback"; reason: string }
  | { type: "done"; phase: string; complete: boolean; listening: ReturnType<typeof listeningPolicy>; timings: Record<string, number> }
  | { type: "error"; message: string; recoverable: boolean };

export interface CreateInterviewInput {
  role: string;
  domain: string;
  level: string;
  type: InterviewType;
  pressure: number;
  persona: PersonaId;
  mode: "single" | "panel";
  panelSize: number;
  ladderLevel: number | null;
  targetMinutes: number;
  cameraMetrics: boolean;
}

// ─── Creation ─────────────────────────────────────────────────────────────

export function createInterview(userId: string, input: CreateInterviewInput): { sessionId: string; interviewId: string } {
  const db = getDb();
  const ent = loadEntitlementContext(userId);
  const verdicts = [canStartSession(ent), canUseDomainPack(ent, input.domain)];
  const rung = input.ladderLevel ? LADDER.find((l) => l.level === input.ladderLevel) : undefined;
  if (input.ladderLevel && !rung) throw new HttpError(400, "Unknown ladder level");
  if (rung) verdicts.push(canUseLadder(ent));
  const mode = rung ? rung.mode : input.mode;
  const panelSize = rung ? rung.personaIds.length : input.panelSize;
  if (mode === "panel") verdicts.push(canUsePanelMode(ent, panelSize));
  for (const v of verdicts) if (!v.allowed) throw new HttpError(402, v.reason, v.upgradeTo ? `upgrade:${v.upgradeTo}` : "entitlement");

  if (rung && input.ladderLevel! > 1) {
    const prog = db.select().from(schema.ladderProgress).where(and(eq(schema.ladderProgress.userId, userId), eq(schema.ladderProgress.level, input.ladderLevel!))).get();
    if (!prog?.unlockedAt) throw new HttpError(403, "This rung of the Ladder is still locked.");
  }

  const pressure = clampPressure(rung ? rung.pressure : input.pressure);
  const targetMinutes = Math.min(Math.max(5, input.targetMinutes), maxSessionMinutes(ent));
  const resume = db.select().from(schema.resumes).where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.isActive, true))).orderBy(desc(schema.resumes.createdAt)).get();
  const jd = db.select().from(schema.jobDescriptions).where(and(eq(schema.jobDescriptions.userId, userId), eq(schema.jobDescriptions.isActive, true))).orderBy(desc(schema.jobDescriptions.createdAt)).get();

  const interviewId = newId("int");
  const sessionId = newId("ses");
  const styles = savedStyles(userId);
  // The person's own name for an interviewer replaces the persona's; behaviour is unchanged.
  const named = (pid: PersonaId) => (styles[pid]?.name ? { name: styles[pid]!.name!, callName: styles[pid]!.name! } : { name: PERSONAS[pid].name });
  const seated: SeatedInterviewer[] = [];
  if (mode === "panel") {
    const roles = rung ? null : panelRolesForSize(panelSize);
    const personaIds = rung ? rung.personaIds : roles!.map((r) => PANEL_ROLE_PERSONA[r]);
    personaIds.forEach((pid, seat) => {
      const role = rung ? (["hiring_manager", "skeptic", "peer", "executive"] as const)[seat] : roles![seat];
      seated.push({ id: newId("ivw"), personaId: pid, panelRole: role, seat, ...named(pid) });
    });
  } else {
    const pid = rung ? rung.personaIds[0] : input.persona;
    seated.push({ id: newId("ivw"), personaId: pid, panelRole: null, seat: 0, ...named(pid) });
  }

  const pack = getPack(input.domain);
  const firstRole = resume?.parsed?.roles?.[0];
  const state = initialState({
    domain: pack.id, type: input.type, level: input.level, role: input.role, targetMinutes,
    interviewers: seated, pressure, mode, curveballs: rung?.curveballs ?? false,
    jdCompetencies: jd?.parsed?.competencies.map((c) => c.label) ?? [],
    resumeRole: firstRole ? { title: firstRole.title, organization: firstRole.organization } : null,
    seed: Math.floor(Math.random() * 2 ** 31),
  });

  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  const cameraMetrics = input.cameraMetrics && (profile?.cameraMetricsEnabled ?? true);
  const retentionDays = profile?.videoRetentionDays ?? 30;

  db.transaction((tx) => {
    tx.insert(schema.interviews).values({
      id: interviewId, userId, role: input.role, domain: pack.id, level: input.level, type: input.type, pressure,
      mode, resumeId: resume?.id ?? null, jobDescriptionId: jd?.id ?? null, ladderLevel: input.ladderLevel, targetMinutes,
    }).run();
    if (mode === "panel") tx.insert(schema.panels).values({ id: newId("pnl"), interviewId, size: seated.length }).run();
    tx.insert(schema.interviewSessions).values({
      id: sessionId, interviewId, userId, status: "created", phase: "INTRO", controllerState: state as unknown as Record<string, unknown>,
      cameraMetricsEnabled: cameraMetrics, llmProvider: getLanguageModel().id, ttsProvider: getTextToSpeech().id,
      videoExpiresAt: new Date(Date.now() + retentionDays * 24 * 3600 * 1000),
    }).run();
    for (const s of seated) {
      tx.insert(schema.interviewers).values({
        id: s.id, sessionId, personaId: s.personaId, panelRole: s.panelRole, displayName: s.name, avatarStyle: styles[s.personaId] ?? null, seat: s.seat,
        competencyFocus: state.plan.filter((p) => p.seat === s.seat).map((p) => p.competency), memory: [],
      }).run();
    }
    tx.insert(schema.usageRecords).values({ id: newId("use"), userId, sessionId, kind: "sessions", quantity: 1 }).run();
  });
  logEvent("decision", "plan_built", { sessionId, userId, data: { plan: state.plan, pressure, mode, seats: seated.map((s) => s.personaId) } });
  audit("interview.create", { userId, target: sessionId, data: { mode, pressure, domain: pack.id, ladder: input.ladderLevel } });
  return { sessionId, interviewId };
}

// ─── Loading ──────────────────────────────────────────────────────────────

export function loadSession(sessionId: string, userId: string) {
  const db = getDb();
  const session = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get();
  if (!session || session.userId !== userId) throw new HttpError(404, "Session not found");
  const interview = db.select().from(schema.interviews).where(eq(schema.interviews.id, session.interviewId)).get()!;
  const interviewers = db.select().from(schema.interviewers).where(eq(schema.interviewers.sessionId, sessionId)).orderBy(asc(schema.interviewers.seat)).all();
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  return { session, interview, interviewers, profile, state: session.controllerState as unknown as InterviewState };
}

function saveState(sessionId: string, state: InterviewState, extra: Partial<typeof schema.interviewSessions.$inferInsert> = {}) {
  getDb().update(schema.interviewSessions).set({ controllerState: state as unknown as Record<string, unknown>, phase: state.phase, ...extra }).where(eq(schema.interviewSessions.id, sessionId)).run();
}

// One turn at a time per session (a double-submitted turn must not advance the state twice).
const inFlight = new Set<string>();

// ─── Opening ──────────────────────────────────────────────────────────────

export async function* runOpening(sessionId: string, userId: string): AsyncGenerator<RoomEvent> {
  if (inFlight.has(sessionId)) throw new HttpError(409, "A turn is already in progress");
  inFlight.add(sessionId);
  try {
    const { session, profile, state, interviewers } = loadSession(sessionId, userId);
    if (session.status === "ended") throw new HttpError(409, "This session has ended");
    const t0 = performance.now();
    const existing = getDb().select().from(schema.questions).where(eq(schema.questions.sessionId, sessionId)).orderBy(desc(schema.questions.seq)).get();
    if (existing) {
      // Reconnect: repeat the last question instead of restarting the interview.
      yield* speakExisting(sessionId, userId, state, existing, interviewers);
      return;
    }
    const { decision, state: next } = openingDecision(state);
    getDb().update(schema.interviewSessions).set({ status: "live", startedAt: new Date() }).where(eq(schema.interviewSessions.id, sessionId)).run();
    // Warm the speech cache with each interviewer's fixed phrases (acknowledgements, handoffs, closing).
    for (const iv of state.interviewers) prewarm(PERSONAS[iv.personaId].voice, cacheablePhrases(state, iv.seat), (u) => recordTokenCost({ userId, sessionId }, "gemini-tts", "tts", "prewarm", u));
    yield* deliver({ sessionId, userId, decision, state: next, interviewers, candidateName: firstName(profile?.name ?? "there"), lastQuestion: null, lastAnswer: null, answerId: null, t0, askedAtMs: 0 });
  } finally {
    inFlight.delete(sessionId);
  }
}

async function* speakExisting(sessionId: string, userId: string, state: InterviewState, q: typeof schema.questions.$inferSelect, interviewers: (typeof schema.interviewers.$inferSelect)[]): AsyncGenerator<RoomEvent> {
  const iv = interviewers.find((i) => i.id === q.interviewerId) ?? interviewers[0];
  yield { type: "decision", seat: iv.seat, interviewerId: iv.id, action: "NEXT_QUESTION", intent: "ask_primary", avatarCue: "still", preSilenceMs: 300, pressure: state.currentPressure, answerId: null };
  const text = `Let's pick up where we left off. ${q.text}`;
  yield { type: "text", questionId: q.id, text, source: "template", seat: iv.seat };
  yield* speak(sessionId, userId, text, PERSONAS[iv.personaId as PersonaId].voice, state.currentPressure);
  yield { type: "done", phase: state.phase, complete: false, listening: listeningPolicy(state), timings: {} };
}

// ─── Turn ─────────────────────────────────────────────────────────────────

export interface TurnInput {
  answerText: string;
  startMs: number;
  endMs: number;
  firstWordLatencyMs: number | null;
  interrupted: boolean;
  inputMode: "voice" | "text";
  prevQuestion: { questionId: string; startMs: number; endMs: number } | null;
  clientTimings?: Record<string, number>;
}

export async function* runTurn(sessionId: string, userId: string, input: TurnInput): AsyncGenerator<RoomEvent> {
  if (inFlight.has(sessionId)) throw new HttpError(409, "A turn is already in progress");
  inFlight.add(sessionId);
  try {
    const t0 = performance.now();
    const db = getDb();
    const { session, profile, state, interviewers, interview } = loadSession(sessionId, userId);
    if (session.status !== "live") throw new HttpError(409, "This session is not live");
    if (!state.lastQuestion) throw new HttpError(409, "No question has been asked yet");

    if (input.prevQuestion?.questionId === state.lastQuestion.questionId) {
      db.update(schema.questions).set({ askedAtMs: Math.round(input.prevQuestion.startMs), speechEndMs: Math.round(input.prevQuestion.endMs) }).where(eq(schema.questions.id, input.prevQuestion.questionId)).run();
      db.update(schema.transcriptSegments).set({ startMs: Math.round(input.prevQuestion.startMs), endMs: Math.round(input.prevQuestion.endMs) })
        .where(and(eq(schema.transcriptSegments.sessionId, sessionId), eq(schema.transcriptSegments.questionId, input.prevQuestion.questionId), eq(schema.transcriptSegments.speaker, "interviewer"))).run();
    }

    const text = input.answerText.trim().slice(0, 8000) || "(no answer)";
    const durationSec = Math.max(1, (input.endMs - input.startMs) / 1000);
    const heur = analyzeAnswer(text, durationSec);
    const answerId = newId("ans");
    const seq = state.answerSeq + 1;
    db.transaction((tx) => {
      tx.insert(schema.answers).values({
        id: answerId, sessionId, questionId: state.lastQuestion!.questionId, seq, text,
        startMs: Math.round(input.startMs), endMs: Math.round(input.endMs), firstWordLatencyMs: input.firstWordLatencyMs === null ? null : Math.round(input.firstWordLatencyMs),
        interrupted: input.interrupted, inputMode: input.inputMode,
        flags: { vague: heur.vagueness >= 0.6, hasNumbers: heur.quantified.length > 0, star: heur.star, hedges: heur.hedges, fillers: heur.fillers, wordCount: heur.wordCount, claims: heur.claims.map((c) => c.text) },
      }).run();
      tx.insert(schema.transcriptSegments).values({
        id: newId("seg"), sessionId, speaker: "candidate", questionId: state.lastQuestion!.questionId, answerId, text,
        startMs: Math.round(input.startMs), endMs: Math.round(input.endMs), source: input.inputMode === "text" ? "typed" : "webspeech",
      }).run();
      for (const c of heur.claims) {
        tx.insert(schema.claims).values({ id: newId("clm"), sessionId, answerId, answerSeq: seq, kind: c.kind, text: c.text, normalized: c.normalized }).run();
      }
    });

    // The model-based Answer Analyzer runs in the background and enriches the memory
    // ledger for later turns. It never blocks the conversation.
    const questionRow = db.select().from(schema.questions).where(eq(schema.questions.id, state.lastQuestion.questionId)).get();
    void enrichAnswer(sessionId, userId, answerId, seq, questionRow?.text ?? "", text, questionRow?.competency ?? null, interview.domain);

    const claims: OpenClaim[] = db.select().from(schema.claims).where(eq(schema.claims.sessionId, sessionId)).all()
      .map((c) => ({ id: c.id, kind: c.kind, text: c.text, status: c.status, answerSeq: c.answerSeq }));
    const elapsedMs = session.startedAt ? Date.now() - session.startedAt.getTime() : input.endMs;
    const { decision, state: next } = decide(state, {
      text, heuristics: heur, durationSec, interrupted: input.interrupted, firstWordLatencyMs: input.firstWordLatencyMs, elapsedMs, claims,
    });
    const tDecide = performance.now() - t0;
    logEvent("decision", decision.intent, { sessionId, userId, durationMs: tDecide, data: { ...decision, quality: heur.quality, vagueness: heur.vagueness, answerSeq: seq } });
    if (decision.claim) db.update(schema.claims).set({ status: "probed" }).where(eq(schema.claims.id, decision.claim.id)).run();

    yield* deliver({
      sessionId, userId, decision, state: next, interviewers, candidateName: firstName(profile?.name ?? "there"),
      lastQuestion: questionRow?.text ?? null, lastAnswer: text, answerId, t0, askedAtMs: input.endMs + decision.preSilenceMs,
      extraTimings: { decideMs: tDecide, ...(input.clientTimings ?? {}) },
    });
  } finally {
    inFlight.delete(sessionId);
  }
}

// ─── Delivery: render → persist → speak ──────────────────────────────────

async function* deliver(p: {
  sessionId: string; userId: string; decision: Decision; state: InterviewState;
  interviewers: (typeof schema.interviewers.$inferSelect)[]; candidateName: string;
  lastQuestion: string | null; lastAnswer: string | null; answerId: string | null; t0: number; askedAtMs: number;
  extraTimings?: Record<string, number>;
}): AsyncGenerator<RoomEvent> {
  const db = getDb();
  const iv = p.interviewers.find((i) => i.seat === p.decision.seat) ?? p.interviewers[0];
  const voice = PERSONAS[iv.personaId as PersonaId].voice;
  yield { type: "decision", seat: iv.seat, interviewerId: iv.id, action: p.decision.action, intent: p.decision.intent, avatarCue: p.decision.avatarCue, preSilenceMs: p.decision.preSilenceMs, pressure: p.decision.pressure, answerId: p.answerId };

  const recent = db.select().from(schema.transcriptSegments).where(eq(schema.transcriptSegments.sessionId, p.sessionId)).orderBy(desc(schema.transcriptSegments.startMs)).limit(6).all().reverse();
  const llm = getLanguageModel();
  const ctx = {
    state: p.state, decision: p.decision, candidateName: p.candidateName, lastQuestion: p.lastQuestion, lastAnswer: p.lastAnswer,
    recentTurns: recent.map((r) => ({ speaker: r.speaker, text: r.text })),
  };

  // The interviewer's words arrive sentence by sentence; speech starts on the first one.
  const sentences: string[] = [];
  let finished = false;
  let rendered: RenderedUtterance | null = null;
  const waiter: { wake: (() => void) | null } = { wake: null };
  const gen = streamUtterance(ctx, llm);
  const pump = (async () => {
    try {
      let r = await gen.next();
      while (!r.done) { sentences.push(r.value); waiter.wake?.(); r = await gen.next(); }
      rendered = r.value;
    } catch (err) {
      rendered = { ...renderTemplate(ctx), error: err instanceof Error ? err.message : String(err) };
      if (!sentences.length) sentences.push(...(rendered.segments ?? [rendered.text]));
    } finally {
      finished = true;
      waiter.wake?.();
    }
  })();
  const next = async (): Promise<string | null> => {
    while (!sentences.length && !finished) await new Promise<void>((r) => { waiter.wake = r; });
    return sentences.shift() ?? null;
  };

  const questionId = newId("qst");
  const first = await next();
  const tFirstText = performance.now() - p.t0;
  yield { type: "text", questionId, text: first ?? "", source: "llm", seat: iv.seat };

  const tts = getTextToSpeech();
  let seq = 0;
  let firstAudioMs: number | null = null;
  let ttsFailed = tts.isMock;
  let ttsFirstChunkMs: number | null = null;
  let cacheHits = 0;
  // Fewer TTS requests: if the model finishes within a beat of the first sentence,
  // speak the whole utterance in one request instead of sentence by sentence.
  let spoken = first;
  if (spoken !== null && !finished) await Promise.race([pump, new Promise((r) => setTimeout(r, 250))]);
  if (spoken !== null && finished && sentences.length && (rendered as RenderedUtterance | null)?.source === "llm") {
    spoken = [spoken, ...sentences.splice(0)].join(" ");
  }
  while (spoken !== null && !ttsFailed) {
    try {
      const sg = synth(voice, spoken);
      let r = await sg.next();
      while (!r.done) {
        if (firstAudioMs === null) firstAudioMs = performance.now() - p.t0;
        yield { type: "audio", seq: seq++, sampleRate: r.value.sampleRate, pcm: r.value.pcm.toString("base64") };
        r = await sg.next();
      }
      if (r.value.cached) cacheHits++;
      if (ttsFirstChunkMs === null) ttsFirstChunkMs = r.value.firstChunkMs;
      if (r.value.usage) recordTokenCost({ userId: p.userId, sessionId: p.sessionId }, tts.id, "tts", "interviewer_speech", r.value.usage);
    } catch (err) {
      logEvent("error", "tts_failed", { sessionId: p.sessionId, userId: p.userId, data: { error: err instanceof Error ? err.message : String(err), chunksSent: seq } });
      ttsFailed = true;
      break;
    }
    spoken = await next();
  }
  await pump;
  const r = rendered as RenderedUtterance | null;
  const fullText = r?.text ?? first ?? "";
  if (r?.usage) recordTokenCost({ userId: p.userId, sessionId: p.sessionId }, llm.id, "llm", "interviewer_turn", r.usage);
  logEvent("llm_output", "interviewer", { sessionId: p.sessionId, userId: p.userId, durationMs: r?.latencyMs, data: { text: fullText, source: r?.source, intent: p.decision.intent, firstTokenMs: r?.firstTokenMs ?? null, error: r?.error ?? null } });
  if (r?.error) logEvent("fallback", "interviewer_template", { sessionId: p.sessionId, userId: p.userId, data: { error: r.error } });

  // Persist before telling the client we're done, so the next turn can reference it.
  const qCount = db.select({ id: schema.questions.id }).from(schema.questions).where(eq(schema.questions.sessionId, p.sessionId)).all().length;
  const bankDifficulty = p.state.plan.find((q) => q.text === p.decision.baseQuestion)?.difficulty ?? (p.decision.kind === "follow_up" ? 2 : 3);
  db.insert(schema.questions).values({
    id: questionId, sessionId: p.sessionId, interviewerId: iv.id, seq: qCount + 1, kind: p.decision.kind,
    competency: p.decision.competency, text: fullText, difficulty: p.decision.kind === "intro" ? 1 : bankDifficulty,
    parentQuestionId: p.state.currentPrimary?.questionId || null, decisionReason: p.decision.reason, askedAtMs: Math.round(p.askedAtMs),
  }).run();
  db.insert(schema.transcriptSegments).values({
    id: newId("seg"), sessionId: p.sessionId, speaker: "interviewer", interviewerId: iv.id, questionId, text: fullText,
    startMs: Math.round(p.askedAtMs), endMs: Math.round(p.askedAtMs + fullText.length * 60), source: "tts",
  }).run();
  const finalState = recordAsked(p.state, p.decision, questionId);
  saveState(p.sessionId, finalState);

  if (fullText !== first) yield { type: "text", questionId, text: fullText, source: r?.source ?? "template", seat: iv.seat };
  if (ttsFailed && seq === 0) yield { type: "tts_fallback", reason: tts.isMock ? "server TTS not configured" : "speech synthesis failed" };
  else yield { type: "audio_end", chunks: seq };

  // Get the next planned question's voice ready while the candidate answers.
  prewarmNext(p.sessionId, p.userId, finalState);

  const timings = {
    ...(p.extraTimings ?? {}), firstSentenceMs: Math.round(tFirstText), llmFirstTokenMs: Math.round(r?.firstTokenMs ?? -1),
    llmMs: Math.round(r?.latencyMs ?? -1), ttsFirstChunkMs: Math.round(ttsFirstChunkMs ?? -1), ttsCacheHits: cacheHits,
    serverToFirstAudioMs: firstAudioMs === null ? -1 : Math.round(firstAudioMs), serverTotalMs: Math.round(performance.now() - p.t0),
  };
  logEvent("latency", "turn_server", { sessionId: p.sessionId, userId: p.userId, durationMs: timings.serverToFirstAudioMs, data: timings });
  yield { type: "done", phase: finalState.phase, complete: p.decision.action === "COMPLETE", listening: listeningPolicy(finalState), timings };
}

function prewarmNext(sessionId: string, userId: string, state: InterviewState) {
  const nextQ = state.plan[state.planCursor];
  if (!nextQ) return;
  const seatIv = state.interviewers.find((i) => i.seat === nextQ.seat) ?? state.interviewers[0];
  prewarm(PERSONAS[seatIv.personaId].voice, [nextQ.text], (u) => recordTokenCost({ userId, sessionId }, "gemini-tts", "tts", "prewarm", u), "high");
}

/** Stream TTS audio for a fixed phrase (drill prompts, reconnect lines). On failure, tell the client to use its local voice. */
export async function* speak(sessionId: string | null, userId: string, text: string, voice: string, pressure: number): AsyncGenerator<RoomEvent> {
  const tts = getTextToSpeech();
  if (tts.isMock) {
    yield { type: "tts_fallback", reason: "server TTS not configured" };
    return;
  }
  const t0 = performance.now();
  let seq = 0;
  try {
    const gen = synth(voice, text);
    let r = await gen.next();
    while (!r.done) {
      if (seq === 0) logEvent("latency", "tts_first_chunk", { sessionId, userId, durationMs: performance.now() - t0, data: { chars: text.length, pressure } });
      yield { type: "audio", seq: seq++, sampleRate: r.value.sampleRate, pcm: r.value.pcm.toString("base64") };
      r = await gen.next();
    }
    if (r.value.usage) recordTokenCost({ userId, sessionId }, tts.id, "tts", "speech", r.value.usage);
    yield { type: "audio_end", chunks: seq };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logEvent("error", "tts_failed", { sessionId, userId, data: { error: msg, chunksSent: seq } });
    if (seq === 0) yield { type: "tts_fallback", reason: msg };
    else yield { type: "audio_end", chunks: seq };
  }
}

async function enrichAnswer(sessionId: string, userId: string, answerId: string, seq: number, question: string, answer: string, competency: string | null, domain: string) {
  try {
    const llm = getLanguageModel();
    const rubric = competency ? getPack(domain).competencies.find((c) => c.key === competency)?.rubric ?? null : null;
    const r = await analyzeAnswerWithModel(llm, question, answer, rubric);
    if (r.usage) recordTokenCost({ userId, sessionId }, llm.id, "analysis", "answer_analyzer", r.usage);
    const db = getDb();
    db.update(schema.answers).set({ analysis: r.data as unknown as Record<string, unknown> }).where(eq(schema.answers.id, answerId)).run();
    const existing = db.select().from(schema.claims).where(eq(schema.claims.answerId, answerId)).all();
    for (const c of r.data.claims) {
      const match = existing.find((e) => e.normalized && (e.normalized.includes(c.text.toLowerCase()) || c.text.toLowerCase().includes(e.normalized)));
      if (match) {
        if (!c.supported && match.status === "open") db.update(schema.claims).set({ status: "weak" }).where(eq(schema.claims.id, match.id)).run();
        if (c.supported && match.status === "open") db.update(schema.claims).set({ status: "supported" }).where(eq(schema.claims.id, match.id)).run();
      } else {
        db.insert(schema.claims).values({ id: newId("clm"), sessionId, answerId, answerSeq: seq, kind: c.kind, text: c.text, normalized: c.text.toLowerCase(), status: c.supported ? "supported" : "weak" }).run();
      }
    }
    logEvent("llm_output", "answer_analyzer", { sessionId, userId, durationMs: r.latencyMs, data: { answerId, source: r.source, analysis: r.data, error: r.error ?? null } });
  } catch (err) {
    logEvent("error", "answer_analyzer_failed", { sessionId, userId, data: { error: String(err) } });
  }
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there";
