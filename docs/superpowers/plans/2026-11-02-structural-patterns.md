# Remaining Structural Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Adapter, Bridge, Composite, Facade, Flyweight and Proxy completely. Each gets a visual Lesson, Exercises and Exam Questions, so all seven Structural Patterns are built.

**Architecture:** Content only, exactly like the Creational plan `docs/superpowers/plans/2026-10-30-creational-patterns.md`. Every Pattern copies the file layout of an existing built Pattern (`content/patterns/<id>/…`). Loaders, the .NET content validator, and the Lesson, Exercise and Exam pages pick it up with no code changes. Lessons use the Lesson visual components (`web/src/features/lesson/visuals/`, DESIGN.md → "Lesson visual vocabulary").

**Tech Stack:** MDX 3, YAML content, C# (Roslyn-compiled Checks), Vitest, .NET xUnit content tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-structural-patterns-design.md` — binding: §2 tiers, lookalikes, roleNames; §3 Lesson stories and roles; §4 Exercise and Exam rules and valid alternatives.

**Reference Patterns:** `content/patterns/abstract-factory/` (Tricky layout: descriptive exercise ids, 5+5) and `content/patterns/builder/` / `decorator/` (Standard: `complete`, `refactor`, `build`, 3 exam questions). Best visual Lessons: `factory-method`, `observer`, `abstract-factory`.

## Global Constraints

