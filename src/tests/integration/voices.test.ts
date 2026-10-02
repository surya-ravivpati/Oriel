import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oriel-media-"));

// A speech service that records which voice each phrase was requested in.
const { spoken } = vi.hoisted(() => ({ spoken: [] as string[] }));
vi.mock("@/lib/ai/providers/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/providers/registry")>();
  return {
    ...actual,
    getTextToSpeech: () => ({
      id: "recording-tts", isMock: false,
      async *streamSpeech(req: { voice: string }) {
        spoken.push(req.voice);
        yield { pcm: Buffer.alloc(480), sampleRate: 24000 };
        return { usage: null };
      },
    }),
  };
});

import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { PERSONAS } from "@/lib/interview/personas";
import { createInterview, runOpening, type RoomEvent } from "@/server/interview/service";
import { saveStyle } from "@/server/avatar-styles";

function makeUser() {
  const db = getDb();
  const id = newId("usr");
  db.insert(schema.users).values({ id, email: `${id}@oriel.test`, passwordHash: "x", onboardedAt: new Date() }).run();
  db.insert(schema.profiles).values({ userId: id, name: "Alex Kim", targetRole: "Engineer", domain: "software" }).run();
  db.insert(schema.subscriptions).values({ id: newId("sub"), userId: id, plan: "pro", periodStart: new Date() }).run();
  db.insert(schema.ladderProgress).values({ userId: id, level: 1, unlockedAt: new Date() }).run();
  return id;
}

const interview = (userId: string) => createInterview(userId, { role: "Engineer", domain: "software", level: "hiring_manager", type: "behavioral", pressure: 2, persona: "skeptic", mode: "single", panelSize: 3, ladderLevel: null, targetMinutes: 15, cameraMetrics: false }).sessionId;

async function opening(userId: string, sessionId: string) {
  spoken.length = 0;
  const events: RoomEvent[] = [];
  for await (const e of runOpening(sessionId, userId)) events.push(e);
  return events;
}

describe("interviewer voices", () => {
  it("speaks in the voice the person chose", async () => {
    const userId = makeUser();
    saveStyle(userId, "skeptic", { shape: "triangle", color: "cream", accessory: "glasses", name: null, voice: "Puck" });
    const events = await opening(userId, interview(userId));
    expect(events.some((e) => e.type === "audio")).toBe(true);
    expect(spoken.length).toBeGreaterThan(0);
    expect(new Set(spoken)).toEqual(new Set(["Puck"])); // the opening and every prewarmed phrase
  });

  it("keeps the persona's own voice when none was chosen", async () => {
    const userId = makeUser();
    await opening(userId, interview(userId));
    expect(new Set(spoken)).toEqual(new Set([PERSONAS.skeptic.voice]));
  });
});
