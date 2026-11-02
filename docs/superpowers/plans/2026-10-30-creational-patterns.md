# Remaining Creational Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Abstract Factory, Builder and Prototype completely. Each gets a visual Lesson, Exercises and Exam Questions, so all five Creational Patterns are built.

**Architecture:** This is content only. Every Pattern copies the file layout of an existing built Pattern (`content/patterns/<id>/…`). The loaders, the .NET content validator, and the Lesson, Exercise and Exam pages pick it up with no code changes. Lessons are written with the Lesson visual components (`web/src/features/lesson/visuals/`, documented in DESIGN.md → "Lesson visual vocabulary").

**Tech Stack:** MDX 3, YAML content, C# (Roslyn-compiled Checks), Vitest, .NET xUnit content tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-creational-patterns-design.md`, which is binding: §2 sets the tiers, lookalikes and roleNames, §3 the Lesson stories and roles, and §4 the Exercise and Exam rules. It builds on:
- the trainer spec `docs/superpowers/specs/2026-10-22-design-patterns-trainer-design.md`: §3–§5;
- the M4 content plan `docs/superpowers/plans/2026-10-23-m4-content.md`, whose Global Constraints, conventions and Review Focus apply here as written;
- the visual Lesson specs `2026-10-29-visual-lesson-factory-method-design.md` and `2026-10-30-visual-lessons-rollout-design.md`.

**Reference Patterns:** `content/patterns/factory-method/` is the Tricky layout: descriptive exercise ids and 5+5. `content/patterns/decorator/` is the Standard layout: `complete`, `refactor` and `build`, plus 3 exam questions. The best visual Lessons are `factory-method` and `observer`.

## Global Constraints

- The M4 Global Constraints bind as written:
  - i18n;
  - tokens;
  - Lucide icons only;
  - the commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - tiers;
  - layout;
  - fixed Lesson section ids and order;
  - **unique domains** (see the registry below);
  - **no pattern giveaway** in Exam titles, scenarios and Contracts (`roleNames`, plurals included);
  - Lookalikes are Catalog ids only;
  - at least one Exam Question per Pattern uses a Lookalike-plausible scenario.
- **Lesson tasks** create `pattern.yaml` with `version: 0`, `exercises: []` and `examQuestions: []`. The Practice task fills in those lists and sets `version: 1`, as M4 Ruling 1 describes.
- **Visual Lessons from the start:**
  - every box-and-arrow figure is a described `<Figure>`;
  - role tags follow spec §3's roles;
  - BadgeList `count` equals the number of leading bullets that have a code badge;
  - a Figure caption never repeats its Card title;
  - stacked grids at 390px use down arrows, and labels never touch box edges;
  - inner objects take their participant's role, never `primary` just because of their position;
  - no raw `className` in MDX.
