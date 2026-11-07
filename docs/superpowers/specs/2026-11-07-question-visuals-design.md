# Question Visuals — Design

**Date:** 2026-11-07 · **Status:** accepted · M1 and M2 complete (20 visuals); rollout cycles of 40 under way (no new automated tests — verified on the UI by screenshots and the reviewer loop). The learner uses a large PC screen. The Quiz is a narrow 820px column, and the learner asked for each Quiz Question to also teach through a picture. The decisions come from a grilling session; the terms are in `CONTEXT.md` → "Quiz" (Question Visual, Setup, Reality play, Claim play). The clickable mockup it was agreed on is described in §4.
**Builds on:**
- the Quiz spec `2026-11-06-dotnet-quiz-design.md`, and its review loop in §9;
- `web/src/features/quiz/QuizRun.tsx` (keys 1–4, Enter, Esc; focus handling) and `web/src/quiz/run.ts` (Options are shuffled per run);
- the Lesson `ScenePlayer` (`web/src/visuals/scene/`), whose reduced-motion behaviour is copied.

## 1. Intent

A Quiz Question can have a **Question Visual**: a steppable picture shown below the Options that makes the situation and the right answer concrete. Before answering, the **Setup** shows the situation without hinting at the answer. After answering, the **Reality play** shows what really happens, and a **Claim play** for each wrong Option shows what that Option claims would happen, next to reality.

**Non-goals:** a visual for every question now; a shared template system (data-driven drawings); visuals in the Exam or Lessons; recording which visuals were watched; visuals counting toward Box or score.

## 2. Milestones

- **M1, the frame:** the wide layout (§4), the shared Question Visual frame (§5), the content file and its tests (§6), and **one** visual, `configureawait-false-library`, reviewed via §8. The learner tries it in the real app before M2 starts.
- **M2, the pilot:** the other 19 visuals of §7, in batches of 5, 5, 5, 4. Each batch is built, reviewed until all approved, then committed. M2 ends with a short note in this spec on which drawing shapes repeated, as input to a later decision on shared templates.

Work happens on a feature branch.

## 3. Decisions

| Topic | Decision |
|---|---|
| When it is shown | Setup before answering; Reality play and Claim plays after (option "c" in the session). |
| How visuals are made | Each visual's **drawing is bespoke** per question (a `.tsx` component). Everything else — panel, controls, phases, tabs, stages, captions — is a **shared frame**. |
| Where text lives | Stages, step ids and captions are content: `content/quiz/visuals/<question-id>.en.yaml`. The component only draws. |
| Page width | **Always wide** (up to 1600px), for every question with or without a visual. Question text and Explanations stay capped at ~80ch. |
| Playback | Setup waits for the learner. After checking, the first post-answer view **plays once by itself**. Reduced motion: no autoplay, no transitions. |
| Review | Every visual passes the reviewer loop of §8 (screenshots of every step). |

## 4. Layout

Top to bottom, inside the existing Quiz page:

1. **Question panel**, full width: meta row, question text (≤ ~80ch), the four Options in a **2×2 grid** (one column below 900px), each Option's Explanation shown inside its card once answered, then the actions row.
2. **Visual panel**, full width, only for questions that have a Question Visual: header (phase label, title, Option tabs), the **stages**, and the player row.

While a Quiz runs, the page max-width rises from 820px to 1600px; setup, history and the end screen keep 820px. No horizontal scroll at any width: a stage's steps share its width evenly and labels wrap. Two stages sit side by side above 1400px and stack below it.

The mockup (scratchpad, not committed) showed this for `configureawait-false-library`: lanes for UI thread (with its SynchronizationContext), thread pool and I/O; steps as columns; the library code under each stage with the current line highlighted.

## 5. The frame

### 5.1 Phases and views

