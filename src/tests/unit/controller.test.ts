import { describe, expect, it } from "vitest";
import { analyzeAnswer } from "@/lib/analysis/text";
import { buildPlan, decide, initialState, openingDecision, recordAsked, type InterviewState, type OpenClaim, type SeatedInterviewer } from "@/lib/interview/controller";
import type { PressureLevel } from "@/lib/interview/pressure";

const single: SeatedInterviewer[] = [{ id: "i0", personaId: "hiring_manager", panelRole: null, seat: 0, name: "Daniel Reyes" }];
const panel: SeatedInterviewer[] = [
  { id: "i0", personaId: "hiring_manager", panelRole: "hiring_manager", seat: 0, name: "Daniel Reyes" },
  { id: "i1", personaId: "skeptic", panelRole: "skeptic", seat: 1, name: "Tom Hadley" },
  { id: "i2", personaId: "peer", panelRole: "peer", seat: 2, name: "Sam Okafor" },
];

function make(pressure: PressureLevel, interviewers = single, seed = 42): InterviewState {
  const s = initialState({ domain: "software", type: "behavioral", level: "hiring_manager", role: "Software Engineer", targetMinutes: 15, interviewers, pressure, mode: interviewers.length > 1 ? "panel" : "single", curveballs: false, seed });
  const { decision, state } = openingDecision(s);
  return recordAsked(state, decision, "q-intro");
}

const STRONG = "At my last company the checkout service was failing under load. I led a rewrite of the queueing layer and I negotiated two extra engineers. As a result we reduced p99 latency from 900ms to 250ms within 3 months, which meant we could launch in Europe.";
const VAGUE = "We worked on a lot of things and helped with various stuff across the org and the team and it went pretty good overall I would say, lots of stuff happened and we did many things together as a group.";

function turn(state: InterviewState, text: string, opts: { interrupted?: boolean; claims?: OpenClaim[]; elapsedMs?: number } = {}) {
  return decide(state, { text, heuristics: analyzeAnswer(text, 45), durationSec: 45, interrupted: !!opts.interrupted, firstWordLatencyMs: 1200, elapsedMs: opts.elapsedMs ?? 60_000, claims: opts.claims ?? [] });
}

describe("plan", () => {
  it("opens with the intro and covers distinct competencies", () => {
    const plan = buildPlan({ domain: "software", type: "behavioral", level: "hiring_manager", role: "SWE", targetMinutes: 15, interviewers: single, seed: 1 });
    expect(plan[0].bankId).toBe("core-intro");
    expect(plan.length).toBeGreaterThanOrEqual(3);
    const comps = plan.slice(1).map((p) => p.competency);
    expect(new Set(comps).size).toBe(comps.length);
  });
  it("adds a resume-grounded question using only resume fields", () => {
    const plan = buildPlan({ domain: "software", type: "behavioral", level: "hiring_manager", role: "SWE", targetMinutes: 15, interviewers: single, seed: 1, resumeRole: { title: "Staff Engineer", organization: "Acme" } });
    expect(plan[1].text).toContain("Staff Engineer at Acme");
  });
  it("spreads panel questions across seats", () => {
    const plan = buildPlan({ domain: "software", type: "mixed", level: "senior_manager", role: "SWE", targetMinutes: 20, interviewers: panel, seed: 3 });
    expect(new Set(plan.map((p) => p.seat)).size).toBeGreaterThan(1);
  });
});

describe("decisions", () => {
  it("is deterministic for a given seed", () => {
    const a = turn(make(3), VAGUE).decision;
    const b = turn(make(3), VAGUE).decision;
    expect(a).toEqual(b);
  });
  it("follows up on a vague answer instead of moving on", () => {
    const { decision } = turn(make(3), VAGUE);
    expect(["FOLLOW_UP", "PRESSURE_EVENT"]).toContain(decision.action);
    expect(decision.intent).toBe("ask_specifics");
  });
  it("redirects after an interruption", () => {
    const { decision } = turn(make(4), VAGUE, { interrupted: true });
    expect(decision.action).toBe("PRESSURE_EVENT");
    expect(decision.intent).toBe("redirect_after_interrupt");
    expect(decision.preSilenceMs).toBe(0);
  });
  it("moves on after a strong answer at low pressure", () => {
    const { decision } = turn(make(1), STRONG);
    expect(decision.action).toBe("NEXT_QUESTION");
  });
  it("closes when time is up and completes after the closing answer", () => {
    const closing = turn(make(2), STRONG, { elapsedMs: 16 * 60_000 });
    expect(closing.decision.action).toBe("CLOSING");
    const s = recordAsked(closing.state, closing.decision, "q-close");
    const done = turn(s, "What does success look like in the first six months for this role?");
    expect(done.decision.action).toBe("COMPLETE");
    expect(done.state.phase).toBe("COMPLETE");
  });
  it("references an earlier claim verbatim (memory callback)", () => {
    let hits = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = make(4, single, seed);
      s = { ...s, answerSeq: 3, followUpDepth: 9 };
      const claims: OpenClaim[] = [{ id: "c1", kind: "team", text: "managed a team of 12", status: "open", answerSeq: 1 }];
      const { decision } = turn(s, STRONG, { claims });
      if (decision.intent === "memory_callback") {
        hits++;
        expect(decision.claim?.text).toBe("managed a team of 12");
      }
    }
    expect(hits).toBeGreaterThan(5);
  });
});

describe("pressure changes behaviour", () => {
  function stats(pressure: PressureLevel) {
    let followUps = 0, silence = 0, challenges = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = make(pressure, single, seed);
      const claims: OpenClaim[] = [{ id: "c", kind: "outcome", text: "we reduced p99 latency from 900ms to 250ms", status: "open", answerSeq: 1 }];
      const { decision } = turn(s, STRONG, { claims });
      if (decision.action !== "NEXT_QUESTION") followUps++;
      if (decision.intent === "challenge_claim" || decision.action === "PRESSURE_EVENT") challenges++;
      silence += decision.preSilenceMs;
    }
    return { followUps, silence: silence / 60, challenges };
  }
  it("probes more, challenges more and holds longer silences at higher pressure", () => {
    const low = stats(1);
    const high = stats(5);
    expect(high.followUps).toBeGreaterThan(low.followUps);
    expect(high.challenges).toBeGreaterThan(low.challenges);
    expect(high.silence).toBeGreaterThan(low.silence * 3);
  });
});

describe("panel", () => {
  it("lets the skeptic cut across with a cross-question", () => {
    let cross = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = make(4, panel, seed);
      const claims: OpenClaim[] = [{ id: "c", kind: "outcome", text: "we reduced p99 latency from 900ms to 250ms", status: "open", answerSeq: 1 }];
      const { decision } = turn(s, STRONG, { claims });
      if (decision.intent === "cross_question") {
        cross++;
        expect(decision.seat).toBe(1);
        expect(decision.handoffFromSeat).toBe(0);
      }
    }
    expect(cross).toBeGreaterThan(0);
  });
});
