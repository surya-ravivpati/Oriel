"use client";
import { useState } from "react";
import { PRESSURE_DESCRIPTIONS, PRESSURE_LABELS, pressurePolicy, type PressureLevel } from "@/lib/interview/pressure";
import { PERSONAS } from "@/lib/interview/personas";

/** Live readout of the actual pressure policy the interviewer runs on. */
export function PressureDemo() {
  const [level, setLevel] = useState<PressureLevel>(3);
  const p = pressurePolicy(level, PERSONAS.hiring_manager);
  const rows: [string, string][] = [
    ["Cuts in on a long answer after", p.interruptAfterSec ? `${p.interruptAfterSec}s` : "never"],
    ["Cuts in on a vague answer after", p.vagueInterruptAfterSec ? `${p.vagueInterruptAfterSec}s` : "never"],
    ["Silence before the next question", `${(p.preResponseSilenceMs / 1000).toFixed(1)}s`],
    ["Follow-ups on one question", `up to ${p.maxFollowUpDepth}`],
    ["Tests the numbers you give", `${Math.round(p.numericProbeRate * 100)}% of the time`],
    ["Reassurance", p.reassurance > 0.6 ? "frequent" : p.reassurance > 0.3 ? "occasional" : p.reassurance > 0.1 ? "rare" : "none"],
  ];
  return (
    <div className="rounded-3xl border hairline bg-white/[0.02] p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-3xl">{PRESSURE_LABELS[level]}</p>
        <p className="font-mono text-xs text-mist-400">pressure {level}/5</p>
      </div>
      <p className="mt-2 text-sm text-mist-300 min-h-10">{PRESSURE_DESCRIPTIONS[level]}</p>
      <input aria-label="Pressure" type="range" min={1} max={5} step={1} value={level} onChange={(e) => setLevel(Number(e.target.value) as PressureLevel)} className="dial mt-6 w-full" />
      <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-mist-400"><span>Warm-up</span><span>Stress test</span></div>
      <dl className="mt-8 divide-y divide-white/[0.06]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-3 text-sm">
            <dt className="text-mist-300">{k}</dt>
            <dd className="font-mono text-mist-100 tabular transition-all">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