- **Before answering** — one view, the Setup: a single stage. It must never hint at the correct Option, or rule out a wrong one.
- **After answering** — one tab per view:
  - **What really happens** — the Reality play. It may hold one stage, or two to contrast (e.g. "await without ConfigureAwait" vs "with").
  - **What <letter> claims** — one per wrong Option: the Claim play stage on the left, a Reality stage on the right.

  The view opened first is the chosen Option's Claim play if the answer was wrong, otherwise the Reality play. Each wrong Option's Explanation also gets a "See what <letter> claims" button that opens its tab. The letter is the Option's **display** letter in this run, because Options are shuffled.

### 5.2 Steps and controls

- Stages shown together step **in sync**. A shorter stage holds on its last step and keeps its last caption.
- Controls: **Back**, **Play/Pause**, **Step**, and "Step n of m". Keys **←** and **→** step back and forward: **after answering**, from anywhere on the page; **before answering**, only while focus is inside the visual panel, because the Option radios own ←/→ then. Never while focus is in a text field or on a radio. Inside the panel, **Space** plays and pauses (except on a button), as in `ScenePlayer`. They do not clash with 1–4, Enter or Esc, and Enter for Next is never blocked by playback. The key hint gains "←/→ step the visual" on questions with a visual.
- Switching tab resets to step 1 and stops playback.
- Autoplay: the Setup never autoplays. The first post-answer view plays once at ~1.6s per step. Opening another tab does not autoplay it unless the learner presses Play.
- **Reduced motion** (`prefers-reduced-motion`): no autoplay and no fade or slide; steps appear instantly — as `ScenePlayer` does.
- Each stage's caption sits in a polite live region, so every step's teaching is also available as text.

### 5.3 The drawing contract

A visual component receives the stage id and the current step id (plus whether that step is the current one, for highlighting) and draws that stage at that step. It owns no controls and no text other than labels inside the drawing. Components are loaded lazily per question id, so the Quiz bundle does not grow with the number of visuals.

## 6. Content

`content/quiz/visuals/<question-id>.en.yaml` (not matched by the topic glob `content/quiz/*.en.yaml`):

```yaml
question: configureawait-false-library
setup:
  id: setup
  title: Where does the code after the await run?
  steps:
    - id: caller-calls
      caption: A click handler on the UI thread calls a library method.
    # …
reality:
  title: Why the correct answer matters: a caller that blocks
  stages:
    - id: default-await
      title: await without ConfigureAwait
      steps: [ … ]
    - id: configure-await-false
      title: await … ConfigureAwait(false)
      steps: [ … ]
claims:
  - option: 1          # 0-based index of the Option in the topic file (never a letter: Options are shuffled)
    claim:   { id: thread-pool-claim, title: …, steps: [ … ] }
    reality: { id: thread-pool-reality, title: What really happens, steps: [ … ] }
```

Rules, enforced by schema tests (next to `quizSchema.test.ts`):

- `question` names an existing Quiz Question, and the file name matches it.
- `claims` has exactly one entry per wrong Option: every `option` index exists and is not the correct Option.
- Step ids are unique within a stage; stage ids are unique within the file.
- There is a component for every visual file and a visual file for every component, and the component declares a drawing for every stage id (a test renders each stage at each step without throwing).
- Captions follow the Quiz text rules: no Option letters, no "all/none of the above".

## 7. The pilot (M2)

2 per Quiz Topic, chosen for visual fit and a spread of drawing shapes:

