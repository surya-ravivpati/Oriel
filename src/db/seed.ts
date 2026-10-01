/**
 * Development seed: a demo account with three analysed sessions, so Progress and the
 * Ladder have history to show.
 *
 *   npm run db:seed
 *
 * Sessions are produced by the real interview service and analysis pipeline driven
 * with scripted answers and the deterministic (template/heuristic) providers — no
 * fabricated AI output. Their coaching is labelled "generated from measurements".
 *
 * Demo login (local development only): demo@oriel.test / oriel-demo-pass-2026
 */
process.env.ORIEL_LLM_PROVIDER = "mock";
process.env.ORIEL_TTS_PROVIDER = "browser";
process.env.ORIEL_STT_PROVIDER = "browser";
process.env.ORIEL_SYNC_PIPELINE = "1";

const DEMO_EMAIL = "demo@oriel.test";
const DEMO_PASSWORD = "oriel-demo-pass-2026";

async function main() {
  const { eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("./client");
  const { newId } = await import("@/lib/id");
  const { hashPassword } = await import("@/lib/security/password");
  const { createInterview, runOpening, runTurn } = await import("@/server/interview/service");
  const { enqueueAnalysis, runJob } = await import("@/server/processing/pipeline");
  const { deleteAccount } = await import("@/server/privacy/deletion");

  const db = getDb();
  const existing = db.select().from(schema.users).where(eq(schema.users.email, DEMO_EMAIL)).get();
  if (existing) deleteAccount(existing.id, "oriel.test");

  const userId = newId("usr");
  db.insert(schema.users).values({ id: userId, email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD), role: "admin", onboardedAt: new Date() }).run();
  db.insert(schema.profiles).values({ userId, name: "Alex Morgan", targetRole: "Senior Software Engineer", domain: "software", experienceLevel: "senior", preferredPersona: "hiring_manager" }).run();
  db.insert(schema.subscriptions).values({ id: newId("sub"), userId, plan: "pro", periodStart: new Date() }).run();
  db.insert(schema.ladderProgress).values({ userId, level: 1, unlockedAt: new Date() }).run();
  db.insert(schema.resumes).values({
    id: newId("res"), userId, rawText: "Alex Morgan — Senior Software Engineer, Northwind Payments (2021–present)", parsed: {
      headline: "Senior Software Engineer", summary: null, skills: ["Go", "TypeScript", "Postgres"], education: [], metrics: [], source: "heuristic",
      roles: [{ title: "Senior Software Engineer", organization: "Northwind Payments", start: "2021", end: "present", highlights: [] }],
    },
  }).run();

  // Three sessions that improve over time: fewer fillers, faster recovery, more specifics.
  const scripts: { answers: string[]; latency: number }[] = [
    { latency: 4200, answers: [
      "Um, so I've been, like, an engineer for a while and I, uh, kind of work on payments stuff at Northwind, you know, various things.",
      "I think maybe the hardest thing was, um, a migration? We did a lot of work and it sort of went okay I guess.",
      "Uh, we had some disagreements and, like, we talked about it and it was fine eventually, you know.",
      "Um, I think we improved things a lot, like performance and stuff, it was pretty good overall.",
    ] },
    { latency: 3100, answers: [
      "I'm a backend engineer at Northwind Payments. I, um, lead the checkout team and I've been there about four years.",
      "The hardest problem was migrating our ledger to Postgres. I think it was risky because we had no downtime window, so I designed a dual-write approach.",
      "I disagreed with my manager about a rewrite. Um, I wrote a short proposal with the risks and we agreed to phase it instead.",
      "We cut checkout latency, I think by about half, over a quarter, and the team shipped it without incidents.",
    ] },
    { latency: 2100, answers: [
      "I'm a senior backend engineer at Northwind Payments. I lead a team of 6 and I own checkout reliability, which handles about 3 million payments a month.",
      "The hardest problem I owned was migrating our ledger to Postgres with no downtime window. I designed a dual-write approach, ran shadow reads for two weeks, and cut over with zero lost transactions.",
      "My manager wanted a full rewrite. I proposed phasing it in three stages with a rollback plan, and I presented the incident data. As a result we shipped stage one in six weeks and avoided a freeze.",
      "In 2023 I led the checkout rewrite. As a result p99 latency dropped from 900ms to 250ms in three months, which meant we could launch in the EU on schedule.",
    ] },
  ];

  let dayOffset = 12;
  for (const [i, script] of scripts.entries()) {
    const { sessionId } = createInterview(userId, {
      role: "Senior Software Engineer", domain: "software", level: "hiring_manager", type: "behavioral",
      pressure: 2 + i, persona: "hiring_manager", mode: "single", panelSize: 3, ladderLevel: 1, targetMinutes: 15, cameraMetrics: false,
    });
    for await (const _ of runOpening(sessionId, userId)) void _;
    let t = 8000;
    const audio: { t: number; rms: number; voiced: boolean; pitch: number | null }[] = [];
    for (const a of script.answers) {
      const words = a.split(/\s+/).length;
      const dur = Math.round((words / (150 - i * 8)) * 60_000);
      const start = t + script.latency;
      for (let x = start; x < start + dur; x += 100) {
        const pause = (x - start) % 9000 > 8000 - i * 250;
        audio.push({ t: x, rms: pause ? 0.003 : 0.05, voiced: !pause, pitch: pause ? null : 120 + (10 + i * 8) * Math.sin(x / 700) });
      }
      for await (const _ of runTurn(sessionId, userId, { answerText: a, startMs: start, endMs: start + dur, firstWordLatencyMs: script.latency, interrupted: false, inputMode: "voice", prevQuestion: null })) void _;
      t = start + dur + 6000;
    }
    db.insert(schema.signalTimelines).values({ id: newId("sig"), sessionId, kind: "audio", startMs: 0, samples: audio }).run();
    const when = new Date(Date.now() - dayOffset * 86400_000);
    db.update(schema.interviewSessions).set({ status: "ended", startedAt: when, endedAt: new Date(when.getTime() + t), createdAt: when }).where(eq(schema.interviewSessions.id, sessionId)).run();
    await runJob(enqueueAnalysis(sessionId));
    db.update(schema.progressSnapshots).set({ createdAt: when }).where(eq(schema.progressSnapshots.sessionId, sessionId)).run();
    dayOffset -= 5;
    console.log(`[seed] session ${i + 1} analysed: ${sessionId}`);
  }
  console.log(`[seed] demo account ready: ${DEMO_EMAIL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
