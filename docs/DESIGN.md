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

Three more tokens cover specific jobs:
- `ivory-press`: an ivory fill under the pointer.
- `olive-ground`: the ground under a chosen option.
- `divider-strong`: tracks and emphatic rules.

The landing page uses no other hues. In the app, the signals (good, warn, bad) describe measurements and nothing else; confidence is never coloured, because certainty isn't quality. The page declares `color-scheme: dark`; a selection is olive with ivory text. There is no pure black or white, no glow, no gradient.

**The build enforces this.** `@theme` switches off Tailwind's default palette, radii and type sizes (`--color-*`, `--radius-*`, `--text-*: initial`), so the only values that exist are Oriel's. A class like `bg-red-500`, `rounded-xl` or `text-2xl` generates nothing.

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

- **Two voices, two typefaces.** Everywhere a conversation appears (the landing preview, the Room, transcripts, Playback moments, rewrites, then-vs-now), the interviewer speaks in the serif and you speak in the sans. You can scan a transcript and see who is talking.
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
- **`Segmented`.** A single choice. Short options read as a row of words, and only the chosen one is drawn: a raised chip with a control edge. Options with a hint become a ruled list of radio rows. The same "chosen is raised" language covers the avatar studio's voices, shapes and accessories.
- **`Toggle`**, **`Field`.** Field edges use `control`, so they meet 3:1. Field text is at least 16px, so phones never zoom.
- **Status.** Words with a coloured dot (`Badge`), never a pill. Confidence is a neutral three-dot scale with its words (`ConfidenceMark`).
- **`SiteHeader`.**
  - It is transparent over the first screen, then ink at 95% with a hairline once you scroll.
  - The navigation appears from 1024px. Below that, a disclosure menu takes over: focus moves in, Escape closes it and returns focus, and the page behind becomes inert and stops scrolling.
- **Skip link.** Every marketing page starts with "Skip to content", which leads to a focusable `<main>`.

## The interviewers (the avatar system)

The six interviewers are Oriel's identity and are never redrawn by hand: Maya, Daniel, Priya, Tom, Eleanor and Sam.

- **What they're made of.** Each is an abstract face (one of eight shapes, ten colours, six accessories) with two capsule eyes and no mouth. They're drawn by `components/avatar/bot/` and animated by `BotAvatar`: blinks, saccades, listening nods, and the voice light that breathes while they speak. People can rename, restyle and re-voice any of them in the studio.
- **Presenting them.** The rule is to stand them on the page: the face and its own floor shadow, generous space, and no box.
  - **Live.** `InterviewerStage` uses the real engine wherever an interviewer is presented on a page: Home, the practice ticket, the Room lobby, the ladder, sign-in and the 404. It only animates on screen in a visible tab, and holds still under reduced motion.
  - **Choosing.** `BotStill` draws them where they are chosen between. The chosen one is lit (`surface-1`), never outlined.
  - **On the landing page.** The preview's interviewer is the real engine, with a still rendered by that engine beneath it until the canvas paints.
- **The mark.** The logo, the loader and the favicon are a vector reduction of the Classic interviewer, computed from the renderer's own outline, eye proportions and colours (`components/brand/Interviewer.tsx`). They can't drift apart.

## App pages

- **Frame.** Every app page sits on the same frame and grid as the marketing pages, under a bar whose mark shares the content's edge.
- **Header.** A page opens with its title (`display-l`) and a lead (`body-l`, 20px below). There is no eyebrow repeating the navigation.
- **Sections.** A section's title sits in the margin (columns 1–3) with its content from column 4, as a document's would. Paired content splits 7 / 5.
- **Boxes.** Boxes are for real objects only: a form, a recording, a dialog, the session ticket.
- **Numbers.** No page shows big-number metric rows. A measurement sits in a table with its target, baseline and change, and a trend is drawn small, in the row. The one exception is a drill's result, which is the single number that page exists to give.
- **States.** A branded 404, an error page with Try again, and a loading state that appears only after 400ms.

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
- Glow backgrounds.
- Coloured side-stripe borders, on quotes, callouts or anything else.
- Identical icon-card grids.
- Big-number metric rows, or the same data summarised twice.
- Uppercase tracked micro-labels, or an eyebrow that repeats the navigation.
- A box around the interviewer.
- Stock photography, or an invented recording presented as real.
- A submit button that is disabled without saying why.

## The two screens that define Oriel

- **The Room** (`features/room/Room.tsx`):
  - A session bar shows the role, the recording (a still dot and the word) and the time.
  - Then the interviewer, then the conversation: who is speaking and the question you're answering, set in the serif once it has been asked.
  - On wide screens a rail lists the questions so far, and nothing else.
  - The controls are a quiet toolbar. Shortcuts (Space, M, C, T) are shown inside the controls, the active toggle is filled, and the only coloured control is End.
  - With no camera, the lobby shows the interviewer who is waiting, not an empty frame.
- **The report** (`features/playback/PlaybackView.tsx`) reads as a professional assessment, in this order:
  1. The session in words, and the overall assessment as its title.
  2. Where you stand: each part of the Read as on-target ticks, with your baseline as a small table. Beside it, numbered next steps, the drill to do, and what worked.
  3. The moments in your recording. With no recording, the timeline remains and a sentence replaces the empty frame.
  4. Lessons.
  5. Every measure, grouped by part, with its range, target and confidence.
  6. Your weakest answer, rewritten, and then vs now.
  7. The transcript, in two voices.