- Everything in the Creational plan's Global Constraints binds as written (M4 constraints: i18n, tokens, Lucide icons only, commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, tiers, layout, fixed Lesson section ids/order, **unique domains**, **no pattern giveaway** in Exam titles/scenarios/Contracts with `roleNames` incl. plurals, Lookalikes are Catalog ids only, ≥1 Lookalike-plausible Exam Question per Pattern).
- **Lesson tasks** create `pattern.yaml` with `version: 0`, `exercises: []`, `examQuestions: []`; the Practice task fills the lists, sets `roleNames` and `version: 1`.
- **Visual Lessons from the start:** every box-and-arrow figure is a described `<Figure>`; role tags follow spec §3's roles; BadgeList `count` = number of leading bullets with a code badge; a Figure caption never repeats its Card title; stacked grids at 390 use down arrows, labels never touch box edges; inner objects take their participant's role; no raw `className` in MDX; Point asides with two alternatives group each alternative (Card or labelled Stack) so they don't merge into one chain at 390.
- **Valid alternatives pass** (spec §4). Each Practice report names the alternatives its Checks accept.
- **Hidden requirements are forbidden.**
- **Test budget:** tasks run only their own Verify commands; reviewers run no tests; full suites run in Task 13 and after the final fix wave; implementers report seconds per command.
- **Memory is low:** one dev server or Playwright run at a time, stopped afterwards; never port 5199 (the user's). Screenshots go to the session scratchpad named in the dispatch, never into the repo. A stale `web/node_modules/.vitest-cache` can make a new Lesson show "couldn't load" — delete it.

## Task recipes

**Lesson task (L):** files under `content/patterns/<id>/`: `pattern.yaml`, `text.en.yaml` (intent, structure node texts, scene step texts, lookalikes), `lesson.en.mdx`, `example.cs` (runs, prints the story's output), `structure.yaml`, `scene.yaml`; modify `web/src/features/lesson/LessonPage.test.tsx`.
1. Failing test `the <Name> Lesson shows its visuals`, same shape as the Abstract Factory test: Key idea count, `#problem` bad lines, BadgeList items, three `.fig-point`, checklist verdicts, pitfall code pairs, one `getByRole('figure', { name })` per named figure. Run `cd web && npx vitest run src/features/lesson` → FAIL.
2. Write the content.
3. Verify: `cd web && npx vitest run src/content src/features/lesson`; `npx tsc -b`; `dotnet test tests/DesignPatterns.Content.Tests --filter "DisplayName~<id>"`; one screenshot script of `/patterns/<id>` per Section at 390 and 1440, light and one dark; read them.
4. Commit `content(<id>): Lesson`.

**Practice task (P):** `content/patterns/<id>/exercises/<ids>/…` and `exam/<ids>/…`, same file set as the reference Pattern of the same tier; in `pattern.yaml` fill `exercises`, `examQuestions`, `roleNames` (spec §2 exactly), set `version: 1`.
1. Write the content (Checks per spec §4 "Checks test the behaviour that matters"; structural Check accepts the spec §4 alternatives).
2. Verify: `dotnet test tests/DesignPatterns.Content.Tests --filter "DisplayName~<id>/"`; `cd web && npx vitest run src/content`.
3. Commit `content(<id>): Exercises and Exam Questions`. Report lists the new domains.

## Review Focus

1. Valid alternatives rejected (spec §4 list).
2. Flyweight: a factory that returns a new instance each time must fail a `ReferenceEquals` Check. Proxy: an eager proxy must fail the "not created until first use" Check. Write both as explicit tests in the exercise Checks.
3. Cross-pattern giveaways against all 14 built Patterns' `roleNames` (e.g. "wrapper" in a Proxy question, "adapter" in a Facade question, "component" in a Composite question). Task 13 greps existing exam texts for the new role words.
4. Tier counts and directories (content test).
5. Lessons at 390px.

---

### Task 1: Adapter Lesson
Recipe L for `adapter`, spec §2 row and §3.1. Tier standard. Figures: Problem annotated `TrainingLog` with conversion lines tinted `bad`, BadgeList, KeyIdea; Analogy plug-adapter strip; Structure client → `IRunSource` ← `PaceWatchAdapter` → `PaceWatchSdk`; Interaction Points "the log asks in its own words", "the adapter translates", "the SDK never changes"; When to use: checklist, object vs class adapter two-card figure, Pitfalls with code pairs (adapter adding business logic; leaking adaptee types). `example.cs` prints imported runs in km; "change it": add a second watch brand adapter.

### Task 2: Adapter Exercises and Exam Questions
Recipe P for `adapter`: 3 Exercises `complete`, `refactor`, `build`; 3 Exam Questions; ≥1 Exam Question Decorator- or Facade-lookalike that is still Adapter (one existing object, wrong interface). Checks per spec §4. Exam texts avoid "adapter", "adaptee", "target" (use "expected interface", "fit", "plug in").

### Task 3: Bridge Lesson
Recipe L for `bridge`, spec §3.2. Tier tricky. Figures: Problem class-explosion grid (2×2 classes, then the 3×3 cost) with BadgeList; Analogy switch-and-lamp strip; Structure two hierarchies joined by one "has a" arrow; Interaction Points "pick a player and an output", "the player delegates sound to its output", "swap the output, same controls"; When to use: checklist, Bridge vs Adapter and Bridge vs Strategy figures, Pitfalls with code pairs. `example.cs` plays with both players on both outputs; "change it": add a `CarStereo` output (one class, not two).

### Task 4: Bridge Exercises and Exam Questions
Recipe P for `bridge`, Tricky: 5 Exercises `complete`, 2× `refactor`, 2× `build` with descriptive kebab-case ids in kind order; 5 Exam Questions; ≥1 Strategy- or Adapter-lookalike Exam Question that is still Bridge (two dimensions that both grow). Checks: every abstraction works with every implementor; swapping the implementor changes output; the structural Check finds an abstraction holding an implementor reference (interface or abstract class) and no class per combination. Exam texts avoid "bridge", "abstraction", "implementor".

### Task 5: Composite Lesson
Recipe L for `composite`, spec §3.3. Tier standard. Figures: Problem annotated recursive `is Combo` checks tinted `bad`; Analogy boxes-in-boxes strip; Structure figure with nested Boxes (a combo containing items and a combo); Interaction Points "ask the top for its price", "a combo asks its children", "an item just answers"; When to use: checklist, transparency vs safety two-card figure, Pitfalls with code pairs (cycles; leaves forced to implement Add). `example.cs` prints a ticket total for a nested combo; "change it": add a discount combo.

### Task 6: Composite Exercises and Exam Questions
Recipe P for `composite`: 3+3; ≥1 Decorator-lookalike Exam Question that is still Composite (many children, combined result). Checks: nested totals correct (≥3 levels), leaves and groups through one interface, an empty group works. Exam texts avoid "composite", "component", "leaf"/"leaves".

### Task 7: Facade Lesson
Recipe L for `facade`, spec §3.4. Tier standard. Figures: Problem two clients each wired to four subsystems (annotated code + a crossing-lines figure), BadgeList; Analogy concierge strip; Structure clients → `EnrolmentDesk` → four subsystems; Interaction Points "one call", "the desk runs the steps in order", "subsystems still usable on their own"; When to use: checklist, Facade vs Adapter figure, Pitfall god-object with code pair. `example.cs` enrols a student and prints each step; "change it": add an SMS reminder step in one place.

### Task 8: Facade Exercises and Exam Questions
Recipe P for `facade`: 3+3; ≥1 Adapter- or Mediator-lookalike Exam Question that is still Facade. Checks: one call performs the stated steps in order (subsystem fakes record calls), the client uses only the facade, failure in a stated step stops later steps if the scenario says so. Exam texts avoid "facade", "subsystem".

### Task 9: Flyweight Lesson
Recipe L for `flyweight`, spec §3.5. Tier tricky. Figures: Problem annotated `Seat` with duplicated style fields tinted `bad`, BadgeList; Analogy rubber-stamp strip; Structure `SeatMap` → `SeatStyleCatalog` → shared `SeatStyle`s, with seat spots pointing at them; Interaction Points "ask the catalog for a style", "the same style comes back", "position is passed in, never stored"; When to use: checklist, intrinsic vs extrinsic figure, memory figure (40,000 heavy vs 5 shared + 40,000 light, use `Track` or Boxes), .NET string interning note, Pitfall mutable flyweight with code pair. `example.cs` prints styles created = 5 for many seats; "change it": add a wheelchair band.

### Task 10: Flyweight Exercises and Exam Questions
Recipe P for `flyweight`, Tricky: 5+5 with descriptive ids; ≥1 Singleton- or Prototype-lookalike Exam Question that is still Flyweight (many shared values keyed by state). Checks per spec §4 incl. Review Focus 2 (`ReferenceEquals` same key, distinct keys distinct, immutability, extrinsic state not stored). Exam texts avoid "flyweight", "intrinsic", "extrinsic", "factory".

### Task 11: Proxy Lesson
Recipe L for `proxy`, spec §3.6. Tier standard. Figures: Problem annotated eager loading + access check tinted `bad`, BadgeList; Analogy debit-card strip; Structure client → `IFloorPlan` ← `FloorPlanProxy` → `ScannedFloorPlan`; Interaction Points "the page holds a stand-in", "first Render loads the real scan", "later calls go straight through"; When to use: checklist, kinds of proxy (virtual, protection, caching, remote) figure, Proxy vs Decorator figure, `Lazy<T>` note, Pitfalls with code pairs. `example.cs` shows the scan created only on first render and an access refusal; "change it": add a cache.

### Task 12: Proxy Exercises and Exam Questions
Recipe P for `proxy`: 3+3; ≥1 Decorator-lookalike Exam Question that is still Proxy (controls access to one object). Checks per spec §4 incl. Review Focus 2 (creation counter: 0 before first use, 1 after several uses; access rule; results equal). Exam texts avoid "proxy", "subject", "surrogate", "wrapper".

### Task 13: Cross-pattern pass, e2e and the one full run

**Files:** `web/e2e/lesson.spec.ts` (Lesson loop includes the six new ids), `web/e2e/patterns.spec.ts` (pattern list), any Catalog/Progress test that hard-codes the built count (8 → 14 or 9 → 15 — read the current value), existing exam scenarios that name a new role word.

- [ ] **Step 1:** grep every `content/patterns/*/exam/*/text.en.yaml` and Contract for the new `roleNames` (case-insensitive, plurals). Fix hits in existing content; record in the report.
- [ ] **Step 2:** update e2e lists and built-count tests.
- [ ] **Step 3: the one full run:** `cd web && npx vitest run`; `npx tsc -b`; `npx oxlint`; `dotnet test` (solution); `npx playwright test lesson.spec`; `npx playwright test patterns.spec`; `npx playwright test catalog.spec exam.spec`. All pass; report seconds.
- [ ] **Step 4:** commit `test: cover the Structural Patterns in e2e`.
