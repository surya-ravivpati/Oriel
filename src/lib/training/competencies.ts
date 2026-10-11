/*
 * Competencies: skills that can be seen in an answer, each with a rubric of observable
 * criteria. The rubric is what the evaluator is held to and what the learning engine reasons
 * about; the candidate never sees the criteria while answering.
 *
 * Every rubric has a version. An evaluation stores the version (and the criteria as they were),
 * so changing a rubric never rewrites what an old evaluation meant. Bump `version` whenever a
 * criterion's meaning changes.
 */

export type Category = "behavioral" | "technical" | "case" | "leadership";

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  { id: "behavioral", label: "Behavioral", blurb: "Stories from your work" },
  { id: "technical", label: "Technical", blurb: "Design decisions and trade-offs" },
  { id: "case", label: "Case", blurb: "Structuring a business problem" },
  { id: "leadership", label: "Leadership", blurb: "Judgment, people and direction" },
];

/** 0 not shown, 1 partly shown, 2 clearly shown. "Cannot tell" is a separate state, never a 0. */
export type Level = 0 | 1 | 2;

export interface Criterion {
  id: string;
  label: string;
  /** What an evaluator looks for, stated as something observable in the words of the answer. */
  look: string;
  /** What it sounds like when it's there. */
  strong: string;
  /** The usual way it goes missing. */
  failure: string;
  /** The principle to apply on a retry. Never a model answer. */
  principle: string;
  /** Scaffolding for a second and third try: a focused question, then a partial outline. */
  scaffold: [string, string];
  /** Why it matters to the person across the table. */
  why: string;
}

export interface Competency {
  id: string;
  version: number;
  label: string;
  categories: Category[];
  /** One plain sentence, shown on the hub and in the summary (never during an attempt). */
  summary: string;
  criteria: Criterion[];
  /** What an answer must contain before this competency can be judged at all. */
  evidenceRequired: string;
  anchors: Record<Level, string>;
  /** Known limits of judging this from a transcript. */
  limitations: string;
}

