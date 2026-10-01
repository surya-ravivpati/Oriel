import { describe, expect, it } from "vitest";
import { computeRead, setupIssues, type AnswerInputRow, type AudioSample, type MetricResult, type VisionSample } from "@/lib/analysis/read";
import { assess, planLessons, MAX_ACTIVE } from "@/lib/lessons/planner";
import { LESSONS } from "@/lib/lessons/library";
import { heuristicContent, numbersWithin, stripPatterns, writeLessons } from "@/lib/ai/lesson-writer";
import { FILLER_PATTERNS } from "@/lib/analysis/text";
import { measureDrill } from "@/lib/practice/drill-scoring";
import { getDrill } from "@/lib/practice/catalog";
import type { LanguageModelProvider } from "@/lib/ai/providers/types";

const row = (id: string, text: string, kind = "primary", extra: Partial<AnswerInputRow> = {}): AnswerInputRow => ({
  id, questionId: `q${id}`, questionText: `Question ${id}?`, questionKind: kind, questionDifficulty: 2, questionEndMs: null,
  text, startMs: 0, endMs: 60000, firstWordLatencyMs: null, interrupted: false, inputMode: "text", ...extra,
});

// A typed interview: no audio, no camera — so pace, voice and presence can't be measured.
const typed = [
  row("1", "I'm a product manager. I worked on a lot of things at my last company, helped with various stuff, and it went pretty well overall I think.", "intro"),
  row("2", "Um, so, like, the project was, uh, basically a big deal and, um, we kind of did a lot of work on it and, like, it was good and the team helped with stuff and things."),
  row("3", "I think maybe I just helped a little with the launch, I guess it probably went okay, I feel like people liked it and we did several things that were really good."),
  row("4", "We were asked to look at the onboarding flow and there were various problems with it and lots of people had opinions and the team was involved in many things."),
];

function plan(rows = typed) {
  const { metrics, per } = computeRead(rows, [], [], null, { cameraMetrics: false, gaze: false, posture: false });
  return { metrics, per, plan: planLessons({ sessionId: "ses_1", metrics, per }) };
}

describe("lesson planner", () => {
  it("plans lessons only for skills it measured, and only where they're off target", () => {
    const { plan: p } = plan();
    const keys = p.map((l) => l.key);
    expect(keys).toEqual(expect.arrayContaining(["structure", "specificity"]));
    for (const unmeasured of ["pace", "vocal_variety", "recovery", "eye_contact", "posture", "setup"]) expect(keys).not.toContain(unmeasured);
    for (const l of p) expect(l.need).toBeGreaterThan(0.05);
  });

  it("quotes the person's own words, verbatim", () => {
    const { plan: p } = plan();
    const all = typed.map((r) => r.text).join(" ");
    for (const l of p) for (const q of l.evidence.quotes) expect(all).toContain(q.text.replace(/…$/, ""));
    const fillers = p.find((l) => l.key === "fillers");
    if (fillers) expect(fillers.evidence.quotes[0].text).toMatch(/\b(um|uh|like)\b/i);
  });

  it("keeps the plan focused: a few active lessons, spread across tracks", () => {
    const m = (key: string, value: number, targetLow: number, targetHigh: number, detail: Record<string, unknown> = {}): MetricResult =>
      ({ key, label: key, value, low: null, high: null, unit: "", confidence: "high", targetLow, targetHigh, note: "", detail });
    const metrics = [
      m("filler_per_min", 9, 0, 3), m("pace_wpm", 210, 120, 160), m("vocal_variety", 0.8, 2, 6), m("structure_score", 20, 70, 100),
      m("specificity", 10, 60, 100), m("hedges_per_min", 7, 0, 2), m("recovery_ms", 7000, 500, 2500), m("camera_engagement", 10, 55, 90),
      m("setup", 3, 0, 0, { issues: ["a", "b", "c"] }),
    ];
    const { per } = plan();
    const p = planLessons({ sessionId: "s", metrics, per });
    const active = p.filter((l) => l.status === "active");
    expect(active.length).toBe(MAX_ACTIVE);
    for (const t of ["delivery", "responses", "presence"]) expect(active.filter((l) => l.track === t).length).toBeLessThanOrEqual(2);
    expect(p.filter((l) => l.status === "queued").length).toBeGreaterThan(0);
    expect(p.map((l) => l.priority)).toEqual([...p.map((l) => l.priority)].sort((a, b) => b - a));
  });

  it("confirms a skill is back on target (so a lesson can be marked mastered)", () => {
    const good = [row("1", "I'm a product manager at Contoso. In 2024 I led a team of 9 to rebuild onboarding: I interviewed 14 customers, cut 3 steps, and activation rose from 31% to 44% in one quarter, so sales stopped discounting.", "primary")];
    const a = assess({ sessionId: "s", ...computeRead(good, [], [], null, { cameraMetrics: false, gaze: false, posture: false }) });
    expect(a.find((x) => x.key === "structure")?.need).toBe(0);
    expect(a.find((x) => x.key === "specificity")?.need).toBe(0);
  });

  it("calls a normally framed person close enough, whatever they wear on their head", () => {
    // Head-and-shoulders portraits measured face areas of 0.047–0.181 (camera-report.md).
    expect(setupIssues({ brightness: 120, faceX: 0.5, faceY: 0.42, faceSize: 0.05, micLevelDb: null, noiseFloorDb: null })).toEqual([]);
    expect(setupIssues({ brightness: 120, faceX: 0.5, faceY: 0.42, faceSize: 0.015, micLevelDb: null, noiseFloorDb: null }).map((i) => i.key)).toEqual(["far"]);
  });
});

