import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oriel-media-"));

import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { setProvidersForTesting } from "@/lib/ai/providers/registry";
import type { LanguageModelProvider, TextToSpeechProvider } from "@/lib/ai/providers/types";
import { ACK_BRIEF, ACK_WARM } from "@/lib/ai/interviewer";
import { createInterview, runOpening, runTurn, type RoomEvent } from "@/server/interview/service";

/*
 * The turn bridge: when the interviewer has to write its follow-up, a cached acknowledgement
 * is voiced at once, the model is told it was said, and the caption grows with each sentence.
 * The model and the voice here are slow fakes, so ordering is observable.
 */

const systems: string[] = [];
const spokenTexts: string[] = [];
const slowLlm: LanguageModelProvider = {
  id: "fake-llm", isMock: false,
  async generateText() { return { text: "What changed as a result?", usage: { model: "fake", inputTokens: 1, outputTokens: 1 }, latencyMs: 1 }; },
  async *streamText(req) {
    systems.push(req.system);
    await new Promise((r) => setTimeout(r, 120)); // the model takes a moment to write
    yield "And what changed as a result? ";
    yield "Give me a number if you can.";
    return { usage: { model: "fake", inputTokens: 1, outputTokens: 1 }, firstTokenMs: 120 };
  },
  async generateJson() { throw new Error("not used"); },
};
const fakeTts: TextToSpeechProvider = {
  id: "fake-tts", isMock: false,
  async *streamSpeech(req) {
    spokenTexts.push(req.text);
    yield { pcm: Buffer.alloc(320), sampleRate: 24000 };
    return { usage: null };
  },
};

async function drain(gen: AsyncGenerator<RoomEvent>) {
  const out: RoomEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("turn bridge", () => {
  let sessionId: string;
  let userId: string;

  beforeAll(async () => {
    setProvidersForTesting({ llm: slowLlm, tts: fakeTts });
    const db = getDb();
    userId = newId("usr");
    await db.insert(schema.users).values({ id: userId, email: `${userId}@oriel.test`, passwordHash: "x", onboardedAt: new Date() }).run();
    await db.insert(schema.profiles).values({ userId, name: "Jordan Lee", targetRole: "Product Manager", domain: "product" }).run();
    await db.insert(schema.subscriptions).values({ id: newId("sub"), userId, plan: "pro", periodStart: new Date() }).run();
    await db.insert(schema.ladderProgress).values({ userId, level: 1, unlockedAt: new Date() }).run();
    ({ sessionId } = await createInterview(userId, { role: "Product Manager", domain: "product", level: "hiring_manager", type: "behavioral", pressure: 2, persona: "warm_recruiter", mode: "single", panelSize: 3, ladderLevel: null, targetMinutes: 15, cameraMetrics: false }));
    await drain(runOpening(sessionId, userId));
    await new Promise((r) => setTimeout(r, 50)); // let the acknowledgements prewarm into the speech cache
  });

  it("voices a cached acknowledgement before the written follow-up, and never twice", async () => {
    const answers = [
      "We did a lot of things on the team and it went well overall I think.",
      "I worked with the team on onboarding and people seemed to like it in the end.",
      "We improved a few things together and the project was a success for everyone.",
    ];
    let bridged: RoomEvent[] | null = null;
    let t = 1000;
    for (const a of answers) {
      const ev = await drain(runTurn(sessionId, userId, { answerText: a, startMs: t, endMs: t + 9000, firstWordLatencyMs: 800, interrupted: false, inputMode: "voice", prevQuestion: null }));
      t += 20000;
      const done = ev.find((e) => e.type === "done") as Extract<RoomEvent, { type: "done" }>;
      if (done.timings.bridged === 1) { bridged = ev; break; }
    }
    expect(bridged, "at least one follow-up should be bridged").not.toBeNull();
    const ev = bridged!;
    const firstText = ev.find((e) => e.type === "text") as Extract<RoomEvent, { type: "text" }>;
    const ack = [...ACK_BRIEF, ...ACK_WARM];
    expect(ack).toContain(firstText.text);
    // The acknowledgement's audio comes before any of the follow-up's words are captioned.
    const firstAudio = ev.findIndex((e) => e.type === "audio");
    const followUpText = ev.findIndex((e) => e.type === "text" && /what changed/i.test(e.text));
    expect(firstAudio).toBeGreaterThan(-1);
    expect(firstAudio).toBeLessThan(followUpText);
    // The model knew it had already acknowledged, so the utterance holds exactly one acknowledgement.
    expect(systems.at(-1)).toContain(`You have just said "${firstText.text}"`);
    const last = [...ev].reverse().find((e) => e.type === "text") as Extract<RoomEvent, { type: "text" }>;
    expect(last.text.startsWith(firstText.text)).toBe(true);
    expect(last.text.split(firstText.text).length - 1).toBe(1);
    // The caption grew sentence by sentence; the stored question holds the whole line.
    const captions = ev.filter((e) => e.type === "text").map((e) => (e as Extract<RoomEvent, { type: "text" }>).text);
    expect(captions.length).toBeGreaterThanOrEqual(2);
    expect(ev.at(-2)?.type === "audio_end" || ev.some((e) => e.type === "audio_end")).toBe(true);
  });
});
