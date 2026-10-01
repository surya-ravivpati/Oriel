# Read validation — speech metrics

Generated 2026-09-30 by `npm run validate:speech`. 16 labelled clips (8 accents × fluent/disfluent scripts).

Ground truth comes from construction: a known silence before the first word, a known inserted pause, and a known script. Measurements come from the production code paths (10 Hz frame analysis, Gemini transcription, the Read).

**Pass criteria** (set before running): pace within ±12%, filler count within ±1, recovery (time to first word) within ±250 ms, inserted pause measured within ±350 ms.

| Measure | Error | Agreement |
| --- | --- | --- |
| Pace (WPM) — mean abs. error | 5.2% | 16/16 within ±12% |
| Fillers — mean abs. count error | 0.38 | 13/16 within ±1 |
| Recovery — mean abs. error | 43 ms | 16/16 within ±250 ms |
| Inserted pause — mean abs. error | 26 ms | 16/16 within ±350 ms |

## By accent

| Accent | Script | Pace truth → measured | Fillers truth → measured | First word truth → measured | Pause truth → measured |
| --- | --- | --- | --- | --- | --- |
| US English | fluent | 191 → 180 wpm | 0 → 0 | 1086 → 1085 ms | 1557 → 1580 ms |
| US English | disfluent | 151 → 148 wpm | 6 → 6 | 1837 → 1785 ms | 2466 → 2480 ms |
| British English | fluent | 183 → 171 wpm | 0 → 0 | 2839 → 2785 ms | 1582 → 1580 ms |
| British English | disfluent | 174 → 166 wpm | 6 → 6 | 4269 → 4285 ms | 2622 → 2680 ms |
| Indian English | fluent | 179 → 168 wpm | 0 → 0 | 1141 → 1085 ms | 1531 → 1580 ms |
| Indian English | disfluent | 178 → 164 wpm | 6 → 4 | 1915 → 1885 ms | 2791 → 2780 ms |
| Nigerian English | fluent | 159 → 150 wpm | 0 → 0 | 2967 → 2885 ms | 1560 → 1580 ms |
| Nigerian English | disfluent | 160 → 155 wpm | 6 → 6 | 4361 → 4285 ms | 2627 → 2580 ms |
| Spanish-accented English | fluent | 165 → 155 wpm | 0 → 0 | 1152 → 1085 ms | 1595 → 1580 ms |
| Spanish-accented English | disfluent | 161 → 149 wpm | 6 → 4 | 1881 → 1885 ms | 2745 → 2780 ms |
| Mandarin-accented English | fluent | 166 → 157 wpm | 0 → 0 | 2945 → 2885 ms | 1586 → 1580 ms |
| Mandarin-accented English | disfluent | 153 → 141 wpm | 6 → 4 | 4422 → 4385 ms | 2695 → 2680 ms |
| Australian English | fluent | 178 → 168 wpm | 0 → 0 | 1137 → 1085 ms | 1639 → 1680 ms |
| Australian English | disfluent | 186 → 180 wpm | 6 → 6 | 1814 → 1785 ms | 2725 → 2680 ms |
| Southern US English | fluent | 167 → 158 wpm | 0 → 0 | 2914 → 2885 ms | 1449 → 1480 ms |
| Southern US English | disfluent | 184 → 180 wpm | 6 → 6 | 4329 → 4285 ms | 2572 → 2580 ms |

## Accent parity

| Accent | Pace abs. error | Filler abs. error | Recovery abs. error |
| --- | --- | --- | --- |
| US English | 3.6% | 0.0 | 27 ms |
| British English | 5.4% | 0.0 | 35 ms |
| Indian English | 6.9% | 1.0 | 43 ms |
| Nigerian English | 4.3% | 0.0 | 79 ms |
| Spanish-accented English | 6.7% | 1.0 | 36 ms |
| Mandarin-accented English | 6.7% | 1.0 | 49 ms |
| Australian English | 4.2% | 0.0 | 41 ms |
| Southern US English | 3.7% | 0.0 | 37 ms |

## Findings

- **Pace** read ~20% slow in the first run because speaking time was estimated as voiced time × 1.25; it is now the answer span minus pauses ≥ 0.7 s.
- **Pauses** were measured ~170 ms short — the voice detector's on/off hysteresis. `findPauses` now corrects for the mechanism.
- **Fillers**: transcription dropped short mid-sentence "uh"/"um" for Indian English, Spanish-accented English, Mandarin-accented English (6→4, 6→4, 6→4). The Read now presents filler counts as a minimum; because progress compares each person with their own earlier sessions, a consistent undercount does not distort improvement. An acoustic filled-pause detector would close this gap.
- Pitch is no longer computed on quiet tail frames the detector still marks as voiced (spurious harmonics inflated vocal variety).

## Limitations

- Voices are synthetic (Gemini TTS). Accents are as directed to the model and were not verified by native listeners.
- Synthetic speech is cleaner than a laptop microphone in a real room; real-world error will be higher.
- This complements — it does not replace — the plan's validation against human-coded video of real sessions (30 sessions), which is still owed.
- Accent is never scored by Oriel. This check exists to make sure measurements do not drift by accent.
