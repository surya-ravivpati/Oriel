import { describe, expect, it } from "vitest";
import { adaptPressure, pressurePolicy } from "@/lib/interview/pressure";
import { PERSONAS } from "@/lib/interview/personas";
import { canStartSession, canUsePanelMode, canUseDomainPack, canUsePlayback, canUseAvatarMinutes, type EntitlementContext } from "@/lib/billing/entitlements";
import { aboveBaseline, compare, computeBaseline, recommendDrill } from "@/lib/practice/progress";

describe("pressure policy", () => {
  it("is monotonic across levels", () => {
    const p = [1, 2, 3, 4, 5].map((l) => pressurePolicy(l as 1));
    for (let i = 1; i < 5; i++) {
      expect(p[i].preResponseSilenceMs).toBeGreaterThan(p[i - 1].preResponseSilenceMs);
      expect(p[i].skepticism).toBeGreaterThan(p[i - 1].skepticism);
      expect(p[i].reassurance).toBeLessThan(p[i - 1].reassurance);
      expect(p[i].vagueThreshold).toBeLessThan(p[i - 1].vagueThreshold);
    }
    expect(p[0].interruptAfterSec).toBeNull();
    expect(p[4].interruptAfterSec).toBeLessThan(p[2].interruptAfterSec!);
  });
  it("persona shifts the policy", () => {
    expect(pressurePolicy(3, PERSONAS.skeptic).skepticism).toBeGreaterThan(pressurePolicy(3, PERSONAS.warm_recruiter).skepticism);
    expect(pressurePolicy(3, PERSONAS.executive).preResponseSilenceMs).toBeGreaterThan(pressurePolicy(3, PERSONAS.warm_recruiter).preResponseSilenceMs);
  });
  it("adapts to performance within a band", () => {
    expect(adaptPressure(3, 3, [0.8, 0.9, 0.85])).toBe(4);
    expect(adaptPressure(3, 4, [0.9, 0.9, 0.9])).toBe(4); // capped at base+1
    expect(adaptPressure(2, 2, [0.1, 0.2, 0.15])).toBe(1);
    expect(adaptPressure(5, 5, [0.1, 0.1, 0.1])).toBe(5); // stress test never eases
  });
});

const ctx = (plan: EntitlementContext["plan"], usage: Partial<EntitlementContext["usage"]> = {}): EntitlementContext => ({
  plan, planActive: true, usage: { sessionsThisWeek: 0, managedAvatarMinutesThisPeriod: 0, drillsToday: 0, ...usage },
});

describe("entitlements", () => {
  it("limits free sessions per week", () => {
    expect(canStartSession(ctx("free")).allowed).toBe(true);
    expect(canStartSession(ctx("free", { sessionsThisWeek: 1 })).allowed).toBe(false);
    expect(canStartSession(ctx("pro", { sessionsThisWeek: 30 })).allowed).toBe(true);
  });
  it("gates panel mode and panel size", () => {
    expect(canUsePanelMode(ctx("free")).allowed).toBe(false);
    expect(canUsePanelMode(ctx("sprint"), 3).allowed).toBe(true);
    expect(canUsePanelMode(ctx("sprint"), 4).allowed).toBe(false);
    expect(canUsePanelMode(ctx("executive"), 4).allowed).toBe(true);
  });
  it("gates domain packs, playback depth and avatar minutes", () => {
    expect(canUseDomainPack(ctx("pro"), "clinical").allowed).toBe(false);
    expect(canUseDomainPack(ctx("executive"), "clinical").allowed).toBe(true);
    expect(canUsePlayback(ctx("free")).maxClips).toBe(3);
    expect(canUsePlayback(ctx("pro")).maxClips).toBe(5);
    expect(canUseAvatarMinutes(ctx("pro", { managedAvatarMinutesThisPeriod: 58 }), 5).allowed).toBe(false);
  });
});

describe("progress", () => {
  it("computes baseline as a median of prior sessions", () => {
    const b = computeBaseline([{ filler_per_min: 8 }, { filler_per_min: 6 }, { filler_per_min: 4 }]);
    expect(b.filler_per_min).toBe(6);
  });
  it("judges improvement in the right direction per metric", () => {
    const cmp = compare({ filler_per_min: 4.1, recovery_ms: 2100, pace_wpm: 134, structure_score: 80 }, { filler_per_min: 8.2, recovery_ms: 4200, pace_wpm: 147, structure_score: 60 });
    expect(cmp.find((c) => c.key === "filler_per_min")!.improved).toBe(true);
    expect(cmp.find((c) => c.key === "recovery_ms")!.improved).toBe(true);
    expect(cmp.find((c) => c.key === "pace_wpm")!.improved).toBe(true);
    expect(aboveBaseline(cmp).above).toBe(true);
  });
  it("recommends a drill for the weakest measure", () => {
    expect(recommendDrill({ recovery_ms: 4200 }).drillId).toBe("hard_recovery");
    expect(recommendDrill({ filler_per_min: 7 }).drillId).toBe("replace_filler");
  });
});
