import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oriel-sec-"));

import { appendSegment, createMedia, readRange, mediaInfo } from "@/lib/privacy/media-store";
import { signMediaUrl, verifyMediaSignature } from "@/lib/security/signed-url";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { rateLimit, resetRateLimits } from "@/lib/security/rate-limit";
import { isGrounded } from "@/lib/ai/analyzers";
import { renderTemplate, sanitize } from "@/lib/ai/interviewer";
import { initialState, openingDecision } from "@/lib/interview/controller";

describe("encrypted media store", () => {
  it("round-trips data and supports byte ranges across segments", () => {
    createMedia("usr_a", "med_1", "video/webm");
    appendSegment("usr_a", "med_1", 0, Buffer.from("abcdef"));
    appendSegment("usr_a", "med_1", 1, Buffer.from("ghij"));
    expect(mediaInfo("usr_a", "med_1")?.totalBytes).toBe(10);
    expect(readRange("usr_a", "med_1", 4, 7).toString()).toBe("efgh");
  });
  it("stores ciphertext, not plaintext", () => {
    const seg = fs.readFileSync(path.join(process.env.MEDIA_DIR!, "usr_a", "med_1", "seg-000000.bin"));
    expect(seg.includes(Buffer.from("abcdef"))).toBe(false);
  });
  it("detects tampering (authenticated encryption)", () => {
    const file = path.join(process.env.MEDIA_DIR!, "usr_a", "med_1", "seg-000001.bin");
    const buf = fs.readFileSync(file);
    buf[buf.length - 1] ^= 0xff;
    fs.writeFileSync(file, buf);
    expect(() => readRange("usr_a", "med_1", 6, 9)).toThrow();
  });
  it("is idempotent for retried uploads and rejects gaps", () => {
    createMedia("usr_a", "med_2", "video/webm");
    appendSegment("usr_a", "med_2", 0, Buffer.from("x"));
    expect(appendSegment("usr_a", "med_2", 0, Buffer.from("x")).stored).toBe(false);
    expect(() => appendSegment("usr_a", "med_2", 5, Buffer.from("y"))).toThrow(/out-of-order/);
  });
  it("uses per-user keys (another user's key cannot decrypt)", () => {
    createMedia("usr_b", "med_3", "video/webm");
    appendSegment("usr_b", "med_3", 0, Buffer.from("secret"));
    fs.mkdirSync(path.join(process.env.MEDIA_DIR!, "usr_c", "med_3"), { recursive: true });
    for (const f of fs.readdirSync(path.join(process.env.MEDIA_DIR!, "usr_b", "med_3"))) fs.copyFileSync(path.join(process.env.MEDIA_DIR!, "usr_b", "med_3", f), path.join(process.env.MEDIA_DIR!, "usr_c", "med_3", f));
    expect(() => readRange("usr_c", "med_3", 0, 5)).toThrow();
  });
  it("rejects path traversal ids", () => {
    expect(() => createMedia("../etc", "x", "video/webm")).toThrow();
  });
});

describe("signed media URLs", () => {
  it("verifies owner, id and expiry", () => {
    const url = new URL(signMediaUrl("med_9", "usr_1", 60), "http://x");
    const exp = url.searchParams.get("exp"), sig = url.searchParams.get("sig");
    expect(verifyMediaSignature("med_9", "usr_1", exp, sig)).toBe(true);
    expect(verifyMediaSignature("med_9", "usr_2", exp, sig)).toBe(false);
    expect(verifyMediaSignature("med_8", "usr_1", exp, sig)).toBe(false);
    expect(verifyMediaSignature("med_9", "usr_1", String(Number(exp) + 1000), sig)).toBe(false);
    const expired = new URL(signMediaUrl("med_9", "usr_1", -10), "http://x");
    expect(verifyMediaSignature("med_9", "usr_1", expired.searchParams.get("exp"), expired.searchParams.get("sig"))).toBe(false);
  });
});

describe("passwords and rate limits", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt\$/);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("limits requests per window", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000).ok).toBe(true);
    expect(rateLimit("k", 3, 1000).ok).toBe(false);
  });
});

describe("hallucination controls", () => {
  it("accepts only excerpts grounded in the source", () => {
    const src = "I led the migration to Postgres and cut costs by 30 percent.";
    expect(isGrounded("led the migration to Postgres", src)).toBe(true);
    expect(isGrounded("managed a team of 40 at Google", src)).toBe(false);
  });
  it("strips stage directions and speaker labels from spoken output", () => {
    expect(sanitize("Interviewer: *leans forward* (pauses) What happened next?")).toBe("What happened next?");
  });
  it("template interviewer references claims verbatim and discloses AI at the start", () => {
    const s = initialState({ domain: "software", type: "behavioral", level: "hiring_manager", role: "SWE", targetMinutes: 15, interviewers: [{ id: "i", personaId: "hiring_manager", panelRole: null, seat: 0, name: "Daniel Reyes" }], pressure: 3, mode: "single", curveballs: false, seed: 7 });
    const { decision, state } = openingDecision(s);
    expect(renderTemplate({ state, decision, candidateName: "Sam", lastQuestion: null, lastAnswer: null, recentTurns: [] }).text).toMatch(/AI interviewer/);
    const cb = renderTemplate({ state, decision: { ...decision, intent: "memory_callback", kind: "memory_callback", claim: { id: "c", text: "managed a team of 12" } }, candidateName: "Sam", lastQuestion: null, lastAnswer: null, recentTurns: [] });
    expect(cb.text).toContain("managed a team of 12");
  });
});
