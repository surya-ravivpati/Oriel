# Oriel design system

Oriel is an interview studio: a quiet room where you practice a hard conversation, then read it back with notes in the margin. The interface borrows from editorial print and the recording studio, not from SaaS dashboards. Tokens live in `src/app/globals.css`; components in `src/components/ui`, `src/components/brand` and `src/components/marketing`.

The test for every element is whether it earns its place: one idea per section, one filled action per view, one way of separating things at a time, and nothing added to make a plain thing look designed.

## Color: ink, surfaces, ivory, stone, olive

| Role | Token | Value | Contrast on ink / surface-1 / surface-2 |
|---|---|---|---|
| The page | `ink` | `#151515` | |
| The Room's stage, the session ticket, a chosen option | `surface-1` | `#20201E` | |
| Raised within a surface; menus | `surface-2` | `#272622` | |
| Headlines, key content, the primary action, focus | `ivory` | `#F5F2EB` | 16.3 / 14.6 / 13.6 |
| Running and secondary text | `stone` | `#B7B0A4` | 8.5 / 7.6 / 7.0 |
| A third tier, used sparingly | `stone-dim` | `#948E84` | 5.6 / 5.0 / 4.7 |
| Olive as text or a thin indicator | `olive-light` | `#8C957A` | 5.8 / 5.2 / 4.8 |
| Olive fills, never text | `olive` | `#555C4A` | 2.6 |
| Hairlines | `divider` | ivory at 12% | 1.4 (decorative) |
| The visible edge of a control | `control` | ivory at 40% | 3.5 / 3.5 / 3.4 |

Three more tokens cover specific jobs:
- `ivory-press`: an ivory fill under the pointer.
- `olive-ground`: the ground under the transcript line that is playing, and under a file dragged over its drop zone.
- `divider-strong`: tracks and emphatic rules.

**Olive is a signal, not a decoration.** It marks the chosen option (a radio, a switch, a checkbox), the current place (the active nav item, "You're on rung 2", "In your plan"), a marked phrase in a Read, and a blank to fill in a rewrite. It is never the border of a card, a list or a figure, and never a numeral's color for its own sake.

The landing page uses no other hues. In the app, the signals (good, warn, bad) describe measurements and nothing else; confidence is never colored, because certainty isn't quality. A routine status ("Read ready", "Active") is neutral, and only a status that needs attention ("Unfinished", "Needs retry") is colored. The page declares `color-scheme: dark`; a selection is olive with ivory text. There is no pure black or white, no glow, no gradient, no blur.

**The build enforces this.** `@theme` switches off Tailwind's default palette, radii and type sizes (`--color-*`, `--radius-*`, `--text-*: initial`), so the only values that exist are Oriel's. A class like `bg-red-500`, `rounded-xl` or `text-2xl` generates nothing.

## Type: two faces

| Face | Used for |
|---|---|
| Newsreader (serif, with optical sizes) | Oriel's voice: headlines, page and section titles, names, and every line an interviewer speaks. `font-optical-sizing: auto` selects the display cut at headline sizes. Loaded in roman only. |
| Schibsted Grotesk | Your words and the interface: answers, paragraphs, labels, buttons, navigation, and every number. |

There is no third face. Measurements, counts and timecodes are set in the sans with its ordinary (proportional) figures, because Schibsted's tabular figures widen the point and the colon ("2 . 1", "00 : 10"). The one exception is the Room's running clock, whose digits are tabular so it doesn't jitter while its colon stays proportional (`Clock` in `Room.tsx`). Units read the same way everywhere: `151 wpm`, `2.1 s`, `0.0/min`.

The scale is fluid and exposed as `text-*` utilities. Each step is at least 1.25× the next, so hierarchy comes from size and never from a second weight or an italic:

| Token | Size | Use |
|---|---|---|
| `display-xl` | 40 → 68px | The landing H1, and its closing line |
| `display-l` | 30 → 44px | Page and section titles |
| `display-m` | 20 → 26px | Spoken lines, names, the parts of a form |
| `body-l` | 18 → 20px | Leads |
| `body` | 16 → 17px | Running text |
| `ui` | 14 → 15px | Labels, buttons, navigation |
| `meta` | 12 → 13px | Captions, small print |

