# Design Patterns Trainer — Design Spec

**Date:** 2026-10-22 · **Status:** accepted
**Vocabulary:** [`CONTEXT.md`](../../../CONTEXT.md) (terms in **bold** below are defined there)
**Decisions:** [ADR 0001](../../adr/0001-react-shell-with-roslyn-in-web-worker.md), [ADR 0002](../../adr/0002-checks-are-client-side-csharp.md)
**Visual design:** [`DESIGN.md`](../../../DESIGN.md) — foundation A (Editor-native)

## 1. Purpose

A front-end-only web app to learn the Gang of Four design patterns in C#: each **Pattern** is explained in a **Lesson** (text + visuals), practised in graded **Exercises**, and examined in **Exam Sessions** where the learner writes real C# that is compiled and graded in the browser.

## 2. Roadmap

Each milestone gets its own implementation plan and ships working software.

| # | Milestone | Ships |
|---|---|---|
| **M1** | Engine & Sandbox | Roslyn compile + run in workers, Check runtime, Contract verifier, API policy, Sandbox page, CI, GitHub Pages deploy |
| **M2** | Learning flow (pilot: Observer) | Content pipeline, content validation, Catalog, Lesson page (Structure Diagram, Scene player), Exercise page, Hints, Progress + Drafts in IndexedDB, export/import |
| **M3** | Exam | Exam setup, Exam Session (closed book, timer, resume), scoring, Exam Report, exam history |
| **M4** | First-release content | Singleton, Factory Method, Strategy, Decorator — Lessons, scenes, Exercises, Exam Questions |
| **M5** | IDE features add-on | Spike, then lazy-loaded completion / hover / go-to-definition / format |
| later | Catalog completion, German | Remaining 18 GoF Patterns; `de` locale |

## 3. Catalog and content

- **Catalog** target: all 23 GoF Patterns, grouped by **Category** (Creational 5, Structural 7, Behavioral 11). Unbuilt Patterns appear in the Catalog as "coming soon".
- **First release:** Singleton, Factory Method (**Tricky**); Strategy, Observer, Decorator (**Standard**).
- **Difficulty Tier** sets content volume:

  | Tier | Exercises | Exam Questions |
  |---|---|---|
  | Standard | 3 — one Complete, one Refactor, one Build | 3 |
  | Tricky | 5 — one Complete, two Refactor, two Build | 5 |

  Tricky GoF Patterns: Visitor, Abstract Factory, Factory Method, Singleton, Bridge, State, Mediator, Interpreter, Flyweight, Memento. All others Standard.
- **Lookalikes** per Pattern (e.g. Strategy ↔ State, Template Method, Bridge; Factory Method ↔ Abstract Factory, Simple Factory; Decorator ↔ Proxy, Adapter, Composite) drive Lesson "vs." comparisons and plausible-but-wrong exam scenarios.
- **Lesson** sections, fixed order: 1 Problem (with "before" code) · 2 Analogy · 3 Structure (**Structure Diagram**) · 4 Interaction (**Interaction Scene**) · 5 C# example (opens in **Sandbox**) · 6 When to use / pitfalls / Lookalike "vs." comparisons.
- **Exercise Kinds:** Complete (scaffolded code with `// TODO` gaps), Refactor (working "before" code → Pattern, output unchanged), Build (plain-English scenario only).
- **Hints:** up to 3 per Exercise, revealed one at a time. **Reveal solution** unlocks after the first Check attempt. Using a Hint or the solution before all Checks pass → **Solved with help**.
- **Exam Questions** come from a pool separate from Exercises, each in a different domain.

### Content layout

```
content/patterns/<pattern-id>/
  pattern.yaml            id, Category, Tier, Lookalikes, version
  lesson.<locale>.mdx     Lesson text; embeds visual components
  example.cs              runnable Lesson example
  structure.yaml          Structure Diagram nodes/edges/positions
  scene.yaml              Scene Script (or a custom scene component)
  text.<locale>.yaml      Pattern-level strings
  exercises/<exercise-id>/
    exercise.yaml         kind, version, Contract, check ids
    text.<locale>.yaml    title, scenario, Hints, Check titles/failure messages
    starter.cs · solution.cs · checks.cs
  exam/<question-id>/
    question.yaml · text.<locale>.yaml · solution.cs · checks.cs
web/src/visuals/<pattern-id>/   custom React visuals when a Scene Script is not enough
```

### Content validation (runs in tests and CI)

Every `solution.cs` passes all its Checks; every `starter.cs` fails at least one; every Check id has an `en` title and messages for every custom failure reason; missing non-`en` text is a warning.

## 4. Grading

- **Contract:** the minimal public surface an Exercise or Exam Question requires. Describes only what client code touches; in unnamed Exam Questions it never names Pattern roles. Contract violations are reported before any Check runs.
- **Checks** are C# static methods marked `[Check("<id>")]`, compiled together with the learner's code. Behavioural Checks call the code; structural Checks inspect it via reflection (`Code`) or syntax (`Source`).
- **Checks carry no human-readable text.** They report a reason key plus string arguments; the UI renders text from locale files. Generic reasons: `isFalse`, `notEqual` (expected, actual), `notSame`, `same`, `didNotThrow` (expected), `wrongException` (expected, actual), `typeNotFound` (type), `threw` (type, message), `timedOut`. Custom reasons via `Expect.Fail(reason, args)`.
- **Check outcome:** passed · failed · errored (learner code threw) · timedOut.
- Singleton thread-safety is a structural Check (Lazy<T>, static initializer, or double-checked `lock`) because no real threads exist.