export const COMPETENCIES: Competency[] = [
  {
    id: "answer_the_question", version: 1, label: "Answering the actual question", categories: ["behavioral", "technical", "case", "leadership"],
    summary: "Respond to what was asked, early, and end on a point.",
    evidenceRequired: "An answer of at least a few sentences to a question with a clear ask.",
    anchors: { 0: "The answer is about something adjacent to the question.", 1: "The question is answered, but late or partly.", 2: "The ask is answered directly and early, and the answer ends on it." },
    limitations: "Judged from the words only; a long warm-up can be a style, so only relevance and directness count, not length.",
    criteria: [
      {
        id: "direct", label: "Answers early", look: "The first two or three sentences respond to the ask itself (a decision, an example, an approach), not background.",
        strong: "\"The short answer is I'd ship the smaller fix first. Here's why.\"", failure: "Several sentences of context before the question is touched.",
        principle: "Answer the question in your first sentence, then give the support.", why: "Interviewers decide early whether you heard the question; an early answer buys you their attention for the rest.",
        scaffold: ["In one sentence, what is your answer to exactly this question?", "Start with: \"My answer is ___.\" Then: \"Here's why: ___.\" Then one example."],
      },
      {
        id: "relevant", label: "Stays on the ask", look: "Each part of the answer serves the question; no long detour into unrelated detail.",
        strong: "Every example and detail supports the point being made.", failure: "A detailed story that never comes back to what was asked.",
        principle: "Keep only what helps answer this question; drop the rest.", why: "Detours read as not listening, and they eat the time you'd use to make your case.",
        scaffold: ["Which part of your last answer did the question actually ask for?", "Keep: your answer, one supporting example, the outcome. Cut: anything else."],
      },
      {
        id: "lands", label: "Ends on a point", look: "The answer closes by restating the answer or its conclusion, not trailing off.",
        strong: "\"So that's why I'd do X.\"", failure: "The answer stops mid-detail or ends with \"so yeah\".",
        principle: "Finish by saying your conclusion again in one sentence.", why: "The last thing you say is what they write down.",
        scaffold: ["What one sentence should they remember from your answer?", "End with: \"So, ___.\""],
      },
    ],
  },
  {
    id: "personal_contribution", version: 1, label: "Explaining your own contribution", categories: ["behavioral", "leadership"],
    summary: "Make clear what you personally did, as distinct from your team.",
    evidenceRequired: "A story about work that involved other people.",
    anchors: { 0: "Only \"we\"; your role can't be told apart.", 1: "Some of your actions are named, but blurred with the team's.", 2: "Your specific actions are explicit and distinct from the team's." },
    limitations: "Some cultures and roles speak in \"we\" by default; the criterion is whether your part can be identified, not pronoun counting.",
    criteria: [
      {
        id: "own_actions", label: "Names your actions", look: "Specific actions attributed to the speaker (\"I proposed\", \"I wrote\", \"I decided\").",
        strong: "\"I proposed the rollback plan and wrote the migration.\"", failure: "\"We worked on it together and it went well.\"",
        principle: "Say what you yourself did, with \"I\" and a concrete verb.", why: "They are hiring you, not your team; if your part isn't clear they assume it was small.",
        scaffold: ["What is one thing that would not have happened without you?", "\"The team ___. My part was ___. Specifically, I ___.\""],
      },
      {
        id: "distinct", label: "Separates you from the team", look: "The answer makes clear which parts were the team's and which were the speaker's.",
        strong: "\"Engineering built it; I set the scope and ran the launch.\"", failure: "Team and personal actions are indistinguishable.",
        principle: "Credit the team for its part, then mark where your part begins.", why: "Clear credit reads as honest and senior; blurred credit reads as either inflated or passive.",
        scaffold: ["Who else was involved, and what did they own that you didn't?", "\"They owned ___; I owned ___.\""],
      },
      {
        id: "concrete", label: "Concrete, not generic", look: "Actions are specific to this situation, not generic descriptions (\"communicated\", \"collaborated\").",
        strong: "\"I set up a weekly review with the two leads and cut the scope by a third.\"", failure: "\"I communicated with stakeholders and aligned everyone.\"",
        principle: "Replace general verbs with the specific thing you did.", why: "Generic actions could be anyone's; specific ones are evidence.",
        scaffold: ["If someone had watched you that week, what would they have seen you do?", "Replace \"communicated\" or \"aligned\" with: who, what, when."],
      },
    ],
  },
  {
    id: "decision_reasoning", version: 1, label: "Reasoning through a decision", categories: ["behavioral", "case", "leadership"],
    summary: "Show the options, how you chose, and what you didn't know.",
    evidenceRequired: "An answer about a choice that was made or would be made.",
    anchors: { 0: "A decision is stated with no reasoning.", 1: "Some reasoning, but options or criteria are missing.", 2: "Alternatives, the basis for choosing, and the uncertainty are all explicit." },
    limitations: "A transcript can show reasoning that was said, not reasoning that happened; quiet but sound judgment may be under-credited.",
    criteria: [
      {
        id: "alternatives", label: "Names the alternatives", look: "At least two real options are named (including doing nothing).",
        strong: "\"We could delay the launch, ship to a subset, or ship as is.\"", failure: "Only the chosen path is mentioned.",
        principle: "Name the options you weighed before saying which you chose.", why: "Without the alternatives, a decision sounds like a default rather than a choice.",
        scaffold: ["What else could you have done instead?", "\"The options were ___, ___ and ___.\""],
      },
      {
        id: "criteria", label: "States how you chose", look: "The basis for the decision is explicit (a criterion, a constraint, a priority).",
        strong: "\"Time to recover mattered more than speed, so...\"", failure: "\"It just felt like the right call.\"",
        principle: "Say what mattered most and how each option scored on it.", why: "Interviewers are testing your judgment, which only shows in how you weigh things.",
        scaffold: ["What mattered most in choosing, and why?", "\"What mattered most was ___. Option ___ was best on that because ___.\""],
      },
      {
        id: "uncertainty", label: "Acknowledges what was unknown", look: "The answer names a risk, an assumption or missing information, and how it was handled.",
        strong: "\"We didn't know the churn impact, so we set a two-week checkpoint.\"", failure: "The decision is presented as certain from the start.",
        principle: "Name what you didn't know and what you did to limit the risk.", why: "Real decisions are made with gaps; naming them shows judgment, not weakness.",
        scaffold: ["What didn't you know when you decided?", "\"What we didn't know was ___. To limit that risk, I ___.\""],
      },
      {
        id: "justified", label: "Justifies the choice", look: "The answer explains why the chosen option beat the alternatives, not just that it was chosen.",
        strong: "\"Shipping to a subset gave us the data without the downside, so...\"", failure: "The choice is announced but never compared.",
        principle: "Compare your choice against the strongest alternative.", why: "The comparison is the evidence that the choice was considered.",
        scaffold: ["Why was your choice better than the next-best option?", "\"I chose ___ over ___ because ___.\""],
      },
    ],
  },
  {
    id: "outcome_evidence", version: 1, label: "Showing the outcome", categories: ["behavioral", "leadership"],
    summary: "Say what changed, how you know, and how it connects to what you did.",
    evidenceRequired: "A story with an end.",
    anchors: { 0: "No result is stated.", 1: "A result is stated vaguely or without connection to your actions.", 2: "A concrete result, how it was known, and the link to your actions." },
    limitations: "Not every result is measurable; a concrete observable change counts as much as a number.",
    criteria: [
      {
        id: "result", label: "States the result", look: "The answer says what happened in the end.",
        strong: "\"We launched two weeks early and kept every client.\"", failure: "The story stops at the actions.",
        principle: "Finish the story: say what happened in the end.", why: "Without the ending they can't tell whether your actions worked.",
        scaffold: ["How did it end?", "\"In the end, ___.\""],
      },
      {
        id: "evidence", label: "Shows how you know", look: "The result is concrete: a number, a timeframe, a before-and-after, or an observable change.",
        strong: "\"Activation went from 31% to 44% in a quarter.\"", failure: "\"It went really well.\"",
        principle: "Make the result concrete: a size, a change, a timeframe, or what someone could see.", why: "Concrete results are believable; adjectives are not.",
        scaffold: ["How would someone else have known it worked?", "\"Before, ___. After, ___. Over ___.\" (Estimate if you must, and say it's an estimate.)"],
      },
      {
        id: "attribution", label: "Links it to your actions", look: "The answer connects the result to what the speaker did.",
        strong: "\"Because the checkpoint caught the issue early, we...\"", failure: "A good result sits next to the actions with no link.",
        principle: "Connect the result to the action that caused it.", why: "The link is what turns a good outcome into evidence about you.",
        scaffold: ["Which of your actions made the biggest difference to that result?", "\"That happened because I ___.\""],
      },
    ],
  },
  {
    id: "tradeoff_reasoning", version: 1, label: "Explaining trade-offs", categories: ["technical"],
    summary: "Compare approaches by what each gives up, and tie the choice to the constraints.",
    evidenceRequired: "An answer that proposes or defends a technical approach.",
    anchors: { 0: "One approach, no costs named.", 1: "Costs mentioned for some options, or not tied to constraints.", 2: "Two or more approaches, their costs, and a choice tied to the constraints." },
    limitations: "Technical correctness is not judged here; only whether the reasoning about trade-offs is explicit. Code is never declared correct from a transcript.",
    criteria: [
      {
        id: "options", label: "Two or more approaches", look: "At least two distinct approaches are described.",
        strong: "\"We could cache at the edge or precompute nightly.\"", failure: "One approach is presented as the only one.",
        principle: "Lay out at least two ways to solve it before choosing.", why: "Interviewers want to see the design space, not just your favourite.",
        scaffold: ["What is a second, genuinely different way to do this?", "\"Approach A: ___. Approach B: ___.\""],
      },
      {
        id: "costs", label: "Names what each gives up", look: "Each approach's cost or weakness is stated (latency, complexity, consistency, cost, time).",
        strong: "\"Precomputing is cheap to serve but stale for up to a day.\"", failure: "Only benefits are listed.",
        principle: "For each option, say what it costs.", why: "Every design gives something up; naming it shows you've built real systems.",
        scaffold: ["What gets worse if you pick your favourite approach?", "\"A is ___ but costs ___. B is ___ but costs ___.\""],
      },
      {
        id: "constraints", label: "Ties the choice to constraints", look: "The final choice is justified by the stated constraints (scale, latency, team, deadline).",
        strong: "\"Since reads dominate and staleness of an hour is fine, I'd precompute.\"", failure: "A choice with no reference to the problem's constraints.",
        principle: "Pick the option that fits the constraints, and say which constraint decided it.", why: "The right answer depends on the constraints; tying them together is the skill being tested.",
        scaffold: ["Which constraint in the problem matters most?", "\"Given ___, I'd choose ___, and I'd revisit it if ___.\""],
      },
    ],
  },
  {
    id: "structuring", version: 1, label: "Structuring an ambiguous problem", categories: ["case"],
    summary: "Lay out how you'll attack the problem before diving in, and say where you'd start.",
    evidenceRequired: "An answer to an open business problem.",
    anchors: { 0: "Dives into one idea with no structure.", 1: "A structure is implied but not stated, or overlaps.", 2: "A stated structure with distinct parts, and a reasoned starting point." },
    limitations: "Structure is judged from what is said; a candidate thinking silently may be under-credited.",
    criteria: [
      {
        id: "upfront", label: "States a structure first", look: "Before analysis, the answer lays out the parts it will look at.",
        strong: "\"I'd look at three things: market, costs, and competition.\"", failure: "Jumps straight into one hypothesis.",
        principle: "Before analysing, say the two to four parts you'll look at.", why: "A stated structure lets the interviewer follow and steer you.",
        scaffold: ["What are the two to four big pieces of this problem?", "\"I'd break this into ___, ___ and ___.\""],
      },
      {
        id: "distinct_parts", label: "Parts are distinct and cover it", look: "The parts don't overlap and together cover the problem.",
        strong: "Revenue and cost as separate branches of profit.", failure: "Overlapping buckets, or an obvious area missing.",
        principle: "Check that your parts don't overlap and that nothing big is missing.", why: "Overlaps and gaps are where case answers go wrong.",
        scaffold: ["Is there a big area your parts don't cover?", "Use a split that can't overlap: inside vs outside, revenue vs cost, now vs later."],
      },
      {
        id: "prioritised", label: "Says where to start, and why", look: "The answer picks which part to examine first and gives a reason.",
        strong: "\"I'd start with costs, since revenue has been flat.\"", failure: "All parts treated as equally important.",
        principle: "Pick the part most likely to explain the problem and say why you'd start there.", why: "Prioritising shows business judgment, not just a framework.",
        scaffold: ["Which part is most likely to explain the problem?", "\"I'd start with ___ because ___.\""],
      },
    ],
  },
  {
    id: "recommendation", version: 1, label: "Making a clear recommendation", categories: ["case", "leadership"],
    summary: "Lead with the recommendation, support it, and name the risk.",
    evidenceRequired: "An answer that is asked to recommend or conclude.",
    anchors: { 0: "No clear recommendation.", 1: "A recommendation, but buried or unsupported.", 2: "Recommendation first, two or three reasons, and the main risk with a next step." },
    limitations: "Whether the recommendation is right is not judged; only whether it is clear and supported.",
    criteria: [
      {
        id: "first", label: "Recommendation first", look: "The recommendation appears at the start, stated plainly.",
        strong: "\"I'd recommend we enter the market, but only in two cities.\"", failure: "The recommendation arrives at the end, or never.",
        principle: "Open with your recommendation in one sentence.", why: "Decision-makers want the answer first and the reasoning second.",
        scaffold: ["If you had ten seconds, what would you recommend?", "\"I recommend ___.\" Then the reasons."],
      },
      {
        id: "supported", label: "Supported with reasons", look: "Two or three specific reasons back the recommendation.",
        strong: "\"First, margins are higher; second, the competitor is retreating.\"", failure: "A recommendation with no reasons, or a long unranked list.",
        principle: "Give the two or three reasons that matter most, in order.", why: "Reasons let them test your thinking; too many dilute it.",
        scaffold: ["What are the two strongest reasons for your recommendation?", "\"Two reasons: first ___, second ___.\""],
      },
      {
        id: "risk", label: "Names the main risk and a next step", look: "The answer names what could make it wrong and what to do about it.",
        strong: "\"The risk is regulation; I'd test in one city first.\"", failure: "The recommendation is presented as risk-free.",
        principle: "Name the biggest risk and the first step to reduce it.", why: "Naming the risk shows you've thought past the slide.",
        scaffold: ["What would make your recommendation wrong?", "\"The main risk is ___. The first step would be ___.\""],
      },
    ],
  },
];

export const COMPETENCY = Object.fromEntries(COMPETENCIES.map((c) => [c.id, c])) as Record<string, Competency>;

export function competency(id: string): Competency {
  const c = COMPETENCY[id];
  if (!c) throw new Error(`Unknown competency: ${id}`);
  return c;
}

export function criterion(c: Competency, id: string): Criterion | undefined {
  return c.criteria.find((x) => x.id === id);
}

export function competenciesFor(category: Category): Competency[] {
  return COMPETENCIES.filter((c) => c.categories.includes(category));
}
