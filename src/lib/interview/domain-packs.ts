/**
 * Domain packs: competencies, question bank, rubric and curveballs per field.
 * Questions are tagged by interview type so a "technical" or "case" interview draws
 * the right material. Rubric lines tell the Answer Analyzer what "good" looks like.
 */
export type InterviewType = "behavioral" | "technical" | "case" | "leadership" | "mixed";

export type DomainId =
  | "software" | "product" | "consulting" | "finance"
  | "research" | "clinical" | "executive" | "government";

export interface Competency {
  key: string;
  label: string;
  rubric: string; // what a strong answer demonstrates
}

export interface BankQuestion {
  id: string;
  competency: string;
  types: InterviewType[];
  text: string;
  difficulty: 1 | 2 | 3;
}

export interface DomainPack {
  id: DomainId;
  label: string;
  roles: string[];
  competencies: Competency[];
  questions: BankQuestion[];
  curveballs: string[];
}

// Shared across packs — every interview may draw on these.
const CORE_COMPETENCIES: Competency[] = [
  { key: "motivation", label: "Motivation & fit", rubric: "Specific reasons tied to this role and team, not generic enthusiasm." },
  { key: "ownership", label: "Ownership", rubric: "Clear personal actions (I, not we), decisions made, and accountability for the result." },
  { key: "impact", label: "Impact", rubric: "Quantified outcome with baseline, scope and timeframe." },
  { key: "collaboration", label: "Collaboration", rubric: "Names stakeholders, describes disagreement and how alignment was reached." },
  { key: "adversity", label: "Handling setbacks", rubric: "Owns the mistake, specific corrective action, what changed afterwards." },
  { key: "communication", label: "Communication", rubric: "Answers the question asked, leads with the point, concise structure." },
];

const CORE_QUESTIONS: BankQuestion[] = [
  { id: "core-intro", competency: "communication", types: ["behavioral", "technical", "case", "leadership", "mixed"], text: "Walk me through your background and what brings you to this role.", difficulty: 1 },
  { id: "core-why", competency: "motivation", types: ["behavioral", "leadership", "mixed"], text: "Why this role, and why now?", difficulty: 1 },
  { id: "core-proud", competency: "impact", types: ["behavioral", "mixed", "technical"], text: "Tell me about the piece of work you're most proud of in the last two years.", difficulty: 2 },
  { id: "core-fail", competency: "adversity", types: ["behavioral", "leadership", "mixed"], text: "Tell me about a time something you owned failed. What happened?", difficulty: 2 },
  { id: "core-conflict", competency: "collaboration", types: ["behavioral", "leadership", "mixed"], text: "Describe a time you strongly disagreed with a colleague or manager. How did it resolve?", difficulty: 2 },
  { id: "core-ambiguity", competency: "ownership", types: ["behavioral", "mixed", "leadership"], text: "Tell me about a time you had to move forward without clear direction.", difficulty: 2 },
  { id: "core-feedback", competency: "adversity", types: ["behavioral", "mixed"], text: "What's the most difficult piece of feedback you've received, and what did you do with it?", difficulty: 2 },
];

const CORE_CURVEBALLS = [
  "If I called your last manager right now, what would they say you need to work on?",
  "What's something on your resume you'd rather I didn't ask about?",
  "Convince me in thirty seconds that you're the strongest candidate I'll see this week.",
  "What would you do in your first ninety days if you got this job?",
  "What's a decision you made in the last year that you'd reverse?",
];

function pack(p: Omit<DomainPack, "competencies" | "questions" | "curveballs"> & {
  competencies: Competency[]; questions: BankQuestion[]; curveballs: string[];
}): DomainPack {
  return {
    ...p,
    competencies: [...CORE_COMPETENCIES, ...p.competencies],
    questions: [...CORE_QUESTIONS, ...p.questions],
    curveballs: [...p.curveballs, ...CORE_CURVEBALLS],
  };
}

