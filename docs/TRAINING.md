# Deliberate practice (Train)

Oriel's interview Room tells you what happened. Train is for getting better at one skill so that it holds on questions you haven't seen. One loop trains one competency in one interview type.

## The loop

1. **Attempt.** One question, answered cold (typed, or dictated with "Speak instead"). No rubric, hints or skill name are shown.
2. **Diagnosis.** The answer is assessed against the competency's rubric. One note: what was seen (quoted from the answer), why it matters, and the principle to apply next. Further notes are behind "More notes".
3. **Retry.** The same question, answered again in your own words. The note gives a principle, never a model answer. If the targeted point still isn't shown, a focused question is added, then a partial outline. There are at most two retries.
4. **Transfer.** A different question, in a different situation, that needs the same skill. It isn't announced.
5. **Review.** Scheduled when the loop ends: in 3 days if it transferred, 1 day if it didn't; after a review, 14 days if it held, 2 if not. Reviews surface on Train and Home on the next visit (nothing runs in the background) and use another question again.

Three outcomes are stored and shown separately, never merged into a score: improved on the same question, carried to a new question, held after a delay. "Not assessed" (too little to judge, a broken transcript, never tried) is its own state and never counts as a failure.

## Who decides what

- `lib/training/engine.ts` decides, deterministically: which criterion to train (the evaluator proposes; the engine accepts only a real, unshown criterion), when to retry, add scaffolding, move to transfer, finish, and when to review. Pure functions, unit-tested.
- `lib/training/evaluate.ts` judges. It is treated as fallible:
  - Pre-checks first: an answer under 15 words, or a voice transcript with repeated "(inaudible)", isn't judged; it is "not enough evidence".
  - The model returns a level per criterion with a verbatim excerpt. Every excerpt is checked against the answer; one that isn't there is dropped and confidence becomes low. "Clearly shown" without a real excerpt becomes "can't tell".
  - Unknown criteria are dropped; missing ones are "can't tell"; duplicates reject the output.
  - Malformed output is retried once. After that, or on a timeout or rate limit, a pattern evaluator stands in, labelled as such and with low confidence.
  - It never judges personality, intelligence, confidence, accent or tone, and never rewards length.
- `lib/training/generate.ts` writes a transfer question only when the curated bank has nothing left in a new situation. Its output is rejected if it paraphrases a used question, and it is stored as unvalidated: never added to the bank.

## Data

Four tables (migration `drizzle/0004_training.sql`, which only creates tables):

| Table | Holds |
|---|---|
| `training_loops` | One loop: competency, interview type, rubric version, stage, target criterion, scaffolding, the question being answered, outcomes |
| `training_attempts` | Each answer, with the exact question text and whether it was curated or generated. A per-submission client key makes resubmits idempotent. |
| `training_evaluations` | One per attempt: evaluator, rubric version, the criteria as judged (labels included), excerpts, confidence, the note, limitations |
| `training_reviews` | Scheduled reviews and the loops that answered them |

Every query is scoped to the signed-in user; anyone else's loop is "not found". Deleting a loop deletes its attempts, evaluations and review; deleting the account deletes everything.

**Rubric changes.** Bump a competency's `version` when a criterion's meaning changes. Old evaluations keep their version and their criteria as judged, so history isn't rewritten.

## Adding to it

- A competency: `lib/training/competencies.ts`. Criteria must be observable in the words of an answer, with a principle, two levels of scaffolding and a reason it matters.
- Questions: `lib/training/questions.ts`. Each needs a `situation`. Every competency needs at least three curated questions in distinct situations for each interview type it is offered in; a unit test enforces this.

## Limits (honest)

- The learning hypothesis (that retries, transfer and spaced reviews improve real interview performance) is not established by this code. The data model records what's needed to test it.
- Assessment reads a transcript; reasoning that was sound but not said is under-credited, and hypothetical answers to past-tense questions are judged on what they say.
- Technical answers are judged on reasoning about trade-offs only. No code is run, and nothing is declared correct.
- Voice input is the browser's dictation (Chrome, Edge, Safari); the interviewer's question is shown, not spoken.
- The curated bank is small (24 questions across 7 competencies). Generated transfer questions are unvalidated.
