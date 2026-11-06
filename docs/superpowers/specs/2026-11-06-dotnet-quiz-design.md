# .NET interview Quiz — Design

**Date:** 2026-11-06 · **Status:** accepted. The user is preparing for senior .NET positions in Zurich. They asked to extend the app with a multiple-choice Quiz on .NET interview topics, with about 400 seeded questions. The decisions come from a grilling session; the terms are in `CONTEXT.md` → "Quiz".
**Builds on:**
- the trainer spec `2026-10-22-design-patterns-trainer-design.md`: §7 Progress, §8 UI, §9 i18n, §10 architecture;
- `web/src/progress/` (IndexedDB stores, export/import) and the local-preference convention of `ThemeProvider` / `useIde` (`localStorage`).

## 1. Intent

A fast, keyboard-driven drill on senior-level .NET interview questions. Each question has four Options (A–D) and one correct Option. After each answer the learner sees why the correct Option is right and why each of the others is wrong. Leitner spaced repetition brings missed questions back.

The Quiz is separate from the Exam. It has no Patterns, Checks, compiled answers, timer or Hints.

**Non-goals:** questions with more than one correct Option, free-text answers, a difficulty field or filter, keeping the chosen Options of past Quizzes, resuming a Quiz, translations, renaming the app or any internal id.

## 2. Milestones

- **M1, the feature:** everything in §3–§8, plus **20 seed questions** (2 per Quiz Topic), so that the unit and e2e tests exercise the real flow.
- **M2, the bank:** about 400 questions, built one Quiz Topic at a time through the review loop of §9. M2 ships when every topic meets its count and every question has been approved.

## 3. Content

### 3.1 Quiz Topics

The list is fixed, and is defined in `content/quiz/topics.yaml` (id, English title, order). There is one content file per topic, `content/quiz/<topic-id>.en.yaml`.

| id | Title | Target |
|---|---|---|
| `csharp-language` | C# language | 50 |
| `clr-memory` | CLR & memory | 40 |
| `async-concurrency` | Async & concurrency | 45 |
| `collections-linq` | Collections & LINQ | 40 |
| `aspnet-core` | ASP.NET Core | 50 |
| `efcore-data` | EF Core & data | 40 |
| `architecture-design` | Architecture & design | 40 |
| `testing` | Testing | 30 |
| `web-distributed` | Web APIs & distributed systems | 35 |
| `security-performance` | Security & performance | 30 |

