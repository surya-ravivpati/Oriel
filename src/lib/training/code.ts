/*
 * Coding exercises for the "implementation" competency. Correctness is decided only by running
 * the tests below (in the browser, in an isolated worker with a time limit); the model never
 * judges whether code is correct. It only reads the candidate's explanation of the approach.
 */

export interface CodeTest {
  name: string;
  args: unknown[];
  expected: unknown;
  /** An edge case (empty input, boundaries, unusual values); run on submit, not by "Run examples". */
  edge?: boolean;
}

export interface CodeSpec {
  language: "javascript";
  fn: string;
  starter: string;
  tests: CodeTest[];
  /** Expected cost, for the explanation's context (never shown before the attempt). */
  complexity: string;
}

export interface CodeResult {
  name: string;
  edge: boolean;
  pass: boolean;
  /** What the function returned (JSON) or the error it threw, cut short. */
  got: string;
}

export interface CodeSubmission { source: string; explanation: string; results: CodeResult[]; ranIn: "browser" }

const t = (name: string, args: unknown[], expected: unknown, edge = false): CodeTest => ({ name, args, expected, edge });

/** The problems. Each is its own situation, so a transfer is a genuinely different problem. */
export const CODE_PROBLEMS: { id: string; situation: string; difficulty: 1 | 2 | 3; text: string; spec: CodeSpec }[] = [
  {
    id: "k-dedupe", situation: "dedupe", difficulty: 1,
    text: "Write dedupe(items): return a new array with duplicates removed, keeping the first occurrence of each item, in order.",
    spec: { language: "javascript", fn: "dedupe", complexity: "O(n) time with a Set, O(n) space.", starter: "function dedupe(items) {\n  \n}",
      tests: [t("keeps first occurrences", [[3, 1, 3, 2, 1]], [3, 1, 2]), t("strings", [["b", "a", "b"]], ["b", "a"]), t("empty", [[]], [], true), t("case matters", [["a", "A", "a"]], ["a", "A"], true), t("already unique", [[1, 2, 3]], [1, 2, 3], true)] },
  },
  {
    id: "k-balanced", situation: "brackets", difficulty: 2,
    text: "Write isBalanced(s): return true if every bracket in the string, (), [] and {}, is closed in the right order.",
    spec: { language: "javascript", fn: "isBalanced", complexity: "O(n) time with a stack, O(n) space.", starter: "function isBalanced(s) {\n  \n}",
      tests: [t("nested", ["{[()]}"], true), t("wrong order", ["([)]"], false), t("with text", ["f(a[1])"], true), t("empty", [""], true, true), t("only opener", ["("], false, true), t("closer first", [")("], false, true)] },
  },
  {
    id: "k-merge", situation: "intervals", difficulty: 2,
    text: "Write mergeIntervals(intervals): merge overlapping [start, end] pairs and return them sorted by start.",
    spec: { language: "javascript", fn: "mergeIntervals", complexity: "O(n log n) time for the sort, O(n) space.", starter: "function mergeIntervals(intervals) {\n  \n}",
      tests: [t("overlapping", [[[1, 3], [2, 6], [8, 10]]], [[1, 6], [8, 10]]), t("unsorted input", [[[8, 10], [1, 3], [2, 4]]], [[1, 4], [8, 10]]), t("empty", [[]], [], true), t("touching ends merge", [[[1, 2], [2, 3]]], [[1, 3]], true), t("one contains another", [[[1, 10], [2, 3]]], [[1, 10]], true)] },
  },
  {
    id: "k-topk", situation: "frequency", difficulty: 2,
    text: "Write topK(words, k): return the k most frequent words, most frequent first; break ties alphabetically.",
    spec: { language: "javascript", fn: "topK", complexity: "O(n log n) time with a count map and a sort, O(n) space.", starter: "function topK(words, k) {\n  \n}",
      tests: [t("basic", [["a", "b", "a", "c", "b", "a"], 2], ["a", "b"]), t("ties alphabetical", [["pear", "fig", "pear", "fig", "kiwi"], 2], ["fig", "pear"]), t("k larger than distinct words", [["x", "y"], 5], ["x", "y"], true), t("empty", [[], 3], [], true), t("k is zero", [["x"], 0], [], true)] },
  },
  {
    id: "k-second", situation: "ranking", difficulty: 1,
    text: "Write secondLargest(nums): return the second largest distinct number, or null if there isn't one.",
    spec: { language: "javascript", fn: "secondLargest", complexity: "O(n) time in one pass, O(1) space.", starter: "function secondLargest(nums) {\n  \n}",
      tests: [t("basic", [[4, 9, 2, 7]], 7), t("negative numbers", [[-3, -1, -7]], -3), t("duplicates of the largest", [[5, 5, 3]], 3, true), t("all equal", [[2, 2, 2]], null, true), t("empty", [[]], null, true)] },
  },
  {
    id: "k-chunk", situation: "batching", difficulty: 1,
    text: "Write chunk(items, size): split the array into consecutive groups of at most size items.",
    spec: { language: "javascript", fn: "chunk", complexity: "O(n) time and space.", starter: "function chunk(items, size) {\n  \n}",
      tests: [t("even split", [[1, 2, 3, 4], 2], [[1, 2], [3, 4]]), t("remainder", [[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]), t("size larger than the array", [[1, 2], 5], [[1, 2]], true), t("empty", [[], 3], [], true), t("size one", [[7, 8], 1], [[7], [8]], true)] },
  },
];

/** Deep equality on JSON values, as the tests compare them. */
export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Check submitted results against the spec: one per test, by name, in order. */
export function validResults(spec: CodeSpec, results: CodeResult[]): boolean {
  return results.length === spec.tests.length && results.every((r, i) => r.name === spec.tests[i].name && r.edge === !!spec.tests[i].edge);
}

export function summarize(results: CodeResult[]) {
  const core = results.filter((r) => !r.edge), edge = results.filter((r) => r.edge);
  return { core: { pass: core.filter((r) => r.pass).length, of: core.length }, edge: { pass: edge.filter((r) => r.pass).length, of: edge.length }, failing: results.filter((r) => !r.pass) };
}

/** The code and explanation as they're stored with the attempt. */
export function asResponse(source: string, explanation: string): string {
  return `${explanation.trim()}\n\n\`\`\`javascript\n${source.trim()}\n\`\`\``;
}
