# Oriel design system

Oriel is an interview studio: a quiet room where you practise a hard conversation, then read it back with notes in the margin. The interface borrows from editorial print and the recording studio, not from SaaS dashboards. Tokens live in `src/app/globals.css`; components in `src/components/ui`, `src/components/brand` and `src/components/marketing`.

## Colour: ink, surfaces, ivory, stone, olive

| Role | Token | Value | Contrast on ink / surface-1 / surface-2 |
|---|---|---|---|
| The page | `ink` | `#151515` | |
| Bands, the preview frame, the Room's stage | `surface-1` | `#20201E` | |
| Raised within a surface; menus | `surface-2` | `#272622` | |
| Headlines, key content, the primary action, focus | `ivory` | `#F5F2EB` | 16.3 / 14.6 / 13.6 |
| Running and secondary text | `stone` | `#B7B0A4` | 8.5 / 7.6 / 7.0 |
| A third tier, used sparingly | `stone-dim` | `#948E84` | 5.6 / 5.0 / 4.7 |
| Olive as text, a mark or a thin indicator | `olive-light` | `#8C957A` | 5.8 / 5.2 / 4.8 |
| Olive fills and decoration, never text | `olive` | `#555C4A` | 2.6 |
| Hairlines | `divider` | ivory at 12% | 1.4 (decorative) |
| The visible edge of a control | `control` | ivory at 40% | 3.5 / 3.5 / 3.4 |

The landing page uses no other hues. In the app, the signals (good, warn, bad) describe measurements and nothing else. Legacy names (`ink-950`…`ink-500`, `mist-*`, `lume*`, `line*`, `accent*`) map onto these values, so existing pages read the new palette. The page declares `color-scheme: dark`; a selection is olive with ivory text. There is no pure black or white, no glow, no gradient.

## Type: three faces, one job each

| Face | Used for |
|---|---|
| Newsreader (serif, with optical sizes) | Oriel's voice: headlines, section statements, the interviewer's lines. `font-optical-sizing: auto` selects the display cut at headline sizes. |
| Schibsted Grotesk | Your words and the interface: answers, paragraphs, labels, buttons, navigation. |
| IBM Plex Mono | Evidence only: timecodes, note numbers, measurements in the app. |

The scale is fluid and exposed as `text-*` utilities:

| Token | Size | Use |
|---|---|---|
| `display-xl` | 40 → 104px | The H1 only |
| `display-l` | 32 → 56px | Section statements |
| `display-m` | 22 → 30px | Spoken lines |
| `body-l` | 18 → 20px | Leads |
| `body` | 16 → 17px | Running text |
| `ui` | 14 → 15px | Labels, buttons, navigation |
| `meta` | 12 → 13px | Captions, small print |

Nothing is set below 12px, and body text on a phone is at least 16px.

- **Italics.** One italic phrase, and it is always *the room*, the brand's subject: in the H1 and in the statement that answers it. Italic is never used for emphasis anywhere else.
- **Line breaks.** Headings balance their lines; running text avoids a last word alone (`text-wrap: pretty`). Non-breaking spaces keep short phrases together ("the room", "in it", "No card required").
- **Hanging quotes.** Opening quotes hang in the margin (`.hang` for the serif, `.hang-sans` for the sans), so quoted lines keep the edge of their speaker's label.
- **Measure.** Running text sits at 45–75 characters a line.
- **Typographic details.** Curly quotes and apostrophes, sentence case, no em dashes in copy. `font-synthesis: none` rules out faux bold and faux italic.
- **Font loading.** Faces are self-hosted by `next/font`. Only the first screen's faces are preloaded: the serif roman and italic for the headline, and the sans for its paragraph.

## Layout: the frame, the grid, the spine

- **Frame.** `.frame` holds 1240px of content, with gutters of `clamp(20px, 5vw, 64px)`.
- **Grid.** `.page-grid` has 4 columns with 16px gaps on phones, 8 columns with 24px gaps from 640px, and 12 from 1024px.
- **The spine.** Statements hold column 1. Whatever supports them (a lead, an exhibit, the notes, the closing action) starts at column 7 on desktop and column 3 on tablets. The hero copy, the preview's conversation, each section's lead or exhibit, and the footer's directory all share this edge. Rows of four (steps, plans) land on the same grid lines.
- **Component spacing.** Components use the 4px scale: 4, 8, 12, 16, 24, 32, 48, 64.
- **Page rhythms.** The page itself uses three named rhythms:
  - `section`: 64 → 128px between chapters.
  - `group`: 48 → 80px from a section's opening to its body.
  - `hero`: 32 → 64px from the header to the headline.
- **Spacing follows relatedness.** The more related two things are, the tighter they sit. In the hero, the action and its small print are 12px apart, the copy and the action 24px, the headline and the copy 32px, and the copy and the preview 48px.
- **Anchors.** `scroll-padding-top` keeps an anchored section clear of the 64px header.

## Surfaces