Nothing is set below 12px, and body text on a phone is at least 16px.

- **Two voices, two typefaces.** Everywhere a conversation appears (the landing interviewer, the Room, transcripts, Playback moments, rewrites, then-vs-now), the interviewer speaks in the serif and you speak in the sans. You can scan a transcript and see who is talking.
- **No italics.** Oriel sets nothing in italic, including the brand's own phrase. Emphasis comes from size, color and position. The italic font file isn't loaded.
- **Line breaks.** Headings balance their lines; running text avoids a last word alone (`text-wrap: pretty`). Non-breaking spaces keep short phrases together ("the room", "in it", "No card required").
- **Hanging quotes.** Opening quotes hang in the margin (`.hang` for the serif, `.hang-sans` for the sans), so quoted lines keep the edge of their speaker's label.
- **Measure.** Running text sits at 45–75 characters a line.
- **Typographic details.** Curly quotes and apostrophes, sentence case, US spelling, no em dashes in copy. `font-synthesis: none` rules out faux bold and faux italic.
- **Font loading.** Faces are self-hosted by `next/font`, Latin only, swapped with metric-matched fallbacks.

## Layout: the frame, the grid, the opening

- **Frame.** `.frame` holds 1240px of content, with gutters of `clamp(20px, 5vw, 64px)`.
- **Grid.** `.page-grid` has 4 columns with 16px gaps on phones, 8 columns with 24px gaps from 640px, and 12 from 1024px.
- **The opening.** A section or page opens the same way everywhere: its title, then a short lead beneath it, on the left edge, at most 40rem wide. What the section shows comes next, in a composition chosen for that content: a cast in a row, an answer with notes in its margin, a before and after, a table.
- **Metadata is a byline.** Facts about a page (the session's role and date, a lesson's track and status, a drill's length) go in a quiet line beneath its title or lead, never in a label above it.
- **Component spacing.** Components use the 4px scale: 4, 8, 12, 16, 24, 32, 48, 64.
- **Page rhythms.** The page itself uses three named rhythms:
  - `section`: 64 → 128px between chapters.
  - `group`: 48 → 80px from a section's opening to its body.
  - `hero`: 32 → 64px from the header to the headline.
- **Spacing follows relatedness.** The more related two things are, the tighter they sit. In the hero, the action and its small print are 12px apart, the headline and the copy 24px, and the copy and the action 32px.
- **Anchors.** `scroll-padding-top` keeps an anchored section clear of the 64px header.

## Surfaces

Space separates sections. A hairline separates the rows of a list or a table, and a figure from its caption. A fill (`surface-1`) marks a real object: the session ticket, the Room's stage, a chosen interviewer. Each element gets one separation method, never two, and there are no rules between the chapters of a page.

There are three radii: control 6px, button 10px and panel 16px.

Only things that float (menus, dialogs) get a shadow, `shadow-sheet`. Bars that stay on screen (the headers, the phone action bar) are solid ink. There is no glass and no translucent panel; a dialog's backdrop is the only scrim.

## Components

- **Primary action.**
  - Ivory fill, ink text, 10px radius.
  - 44px tall on desktop and 48px on touch; full width under 480px.
  - One per view.
  - A transparent border keeps its shape in forced-colors mode.
  - When pressed it scales to 0.97 over 120ms, eased out. Hover darkens the fill; nothing fades.
- **Secondary action:** a `control` outline with ivory text; on hover the edge brightens and a surface appears.
- **Danger action:** a `control` outline with red words, and a faint red ground on hover. The color is in the words, not the edge.
- **Text link:** stone, with a 1px underline offset 0.2em; ivory on hover.
- **Focus:** a 2px ivory outline offset 2px on every interactive element. Being an outline, it survives forced colors.
- **`Interviewer`** (`components/brand/Interviewer.tsx`) is the face. One inline SVG serves as the logo at 24px and the loading state (`Thinking`). It blinks only after hydration and holds still under reduced motion.
- **`Segmented`.** A single choice. Short options read as a row of words, and only the chosen one is drawn: a raised chip with a control edge. An option whose label is a number or a word out of context carries its full name for screen readers (`spoken`), as the Ladder's rungs do. Options with a hint become a ruled list of radio rows.
- **`Toggle`**, **`Field`.** Field edges use `control`, so they meet 3:1. Field text is at least 16px, so phones never zoom.
- **Status.** Words with a small dot (`Badge`), never a pill. Confidence is a neutral three-dot scale with its words (`ConfidenceMark`).
- **The Room's toolbar.** Each control is named by what it shows (Mute, Captions, Type), with any extra words for screen readers only. Key caps are for the eye; shortcuts are announced with `aria-keyshortcuts`.
- **`SiteHeader`.**
  - It is transparent over the first screen, then solid ink with a hairline once you scroll.
  - The navigation appears from 1024px. Below that, a disclosure menu takes over: focus moves in, Escape closes it and returns focus, and the page behind becomes inert and stops scrolling.
- **Skip link.** Every marketing page starts with "Skip to content", which leads to a focusable `<main>`.

## The interviewers (the avatar system)

The six interviewers are Oriel's identity and are never redrawn by hand: Maya, Daniel, Priya, Tom, Eleanor and Sam.

- **What they're made of.** Each is an abstract face (one of eight shapes, ten colors, six accessories) with two capsule eyes and no mouth. They're drawn by `components/avatar/bot/` and animated by `BotAvatar`: blinks, saccades, listening nods, and the voice light that breathes while they speak. People can rename, restyle and re-voice any of them in the studio.
- **Presenting them.** The rule is to stand them on the page: the face and its own floor shadow, generous space, and no box.
  - **Live.** `InterviewerStage` uses the real engine wherever an interviewer is presented on a page: the landing cast, Home, the practice ticket, the Room lobby, the Ladder, sign-in and the 404. It only animates on screen in a visible tab, and holds still under reduced motion.
  - **Stills.** On the landing page each face has a still beneath its canvas (`public/interviewer/*.webp`), rendered by the same engine in its base pose, so the faces are there before scripts run, and without them. Regenerate the stills whenever the renderer changes.
  - **Choosing.** `BotStill` draws them where they are chosen between. The chosen one is lit (`surface-1`), never outlined.
- **The mark.** The logo, the loader and the favicon are a vector reduction of the Classic interviewer, computed from the renderer's own outline, eye proportions and colors. They can't drift apart.

## App pages

- **Frame.** Every app page sits on the same frame and grid as the marketing pages, under a solid bar whose mark shares the content's edge.
- **Header.** A page opens with its title (`display-l`), a lead (`body-l`, 20px below) and, where it has one, its byline. There is never a label above the title.
- **Sections.** A section's title sits in the margin (columns 1–3) with its content from column 4, as a document's would, and space (not a rule) sets it apart. A long form is split into parts with serif titles, in the order you'd decide them (Practice: "The interview", then "Your interviewer").
- **Boxes.** Boxes are for real objects only: a form field, a recording, a dialog, the session ticket.
- **Numbers.** No page shows big-number metric rows. A measurement sits in a table with its target, baseline and change, and a trend is drawn small, in the row. The one exception is a drill's result, which is the single number that page exists to give.
- **States.** A branded 404, an error page with Try again, and a loading state that appears only after 400ms.

## Motion

Motion explains time; it is never decoration.

- **Timing.**
  - Durations: press 120ms, state change 200ms, panel 320ms, entrance at most 600ms.
  - `--ease-enter`, a strong ease-out, is for anything arriving and for press feedback.
  - `--ease-state`, an ease-in-out, is for things moving on screen.
- **Properties.** Only `opacity` and `transform` animate, and every transition names its properties. Everything is visible without JavaScript; nothing waits at opacity 0 for a script.
- **Allowed:**
  - the interviewers' blinks, glances and speaking light
  - captions arriving word by word
  - the landing interviewer's loop
  - menus entering (`@starting-style`)
  - a playhead
  - a microphone meter
- **Not used:** scroll-triggered reveals, parallax, cursor effects, page transitions, bounce.
- **Reduced motion.** Under `prefers-reduced-motion`, the landing interviewer shows a still, composed scene with no play control, onboarding's spoken line appears whole, and transitions collapse to instant.
- **Hover.** Hover styles apply only where hover exists, which is Tailwind's default.
- **Where the motion library loads.** `motion/react` loads only in the signed-in app and onboarding, through `MotionProvider` in their layouts. It never loads on the landing page.

## The landing page

One idea per section, in the order a session happens:

1. **Hero:** the promise beside the interviewer who keeps it. On desktop the headline, copy and action take seven columns on the left and Daniel stands in the five on the right, centered on each other; on narrower screens he follows the action. One filled action, one quiet link.
2. **The interviewers:** "Choose who sits across from you." The six faces as a cast, each with a name, a role and how they interview, then one line on resumes, pressure and panels.
3. **The Read:** "Evidence, not adjectives." A sample answer with Oriel's notes in its margin, then three measures with their targets and confidence.
4. **Lessons:** a sentence of the sample answer, and the same story rewritten with the lesson, its blanks left for you.
5. **Privacy:** four statements taken from the policy.
6. **Pricing:** four plans, each with its price, who it's for, what's included and its action. The plan built for an interview on the calendar carries the page's filled button.
7. **The close:** "Walk in ready."

Every sample is labelled as one, and every claim comes from the product: the personas, the Read, the lesson writer, the privacy policy and the plan data.

**The landing interviewer** (`components/marketing/InterviewPreview.tsx`) is a sample interview with Daniel, for a product manager's behavioral round.

- It has no frame, no header bar and no fake controls in the tab order: the face, a nameplate with its play control, and the conversation beneath as subtitles.
- It renders complete on the server, with a still of the same face under the canvas.
- With motion allowed, it plays one loop: the question, an answer at about 150 words a minute, a follow-up, then a rest.
- The loop pauses on hover, on focus, when off-screen, in a hidden tab, and with its pause button.
- The question's line keeps the taller question's height, and the answer scrolls like captions, by transform and one whole line at a time, so the loop causes no layout shift.
- Screen readers get the whole exchange as text.

## Copy

Short, specific, sentence case, US spelling. There are no em dashes in copy: a sentence that wants one becomes two sentences, a colon or a comma. In tables a dash stands for "not included" or "no value", and screen readers hear "Not included". Don't restate a label in the heading beneath it, and don't add a label above a heading.

## Never

- Gradient text.
- Glassmorphism, blur or translucent panels.
- Glow backgrounds or grain.
- Colored borders or rules as accents, on cards, quotes, figures, callouts or anything else.
- Identical icon-card grids.
- Big-number metric rows, or the same data summarized twice.
- Labels above headings, uppercase tracked micro-labels, or an eyebrow that repeats the navigation.
- Italic accents, or a third typeface.
- Hover states that only fade.
- A box around the interviewer.
- Stock photography, or an invented recording presented as real.
- A submit button that is disabled without saying why.

## The two screens that define Oriel

- **The Room** (`features/room/Room.tsx`):
  - A session bar shows the role, the recording (a still dot and the word) and the time.
  - Then the interviewer, then the conversation: who is speaking and the question you're answering, set in the serif once it has been asked.
  - On wide screens a rail lists the questions so far, and nothing else.
  - The controls are a quiet toolbar. Shortcuts (Space, M, C, T) are shown inside the controls, the active toggle is filled, and the only colored control is End.
  - With no camera, the device check shows the interviewer who is waiting, not an empty frame.
- **The report** (`features/playback/PlaybackView.tsx`) reads as a professional assessment, in this order:
  1. The overall assessment as its title, and the session in words as its byline.
  2. Where you stand: each part of the Read with its verdict in words, and your baseline as a small table. Beside it, numbered next steps, the drill to do, and what worked.
  3. The moments in your recording. With no recording, the timeline remains and a sentence replaces the empty frame.
  4. Lessons.
  5. Every measure, grouped by part, with its range, target and confidence.
  6. Your weakest answer, rewritten, and then vs now.
  7. The transcript, in two voices.