- **Valid alternatives pass** (spec §4). Each Practice report names the alternative designs its Checks deliberately accept.
- **Hidden requirements are forbidden.** Every behaviour a Check enforces is stated in the scenario.
- **Test budget** (M4 rule). Tasks run only their own Verify commands. Reviewers run no tests. The full suites run in Task 7 and after the final fix wave. Every implementer reports the wall-clock seconds of each command.
- **Memory is low.** Run one dev server or Playwright run at a time, and stop them afterwards. Screenshots go to the scratchpad `C:\Users\calexand\AppData\Local\Temp\claude\D--Repos-Design-Patterns\60c64b16-9341-4001-8677-cac3bc9cbb5f\scratchpad\`, never into the repo.

## Domain registry (domains already used; never reuse)

**Lesson examples:**
- weather station
- shipping costs at checkout
- video captions and subtitles
- bakery queue tickets
- platform-game enemy waves

**Exercises:**
- fantasy weapon enchantments
- garden moisture sensors
- rental extras
- archive formats
- museum audio tours
- dentist reminders
- hotel key desks
- tea counter pots
- auction bidders
- weather station
- stock ticker
- bike-share dock map
- ferry departure board
- planetarium star catalogue
- pottery kiln bookings
- recipe app feature switches
- report card grading
- playlist orders
- contact export

**Exam:**
- gym entry gate
- travel phrasebook
- till shelf prices
- book exports
- instrument tuners
- lab sample labels
- parking meters
- ski passes
- CI build status
- live football score
- parcel tracking
- hiking units
- smart home hub
- notes-app spell check
- sports hall courts
- tram fares
- library catalogue search
- newsroom headlines
- robot vacuum modes

**New in this plan** (Lesson examples): café breakfast sets (Abstract Factory), rail journey booking (Builder) and wedding seating plan (Prototype). Each Practice task appends its 6 or 10 domains here in its report, and the controller carries the list forward.

## Review Focus

1. **Valid alternatives rejected:**
   - Abstract Factory: an abstract-class factory instead of an interface.
   - Builder: `void` step methods instead of fluent ones, where the Contract allows it.
   - Prototype: a copy constructor or `MemberwiseClone` plus a deep copy.

   Checks must not hard-code one implementation. Practice reviewers check this.
2. **Shallow copy passing Prototype Checks.** Expected: a shared list fails a "copy is independent" Check. The Prototype Practice task must include such a Check, written as an explicit test.
3. **Cross-pattern giveaways.** A new scenario uses a role word of any built Pattern ("factory" in a Builder question, "builder" in an Abstract Factory question), or an existing scenario now names a new Pattern's role. Practice reviewers check against all 8 Patterns' `roleNames`. Task 7 greps the existing exam texts for the new role words.
4. **Tier counts and directories.** The existing content test enforces them. Practice tasks run it.
5. **Lessons at 390px.** The Task 7 e2e loop covers all 8 Lessons for overflow, and each Lesson task screenshots once.

---

### Task 1: Abstract Factory Lesson

**Files:** under `content/patterns/abstract-factory/`, create `pattern.yaml`, `text.en.yaml`, `lesson.en.mdx`, `example.cs`, `structure.yaml` and `scene.yaml`. Modify `web/src/features/lesson/LessonPage.test.tsx`.

**Content:**
- Spec §2 row and §3.1 story and roles.
- Category creational, tier tricky, `version: 0`, with empty `exercises` and `examQuestions`. The lookalike texts go in `text.en.yaml`.
- The Lesson is fully visual. Its figures:
  - Problem: annotated code where the two `switch`es are tinted `bad`, with a `BadgeList` and a `KeyIdea`.
  - Analogy: the showroom collections strip.
  - Structure: a figure of one factory to a family of products, with two kitchens and two families.
  - Interaction: three Points, which are "choose the family once", "every product from that one object", and "swap the kitchen and the whole family changes".
  - When to use: a checklist; a Factory Method vs Abstract Factory two-card figure; a "new product kind touches every factory" figure; and Pitfall cards with code pairs.
- `example.cs` runs and prints both breakfasts, and the Lesson's "change it" exercise is adding a third set.

- [ ] **Step 1: Write the failing test.** Add a LessonPage test `the Abstract Factory Lesson shows its visuals`, with the same shape as the Observer/Strategy tests in that file: the Key idea count, `#problem` bad lines, BadgeList items, three `.fig-point`, checklist verdicts, pitfall code pairs, and one `getByRole('figure', { name })` per named figure.
  Run: `cd web && npx vitest run src/features/lesson`
  Expected: FAIL.
- [ ] **Step 2: Write the content.**
- [ ] **Step 3: Verify.**
  Run:
  - `cd web && npx vitest run src/content src/features/lesson`
  - `npx tsc -b`
  - `dotnet test tests/DesignPatterns.Content.Tests --filter "DisplayName~abstract-factory"`

  Then run one screenshot script of `/patterns/abstract-factory` per Section, at 390 and 1440, light and one dark. Read the screenshots. Report the seconds of each command.
- [ ] **Step 4: Commit.** `content(abstract-factory): Lesson`

### Task 2: Abstract Factory Exercises and Exam Questions

**Files:** `content/patterns/abstract-factory/exercises/<5 ids>/…` and `exam/<5 ids>/…`. In `pattern.yaml`, fill in `exercises`, `examQuestions` and `roleNames`, and set `version: 1`.

**Content:**
- Follow the Factory Method Practice conventions. There are 5 Exercises: `complete`, 2× `refactor` and 2× `build`, with descriptive kebab-case ids in kind order. There are 5 Exam Questions.
- `roleNames` are exactly as in spec §2. All content avoids "product", "factory", "family" and "kit" as domain words in Exam texts.
- At least one Exam Question uses a Factory-Method-lookalike scenario that is still Abstract Factory: several related objects that must match.
- Checks prove that products from one creator always belong to the same family and that the client never names a concrete product. The structural Check accepts an interface or an abstract class as the creator type.

- [ ] **Step 1: Write the content.**
- [ ] **Step 2: Verify.**
  Run:
  - `dotnet test tests/DesignPatterns.Content.Tests --filter "DisplayName~abstract-factory/"`
  - `cd web && npx vitest run src/content`

  Report the seconds.