export const DOMAIN_PACKS: Record<DomainId, DomainPack> = {
  software: pack({
    id: "software", label: "Software Engineering",
    roles: ["Software Engineer", "Senior Software Engineer", "Staff Engineer", "Engineering Manager", "Tech Lead"],
    competencies: [
      { key: "system_design", label: "System design", rubric: "States requirements and constraints, sizes load, names trade-offs and failure modes." },
      { key: "technical_depth", label: "Technical depth", rubric: "Explains how it works under the hood, not just which tool was used." },
      { key: "debugging", label: "Debugging & incidents", rubric: "Hypothesis-driven, measured impact, root cause, prevention." },
    ],
    questions: [
      { id: "swe-design", competency: "system_design", types: ["technical", "mixed"], text: "Pick a system you built or owned. Walk me through its architecture and the biggest trade-off you made.", difficulty: 2 },
      { id: "swe-scale", competency: "system_design", types: ["technical"], text: "How would you design a rate limiter for an API serving ten thousand requests per second?", difficulty: 3 },
      { id: "swe-incident", competency: "debugging", types: ["technical", "behavioral", "mixed"], text: "Tell me about the worst production incident you were part of. What was your role?", difficulty: 2 },
      { id: "swe-depth", competency: "technical_depth", types: ["technical"], text: "What's a technical decision you pushed back on, and what was your reasoning?", difficulty: 2 },
      { id: "swe-quality", competency: "technical_depth", types: ["technical", "mixed"], text: "How do you decide when code is ready to ship?", difficulty: 1 },
      { id: "swe-lead", competency: "collaboration", types: ["leadership"], text: "Tell me about a time you raised the bar for engineering quality on a team.", difficulty: 2 },
    ],
    curveballs: ["What's a widely used technology you think is overrated, and why?"],
  }),
  product: pack({
    id: "product", label: "Product Management",
    roles: ["Product Manager", "Senior Product Manager", "Group Product Manager", "Director of Product"],
    competencies: [
      { key: "product_sense", label: "Product sense", rubric: "Starts from a user and problem, prioritises with explicit criteria." },
      { key: "metrics", label: "Metrics & analytics", rubric: "Defines a north-star and guardrail metrics, explains movement causally." },
      { key: "prioritization", label: "Prioritization", rubric: "Names what was cut and why, handles stakeholder pressure." },
    ],
    questions: [
      { id: "pm-launch", competency: "product_sense", types: ["behavioral", "mixed"], text: "Tell me about a product you launched. How did you decide what to build?", difficulty: 2 },
      { id: "pm-metric", competency: "metrics", types: ["case", "technical", "mixed"], text: "Weekly active users dropped twelve percent last week. Walk me through how you'd investigate.", difficulty: 3 },
      { id: "pm-prior", competency: "prioritization", types: ["behavioral", "leadership", "mixed"], text: "Tell me about a time you said no to an important stakeholder.", difficulty: 2 },
      { id: "pm-design", competency: "product_sense", types: ["case"], text: "Design a product that helps people practice for job interviews. Who's it for and what's the first version?", difficulty: 3 },
      { id: "pm-kill", competency: "prioritization", types: ["case", "leadership"], text: "How would you decide whether to shut down a feature that a vocal minority loves?", difficulty: 3 },
    ],
    curveballs: ["What's a product you use every day that you think is badly designed?"],
  }),
  consulting: pack({
    id: "consulting", label: "Consulting",
    roles: ["Consultant", "Associate", "Senior Consultant", "Engagement Manager"],
    competencies: [
      { key: "structuring", label: "Structuring", rubric: "MECE framework stated up front, hypothesis-led, prioritised branches." },
      { key: "quant", label: "Quantitative reasoning", rubric: "Clear assumptions, sanity-checks orders of magnitude, states the so-what." },
      { key: "client", label: "Client presence", rubric: "Synthesises crisply, handles pushback, recommends a decision." },
    ],
    questions: [
      { id: "con-case", competency: "structuring", types: ["case", "mixed"], text: "A regional coffee chain's profits have fallen twenty percent in two years while revenue is flat. How would you approach this?", difficulty: 3 },
      { id: "con-size", competency: "quant", types: ["case"], text: "Estimate the annual market for electric bike rentals in Chicago.", difficulty: 3 },
      { id: "con-client", competency: "client", types: ["behavioral", "mixed"], text: "Tell me about a time a client or senior stakeholder rejected your recommendation.", difficulty: 2 },
      { id: "con-lead", competency: "collaboration", types: ["behavioral", "leadership"], text: "Describe a time you led a team through a tight deadline.", difficulty: 2 },
    ],
    curveballs: ["Give me your recommendation in one sentence. Then tell me the biggest risk to it."],
  }),
  finance: pack({
    id: "finance", label: "Finance",
    roles: ["Financial Analyst", "Investment Banking Associate", "Private Equity Associate", "FP&A Manager"],
    competencies: [
      { key: "technicals", label: "Finance technicals", rubric: "Correct mechanics (valuation, three statements), explains intuition not just formulas." },
      { key: "judgement", label: "Investment judgement", rubric: "Clear thesis, key risks, what would change their mind." },
      { key: "detail", label: "Attention to detail", rubric: "Checks work, catches errors, explains controls." },
    ],
    questions: [
      { id: "fin-dcf", competency: "technicals", types: ["technical", "mixed"], text: "Walk me through a DCF, and tell me which assumption matters most.", difficulty: 2 },
      { id: "fin-3s", competency: "technicals", types: ["technical"], text: "Depreciation goes up by ten. Walk me through the three statements.", difficulty: 2 },
      { id: "fin-pitch", competency: "judgement", types: ["case", "mixed"], text: "Pitch me a company you'd invest in, and tell me why the market is wrong about it.", difficulty: 3 },
      { id: "fin-error", competency: "detail", types: ["behavioral"], text: "Tell me about a time you caught a significant error in a model or report.", difficulty: 2 },
    ],
    curveballs: ["What would make you sell the company you just pitched?"],
  }),
  research: pack({
    id: "research", label: "Research",
    roles: ["Research Scientist", "Postdoctoral Researcher", "UX Researcher", "Data Scientist"],
    competencies: [
      { key: "methods", label: "Research methods", rubric: "Justifies design choices, controls, sample size and limitations." },
      { key: "rigor", label: "Rigor & integrity", rubric: "Discusses confounds, negative results and reproducibility honestly." },
      { key: "translation", label: "Translating findings", rubric: "Explains significance to non-experts and what decision it informs." },
    ],
    questions: [
      { id: "res-project", competency: "methods", types: ["technical", "behavioral", "mixed"], text: "Walk me through your most significant research project. Why that design?", difficulty: 2 },
      { id: "res-null", competency: "rigor", types: ["behavioral", "technical"], text: "Tell me about a result that didn't replicate or didn't hold up. What did you do?", difficulty: 2 },
      { id: "res-explain", competency: "translation", types: ["mixed", "behavioral"], text: "Explain your work to me as if I were a board member with five minutes.", difficulty: 2 },
    ],
    curveballs: ["What's the weakest part of your own best paper?"],
  }),
  clinical: pack({
    id: "clinical", label: "Clinical",
    roles: ["Registered Nurse", "Physician Assistant", "Resident Physician", "Clinical Manager"],
    competencies: [
      { key: "patient_safety", label: "Patient safety", rubric: "Escalation, protocol, speaking up, documentation." },
      { key: "clinical_judgement", label: "Clinical judgement", rubric: "Prioritisation under pressure, differential reasoning, reassessment." },
      { key: "teamwork", label: "Interdisciplinary teamwork", rubric: "Clear handoffs, closed-loop communication, respect across roles." },
    ],
    questions: [
      { id: "cl-deteriorate", competency: "clinical_judgement", types: ["behavioral", "mixed", "case"], text: "Tell me about a time a patient deteriorated unexpectedly. What did you do in the first five minutes?", difficulty: 3 },
      { id: "cl-speakup", competency: "patient_safety", types: ["behavioral", "mixed"], text: "Describe a time you had to challenge a more senior colleague about patient safety.", difficulty: 3 },
      { id: "cl-handoff", competency: "teamwork", types: ["behavioral"], text: "How do you make sure nothing is lost in a handoff?", difficulty: 2 },
    ],
    curveballs: ["What would you do if you realised you'd made a medication error an hour ago?"],
  }),
  executive: pack({
    id: "executive", label: "Executive",
    roles: ["Director", "Vice President", "Chief of Staff", "General Manager", "C-level"],
    competencies: [
      { key: "strategy", label: "Strategy", rubric: "Clear choices, what was not done, link to market and capability." },
      { key: "org_building", label: "Building organisations", rubric: "Hiring, structure, culture changes with evidence of outcome." },
      { key: "exec_judgement", label: "Judgement under uncertainty", rubric: "Frames the decision, options, reversibility, and how it played out." },
    ],
    questions: [
      { id: "ex-strategy", competency: "strategy", types: ["leadership", "mixed", "case"], text: "What's the most consequential strategic choice you've made, and what did you give up?", difficulty: 3 },
      { id: "ex-org", competency: "org_building", types: ["leadership", "mixed"], text: "Tell me about an organisation you built or turned around. What did you change first?", difficulty: 3 },
      { id: "ex-bet", competency: "exec_judgement", types: ["leadership", "behavioral"], text: "Describe a bet you made with incomplete information. How did it turn out?", difficulty: 3 },
      { id: "ex-exit", competency: "org_building", types: ["leadership"], text: "Tell me about the hardest person you've had to move out of a role.", difficulty: 3 },
    ],
    curveballs: ["Your board wants a twenty percent cost cut in ninety days. Where do you start, and what don't you touch?"],
  }),
  government: pack({
    id: "government", label: "Government & Public Sector",
    roles: ["Policy Analyst", "Program Manager", "Public Administrator", "Foreign Service Officer"],
    competencies: [
      { key: "public_service", label: "Public service motivation", rubric: "Specific mission connection, understanding of constituents." },
      { key: "policy_analysis", label: "Policy analysis", rubric: "Stakeholders, trade-offs, evidence, implementation constraints." },
      { key: "integrity", label: "Integrity & ethics", rubric: "Recognises the dilemma, applies rules, escalates appropriately." },
    ],
    questions: [
      { id: "gov-policy", competency: "policy_analysis", types: ["case", "mixed"], text: "A city wants to reduce traffic deaths by half in five years. What would you recommend first, and why?", difficulty: 3 },
      { id: "gov-ethics", competency: "integrity", types: ["behavioral", "mixed"], text: "Tell me about a time you faced pressure to bend a rule.", difficulty: 2 },
      { id: "gov-stake", competency: "collaboration", types: ["behavioral", "leadership"], text: "Describe a time you brought together groups with conflicting interests.", difficulty: 2 },
    ],
    curveballs: ["What's a policy you personally disagree with that you'd still have to implement well?"],
  }),
};

export const DOMAIN_OPTIONS = Object.values(DOMAIN_PACKS).map((p) => ({ id: p.id, label: p.label }));

export const ROLE_TO_DOMAIN: Record<string, DomainId> = {
  "Software Engineer": "software",
  "Product Manager": "product",
  "Consultant": "consulting",
  "Finance": "finance",
  "Research": "research",
  "Clinical": "clinical",
  "Executive": "executive",
  "Government": "government",
};

export function getPack(id: string): DomainPack {
  return DOMAIN_PACKS[(id as DomainId)] ?? DOMAIN_PACKS.software;
}
