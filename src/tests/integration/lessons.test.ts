import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oriel-media-"));

import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { computeRead, type AnswerInputRow } from "@/lib/analysis/read";
import { createInterview } from "@/server/interview/service";
import { lessonFor, lessonsFor, planFromSession, recordLessonPractice } from "@/server/lessons";

function makeUser() {
  const db = getDb();
  const id = newId("usr");
  db.insert(schema.users).values({ id, email: `${id}@oriel.test`, passwordHash: "x", onboardedAt: new Date() }).run();
  db.insert(schema.profiles).values({ userId: id, name: "Sam Rivera", targetRole: "Product Manager", domain: "product" }).run();
  db.insert(schema.subscriptions).values({ id: newId("sub"), userId: id, plan: "pro", periodStart: new Date() }).run();
  db.insert(schema.ladderProgress).values({ userId: id, level: 1, unlockedAt: new Date() }).run();
  return id;
}

const session = (userId: string) => createInterview(userId, { role: "Product Manager", domain: "product", level: "hiring_manager", type: "behavioral", pressure: 3, persona: "hiring_manager", mode: "single", panelSize: 3, ladderLevel: null, targetMinutes: 15, cameraMetrics: false }).sessionId;
const answer = (id: string, text: string): AnswerInputRow => ({ id, questionId: `q${id}`, questionText: "Tell me about a project.", questionKind: "primary", questionDifficulty: 2, questionEndMs: null, text, startMs: 0, endMs: 60000, firstWordLatencyMs: null, interrupted: false, inputMode: "text" });
const read = (texts: string[]) => computeRead(texts.map((t, i) => answer(String(i), t)), [], [], null, { cameraMetrics: false, gaze: false, posture: false });

const VAGUE = [
  "We were asked to look at the onboarding flow and there were various problems with it and lots of people had opinions about all of it, so there was a lot of discussion with the wider team.",
  "The team was involved in many things around the launch and it was a big project with a lot going on across the company at the time, and everyone was busy with various stuff.",
];
const STRONG = [
  "In 2024 our activation was flat at 31 percent. I interviewed 14 customers, I proposed cutting 3 onboarding steps, and I convinced engineering to ship it in six weeks. As a result activation rose to 44 percent.",
  "Our support backlog hit 900 tickets. I set up a triage rota for 6 engineers and wrote the routing rules myself. Within a month the backlog fell to 120 and response time dropped from 3 days to 6 hours.",
];

describe("a lesson's life", () => {
  it("is planned from an interview, practised, confirmed in a later interview, and reopened if it slips", async () => {
    const userId = makeUser();
    const first = session(userId);
    await planFromSession({ userId, sessionId: first, role: "Product Manager", ...read(VAGUE) });
    let structure = lessonsFor(userId).find((l) => l.lessonKey === "structure")!;
    expect(structure).toBeDefined();
    expect(structure.status).toBe("active");
    expect(VAGUE.some((v) => v.startsWith(structure.evidence.quotes[0].text.replace(/…$/, "")))).toBe(true); // their own words, verbatim

    // Reading the lesson counts as "learn"; two passing drills count as practised.
    expect(lessonFor(userId, "structure")!.lesson.viewedAt).toBeNull();
    expect(lessonFor(userId, "structure")!.lesson.viewedAt).not.toBeNull();
    recordLessonPractice(userId, "star_structure", true);
    expect(recordLessonPractice(userId, "star_structure", true)).toMatchObject({ passes: 2, needed: 2 });

    // The next interview is on target → mastered (practice alone never masters a lesson).
    await planFromSession({ userId, sessionId: session(userId), role: "Product Manager", ...read(STRONG) });
    structure = lessonsFor(userId).find((l) => l.lessonKey === "structure")!;
    expect(structure.status).toBe("mastered");
    expect(structure.masteredAt).not.toBeNull();
    expect(recordLessonPractice(userId, "star_structure", true)).toBeNull(); // nothing open to practise

    // It slips again → reopened with a fresh round of practice.
    const third = session(userId);
    await planFromSession({ userId, sessionId: third, role: "Product Manager", ...read(VAGUE) });
    structure = lessonsFor(userId).find((l) => l.lessonKey === "structure")!;
    expect(structure.status).toBe("active");
    expect(structure.practicePasses).toBe(0);
    expect(structure.sourceSessionId).toBe(third);
  });

  it("leaves lessons alone that an interview couldn't measure", async () => {
    const userId = makeUser();
    const s = session(userId);
    getDb().insert(schema.lessons).values({
      id: newId("lsn"), userId, lessonKey: "pace", track: "delivery", status: "active", priority: 1, sourceSessionId: s, metricKey: "pace_wpm",
      startValue: 190, latestValue: 190, evidence: { value: 190, unit: "wpm", display: "190 words a minute", target: "120–160 words a minute", confidence: "high", facts: [], quotes: [], moments: [] },
      content: { observation: "Fast.", tip: "Slow down.", rewrite: null, source: "heuristic" },
    }).run();
    await planFromSession({ userId, sessionId: session(userId), role: "Product Manager", ...read(STRONG) }); // typed: pace not measured
    expect(lessonsFor(userId).find((l) => l.lessonKey === "pace")?.status).toBe("active");
  });
});