- [ ] **Step 3: Commit.** `content(abstract-factory): Exercises and Exam Questions`

### Task 3: Builder Lesson

Same shape as Task 1, for `builder`:
- Spec §2 row and §3.2.
- Tier standard.
- Its figures:
  - Problem: annotated telescoping-constructor call and constructor, with a BadgeList.
  - Analogy: the bicycle shop strip.
  - Structure: a builder → `Build()` → immutable product figure, with the optional director.
  - Interaction: three Points, which are "steps in any order", "`Build()` checks the whole", and "the product can't change afterwards".
  - When to use: a checklist; an "object initializer / record `with` is enough" vs "Builder earns its place" two-card figure; and Pitfalls with code pairs.

The test is `the Builder Lesson shows its visuals`. The commit message is `content(builder): Lesson`.

### Task 4: Builder Exercises and Exam Questions

Same shape as Task 2, for `builder`:
- **3 Exercises** with ids `complete`, `refactor` and `build`, and **3 Exam Questions**.
- `roleNames` as in spec §2.
- At least one Exam Question uses an Abstract-Factory-lookalike scenario that is still Builder: one complex object assembled step by step.
- Checks prove three things:
  - `Build()` rejects an invalid combination that the scenario states;
  - a built object is unaffected by later builder calls, where the scenario says so;
  - steps can be given in any order the scenario allows.

  Accept fluent and `void` steps where the Contract allows.

The commit message is `content(builder): Exercises and Exam Questions`.

### Task 5: Prototype Lesson

Same shape as Task 1, for `prototype`:
- Spec §2 row and §3.3.
- Tier standard.
- Its figures:
  - Problem: annotated copy-and-paste table setup, with a BadgeList.
  - Analogy: the key cutter strip.
  - Structure: an `ITable.Clone()` figure with two concrete tables and the client.
  - Interaction: three Points, which are "copy from an object, not a class", "the copy keeps its concrete type", and "change the copy and the original stays".
  - When to use: a checklist; a **shallow vs deep copy** figure (a shared chair list vs copied lists, using nested boxes and ✕/✓); .NET notes (`MemberwiseClone`, `ICloneable`, records `with`) as a code pair or cards; a prototype registry figure; and Pitfalls with code pairs.

The test is `the Prototype Lesson shows its visuals`. The commit message is `content(prototype): Lesson`.

### Task 6: Prototype Exercises and Exam Questions

Same shape as Task 2, for `prototype`:
- **3 Exercises** with ids `complete`, `refactor` and `build`, and **3 Exam Questions**.
- `roleNames` as in spec §2. Exam texts avoid "clone", "prototype" and "cloneable". They use domain verbs such as "duplicate" or "copy".
- At least one Exam Question uses a Memento- or Abstract-Factory-lookalike scenario that is still Prototype.
- Checks prove three things:
  - the copy has the same concrete type, without the caller naming it;
  - the copy is **independent**, so mutating its collection or nested object leaves the original alone, and a shallow copy fails this (Review Focus 2);
  - the original is unchanged by copying.

  Accept a copy constructor, a hand-written copy, or `MemberwiseClone` plus a deep copy of the collections.

The commit message is `content(prototype): Exercises and Exam Questions`.

### Task 7: Cross-pattern pass, e2e and the one full run

**Files:**
- Modify `web/e2e/lesson.spec.ts`, so the Lesson loop over ids includes `abstract-factory`, `builder` and `prototype`.
- Modify `web/e2e/patterns.spec.ts`, so its pattern list includes the three new ids.
- Modify any Catalog or Progress test that hard-codes the built count (5 → 8). The M4 appendix notes that the Catalog test does.
- If needed, modify an existing exam scenario that names a new Pattern's role word.

- [ ] **Step 1: Cross-pattern giveaway pass.** Grep every `content/patterns/*/exam/*/text.en.yaml` and Contract for the new `roleNames`, case-insensitive and including plurals. Fix any hit in the existing content and record it in the report.
- [ ] **Step 2: Update the e2e lists and the built-count tests.**
- [ ] **Step 3: Verify. This is the one full run.** Run once each:
  - `cd web && npx vitest run`
  - `npx tsc -b`
  - `npx oxlint`
  - `dotnet test` (whole solution)
  - `npx playwright test lesson.spec`
  - `npx playwright test patterns.spec`
  - `npx playwright test catalog.spec exam.spec`

  Expected: everything passes. Report the seconds.
- [ ] **Step 4: Commit.** `test: cover the Creational Patterns in e2e`
