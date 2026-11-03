# Remaining Behavioral Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, State, Template Method and Visitor completely. Each gets a visual Lesson, Exercises and Exam Questions, so all 23 Patterns are built.

**Architecture:** Content only, exactly like the Structural plan `docs/superpowers/plans/2026-11-02-structural-patterns.md`. Every Pattern copies the file layout of an existing built Pattern (`content/patterns/<id>/…`). Loaders, the .NET content validator, and the Lesson, Exercise and Exam pages pick it up with no code changes. Lessons use the Lesson visual components (`web/src/features/lesson/visuals/`, DESIGN.md → "Lesson visual vocabulary").

**Tech Stack:** MDX 3, YAML content, C# (Roslyn-compiled Checks), Vitest, .NET xUnit content tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-behavioral-patterns-design.md` — binding: §2 tiers, lookalikes, roleNames; §3 Lesson stories and roles; §4 Exercise and Exam rules, valid alternatives and Checks.

**Reference Patterns:** `content/patterns/bridge/` or `flyweight/` (Tricky layout: descriptive exercise ids, 5+5) and `content/patterns/observer/` / `strategy/` / `proxy/` (Standard: `complete`, `refactor`, `build`, 3 exam questions). Best visual Lessons: `factory-method`, `observer`, `abstract-factory`, `flyweight`.

## Global Constraints

