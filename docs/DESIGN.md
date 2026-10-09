# Oriel design system

Oriel is an interview studio with an editor attached: you interview, then you read your take with notes in the margin. The interface borrows from that, not from SaaS dashboards. Tokens live in `src/app/globals.css`; components in `src/components/ui`.

## Type: three voices, one job each

| Face | Token | Used for |
|---|---|---|
| Newsreader (serif) | `font-display`, `text-hero` / `text-display` / `text-title` | Words spoken in the room (the interviewer's lines, your answers, transcripts, quotes) and Oriel's own headlines |
| Schibsted Grotesk | `font-sans` (default) | Interface: labels, buttons, navigation, explanations |
| IBM Plex Mono | `font-mono` | Evidence: timecodes, measurements, counts, dates |

If a number is a measurement, it is mono. If a sentence was or could be said aloud, it is serif. Emphasis in a headline is italic, never a colour or a gradient.

## Colour: ink, ivory, stone, olive

| Role | Token | Hex |
|---|---|---|
| Page | `ink-950` (Ink) | `#151515` |
| Frames, navigation, the Room's stage | `ink-900` (Surface) | `#20201E` |
| Fields, raised controls | `ink-700` | `#2A2A27` |
| Hairline rules | `line`, `line-strong` | `#2B2B28`, `#3B3A36` |
| Primary text, the primary action | `mist-100` (Ivory) | `#F5F2EB` |
| Secondary text | `mist-300` (Stone) | `#B7B0A4` |
| Marks, focus, the current place, a chosen option | `lume` / `accent` (olive, lit) | `#A3AB8B` |
| Borders on chosen things, quiet details | `lume-deep` / `accent-deep` (Deep olive) | `#555C4A` |
| Ground under a chosen thing | `bronze` / `accent-ground` | `#23261D` |

`lume` and `bronze` are legacy names kept so existing pages read the new values; new code can use the `accent*` names. Ivory is the one high-contrast action per view (a primary button). Olive marks: a word underlined or struck in a transcript, a timeline tick, the current nav item, a selected option. Signals (good, warn, bad) are muted to sit with the palette and only describe measurements. There are no glows.

## The mark

The logo is the interviewer's face: an ivory rounded square with two upright eyes, the same geometry the avatar is drawn from (`LogoMark` in `components/ui/Logo.tsx`, `src/app/icon.svg`). With `blink` it is Oriel's loading state (`Thinking`), so waiting looks like the interviewer, not a spinner.

## Structure

- **Rules, not boxes.** Sections and lists are separated by 1px hairlines. A box (`Card`, rounded 8px, hairline frame, no fill) is for a real object: a video frame, a form, a menu, a dialog.
- **The margin.** Landing and Home use a 12-column grid: a quiet label in the left three columns, content in the remaining nine (`Section` in `components/marketing/Section.tsx`, `Band` in the Home page).
- **Radii** are 3–14px (`rounded-sm` … `rounded-3xl` are remapped). Only switches and status dots are round.
- **Status** is words with a coloured dot (`Badge`), never a pill.
- **One elevation** (`shadow-sheet`), only for things that float: menus and dialogs.

## Components

- `Button`: rectangular, 6px radius. `primary` (ivory) once per view; `secondary` is outlined; `ghost` is text. Loading shows a spinner and sets `aria-busy`.
- `TextLink`: ivory, underlined in olive.
- `Input` / `Textarea` / `Select`: hairline frame on Surface, olive border on focus, red border when `aria-invalid`.
- `Segmented`: a row of square-shouldered options, or tiles when options carry a hint. The chosen one is outlined in olive on an olive ground.
- `Toggle`: the only pill-shaped control.
- `Modal`: Surface, 10px radius, one shadow, no blur.

## Motion

Motion explains time; it is never decoration.

- Allowed: the interviewer's face, mouth and blink, captions arriving word by word, notes appearing after the line they annotate, a timeline playhead moving, the microphone level, a step sliding in during onboarding, menus and dialogs entering.
- Not used: scroll-triggered fade-ups, parallax, glows, page transitions, bounce or spring.
- Easing is exponential ease-out (`--ease-out-expo`). Only `transform` and `opacity` animate. Everything respects `prefers-reduced-motion`.

## Copy

Short, specific, in sentence case. No em dashes in interface copy: use a comma, colon or full stop. Don't restate a label in the heading beneath it.

## Never

Gradient text, glassmorphism, coloured side-stripe borders, glow backgrounds, identical icon-card grids, hero-metric rows, uppercase tracked micro-labels.

## The two screens that define Oriel

- **The Room** (`features/room/Room.tsx`): a session bar (role, recording, time), the interviewer, then the conversation: who is speaking and the question you're answering, set in the serif once it has been asked. A rail lists the questions so far, who is interviewing and the keyboard shortcuts (Space, M, C, T). Controls sit in one quiet bar; the only coloured control is End.
- **The report** (`features/playback/PlaybackView.tsx`): reads as a document. Where you stand (each part of the Read as on-target ticks) beside numbered next steps, then the moments in your recording, lessons, every measure grouped by part with its range and confidence, your weakest answer rewritten, and the transcript.
