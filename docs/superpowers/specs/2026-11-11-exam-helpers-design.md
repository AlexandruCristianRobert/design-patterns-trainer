# Exam Helpers — design

Date: 2026-11-11
Status: approved in chat, awaiting spec review

## Goal

Make the Exam easier to practise while the learner is new to the Patterns: optional **Helpers** during an Exam
Session, which the learner turns off on their own once they no longer need them. With Helpers off the Exam works
exactly as today.

## Decisions

- Four Helpers: **Hints**, **Check my answer**, **Show pattern**, **Reveal solution**.
- One **Helpers** switch on the Exam setup page, remembered between sessions. No per-helper switches, no automatic
  fading, no nudge.
- Helped sessions **count normally**: same score, same pass/fail, same best exam score. Help use is recorded and
  shown, never penalised.
- Delivered in two phases:
  - **Phase 1:** the switch, Check my answer, Show pattern and Reveal solution. No new content needed.
  - **Phase 2:** hand-written Hints for all 178 Exam Questions, one Pattern at a time. A question shows its Hint
    button once it has hints.

## Phase 1

### Setup page (`ExamSetupPage.tsx`)

- New switch below Named/Timed: label *Helpers*, hint *Hints, check my answer, show pattern and reveal solution while
  you work*. Uses the existing `Switch` component.
- The last choice is remembered in `localStorage` (key `exam.helpers`, wrapped in try/catch, default off). This is a
  convenience, not Progress.
- A muted line under the switch: *N exams with helpers · M without*. The counts include only submitted sessions from
  exam history; a session counts as "with helpers" if any Helper was used in it.

### Data model (`exam/types.ts`)

```ts
interface ExamSetup { count; scope; named; timed; helpers: boolean }

type HelpUse = 'check' | 'pattern' | 'solution' | 'hint1' | 'hint2' | 'hint3'

interface ExamAnswer { code; identification; help?: HelpUse[] }   // unique, in first-use order
```

- When a session is read, a missing `setup.helpers` means `false` and a missing `help` means `[]`. Old sessions and
  imported Progress keep working. Export/import carries the new fields through unchanged.
- Grading and `questionScore` are unchanged.

### Session page (`ExamSessionPage.tsx`)

With `setup.helpers` on, a **Helpers** panel sits under the question scenario (a new `features/exam/HelpersPanel.tsx`
component). Every Helper stays hidden until clicked. The first click of each is recorded in that answer's `help`
through the same save path as code and Identification.

- **Check my answer:** runs `gradeExercise(answer.code, question, expectedIds, compiler, runner)` for the current
  question only, and shows the result with the existing Exercise `CheckList`, `GradeDiagnostics` and contract-violation
  views. It shares the runner the way Run does: Run, Check and Submit exclude each other (the existing `running`
  / `runWaiters` gate is widened to cover Check). The result belongs to the current question's panel and is dropped
  when the code changes. It is not saved.
- **Show pattern:** shows the Pattern's name, its Structure Diagram (the existing `StructureDiagram`) and a link to its
  Lesson that opens in a new tab. In unnamed mode the Identification field stays, and Identification is still scored.
  In Named mode only the diagram and link are new.
- **Reveal solution:** a read-only code view of `question.solution` with a *Copy into editor* button that replaces the
  answer's code after a confirmation step in the page (no browser `confirm()`). Reuses the Exercise `SolutionPanel`
  where its props fit.
- **Hints:** in Phase 1 the panel shows no Hints section. Phase 2 adds it.

With `setup.helpers` off, the panel doesn't appear, and nothing else changes.

### Report and history

- Exam Report: for each question, a small line *Helpers used: check, solution, hint 2*. It is left out when nothing was
  used.
- Exam history on the Progress page: a *with helpers* tag on sessions where any Helper was used.

### Language

`CONTEXT.md` gains the term **Helpers**: optional aids in an Exam Session (Hints, Check my answer, Show pattern,
Reveal solution). They are turned on at setup, recorded per Exam Question, and never change the score. **Exam
Session** loses "Checks stay hidden until the session is submitted" as an absolute rule: it now applies unless
Helpers are on. **Hint** is extended to Exam Questions in Phase 2.

### Testing

The memory rule "no new tests, verify on the UI" covered the Question Visuals work only. This feature changes
persisted state and scoring-adjacent code, so it gets normal tests:
- Unit: setup default and migration of old sessions; `help` recording (unique, ordered); history counts.
- Component: `HelpersPanel` hidden when off; each Helper is revealed and recorded; Check results render; Copy into
  editor replaces the code after confirming.
- e2e (`web/e2e`): start with Helpers on, use Check, Show pattern and Reveal solution, submit, see *Helpers used* in
  the Report.
- Manual pass in the browser with screenshots.

## Phase 2 — Hints content

- Schema: `examQuestionText` gets `hints: z.array(z.string()).max(3).optional()`.
- The Helpers panel shows *Hint 1/2/3*, revealed in order, using the Exercise `HintsPanel`. Revealing hint *n* records
  `hint<n>`.
- Writing rules for each question's 3 hints:
  1. **Direction:** which Pattern idea fits the problem, without naming the Pattern in unnamed questions (for
     example, "Each stage behaves differently. What if each stage were its own object?").
  2. **Shape:** the types and how they relate (for example, "an interface with one method per request, one class per
     stage, the order holds the current one").
  3. **Specific trap:** the detail of this question that most often fails a Check (for example, "the refund is
     computed from the order's own price, rounded down").
  Hints never contain the full code of a solution, and must not contradict the scenario or the Checks.
- Every question's hints are approved by a separate reviewer subagent, which checks them against the scenario,
  `solution.cs` and `checks.cs`. Hints are rewritten until the reviewer approves (the same loop as Quiz Questions).
- Content test: when present, hints are 1–3 non-empty strings, and an unnamed question's hints don't contain its
  Pattern's name.
- Work is done one Pattern at a time (23 batches, about 178 questions), each batch committed separately.

## Out of scope

Per-helper switches, automatic fading or nudges, scoring penalties, hints in other languages, and AI-generated hints
at runtime.
