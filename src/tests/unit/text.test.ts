import { describe, expect, it } from "vitest";
import { analyzeAnswer, countFillers, countHedges, detectStar, extractClaims, quantifiedStatements, vaguenessScore } from "@/lib/analysis/text";

describe("filler and hedge detection", () => {
  it("counts common fillers", () => {
    const r = countFillers("Um, so, uh, I was kind of, you know, basically leading it. Um.");
    expect(r.byType.um).toBe(2);
    expect(r.byType.uh).toBe(1);
    expect(r.byType["kind of"]).toBe(1);
    expect(r.byType["you know"]).toBe(1);
    expect(r.byType.basically).toBe(1);
  });
  it("does not count 'like' used as a verb or comparison", () => {
    expect(countFillers("I would like to join. It looks like a fit. I like the team.").byType.like ?? 0).toBe(0);
    expect(countFillers("It was, like, really hard.").byType.like).toBe(1);
  });
  it("counts hedges", () => {
    expect(countHedges("I think maybe we could probably have done it, I guess.").total).toBe(4);
  });
});

describe("structure and specificity", () => {
  const strong = "At my last company the checkout service was failing under load. I led a rewrite of the queueing layer and I negotiated two extra engineers. As a result, we reduced p99 latency from 900ms to 250ms within 3 months, which meant we could launch in Europe.";
  const vague = "We worked on a lot of things and helped with various stuff. It went pretty good and the team did a lot of work on it.";
  it("detects STAR parts", () => {
    expect(detectStar(strong)).toEqual({ situation: true, action: true, result: true, outcome: true });
    expect(detectStar(vague).action).toBe(false);
  });
  it("scores vague answers as vaguer than specific ones", () => {
    expect(vaguenessScore(vague)).toBeGreaterThan(0.6);
    expect(vaguenessScore(strong)).toBeLessThan(0.3);
  });
  it("finds quantified statements", () => {
    expect(quantifiedStatements(strong).length).toBeGreaterThan(0);
    expect(quantifiedStatements(vague)).toHaveLength(0);
  });
  it("gives strong answers higher quality", () => {
    expect(analyzeAnswer(strong, 40).quality).toBeGreaterThan(analyzeAnswer(vague, 40).quality + 0.3);
  });
});

describe("claim extraction (interviewer memory)", () => {
  it("extracts team size and outcomes verbatim", () => {
    const claims = extractClaims("I managed a team of 12 engineers. We cut costs by 30 percent last year. I led the migration to Postgres.");
    const texts = claims.map((c) => c.text);
    expect(texts.some((t) => /team of 12/.test(t))).toBe(true);
    expect(claims.some((c) => c.kind === "outcome" && /30 percent/.test(c.text))).toBe(true);
    expect(claims.some((c) => c.kind === "project" && /migration to Postgres/.test(c.text))).toBe(true);
  });
  it("never produces claims absent from the text", () => {
    const text = "I helped out on some projects.";
    for (const c of extractClaims(text)) expect(text.toLowerCase()).toContain(c.normalized);
  });
});

describe("first-person action detection", () => {
  it("allows a few words between 'I' and the verb", () => {
    expect(detectStar("I basically had to, um, design a dual-write approach.").action).toBe(true);
    expect(detectStar("I managed a team of 6 engineers.").action).toBe(true);
    expect(detectStar("I've been driving the platform roadmap.").action).toBe(true);
  });
  it("does not fire on team-only narration", () => {
    expect(detectStar("We worked on a lot of things and the team shipped it.").action).toBe(false);
  });
  it("dedupes overlapping claims, keeping the more specific one", () => {
    const claims = extractClaims("So I've been an engineer for a while, I managed a team of 6 engineers at Northwind and we did payments.");
    const team = claims.filter((c) => /team of 6/.test(c.text));
    expect(team).toHaveLength(1);
  });
});