describe("lesson writer", () => {
  it("strips fillers and softeners for the template rewrite, keeping honest uncertainty", () => {
    expect(stripPatterns("Um, so, like, the project was, uh, a big deal.", FILLER_PATTERNS)).toBe("So, the project was, a big deal.");
    const { plan: p } = plan();
    const hedging = p.find((l) => l.key === "hedging");
    expect(hedging).toBeDefined();
    const c = heuristicContent(hedging!);
    expect(c.rewrite?.after).not.toMatch(/\b(I think|maybe|just|I guess|probably|I feel like)\b/i);
    const unsure = heuristicContent({ ...hedging!, evidence: { ...hedging!.evidence, quotes: [{ ...hedging!.evidence.quotes[0], text: "I'm not sure of the figure, I think it was maybe 20%." }] } });
    expect(unsure.rewrite?.after).toMatch(/I'm not sure/);
  });

  it("only lets numbers through that were measured or said", () => {
    expect(numbersWithin("You used 6.2 fillers a minute.", "6.2 fillers a minute")).toBe(true);
    expect(numbersWithin("That's 40% more than most people.", "6.2 fillers a minute")).toBe(false);
  });

  it("rejects model text that invents facts, and keeps what's grounded", async () => {
    const { plan: p } = plan();
    const structure = p.find((l) => l.key === "structure")!;
    const fake = (rewrite: { before: string; after: string }, observation: string): LanguageModelProvider => ({
      id: "fake", isMock: false,
      generateText: async () => { throw new Error("unused"); },
      generateJson: async <T,>() => ({ data: { lessons: [{ key: "structure", observation, tip: "Finish the onboarding story with what changed.", rewrite }] } as T, usage: { model: "fake", inputTokens: 1, outputTokens: 1 }, latencyMs: 1 }),
    });
    const before = structure.focus!.text.split(/(?<=[.!?])\s+/)[0];
    // Invented number in the rewrite and the observation → both rejected.
    let r = await writeLessons(fake({ before, after: "I cut onboarding time by 45% in two weeks." }, "Your structure was 12% below most candidates."), { role: "PM", lessons: [structure] });
    expect(r.data.structure.rewrite).toBeNull();
    expect(r.data.structure.observation).toBe(heuristicContent(structure).observation);
    // Placeholders instead of numbers, and words they actually said → accepted.
    r = await writeLessons(fake({ before, after: "The onboarding flow had problems, so I [what you did] — and [what changed, with a number]." }, "Your stories set the scene but stopped before the result."), { role: "PM", lessons: [structure] });
    expect(r.data.structure.rewrite?.after).toMatch(/\[what changed/);
    expect(r.data.structure.observation).toMatch(/stopped before the result/);
    expect(r.data.structure.source).toBe("llm");
    // A "before" they never said → rejected.
    r = await writeLessons(fake({ before: "I single-handedly saved the company.", after: "I saved the company." }, "x"), { role: "PM", lessons: [structure] });
    expect(r.data.structure.rewrite).toBeNull();
  });

  it("never lets a model 'improve' what someone said when the lesson is about their exact words", async () => {
    const { plan: p } = plan();
    const hedging = p.find((l) => l.key === "hedging")!;
    const model: LanguageModelProvider = {
      id: "fake", isMock: false,
      generateText: async () => { throw new Error("unused"); },
      generateJson: async <T,>() => ({ data: { lessons: [{ key: "hedging", observation: "You softened your claims.", tip: "Own it.", rewrite: { before: hedging.evidence.quotes[0].text, after: "I led the launch and it went well." } }] } as T, usage: { model: "fake", inputTokens: 1, outputTokens: 1 }, latencyMs: 1 }),
    };
    const r = await writeLessons(model, { role: "PM", lessons: [hedging] });
    expect(r.data.hedging.rewrite).toEqual(heuristicContent(hedging).rewrite); // softeners removed, nothing upgraded
    expect(r.data.hedging.rewrite?.after).not.toMatch(/\bled\b|went well/);
  });

  it("writes something sensible for every lesson without a model", () => {
    for (const l of plan().plan) {
      const c = heuristicContent(l);
      expect(c.observation.length).toBeGreaterThan(10);
      expect(c.tip).toContain(LESSONS[l.key].steps[0].title);
    }
  });
});

describe("drill measurements for lessons", () => {
  const voiced = (from: number, to: number, pitch: (t: number) => number): AudioSample[] =>
    Array.from({ length: Math.round((to - from) / 100) }, (_, i) => ({ t: from + i * 100, rms: 0.05, voiced: true, pitch: pitch(from + i * 100) }));
  const text = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ") + ".";

  it("measures pace from the voice, like the Read", () => {
    const m = measureDrill(getDrill("steady_pace")!, { transcript: text(150), durationMs: 60000, firstWordLatencyMs: 500, cameraEngagement: null, audio: voiced(0, 60000, () => 140), answerStartMs: 0 }, null);
    expect(m.value).toBe(150);
    expect(m.passed).toBe(true);
    const typedPace = measureDrill(getDrill("steady_pace")!, { transcript: text(150), durationMs: 60000, firstWordLatencyMs: null, cameraEngagement: null }, null);
    expect(typedPace.value).toBeNull();
    expect(typedPace.details.reason).toMatch(/voice/);
  });

  it("measures pitch movement in semitones", () => {
    const flat = measureDrill(getDrill("emphasis")!, { transcript: text(120), durationMs: 50000, firstWordLatencyMs: 400, cameraEngagement: null, audio: voiced(0, 50000, () => 130), answerStartMs: 0 }, null);
    const lively = measureDrill(getDrill("emphasis")!, { transcript: text(120), durationMs: 50000, firstWordLatencyMs: 400, cameraEngagement: null, audio: voiced(0, 50000, (t) => 130 * 2 ** ((5 * Math.sin(t / 700)) / 12)), answerStartMs: 0 }, null);
    expect(flat.passed).toBe(false);
    expect(lively.value).toBeGreaterThan(2.5);
    expect(lively.passed).toBe(true);
  });

  it("measures hedges and answer length", () => {
    const hedgy = measureDrill(getDrill("own_it")!, { transcript: "I think I maybe just helped a little, I guess it probably went fine.", durationMs: 20000, firstWordLatencyMs: null, cameraEngagement: null }, null);
    expect(hedgy.passed).toBe(false);
    const point = measureDrill(getDrill("point_first")!, { transcript: "I decided to pause the launch. Our error rate had doubled, so I rolled back, fixed the cache, and as a result we relaunched two days later with errors down 80 percent and no customer complaints at all. I told support first so nobody was surprised.", durationMs: 30000, firstWordLatencyMs: null, cameraEngagement: null }, null);
    expect(point.passed).toBe(true);
  });

  it("measures upright posture from calibrated samples, and says when it couldn't", () => {
    const s = (t: number, slouch: number): VisionSample => ({ t, face: true, engaged: 0.8, yaw: 0, pitch: 0, lean: 1, slouch, sway: 0.5, motion: 0.005, brightness: 120 });
    const upright = measureDrill(getDrill("steady_posture")!, { transcript: "x", durationMs: 30000, firstWordLatencyMs: null, cameraEngagement: null, vision: Array.from({ length: 100 }, (_, i) => s(i * 250, 0.03)) }, null);
    expect(upright).toMatchObject({ value: 100, passed: true });
    const slumped = measureDrill(getDrill("steady_posture")!, { transcript: "x", durationMs: 30000, firstWordLatencyMs: null, cameraEngagement: null, vision: Array.from({ length: 100 }, (_, i) => s(i * 250, i > 40 && i < 70 ? 0.35 : 0.03)) }, null);
    expect(slumped.passed).toBe(false);
    const uncalibrated = measureDrill(getDrill("steady_posture")!, { transcript: "x", durationMs: 30000, firstWordLatencyMs: null, cameraEngagement: null, vision: Array.from({ length: 100 }, (_, i) => ({ ...s(i * 250, 0), slouch: null })) }, null);
    expect(uncalibrated.passed).toBeNull();
  });
});
