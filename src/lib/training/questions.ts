import type { Category } from "./competencies";

/*
 * The curated question bank: validated exercises, each mapped to the competencies it can
 * assess. `situation` names the kind of story or problem it asks for; a transfer question must
 * come from a different situation, so it tests the skill rather than the memory of an answer.
 * Generated questions (lib/training/generate.ts) are never added here: they are stored with the
 * attempt that used them and marked as unvalidated.
 */

export interface Exercise {
  id: string;
  text: string;
  category: Category;
  competencies: string[];
  difficulty: 1 | 2 | 3;
  situation: string;
  /** What a strong answer has to show (evaluator context; never shown before an attempt). */
  expected: string;
  followUps: string[];
  source: "curated" | "generated";
  validated: boolean;
}

type Seed = Omit<Exercise, "source" | "validated">;

const SEEDS: Seed[] = [
  // ─── Behavioral ───────────────────────────────────────────────────────────
  { id: "b-incomplete-data", category: "behavioral", situation: "incomplete-data", difficulty: 2, competencies: ["decision_reasoning", "outcome_evidence", "answer_the_question"],
    text: "Tell me about a time you had to make a decision without all the information you wanted.",
    expected: "A specific decision, the options, what was unknown and how the risk was handled, and how it turned out.", followUps: ["What would you have done if you'd been wrong?", "Who else had a say?"] },
  { id: "b-disagree-manager", category: "behavioral", situation: "disagreement", difficulty: 2, competencies: ["decision_reasoning", "personal_contribution", "answer_the_question"],
    text: "Tell me about a time you disagreed with your manager about what to prioritize.",
    expected: "The disagreement, the speaker's own position and reasoning, what they did, and the resolution.", followUps: ["What did your manager say?", "Would you handle it the same way again?"] },
  { id: "b-off-track", category: "behavioral", situation: "recovery", difficulty: 2, competencies: ["personal_contribution", "outcome_evidence", "answer_the_question"],
    text: "Describe a project that went off track. What did you do?",
    expected: "What went wrong, the speaker's specific actions to recover, and the result.", followUps: ["What warning signs did you miss?", "What changed afterwards?"] },
  { id: "b-team-proud", category: "behavioral", situation: "team-success", difficulty: 1, competencies: ["personal_contribution", "outcome_evidence", "answer_the_question"],
    text: "Tell me about something you're proud of that was a team effort.",
    expected: "The team's goal, the speaker's distinct part, and the concrete result.", followUps: ["What would have happened without you?", "What did you learn from the others?"] },
  { id: "b-speed-quality", category: "behavioral", situation: "speed-quality", difficulty: 2, competencies: ["decision_reasoning", "outcome_evidence", "answer_the_question"],
    text: "Tell me about a time you had to choose between moving fast and getting it right.",
    expected: "The choice, the options and how they were weighed, and the consequence.", followUps: ["What did you give up?", "How did you know it was the right call?"] },
  { id: "b-changed-mind", category: "behavioral", situation: "influence", difficulty: 2, competencies: ["personal_contribution", "outcome_evidence", "answer_the_question"],
    text: "Tell me about a time you changed someone's mind.",
    expected: "Whose mind, what the speaker specifically did to persuade them, and what changed.", followUps: ["Why did they disagree at first?", "What would you do if it hadn't worked?"] },
  { id: "b-fell-short", category: "behavioral", situation: "shortfall", difficulty: 3, competencies: ["outcome_evidence", "personal_contribution", "answer_the_question"],
    text: "Tell me about a result you were responsible for that fell short.",
    expected: "The target, what actually happened (concretely), the speaker's part in it, and what they did next.", followUps: ["What would you do differently?", "How did you tell your manager?"] },
  { id: "b-deadline-sacrifice", category: "behavioral", situation: "tradeoff-deadline", difficulty: 2, competencies: ["decision_reasoning", "answer_the_question"],
    text: "Describe a time you had to give up something important to meet a deadline.",
    expected: "What was given up, the alternatives considered, and why that sacrifice was chosen.", followUps: ["Did you ever go back to it?", "Who did you have to convince?"] },

  // ─── Technical ────────────────────────────────────────────────────────────
  { id: "t-most-viewed", category: "technical", situation: "read-heavy", difficulty: 2, competencies: ["tradeoff_reasoning", "answer_the_question"],
    text: "How would you build a feature that shows each user their ten most-viewed items, for ten million users?",
    expected: "At least two approaches (e.g. compute on read vs precompute), their costs, and a choice tied to scale and freshness.", followUps: ["What if the list must be real-time?", "How would you test it?"] },
  { id: "t-latency-regression", category: "technical", situation: "incident", difficulty: 2, competencies: ["tradeoff_reasoning", "answer_the_question"],
    text: "Your service's p99 latency doubled after a release. How would you respond?",
    expected: "Options such as rolling back versus diagnosing in place, what each costs, and how the choice depends on impact.", followUps: ["What would you look at first?", "How would you prevent it next time?"] },
  { id: "t-session-store", category: "technical", situation: "storage", difficulty: 1, competencies: ["tradeoff_reasoning", "answer_the_question"],
    text: "Would you keep user sessions in the database or in a cache? Walk me through it.",
    expected: "Both options with their costs (durability, latency, operational load) and a choice tied to the requirements.", followUps: ["What happens if the cache goes down?", "How would this change at ten times the traffic?"] },
  { id: "t-schema-change", category: "technical", situation: "migration", difficulty: 3, competencies: ["tradeoff_reasoning", "answer_the_question"],
    text: "How would you roll out a risky schema change to a large production database?",
    expected: "Alternative rollout strategies, the risk and cost of each, and how the choice depends on downtime tolerance.", followUps: ["How would you roll it back?", "How would you know it worked?"] },
  { id: "t-monolith", category: "technical", situation: "architecture", difficulty: 2, competencies: ["tradeoff_reasoning", "answer_the_question"],
    text: "When would you choose a single monolith over several services for a new product?",
    expected: "Both architectures, what each costs at this stage, and the constraints that decide it.", followUps: ["When would you split it?", "What would make you regret the choice?"] },

  // ─── Case ─────────────────────────────────────────────────────────────────
  { id: "c-profit-decline", category: "case", situation: "profit-decline", difficulty: 2, competencies: ["structuring", "answer_the_question"],
    text: "A coffee chain's profits fell fifteen percent this year while revenue held flat. How would you approach this?",
    expected: "A stated structure (e.g. cost components), distinct parts, and a reasoned starting point.", followUps: ["Which costs would you look at first?", "What data would you ask for?"] },
  { id: "c-budgeting-app", category: "case", situation: "market-entry", difficulty: 2, competencies: ["structuring", "recommendation", "decision_reasoning", "answer_the_question"],
    text: "A bank is deciding whether to launch a budgeting app for its customers. How would you think about it?",
    expected: "A structure covering customers, economics and competition, and a recommendation with reasons and risk.", followUps: ["How would the bank make money from it?", "What would make you say no?"] },
  { id: "c-gym-churn", category: "case", situation: "churn", difficulty: 1, competencies: ["structuring", "answer_the_question"],
    text: "A gym chain loses most new members within three months. Where would you start?",
    expected: "A structure for why members leave, distinct parts, and where to start and why.", followUps: ["How would you test your hypothesis?", "What would you do first?"] },
  { id: "c-new-route", category: "case", situation: "route", difficulty: 2, competencies: ["recommendation", "decision_reasoning", "answer_the_question"],
    text: "Should a regional airline add a route between two mid-sized cities? Give me your recommendation.",
    expected: "A clear recommendation first, two or three reasons, alternatives weighed, and the main risk.", followUps: ["What would change your answer?", "How would you test it cheaply?"] },
  { id: "c-pricing", category: "case", situation: "pricing", difficulty: 3, competencies: ["recommendation", "decision_reasoning", "answer_the_question"],
    text: "A software company can either raise prices or remove its free tier. What would you recommend?",
    expected: "A recommendation first, the two options compared on explicit criteria, and the risk with a next step.", followUps: ["How would customers react?", "What would you measure?"] },
  { id: "c-er-waits", category: "case", situation: "operations", difficulty: 2, competencies: ["structuring", "answer_the_question"],
    text: "A hospital's emergency room wait times have doubled in a year. How would you structure the problem?",
    expected: "A stated structure (e.g. demand, capacity, process), distinct parts, and a reasoned starting point.", followUps: ["What data would you collect first?", "What would a quick win look like?"] },

  // ─── Leadership ───────────────────────────────────────────────────────────
  { id: "l-unpopular", category: "leadership", situation: "unpopular", difficulty: 2, competencies: ["decision_reasoning", "personal_contribution", "outcome_evidence", "answer_the_question"],
    text: "Tell me about a time you made an unpopular decision for your team.",
    expected: "The decision, the alternatives and reasoning, what the speaker did to handle the reaction, and the result.", followUps: ["How did you know it was right?", "What did you say to the people who disagreed?"] },
  { id: "l-engineers-disagree", category: "leadership", situation: "conflict", difficulty: 2, competencies: ["decision_reasoning", "recommendation", "answer_the_question"],
    text: "Your two strongest engineers disagree about an architecture choice, and the deadline is in two weeks. What do you do?",
    expected: "How the options are weighed, the basis for deciding, what is uncertain, and a clear decision.", followUps: ["What if they still disagree afterwards?", "How would you explain the call?"] },
  { id: "l-unclear-strategy", category: "leadership", situation: "ambiguity", difficulty: 3, competencies: ["decision_reasoning", "outcome_evidence", "personal_contribution", "answer_the_question"],
    text: "Tell me about a time you set direction when the strategy above you was unclear.",
    expected: "The ambiguity, the direction chosen and why, the speaker's actions, and the result.", followUps: ["How did you check you were right?", "What did you do when things changed?"] },
  { id: "l-client-feature", category: "leadership", situation: "client-tradeoff", difficulty: 2, competencies: ["recommendation", "decision_reasoning", "answer_the_question"],
    text: "A key client wants a feature that would delay your roadmap by a quarter. What would you recommend to leadership?",
    expected: "A recommendation first, the options compared, the reasons, and the main risk.", followUps: ["How would you tell the client?", "What would change your recommendation?"] },
  { id: "l-turnaround", category: "leadership", situation: "turnaround", difficulty: 3, competencies: ["personal_contribution", "outcome_evidence", "answer_the_question"],
    text: "Tell me about a time you improved a team that was underperforming.",
    expected: "The starting point, what the speaker specifically changed, and the measurable result.", followUps: ["What didn't work?", "How did the team react?"] },
  { id: "l-budget-cut", category: "leadership", situation: "budget", difficulty: 3, competencies: ["recommendation", "decision_reasoning", "answer_the_question"],
    text: "Your company has to cut twenty percent of next year's budget. What would you recommend to the leadership team?",
    expected: "A clear recommendation first, how the options were weighed, the reasons, and the risk.", followUps: ["What would you protect at all costs?", "How would you tell the teams affected?"] },
];

export const EXERCISES: Exercise[] = SEEDS.map((s) => ({ ...s, source: "curated", validated: true }));
export const EXERCISE = Object.fromEntries(EXERCISES.map((e) => [e.id, e])) as Record<string, Exercise>;

/** Curated exercises that can assess a competency in a category. */
export function poolFor(competencyId: string, category: Category): Exercise[] {
  return EXERCISES.filter((e) => e.category === category && e.competencies.includes(competencyId));
}