- Everything in the Structural and Creational plans' Global Constraints binds as written (M4 constraints: i18n, tokens, Lucide icons only, commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, tiers, layout, fixed Lesson section ids/order, **unique domains** (grep `content/` before choosing one), **no pattern giveaway** in Exam titles/scenarios/Contracts with `roleNames` incl. plurals, Lookalikes are Catalog ids only, ≥1 Lookalike-plausible Exam Question per Pattern).
- **Lesson tasks** create `pattern.yaml` with `version: 0`, `exercises: []`, `examQuestions: []`; the Practice task fills the lists, sets `roleNames` and `version: 1`.
- **Visual Lessons from the start:** every box-and-arrow figure is a described `<Figure>`; role tags follow spec §3's roles; BadgeList `count` = number of leading bullets with a code badge; a Figure caption never repeats its Card title; stacked grids at 390 use down arrows, labels never touch box edges; inner objects take their participant's role; no raw `className` in MDX; Point asides with two alternatives group each alternative (Card or labelled Stack) so they don't merge into one chain at 390; scene actor labels ≤5–6 chars; long inline code in Lesson prose must not overflow 390px.
- **Checks:** every failure reason a Check (or a helper) can raise has a key in the exercise's `text.en.yaml`; a Check comparing a value with a literal passes `new { expected = "…", actual = x }`.
- **Valid alternatives pass** (spec §4). Each Practice report names the alternatives its Checks accept.
- **Hidden requirements are forbidden.**
- **Cross-pattern giveaways:** the validator only bans a Pattern's OWN roleNames; grep Exam texts by hand for the other 22 Patterns' role words.
- **Test budget:** tasks run only their own Verify commands; reviewers run no tests; full suites run in Task 19 and after the final fix wave; implementers report seconds per command.
- **Memory is low:** one dev server or Playwright run at a time, stopped afterwards; never port 5199 (the user's). Screenshots go to the session scratchpad named in the dispatch, never into the repo. A stale `web/node_modules/.vitest-cache` can make a new Lesson show "couldn't load" — delete it.

## Task recipes

**Lesson task (L):** files under `content/patterns/<id>/`: `pattern.yaml`, `text.en.yaml` (intent, structure node texts, scene step texts, lookalikes), `lesson.en.mdx`, `example.cs` (runs, prints the story's output), `structure.yaml`, `scene.yaml`; modify `web/src/features/lesson/LessonPage.test.tsx`.
1. Failing test `the <Name> Lesson shows its visuals`, same shape as the Flyweight test: Key idea count, `#problem` bad lines, BadgeList items, three `.fig-point`, checklist verdicts, pitfall code pairs, one `getByRole('figure', { name })` per named figure. Run `cd web && npx vitest run src/features/lesson` → FAIL.
2. Write the content.
3. Verify: `cd web && npx vitest run src/content src/features/lesson`; `npx tsc -b`; `dotnet test tests/DesignPatterns.Content.Tests --filter "DisplayName~<id>"`; one screenshot script of `/patterns/<id>` per Section at 390 and 1440, light and one dark; read them.
4. Commit `content(<id>): Lesson`.

**Practice task (P):** `content/patterns/<id>/exercises/<ids>/…` and `exam/<ids>/…`, same file set as the reference Pattern of the same tier; in `pattern.yaml` fill `exercises`, `examQuestions`, `roleNames` (spec §2 exactly), set `version: 1`.
1. Write the content (Checks per spec §4 "Checks test the behaviour that matters"; structural Check accepts the spec §4 alternatives).
2. Verify: `dotnet test tests/DesignPatterns.Content.Tests --filter "DisplayName~<id>/"`; `cd web && npx vitest run src/content`.
3. Commit `content(<id>): Exercises and Exam Questions`. Report lists the new domains.

## Review Focus

1. Valid alternatives rejected (spec §4 list). Iterator: a `yield return` solution must pass. Memento: a nested-class and a record memento must both pass.
2. Behaviour Checks that would pass a non-pattern solution where the spec names a structural Check (State: status switch; Mediator: colleagues referencing each other; Chain: a central loop; Visitor: `is` checks inside elements).
3. Cross-pattern giveaways against all 23 Patterns' `roleNames`.
4. Tier counts and directories (content test).
5. Lessons at 390px.

---

### Task 1: Chain of Responsibility Lesson
Recipe L for `chain-of-responsibility`, spec §2 row and §3.1. Tier standard. Figures: Problem annotated `if/else` ladder tinted `bad`, BadgeList, KeyIdea; Analogy phone-escalation strip; Structure client → first `Approver` → next → next, each `concrete` under `contract` `Approver`; Interaction Points "the form hands the claim to the first link", "each approver decides: mine or next", "the end of the chain has a default"; When to use: checklist, Chain vs Decorator figure, Pitfalls with code pairs (no default at the end; a handler forgetting to pass on). `example.cs` routes claims of 60, 800, 4,000 and 25,000 EUR; "change it": add a travel-desk link in front.

### Task 2: Chain of Responsibility Exercises and Exam Questions
Recipe P for `chain-of-responsibility`: 3 Exercises `complete`, `refactor`, `build`; 3 Exam Questions; ≥1 Decorator- or Observer-lookalike Exam Question that is still a chain (one request, one taker). Checks per spec §4 incl. the structural Check that each handler holds a reference to the next and no class loops over a handler list. Exam texts avoid "handler", "successor", "chain".

### Task 3: Command Lesson
Recipe L for `command`, spec §3.2. Tier standard. Figures: Problem annotated undo `switch` tinted `bad`, BadgeList; Analogy order-slip strip; Structure `EditHistory` → `IPlaylistEdit` ← `AddSong`/`RemoveSong`/`MoveSong` → `Playlist`; Interaction Points "a button makes an edit object", "the history runs it and keeps it", "undo asks the last edit to reverse itself"; When to use: checklist, Command vs Strategy figure, undo stack figure, Pitfalls with code pairs. `example.cs` adds, moves, removes, undoes twice; "change it": add a `RenamePlaylist` edit.

### Task 4: Command Exercises and Exam Questions
Recipe P for `command`: 3+3; ≥1 Strategy- or Memento-lookalike Exam Question that is still Command (requests as objects with undo/queue). Checks per spec §4. Exam texts avoid "command", "invoker", "receiver".

### Task 5: Interpreter Lesson
Recipe L for `interpreter`, spec §3.3. Tier tricky. Figures: Problem annotated string-splitting code tinted `bad`, BadgeList; Analogy sheet-music strip; Structure `IRule` ← `SensorIs` (terminal) and `Both`/`Either`/`Not` (nonterminal, hold child rules), `Readings` context; a sentence-to-tree figure for `soil-dry and not raining`; Interaction Points "build the tree once", "each node asks its children", "a sensor rule reads the readings"; When to use: checklist, Interpreter vs Composite figure, Pitfalls with code pairs (big grammars; mixing parsing and evaluating). `example.cs` evaluates two rules against three readings; "change it": add an `Either` rule for frost.

### Task 6: Interpreter Exercises and Exam Questions
Recipe P for `interpreter`, Tricky: 5 Exercises (descriptive ids) + 5 Exam Questions; ≥1 Composite- or Strategy-lookalike Exam Question that is still Interpreter (a small language whose sentences are evaluated). Checks per spec §4. Exam texts avoid "interpreter", "expression", "terminal", "nonterminal", "grammar".

### Task 7: Iterator Lesson
Recipe L for `iterator`, spec §3.4. Tier standard. Figures: Problem annotated repeated nested loops tinted `bad`, BadgeList; Analogy channel-up strip; Structure clients → `CoinAlbum` → walker with its own position; hand-written walker vs `yield return` two-card figure; Interaction Points "ask the album for a walker", "the walker remembers where it is", "two walks don't disturb each other"; When to use: checklist, Pitfalls with code pairs (changing the collection during a walk; exposing the storage). `example.cs` prints coins in order and their total value; "change it": a walker for one country only.

### Task 8: Iterator Exercises and Exam Questions
Recipe P for `iterator`: 3+3; ≥1 Composite- or Visitor-lookalike Exam Question that is still Iterator (walking elements in an order without exposing storage). Checks per spec §4 (order, skipping empties, two independent walks, empty collection; `yield` solutions pass). Exam texts avoid "iterator", "aggregate", "cursor".

### Task 9: Mediator Lesson
Recipe L for `mediator`, spec §3.5. Tier tricky. Figures: Problem web-of-references figure plus annotated code tinted `bad`, BadgeList; Analogy control-tower strip; Structure widgets → `ITicketForm` ← `TicketForm` owning the widgets; Interaction Points "a widget says it changed", "the form decides who reacts", "widgets never call each other"; When to use: checklist, Mediator vs Observer and Mediator vs Facade figures, Pitfall god-object with code pair. `example.cs` picks a film, a showtime, two seats, a student ticket and prints the price; "change it": add a snack-combo checkbox.

### Task 10: Mediator Exercises and Exam Questions
Recipe P for `mediator`, Tricky: 5+5 (descriptive ids); ≥1 Observer- or Facade-lookalike Exam Question that is still Mediator (peers that react to each other). Checks per spec §4 incl. the reflection Check that colleagues hold no field typed as another colleague. Exam texts avoid "mediator", "colleague".

### Task 11: Memento Lesson
Recipe L for `memento`, spec §3.6. Tier tricky. Figures: Problem annotated public-internals copying tinted `bad`, BadgeList; Analogy save-slot strip; Structure `CheckpointHistory` holds `BoardCheckpoint`s, `SudokuBoard` makes and reads them; who-can-see-inside figure; Interaction Points "the board saves itself", "the history only keeps it", "restore hands it back to the board"; When to use: checklist, Memento vs Command figure, Pitfalls with code pairs (shared mutable arrays; unbounded history). `example.cs` saves, guesses, restores and prints the board line; "change it": keep only the last three checkpoints.

### Task 12: Memento Exercises and Exam Questions
Recipe P for `memento`, Tricky: 5+5 (descriptive ids); ≥1 Command- or Prototype-lookalike Exam Question that is still Memento (restore the same object later). Checks per spec §4 (exact restore, snapshot not affected by later changes, no public state on the memento). Exam texts avoid "memento", "originator", "caretaker", "snapshot".

### Task 13: State Lesson
Recipe L for `state`, spec §3.7. Tier tricky. Figures: Problem annotated status `switch` tinted `bad`, BadgeList; Analogy traffic-light strip; Structure `Scooter` → `IScooterState` ← four states; a transition diagram figure; Interaction Points "the scooter asks its current state", "the state decides and switches", "a new state is one new class"; When to use: checklist, State vs Strategy figure, Pitfalls with code pairs. `example.cs` unlocks, rides, pauses, resumes, ends; "change it": a `LowBattery` state that refuses `Resume`.

### Task 14: State Exercises and Exam Questions
Recipe P for `state`, Tricky: 5+5 (descriptive ids); ≥1 Strategy-lookalike Exam Question that is still State (the object changes behaviour by itself as its situation changes). Checks per spec §4 incl. the structural Check (no status enum/string field switched on in the context; a state type with the stated implementations). Exam texts avoid "state" as a role word ("status", "mode", "stage" are fine), "transition", "context".

### Task 15: Template Method Lesson
Recipe L for `template-method`, spec §3.8. Tier standard. Figures: Problem two copied renewals side by side with drifted lines tinted `bad`, BadgeList; Analogy fill-in-the-blanks strip; Structure `MembershipRenewal` (fixed `Renew()`) ← `JuniorRenewal`, `SeniorRenewal`; a steps figure marking fixed, filled-in and hook steps; Interaction Points "call the fixed method", "the base runs the steps in order", "subclasses answer only their steps"; When to use: checklist, Template Method vs Strategy figure, Pitfalls with code pairs (overridable template; too many steps). `example.cs` renews a junior and a senior; "change it": a family renewal using the hook.

### Task 16: Template Method Exercises and Exam Questions
Recipe P for `template-method`: 3+3; ≥1 Strategy- or Factory-Method-lookalike Exam Question that is still Template Method. Checks per spec §4 (order recorded per subclass, template not virtual, hook default). Exam texts avoid "template", "hook", "abstract class", "concrete class", "primitive operation".

### Task 17: Visitor Lesson
Recipe L for `visitor`, spec §3.9. Tier tricky. Figures: Problem annotated item classes each growing report methods tinted `bad`, BadgeList; Analogy home-inspector strip; Structure items with `Accept` ↔ `IItemVisitor` with one `Visit` per item ← two reports; double-dispatch figure; Interaction Points "the report goes to each item", "the item calls the right Visit", "a new report is one new class"; When to use: checklist, the add-element-vs-add-operation trade-off figure, pattern matching note, Pitfalls with code pairs. `example.cs` prints moving cost and insurance value for a small inventory; "change it": a packing-list visitor.

### Task 18: Visitor Exercises and Exam Questions
Recipe P for `visitor`, Tricky: 5+5 (descriptive ids); ≥1 Composite- or Iterator-lookalike Exam Question that is still Visitor (new operations over a fixed set of element classes). Checks per spec §4 incl. the structural Check. Exam texts avoid "visitor", "visit", "accept", "element".

### Task 19: Cross-pattern pass, e2e and the one full run

**Files:** `web/e2e/lesson.spec.ts` (Lesson loop includes the nine new ids), `web/e2e/patterns.spec.ts` (pattern list), any Catalog/Progress test that hard-codes the built count (read the current value; it becomes 23), existing exam scenarios that name a new role word.

- [ ] **Step 1:** grep every `content/patterns/*/exam/*/text.en.yaml` and Contract for the new `roleNames` (case-insensitive, plurals). Fix hits in existing content; record in the report.
- [ ] **Step 2:** update e2e lists and built-count tests.
- [ ] **Step 3: the one full run:** `cd web && npx vitest run`; `npx tsc -b`; `npx oxlint`; `dotnet test` (solution); `npx playwright test lesson.spec`; `npx playwright test patterns.spec`; `npx playwright test catalog.spec exam.spec`. All pass; report seconds.
- [ ] **Step 4:** commit `test: cover the Behavioral Patterns in e2e`.