Each element gets one separation method: a hairline, a fill or space, never two. A band (`surface-1`) carries a whole section; rules separate lists and tables.

There are three radii: control 6px, button 10px and panel 16px. The app's legacy `rounded-*` classes are remapped to 3–14px.

Only things that float (menus, dialogs) get a shadow, `shadow-sheet`. There is no glass.

## Components

- **Primary action.**
  - Ivory fill, ink text, 10px radius.
  - 44px tall on desktop and 48px on touch; full width under 480px.
  - One per view.
  - A transparent border keeps its shape in forced-colours mode.
  - When pressed it scales to 0.97 over 120ms, eased out.
- **Secondary action:** a `control` outline with ivory text.
- **Text link:** stone, with a 1px underline offset 0.2em; ivory on hover.
- **Focus:** a 2px ivory outline offset 2px on every interactive element. Being an outline, it survives forced colours.
- **`Interviewer`** (`components/brand/Interviewer.tsx`) is the face. One inline SVG serves as the logo at 24px, the loading state (`Thinking`) and the preview's interviewer.
  - It has three states: idle, listening and speaking.
  - It blinks only after hydration, so server and client markup match.
  - It holds still under reduced motion.
- **`SiteHeader`.**
  - It is transparent over the first screen, then ink at 95% with a hairline once you scroll.
  - The navigation appears from 1024px. Below that, a disclosure menu takes over: focus moves in, Escape closes it and returns focus, and the page behind becomes inert and stops scrolling.
- **Skip link.** Every marketing page starts with "Skip to content", which leads to a focusable `<main>`.

## Motion

Motion explains time; it is never decoration.

- **Timing.**
  - Durations: press 120ms, state change 200ms, panel 320ms, entrance at most 600ms.
  - `--ease-enter`, a strong ease-out, is for anything arriving and for press feedback.
  - `--ease-state`, an ease-in-out, is for things moving on screen.
- **Properties.** Only `opacity` and `transform` animate. Everything is visible without JavaScript; nothing waits at opacity 0 for a script.
- **Allowed:**
  - the interviewer's blink and speaking lift
  - captions arriving word by word
  - the preview's loop
  - menus entering (`@starting-style`)
  - a playhead
  - a microphone meter
- **Not used:** scroll-triggered reveals, parallax, page transitions, bounce.
- **Reduced motion.** Under `prefers-reduced-motion`, the preview shows a still, composed scene with no play control, and transitions collapse to instant.
- **Hover.** Hover styles apply only where hover exists, which is Tailwind's default.
- **Where the motion library loads.** `motion/react` loads only in the signed-in app and onboarding, through `MotionProvider` in their layouts. It never loads on the landing page.

## The landing page

1. **Hero:** the statement, the copy and action on the spine, then the sample session.
2. **How it works:** a statement and its lead, then four steps on one rule.
3. **The interview:** the statement stays in view beside a sample exchange and the pressure levels.
4. **The Read:** a band with your answer and Oriel's notes in the margin, then measures with their targets and confidence.
5. **Privacy:** four statements taken from the policy.
6. **Pricing:** four plans as subgrids, so every inclusion lines up across them.
7. **The close:** "Walk in ready."

Every sample is labelled as one, and every claim comes from the product.

**The preview** (`components/marketing/InterviewPreview.tsx`) is a "Sample session" for a product manager's behavioral round.

- It has no recording dot, no candidate thumbnail and no fake controls in the tab order.
- It renders complete on the server.
- With motion allowed, it plays one loop: the question, an answer at about 150 words a minute, a follow-up, then a rest.
- The loop pauses on hover, on focus, when off-screen, in a hidden tab, and with its pause button.
- The answer scrolls like captions, by transform and one whole line at a time, so the loop causes no layout shift.
- Screen readers get the whole exchange as text.

## Copy

Short, specific, sentence case. There are no em dashes in copy; in tables a dash stands for "not included", and screen readers hear "Not included". Don't restate a label in the heading beneath it.

## Never

- Gradient text.
- Glassmorphism.
- Coloured side-stripe borders.
- Glow backgrounds.
- Identical icon-card grids.
- Hero-metric rows.
- Uppercase tracked micro-labels.
- Stock photography on the landing page.

## The two screens that define Oriel

- **The Room** (`features/room/Room.tsx`):
  - A session bar shows the role, the recording and the time.
  - Then comes the interviewer, then the conversation: who is speaking, and the question you're answering, set in the serif once it has been asked.
  - A rail lists the questions so far, who is interviewing and the keyboard shortcuts (Space, M, C, T).
  - The controls sit in one quiet bar; the only coloured control is End.
- **The report** (`features/playback/PlaybackView.tsx`) reads as a document, in this order:
  1. Where you stand: each part of the Read as on-target ticks, beside numbered next steps.
  2. The moments in your recording.
  3. Lessons.
  4. Every measure, grouped by part, with its range and confidence.
  5. Your weakest answer, rewritten.
  6. The transcript.