| # | Quiz Topic | Question id | Shape |
|---|---|---|---|
| 1 | Async & concurrency | `configureawait-false-library` (M1) | Thread lanes |
| 2 | Async & concurrency | `channel-bounded-dropoldest` | Buffer / queue |
| 3 | C# language | `closure-capture-for-vs-foreach` | Variable boxes + arrows |
| 4 | C# language | `record-with-shallow-copy` | Object graph |
| 5 | CLR & memory | `value-type-storage-follows-container` | Stack / heap |
| 6 | CLR & memory | `finalizer-object-survives-extra-gc` | GC generations |
| 7 | Collections & LINQ | `linq-deferred-vs-tolist` | Pipeline pull |
| 8 | Collections & LINQ | `list-growth-doubling-capacity` | Array resize |
| 9 | ASP.NET Core | `middleware-short-circuit-skips-rest` | Pipeline (onion) |
| 10 | ASP.NET Core | `scoped-dependency-in-singleton` | Lifetime scopes |
| 11 | EF Core & data | `lazy-loading-proxies-n-plus-one` | Round-trip timeline |
| 12 | EF Core & data | `rowversion-concurrency-where-clause` | Two actors + table row |
| 13 | Architecture & design | `aggregate-root-invariants` | Boundary |
| 14 | Architecture & design | `mediator-pipeline-behavior-order` | Nested layers |
| 15 | Testing | `test-pyramid-e2e-cost-feedback` | Pyramid + bars |
| 16 | Testing | `xunit-instance-per-test-class-fixture` | Instance lifetimes |
| 17 | Web APIs & distributed | `circuit-breaker-open-half-open` | State machine |
| 18 | Web APIs & distributed | `retry-backoff-jitter-thundering-herd` | Timeline chart |
| 19 | Security & performance | `oauth-pkce-code-interception` | Sequence + attacker |
| 20 | Security & performance | `memorycache-stampede-hybridcache` | Fan-in |

## 8. Review loop

Every visual is approved by a fresh reviewer subagent (same model as the Quiz reviews). It gets the question's YAML, the visual's content file, and **Playwright screenshots of every step of every stage** from the dev app, at 1920 wide and at a narrow width. Rubric:

1. The Setup never hints at the correct Option, nor rules any Option out.
2. The Reality play is correct for .NET 8/10 and consistent with the correct Option's Explanation.
3. Each Claim play shows exactly what its Option says — no straw man — and makes clear where it breaks.
4. The drawing matches the caption at every step.
5. Legible at 1920 wide, and still understandable when stages stack.

Batches of 5; verdict OK / NOT OK with a reason per visual; only NOT OK visuals are redone and resubmitted, until all pass.

## 9. Testing

- **Unit (Vitest):** content schema rules of §6; the frame — phases, opening view for right and wrong answers, tab letters follow the shuffle, synced stepping and the shorter-stage hold, ←/→ not firing while typing, autoplay once, reduced motion (no autoplay), captions in a live region; questions without a visual render no visual panel.
- **e2e (Playwright):** answer `configureawait-false-library` wrong, see the chosen Option's Claim play autoplay, switch tabs, step with the keyboard, press Enter for Next mid-play; no horizontal scroll at 1920 and 390 wide.
- Existing Quiz tests keep passing (layout change, keys).

## 10. What the pilot showed (M2 note)

All 20 pilot visuals passed the reviewer loop. Every drawing ended up built on a small set of shared helpers in `web/src/features/quiz/visuals/`:

| Helper | Shape | Used by |
|---|---|---|
| `BoxGraph` | boxes in regions + measured arrows (memory, object graphs, DI scopes, aggregates) | 12 of 20 |
| `SeqStage` | sequence diagram (pipelines, round trips, protocols) | 6 |
| `RowStage` | rows of chips / fixed slots (buffers, queues, generations, requests) | 6 |
| `LaneStage`, `ArrayStage`, `PyramidStage`, `StateStage`, `BarStage` | thread lanes, array growth, layered pyramid, state machine, timeline bars | 1 each |

So the "bespoke drawing" in practice is a small data spec over one of ~9 helpers — the shared-template option (a) is effectively what emerged, without a data-driven template format. Recurring review findings, now in the builder brief: Setups that leak the answer through the picture (drawing the contested result, a generation label, a filled buffer), Claim plays that add assertions the Option doesn't make, captions truncated by YAML ` #` comments, and wording that is technically loose (e.g. "no lock" vs "no lock held").
