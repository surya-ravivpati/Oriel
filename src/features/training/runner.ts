"use client";

import type { CodeResult, CodeSpec, CodeTest } from "@/lib/training/code";

/*
 * Runs a candidate's JavaScript against the tests in an isolated, short-lived Web Worker:
 * no access to the page, cookies or storage, killed after a time limit, and built from a blob
 * (allowed by the CSP's worker-src) rather than eval. Each test is called separately so one
 * throw or wrong answer doesn't hide the others. Nothing here runs on the server.
 */

const LIMIT_MS = 2000;

function workerSource(source: string, fn: string, tests: CodeTest[]): string {
  return [
    "\"use strict\";",
    // Strip the most obvious ways out of the sandbox before the candidate's code runs.
    "self.importScripts = undefined; self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined;",
    source,
    ";",
    `const __tests = ${JSON.stringify(tests)};`,
    "const __out = [];",
    "const __show = (v) => { try { const s = JSON.stringify(v); return s === undefined ? String(v) : s.slice(0, 280); } catch { return String(v).slice(0, 280); } };",
    `const __fn = typeof ${fn} === "function" ? ${fn} : null;`,
    "for (const t of __tests) {",
    "  if (!__fn) { __out.push({ name: t.name, edge: !!t.edge, pass: false, got: \"the function isn't defined\" }); continue; }",
    "  try { const got = __fn(...JSON.parse(JSON.stringify(t.args))); __out.push({ name: t.name, edge: !!t.edge, pass: JSON.stringify(got) === JSON.stringify(t.expected), got: __show(got) }); }",
    "  catch (e) { __out.push({ name: t.name, edge: !!t.edge, pass: false, got: \"threw \" + String(e && e.message || e).slice(0, 200) }); }",
    "}",
    "postMessage(__out);",
  ].join("\n");
}

/** Run the given tests (all, or only the examples) and return a result per test, in order. */
export function runTests(spec: CodeSpec, source: string, which: "examples" | "all"): Promise<CodeResult[]> {
  const tests = which === "all" ? spec.tests : spec.tests.filter((t) => !t.edge);
  const fail = (got: string) => tests.map((t) => ({ name: t.name, edge: !!t.edge, pass: false, got }));
  return new Promise((resolve) => {
    let url = "";
    let worker: Worker;
    try {
      url = URL.createObjectURL(new Blob([workerSource(source, spec.fn, tests)], { type: "text/javascript" }));
      worker = new Worker(url);
    } catch {
      return resolve(fail("couldn't start the test runner"));
    }
    const done = (r: CodeResult[]) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(r); };
    const timer = setTimeout(() => done(fail(`didn't finish within ${LIMIT_MS / 1000} s (an endless loop?)`)), LIMIT_MS);
    worker.onmessage = (e: MessageEvent<CodeResult[]>) => {
      const got = Array.isArray(e.data) ? e.data : [];
      // Only results for these tests, in this order, count.
      done(tests.map((t, i) => (got[i] && got[i].name === t.name ? { name: t.name, edge: !!t.edge, pass: !!got[i].pass, got: String(got[i].got).slice(0, 280) } : { name: t.name, edge: !!t.edge, pass: false, got: "no result" })));
    };
    worker.onerror = (e) => { e.preventDefault(); done(fail(`a syntax or load error: ${e.message?.slice(0, 160) ?? "unknown"}`)); };
  });
}