The level is **senior**, and the target is modern .NET (8/10, C# 12–14). Legacy .NET Framework behaviour appears only where interviewers still ask about it.

### 3.2 Question shape

```yaml
- id: configureawait-false-library        # kebab-case, unique across the whole bank
  question: |
    Why do library authors often write `await x.ConfigureAwait(false)`?
  options:                                 # exactly 4, in any order (they are shuffled at display time)
    - text: It avoids resuming on the captured synchronization context.
      correct: true
      explanation: |
        …why this is right…
    - text: It makes the awaited task run on a new thread.
      explanation: |
        …why this is wrong…
    - …
  code: |                                  # optional: a complete C# program, used only with expectedOutput
    …
  expectedOutput: "…"                      # optional: what `code` prints; the build compiles and runs it
```

- `question`, `text` and `explanation` support inline `` `code` `` and fenced ```` ```csharp ```` blocks. These are rendered read-only with the app's existing code styling, never in Monaco.
- **The id is stable.** Rewording keeps the id. A change to *what the correct answer is* needs a new id, which resets that question to New for everyone.
- **Explanations never mention a letter**, because the Options are shuffled.
- **All/none of the above is banned.**
- When `expectedOutput` is set, `code` is shown in the question, and the question asks what it prints.

### 3.3 Validation

Validation runs in vitest at build/CI time, plus a zod parse at load time.

- every file is listed in `topics.yaml` and every topic has a file;
- ids are unique across the bank;
- each question has exactly 4 Options and exactly 1 correct one;
- `question`, every `text` and every `explanation` are non-empty;
- Option `text` uses inline code only, with no fenced blocks (the Option is a label);
- the four Option texts are distinct;
- no Option text matches `/\b(all|none|both) of the (above|others)\b/i`;
- no Explanation refers to a letter, e.g. `/\b(option|answer)\s+[A-D]\b/i` or `/\b[A-D]\)\s/`, or `"[A-D] is "`;
- `code` and `expectedOutput` are both present or both absent;
- **length bias:** across the whole bank, the correct Option is the strictly longest of the four in at most 40% of questions;
- **counts:** in M1 each topic has ≥ 2 questions; in M2 each topic has at least its target.

**Compile-verified output.** A new `QuizOutputTests` in `DesignPatterns.Content.Tests` reads every question that has `expectedOutput`. It compiles `code` with `CompilerService` (purpose Run), runs it like `ExampleTests` does, and asserts that stdout, with trailing whitespace trimmed and line endings normalised, equals `expectedOutput`.

## 4. Spaced repetition

- A New question has no Box. Answering it correctly puts it in **Box 2**; answering it wrongly puts it in **Box 1**. After that, a correct answer moves it up one Box (the maximum is 5), and a wrong answer moves it to Box 1.
- Waits per Box before a question is Due again: **1, 3, 7, 16, 35 days** (Boxes 1–5). Due means `now ≥ lastAnsweredAt + wait`.
- Stored per question: `{ questionId, box, lastAnsweredAt }`, written as soon as an answer is submitted.
- **Selection** of N questions within the selected topics:
  1. Due questions, most overdue first;
  2. New questions, at random;
  3. the not-yet-Due questions, the ones closest to Due first.

  The chosen set is then shuffled, so Due questions are not always first.
- Box records for ids that no longer exist in the bank are ignored. They are not deleted, so a removed question that comes back keeps its Box.
- A Quiz left before the end still keeps the Box updates of the questions answered. It writes no Quiz Result.

## 5. Flow and keys

**Setup (`/quiz`):**
- **Length:** a segmented control with **5 · 10 · 25 · Custom**. Custom shows a number field from 1 up to min(100, the number of questions in the selected topics).
- **Topics:** "All", or a set of ticked Quiz Topics. Each row shows "*n* due · *m* new".
- **Start:** the button, or Enter when the focus is not in the number field. If fewer questions exist than the length, the Quiz uses all of them and the setup says so.
- **Quiz History** sits below the setup: date, topics (or "All"), "correct / total" and %. Newest first, and no per-entry delete.
- Length and topics are remembered in `localStorage` (`dpt.quiz.settings`). If a stored topic id no longer exists, it is dropped.

**Question.** It runs on the same `/quiz` route; the setup, the question and the end screen are phases of one page, held in memory only:
- The screen shows the question, then A–D (shuffled), plus "*i* / *N*" and the Quiz Topic.
- **1–4** or a click selects an Option, and the selection can change. Enter with nothing selected does nothing.
- **Enter**, or **Submit**, locks the answer. Then:
  - the chosen Option is marked ✓ or ✗;
  - the correct Option is highlighted;
  - all four Explanations are shown, each under its Option;
  - the Box change is shown ("Box 2 → 3", or "→ Box 1").
- While an answer is locked, 1–4 do nothing, and **Enter** moves to the next question.
- **Esc** opens a confirmation to quit. Quitting returns to the setup.
- A reload or navigating away also ends the Quiz, with the same effect as quitting.
- The keys work only while the focus is not in a text field. The options are a radio group, so the screen-reader and Tab order stay correct.

**End screen:**
- "*c* / *N* (*p*%)", and a breakdown by Quiz Topic for this Quiz only, which is not saved.
- **New Quiz** (the default, Enter) starts another Quiz with the same settings. **Back** returns to the setup.

## 6. Storage and Progress

- IndexedDB `DB_VERSION` 3 adds two stores:
  - `quizBoxes`, keyPath `questionId`;
  - `quizResults`, keyPath `id`, with `{ id, takenAt, topics: string[] | 'all', total, correct }`.
- The **Progress export** goes to `schemaVersion: 3` with `quizBoxes` and `quizResults`. Import accepts v1, v2 and v3, and v1/v2 files clear the Quiz stores, the same rule as for exam history. (The app has no "reset progress" action; importing is the only bulk replace.)
- The Progress page gets a **Quiz summary line**: "*k* quizzes · *a*% average · *s* / *total* questions seen".

## 7. UI and i18n

- A new nav tab, **Quiz**, between Exam and Progress. A new i18n namespace, `quiz`, holds the UI strings. The content text comes from the YAML.
- The layout works at 390 px, with tap targets ≥ 44 px. On touch devices the key hints are hidden.
- It follows `DESIGN.md` tokens and both themes. ✓ and ✗ never rely on colour alone: each also has an icon and a text label.

## 8. Code layout

- `web/src/content/quiz.ts` loads `topics.yaml` and the topic files with an eager glob, and does the zod parse. Schemas go in `schema.ts`.
- `web/src/quiz/`:
  - `leitner.ts`, a pure module for Box transitions, Due and selection, with an injected clock and RNG;
  - `run.ts`, pure: building a run (selection, shuffled Options) and the per-topic breakdown;
  - `quizStore.ts`, the IndexedDB access for both stores;
  - `settings.ts`, the `localStorage` settings and `useQuizSettings`;
  - `summary.ts`, the Progress summary numbers.
- `web/src/features/quiz/`: `QuizPage` (the phase switch), `QuizSetup`, `QuizRun`, `QuizEnd`, `QuizHistory`, `QuizText`.
- Tests:
  - unit tests for `leitner.ts`, which carries the boundary logic;
  - component tests for the keys and the locked state;
  - the content validator and `QuizOutputTests`;
  - an export → import round trip of Boxes and Quiz Results, in `progress.test.ts`;
  - e2e (`web/e2e/quiz.spec.ts`): a 5-question Quiz driven only by the keyboard, the Quiz Result showing up in the history, and the settings remembered after a reload.

## 9. Authoring and review loop (M2)

The loop runs per topic:

1. The author (main session) writes the topic's batch into its YAML file.
2. A **fresh-context reviewer subagent** gets only that file, the ids already in the bank with their question lines (to check for overlap), and the rubric below. It returns **OK, or NOT OK with a reason**, for every question id. It may check Microsoft Learn and the official docs on the web when it is unsure.
3. The author rewrites every NOT OK question and resubmits **only those**. This repeats until every question in the batch is OK.
4. The validator and `QuizOutputTests` run, and then the batch is committed.

**Rubric:**
- technically correct for .NET 8/10;
- exactly one defensibly correct Option, with no "it depends" reading under which another Option is also right;
- the distractors are plausible misconceptions, not filler;
- each Explanation is accurate and says *why*;
- senior-level interview relevance, neither trivial nor obscure trivia;
- no letter references and no all/none-of-the-above;
- no overlap with existing questions;
- for `expectedOutput` questions, the stated output is what the code prints.

The reviewer runs on the same model as the author. The independent check for output questions is the compiler.