## 5. C# runtime rules

| Area | Rule |
|---|---|
| Language | C# 14, .NET 10 reference assemblies, nullable enabled |
| Implicit usings | `System`, `System.Collections.Generic`, `System.Linq`, `System.Threading`, `System.Threading.Tasks` |
| Program shape | single file; top-level statements or `Main` |
| Not available | file system and other `System.IO` except `StringReader/StringWriter/TextReader/TextWriter`; `System.Net`; `System.Reflection.Emit`; `Thread`, `ThreadPool`, `Parallel`; `Process`; `Environment.Exit`; `Console.Read/ReadLine/ReadKey` — reported as `DP0001: Not available in the browser runtime: <api>` |
| Limits | 5 s per run or per Check, then the runner worker is terminated and respawned; stdout capped at 65,536 characters |

## 6. Exam

- **Setup:** Exam Question count 1–10 (default 3); scope all / chosen Categories / chosen Patterns (default all); **Named mode** (default off); timer (default on, 15 min × question count).
- **During:** closed book — no Hints, solutions or Lessons. Run allowed (compiler errors + console output). Checks hidden until submit. Free navigation between questions; auto-submit on timer expiry.
- **Selection:** no Pattern twice in a session unless count exceeds Patterns in scope; least-recently-seen Exam Questions first.
- **Identification** offers all 23 GoF names regardless of what is built.
- **Scoring per question:** Identification 20% + Checks 80% (partial credit by Checks passed); Named mode: Checks 100%. Pass mark 70%.
- **Exam Report:** per question — Identification outcome, every Check with message, learner code beside reference solution, link to Lesson.
- **Interruption:** in-progress session saved continuously; on return offer Resume / Abandon; timer runs on wall-clock time; expired → auto-submitted on return; one in-progress session at a time; abandoned sessions logged without score.

## 7. Progress

- Stored in IndexedDB behind one storage module; no accounts.
- **Progress:** per Pattern — Lesson visited, each Exercise status (not started / attempted / Solved with help / Solved), best exam score; exam history with Exam Reports.
- **Drafts** autosaved per Exercise and per Lesson Sandbox. Each Exercise has a content version; on version change the Draft is kept and flagged stale, and Solved status is kept.
- Export / Import Progress as JSON.
- **Nothing is locked.** Each Pattern shows a **Next Step**.

## 8. UI

| Route | Screen |
|---|---|
| `/` | Catalog — rows grouped by Category, each with mini Structure Diagram thumbnail, Tier, Exercise dots, best exam %, Next Step |
| `/patterns/:id` | Lesson — one page, sticky section nav |
| `/patterns/:id/practice/:exerciseId` | Exercise — split: scenario/Contract/Hints left; editor, Checks, console right |
| `/sandbox` | Sandbox — free C# editor + Run |
| `/exam` · `/exam/:sessionId` · `/exam/:sessionId/report` | Exam setup · Exam Session · Exam Report |
| `/progress` | Progress overview, exam history, export/import |

- Desktop-first (split editor ≥ 1024 px); Lessons and Exam Reports fully usable at 390 px; Exercise/Exam stack vertically on narrow screens with a "best on a larger screen" note.
- Theme: System / Light / Dark; Monaco theme derived from `DESIGN.md` tokens.
- Visuals: Structure Diagrams with React Flow from `structure.yaml`; Interaction Scenes from a **Scene Script** played by one shared player (React + SVG + Motion): play / pause / step / scrub / speed, linked code-line highlighting, `prefers-reduced-motion` honoured. A Pattern may supply a custom scene component instead.
- Editor v1: C# highlighting + live Roslyn diagnostics (500 ms debounce) in Sandbox, Exercises and exams.
- All UI work follows the `uxkin:no-ui-slop` skill and `DESIGN.md`.

## 9. Internationalisation

- UI strings via i18next + react-i18next, one JSON namespace per area, `en` default and fallback. German planned.
- Content per locale as described in §3; C# code (starter, solution, example, comments) is English-only.
- Missing translation falls back to `en` with a "not yet translated" badge.
- Roslyn `CS*` diagnostics are shown as the compiler emits them (English); app diagnostics (`DP*`), Check reasons and Contract violations are translated.

## 10. Architecture

- **web/** React + TypeScript + Vite, react-router, i18next, Monaco, React Flow, Motion, IndexedDB.
- **core/** .NET 10 class libraries shared by browser and tests: `DesignPatterns.Core` (compile, API policy, Contract verifier, program/Check runner, JSON protocol) and `DesignPatterns.Checks` (Check authoring API).
- **compiler/** `DesignPatterns.Wasm` — .NET WebAssembly host exporting compiler and runner entry points via `[JSExport]`. One bundle, instantiated by two Web Workers:
  - **compiler worker** — long-lived; compile, diagnostics, Contract verification; later IDE features.
  - **runner worker** — disposable; loads compiled assemblies, runs `Main` and Checks; terminated on timeout and recycled periodically.
- **tests/** xUnit for core and content validation; Vitest for web logic; Playwright end-to-end.
- **Hosting:** GitHub repo, GitHub Actions (tests + content validation on every push), GitHub Pages deploy from `main`; SPA fallback via `404.html`.

## 11. IDE features add-on (M5)

A toolbar button "Enable IDE features" (Lucide icon, size shown) lazily downloads Roslyn Workspaces/Features assemblies into the compiler worker, enabling completion, hover, in-file go-to-definition and format document; a setting loads them automatically on later visits. Allowed in exams. Starts with a feasibility spike.
