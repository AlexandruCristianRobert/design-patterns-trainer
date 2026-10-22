# M2 · Learning Flow (pilot: Observer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A learner opens the Catalog, reads the Observer Lesson (text, Structure Diagram, Interaction Scene, runnable example), solves its three graded Exercises with Hints, and finds their Progress and Drafts saved — with all content validated automatically.

**Architecture:** Content lives as files under `content/` (YAML + MDX + C#), loaded into the Vite app at build time (YAML via a tiny plugin, MDX via `@mdx-js/rollup`, C# via `?raw`) and validated twice: structurally in Vitest and behaviourally in a .NET test project that compiles every solution/starter against its Checks with the M1 core. UI is React pages on top of the M1 engine (`useCompiler`), with one shared code panel, React Flow for Structure Diagrams, a Motion-based player for Scene Scripts, and IndexedDB (`idb`) for Progress and Drafts.

**Tech Stack:** M1 stack + `yaml`, `zod`, `@mdx-js/rollup`, `@mdx-js/react`, `@xyflow/react`, `motion`, `idb`, `fake-indexeddb` (dev) · .NET: `YamlDotNet` in the new test project.

**Spec:** `docs/superpowers/specs/2026-10-22-design-patterns-trainer-design.md` (milestone M2; §3 Catalog and content, §4 Grading, §7 Progress, §8 UI, §9 i18n). Also `CONTEXT.md` (vocabulary — use its terms in code and copy), `DESIGN.md`, ADRs 0001–0002. M1 code is on `main`.

## Global Constraints

- Everything from the M1 plan's Global Constraints still binds (i18next for all UI copy, `DESIGN.md` tokens, `uxkin:no-ui-slop` before UI work, Lucide only, no emoji, `VITE_BASE`, commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Content root is `content/` at the repo root. Pattern ids are kebab-case (`observer`, `factory-method`).
- The Catalog lists all 23 GoF Patterns; a Pattern is **built** when `content/patterns/<id>/pattern.yaml` exists, otherwise it shows "coming soon".
- Lesson sections, fixed ids and order: `problem`, `analogy`, `structure`, `interaction`, `example`, `when-to-use`.
- Standard Tier = 3 Exercises (one `complete`, one `refactor`, one `build`); Tricky = 5 (`complete`, 2× `refactor`, 2× `build`). Observer is Standard.
- Hints: at most 3 per Exercise. Reveal solution is available only after the first Check attempt. Using a Hint or the solution before all Checks pass makes the outcome **Solved with help**; that is sticky until the learner resets the Exercise.
- Exercise status values: `notStarted` | `attempted` | `solvedWithHelp` | `solved`; status never downgrades except by reset.
- Drafts autosave 500 ms after the last keystroke; a Draft whose `contentVersion` differs from the Exercise's `version` is kept and flagged stale.
- C# code in content is English-only; all prose lives in `text.<locale>.yaml` / `lesson.<locale>.mdx`; missing locale falls back to `en` with a "not yet translated" badge.
- Check messages: `text.<locale>.yaml` → `checks.<id>.failures.<reason>` for custom reasons; generic reasons from the `checks` i18n namespace.
- Exam scores and Exam Questions are M3: the Catalog shows "—" for best exam score.

## Spec deviation (ruled here)

`exercise.yaml` does **not** list Check ids (spec §3 says it does): ids are discovered from `checks.cs` at compile time and validated against the text file, so listing them twice would only create drift.

## Review Focus

1. **Valid solutions rejected:** every `solution.cs` must pass all its Checks in the real engine → .NET content validation (Task 2) runs on every pattern + browser e2e solves an Exercise with the shipped solution (Task 12).
2. **Lost work:** a page reload, a content version bump, or an import must never silently drop a Draft → Draft store tests for stale flagging and import (Task 4) + e2e reload (Task 12).
3. **Help honesty:** a Hint opened after the Exercise was already Solved must not downgrade it; a Hint before solving must make it Solved with help → status reducer tests (Task 4).
4. **Bad import file:** malformed or foreign JSON must leave existing Progress untouched and show a recoverable error → import tests (Task 4) + Progress page test (Task 11).
5. **Reduced motion and keyboard:** the Interaction Scene must be fully steppable by keyboard and show final states without animation under `prefers-reduced-motion` → scene player tests (Task 7).

---

## File Structure

```
content/
  catalog.yaml                     23 GoF entries: id, category, tier
  catalog.text.en.yaml             names + one-line intents for all 23
  patterns/observer/
    pattern.yaml · text.en.yaml · lesson.en.mdx · example.cs · structure.yaml · scene.yaml
    exercises/{complete,refactor,build}/exercise.yaml · text.en.yaml · starter.cs · solution.cs · checks.cs
tests/DesignPatterns.Content.Tests/
  ContentLocator.cs · ExerciseFiles.cs · ContentValidator.cs · CheckReasonScanner.cs
  ContentValidationTests.cs · Fixtures/content/patterns/fixture/...   (validator unit-test fixtures)
web/
  vite.config.ts                    + yaml plugin, mdx plugin, server.fs.allow
  scripts/vite-plugin-yaml.ts
  src/content/schema.ts · catalog.ts · patterns.ts · text.ts · content.test.ts
  src/progress/db.ts · progressStore.ts · drafts.ts · exportImport.ts · nextStep.ts · useProgress.ts · *.test.ts
  src/code/CodePanel.tsx · useDraft.ts                (shared editor + run + output; Sandbox refactored onto it)
  src/editor/CodeEditor.tsx          + highlightedLines prop
  src/features/catalog/CatalogPage.tsx · StructureThumbnail.tsx
  src/features/lesson/LessonPage.tsx · LessonContext.tsx · Section.tsx · LessonToc.tsx · LessonExample.tsx · mdxComponents.tsx
  src/visuals/StructureDiagram.tsx · structureNodes.tsx · umlEdges.tsx
  src/visuals/scene/sceneModel.ts · ScenePlayer.tsx · SceneStage.tsx · sceneModel.test.ts
  src/features/exercise/ExercisePage.tsx · gradeExercise.ts · CheckList.tsx · ContractView.tsx · HintsPanel.tsx · SolutionPanel.tsx
  src/features/progress/ProgressPage.tsx
  src/locales/en/{catalog,lesson,exercise,progress,checks,contract}.json
  e2e/learning.spec.ts
```

---

### Task 1: Content schema, loaders and the Catalog data

**Files:**
- Create: `content/catalog.yaml`, `content/catalog.text.en.yaml`, `web/scripts/vite-plugin-yaml.ts`, `web/src/content/{schema,catalog,patterns,text}.ts`, `web/src/content/content.test.ts`, `web/src/content/yaml.d.ts`
- Modify: `web/vite.config.ts` (yaml plugin; `server.fs.allow: ['..']`), `web/package.json` (add `yaml`, `zod`)

**Interfaces:**
- Produces (`web/src/content/schema.ts`, zod schemas + inferred types):
  ```ts
  export type Category = 'creational' | 'structural' | 'behavioral'
  export type Tier = 'standard' | 'tricky'
  export type ExerciseKind = 'complete' | 'refactor' | 'build'
  export type Role = 'primary' | 'contract' | 'concrete'
  export interface CatalogEntry { id: string; category: Category; tier: Tier }
  export interface CatalogText { name: string; intent: string }
  export interface PatternMeta { id: string; category: Category; tier: Tier; version: number; lookalikes: string[]; exercises: string[] }
  export interface StructureNode { id: string; name: string; role: Role; stereotype?: 'interface' | 'abstract'; members: string[]; x: number; y: number; codeLines?: [number, number] }
  export interface StructureEdge { id: string; from: string; to: string; kind: 'association' | 'realization' | 'inheritance' | 'dependency' | 'creates'; label?: string }
  export interface Structure { nodes: StructureNode[]; edges: StructureEdge[] }
  export interface SceneActor { id: string; name: string; role: Role }
  export interface SceneStep { id: string; call?: { from: string; to: string | string[]; label: string }; state?: Record<string, Record<string, string>>; code?: [number, number] }
  export interface SceneScript { actors: SceneActor[]; steps: SceneStep[] }
  export interface PatternText { intent: string; structure: Record<string, string>; scene: Record<string, string>; lookalikes: Record<string, string> }
  export interface ExerciseMeta { kind: ExerciseKind; version: number; contract: { types: ContractType[] } }   // ContractType from compiler/protocol.ts
  export interface ExerciseText { title: string; scenario: string; hints: string[]; checks: Record<string, { title: string; failures?: Record<string, string> }> }
  export const schemas: { catalog; catalogText; pattern; structure; scene; patternText; exercise; exerciseText }  // zod objects, hints max(3)
  ```
- Produces (loaders; YAML imported eagerly via `import.meta.glob`, `.cs` via `?raw`, MDX lazily — MDX lands in Task 8):
  ```ts
  // catalog.ts
  export interface CatalogItem extends CatalogEntry { built: boolean }
  export function getCatalog(): CatalogItem[]                               // 23 items, catalog.yaml order
  export function getCatalogText(id: string, lng: string): Localized<CatalogText>
  // patterns.ts
  export interface ExerciseContent { id: string; meta: ExerciseMeta; starter: string; solution: string; checks: string }
  export interface PatternContent { meta: PatternMeta; example: string; structure: Structure; scene: SceneScript; exercises: ExerciseContent[] }
  export function getPattern(id: string): PatternContent | undefined
  export function getBuiltPatternIds(): string[]
  // text.ts
  export interface Localized<T> { value: T; untranslated: boolean }      // untranslated = fell back to en for a non-en lng
  export function getPatternText(id: string, lng: string): Localized<PatternText>
  export function getExerciseText(patternId: string, exerciseId: string, lng: string): Localized<ExerciseText>
  ```
  Every loader parses with the zod schema and throws `Error("<file path>: <zod message>")` on invalid content.

`catalog.yaml` (exact ids, order, category, tier): creational — `abstract-factory` (tricky), `builder`, `factory-method` (tricky), `prototype`, `singleton` (tricky); structural — `adapter`, `bridge` (tricky), `composite`, `decorator`, `facade`, `flyweight` (tricky), `proxy`; behavioral — `chain-of-responsibility`, `command`, `interpreter` (tricky), `iterator`, `mediator` (tricky), `memento` (tricky), `observer`, `state` (tricky), `strategy`, `template-method`, `visitor` (tricky). Unlisted tiers are `standard`. `catalog.text.en.yaml` gives each a GoF name ("Abstract Factory", …) and a one-line intent of ≤ 80 characters written in plain English.

- [ ] **Step 1: Write failing tests** (`content.test.ts`):
  ```ts
  it('lists all 23 GoF patterns with 5/7/11 per category', () => { /* counts by category === {creational:5, structural:7, behavioral:11} */ })
  it('every catalog entry has an en name and intent ≤ 80 chars', () => {})
  it('marks only patterns with a pattern.yaml as built', () => { /* before Task 3 no pattern is built; after Task 3 only observer — assert built ids === getBuiltPatternIds() and every built id has a catalog entry */ })
  it('every built pattern: tier matches catalog, exercise count matches tier and kinds', () => { /* standard → 1 complete,1 refactor,1 build; tricky → 1,2,2 */ })
  it('every built pattern: structure edges reference existing nodes; scene calls reference existing actors; every scene step id and structure node id has text', () => {})
  it('every built pattern: each lookalike is a catalog id and has a text.lookalikes entry', () => {})
  it('every built exercise: ≤ 3 hints, non-empty title and scenario', () => {})
  it('falls back to en with untranslated=true for lng "de"', () => { /* getCatalogText('observer','de').untranslated === true */ })
  it('schema rejects invalid content with the file path in the message', () => { /* schemas.exercise.parse on {kind:'nope'} throws */ })
  ```
  The per-pattern tests iterate `getBuiltPatternIds()`; with none built they pass vacuously and start biting in Task 3.
- [ ] **Step 2: Run** `npm test -- --run src/content` — expect FAIL.
- [ ] **Step 3: Implement.** YAML plugin: `transform(code, id)` for `.yaml` → `export default ${JSON.stringify(parse(code))}`. Globs are relative to `web/src/content/` (e.g. `'../../../content/patterns/*/pattern.yaml'`).
- [ ] **Step 4: Run** — PASS; `npx tsc -b` clean.
- [ ] **Step 5: Commit** `feat(content): content schema, loaders and GoF catalog`.

---

### Task 2: .NET content validation

**Files:**
- Create: `tests/DesignPatterns.Content.Tests/` (xUnit, net10.0, refs Core + `YamlDotNet`; add to `DesignPatterns.slnx`): `ContentLocator.cs`, `ExerciseFiles.cs`, `ContentValidator.cs`, `CheckReasonScanner.cs`, `ContentValidationTests.cs`, `ValidatorTests.cs`, `Fixtures/content/patterns/fixture/exercises/{good,bad-starter,bad-solution,missing-text}/…`

**Interfaces:**
- Consumes: `CompilerService.Compile`, `RunnerService` / `LoadedProgram`, `Contract`, `ContractType`, `ContractTypeKind`, `RuntimeLimits.TimeoutMs` (M1 core).
- Produces:
  ```csharp
  public sealed record ExerciseFiles(string PatternId, string ExerciseId, string Kind, int Version, Contract Contract,
      string Starter, string Solution, string Checks, IReadOnlyDictionary<string, string> TextEnPathsByLocale);
  public static class ContentLocator {
      public static string Root { get; }                                    // walks up from AppContext.BaseDirectory to the dir containing DesignPatterns.slnx, + "/content"
      public static IEnumerable<ExerciseFiles> Exercises(string contentRoot);
  }
  public static class CheckReasonScanner {   // string literals passed as the reason argument
      public static IReadOnlyDictionary<string, IReadOnlySet<string>> CustomReasonsByCheck(string checksSource); // Expect.Fail("r", …) and Expect.That(cond, "r", …); generic reasons excluded
  }
  public sealed record ValidationResult(IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings);
  public static class ContentValidator { public static Task<ValidationResult> ValidateAsync(ExerciseFiles exercise); }
  ```
Validation rules (errors unless noted): solution compiles, satisfies the Contract and passes **every** Check (each Check bounded by `RuntimeLimits.TimeoutMs` via `Task.WhenAny`; timeout = error); starter fails at least one Check, where for `complete`/`refactor` the starter must compile and satisfy the Contract (so the learner gets Check feedback) and for `build` a compile error or Contract violation counts as failing; at least one Check exists; `text.en.yaml` has `checks.<id>.title` for every discovered id and `checks.<id>.failures.<reason>` for every custom reason; text entries for unknown check ids are errors; a missing non-`en` text file or missing keys in it are **warnings**. Generic reasons: `isFalse notEqual notSame same didNotThrow wrongException typeNotFound threw timedOut`.

- [ ] **Step 1: Write failing tests** — `ValidatorTests` on the four fixtures: `good` → no errors; `bad-starter` (starter already passes all checks) → error containing "starter"; `bad-solution` (solution fails a check) → error naming the check id; `missing-text` (a check id and a custom reason without text) → two errors naming them. `CheckReasonScanner`: `Expect.Fail("didNotNotify", new { o = 1 })` and `Expect.That(x, "usesIf")` inside `[Check("a")]` → `{ a: {didNotNotify, usesIf} }`; `Expect.That(x)` adds nothing. `ContentValidationTests`: `[Theory, MemberData]` over `ContentLocator.Exercises(ContentLocator.Root)` asserting `Errors` empty and writing warnings to `ITestOutputHelper`; when no exercises exist yet, the data source yields a single `null` sentinel that the test skips via early return (xUnit fails a Theory with no data).
- [ ] **Step 2: Run** `dotnet test tests/DesignPatterns.Content.Tests` — FAIL.
- [ ] **Step 3: Implement.** Tests that execute learner code join a non-parallel collection (same reason as M1's `ConsoleCaptureCollection`).
- [ ] **Step 4: Run** `dotnet test` (whole solution) — PASS.
- [ ] **Step 5: Commit** `test(content): validate exercises against their checks`.

---

### Task 3: Observer content

Write as a teacher for working C# developers: concrete, short sentences, no filler, no emoji. C# follows modern idioms (file-scoped types in one file, `List<T>`, expression-bodied members where natural, nullable-correct). All prose in English.

**Files:**
- Create: `content/patterns/observer/{pattern.yaml,text.en.yaml,lesson.en.mdx,example.cs,structure.yaml,scene.yaml}`, `content/patterns/observer/exercises/{complete,refactor,build}/{exercise.yaml,text.en.yaml,starter.cs,solution.cs,checks.cs}`

**Interfaces:**
- Consumes: schemas (Task 1), validator (Task 2), Check API (`Expect`, `Code`, `Source`) from M1.
- Produces: the pilot pattern every later task renders and e2e solves.

Content requirements:
- `pattern.yaml`: `id: observer`, `category: behavioral`, `tier: standard`, `version: 1`, `lookalikes: [mediator, chain-of-responsibility]`, `exercises: [complete, refactor, build]`.
- `example.cs`: runnable top-level program: `IObserver` (`void Update(int temperature)`), `WeatherStation` (`Subscribe`, `Unsubscribe`, `SetTemperature`), `PhoneDisplay`, `TvDisplay`; main code subscribes both, sets 23 then unsubscribes Tv and sets 25; prints lines like `Phone: 23°C`.
- `structure.yaml`: nodes `subject` (WeatherStation, primary), `observer` (IObserver, contract, stereotype interface), `phone` and `tv` (concrete); edges `subject→observer` association label `observers 0..*`, `phone→observer` and `tv→observer` realization; each node's `codeLines` points at its declaration in `example.cs`.
- `scene.yaml`: actors `station`, `phone`, `tv`; ≥ 6 steps: phone subscribes, tv subscribes, temperature set to 23 (state change on station), fan-out `Update(23)` to `[phone, tv]` with both states updated, tv unsubscribes, temperature 25 reaching only phone. Each step's `code` points into `example.cs`.
- `text.en.yaml`: intent; one sentence per structure node; one caption per scene step id; one-sentence difference per lookalike.
- `lesson.en.mdx`: exactly six `<Section id="…">` blocks in the fixed order (component contract from Task 8): `problem` (a `WeatherStation` hard-wired to three displays, with a short "before" code block and why it hurts), `analogy` (newsletter subscription), `structure` (prose + `<StructureDiagram />`), `interaction` (prose + `<InteractionScene />`), `example` (prose + `<LessonExample />`), `when-to-use` (when to use; pitfalls: forgotten unsubscribe leaks, notification order, re-entrancy while notifying, observers throwing; then `<Lookalikes />`). ~600–900 words.
- Exercises (Contracts never name roles beyond what client code touches):
  - `complete`: `WeatherStation` with list + Subscribe/Unsubscribe given; learner fills `SetTemperature` notify loop and `Unsubscribe` removal. Checks: `every-subscriber-notified`, `unsubscribed-not-notified`, `notified-with-new-value`, `no-subscribers-ok`.
  - `refactor`: "before" `Stock` that calls `_logger.Log`, `_chart.Plot`, `_alerts.Check` directly; learner introduces `IStockObserver` + `Attach/Detach` while the shipped `Main` output stays identical. Checks: `observers-receive-price`, `stock-has-no-concrete-dependencies` (structural: `Stock` has no fields of the three concrete types — via `Code.Type("Stock")` fields), `detach-works`, `output-unchanged` (calls a static `Demo.Run()` the starter provides and compares returned lines to the expected list).
  - `build`: scenario only — an auction where bidders are told about each new highest bid and can stop following; Contract: `IBidder` with `void OnNewHighBid(string bidder, decimal amount)`, class `Auction` with `void Follow(IBidder bidder)`, `void Unfollow(IBidder bidder)`, `void PlaceBid(string bidder, decimal amount)`. Checks: `followers-told-of-higher-bid`, `lower-bid-ignored`, `unfollowed-not-told`, `bidder-not-told-own-bid` (custom reason `toldOwnBid`).
  - Each `text.en.yaml`: title, scenario (2–5 short paragraphs; backticks for code), 3 Hints from gentle to specific, every check title, every custom failure message.
- [ ] **Step 1:** Write the files.
- [ ] **Step 2: Run** `dotnet test tests/DesignPatterns.Content.Tests` (all three exercises validate, no errors) and `cd web && npm test -- --run src/content` — PASS. Also run `example.cs` once through `CompilerService` (the content test project gets one extra test: every `example.cs` compiles and runs without exception).
- [ ] **Step 3: Commit** `content: Observer lesson, visuals and exercises`.

---

### Task 4: Progress, Drafts, export/import and Next Step

**Files:**
- Create: `web/src/progress/{db,progressStore,drafts,exportImport,nextStep,useProgress}.ts` + tests (`fake-indexeddb/auto` imported in the test files)
- Modify: `web/package.json` (`idb`, dev `fake-indexeddb`)

**Interfaces:**
- Produces:
  ```ts
  export type ExerciseStatus = 'notStarted' | 'attempted' | 'solvedWithHelp' | 'solved'
  export interface ExerciseProgress { status: ExerciseStatus; usedHelp: boolean; hintsRevealed: number; solutionRevealed: boolean; checkedOnce: boolean; updatedAt: string }
  export interface PatternProgress { patternId: string; lessonVisited: boolean; exercises: Record<string, ExerciseProgress> }
  export type ExerciseEvent = { type: 'checked'; allPassed: boolean } | { type: 'hintRevealed' } | { type: 'solutionRevealed' } | { type: 'reset' }
  export function applyExerciseEvent(prev: ExerciseProgress | undefined, e: ExerciseEvent, now: string): ExerciseProgress
  // progressStore.ts (IndexedDB "design-patterns-trainer", v1, stores: progress (key patternId), drafts (key draftKey))
  export function getProgress(patternId: string): Promise<PatternProgress>          // default empty
  export function getAllProgress(): Promise<PatternProgress[]>
  export function markLessonVisited(patternId: string): Promise<void>
  export function recordExerciseEvent(patternId: string, exerciseId: string, e: ExerciseEvent): Promise<ExerciseProgress>
  // drafts.ts
  export type DraftKey = `exercise:${string}/${string}` | `lesson:${string}`
  export interface Draft { key: DraftKey; code: string; contentVersion: number; updatedAt: string }
  export function loadDraft(key: DraftKey, currentVersion: number): Promise<{ draft: Draft; stale: boolean } | undefined>
  export function saveDraft(key: DraftKey, code: string, contentVersion: number): Promise<void>
  export function deleteDraft(key: DraftKey): Promise<void>
  // exportImport.ts
  export interface ProgressExport { app: 'design-patterns-trainer'; schemaVersion: 1; exportedAt: string; progress: PatternProgress[]; drafts: Draft[] }
  export function exportProgress(): Promise<ProgressExport>
  export type ImportResult = { ok: true; patterns: number; drafts: number } | { ok: false; reason: 'invalidJson' | 'notAnExport' | 'unsupportedVersion' }
  export function importProgress(json: string): Promise<ImportResult>               // validates fully (zod) before writing; replaces everything in one transaction
  // nextStep.ts
  export type NextStep = { kind: 'readLesson' } | { kind: 'exercise'; exerciseId: string; index: number } | { kind: 'examReady' }
  export function nextStep(meta: PatternMeta, progress: PatternProgress): NextStep
  // useProgress.ts — React hooks over the store with a change subscription
  export function usePatternProgress(patternId: string): PatternProgress | undefined
  export function useAllProgress(): PatternProgress[] | undefined
  ```
Status rules for `applyExerciseEvent`: `checked` with `allPassed` → `solved` unless `usedHelp` (then `solvedWithHelp`); `checked` without → `attempted` unless already solved/solvedWithHelp (no downgrade); `hintRevealed`/`solutionRevealed` set `usedHelp` only if not already solved/solvedWithHelp, increment counters, `checkedOnce` unchanged; `solutionRevealed` is ignored unless `checkedOnce`; `reset` → fresh `notStarted`.

- [ ] **Step 1: Write failing tests**
  ```ts
  it('solve without help → solved', ...)                 // checked(false) → attempted; checked(true) → solved
  it('hint before solving → solvedWithHelp', ...)
  it('hint after solved does not downgrade', ...)        // solved → hintRevealed → still solved, usedHelp false
  it('solution cannot be revealed before the first check', ...)
  it('failed check after solved does not downgrade', ...)
  it('reset returns to notStarted and clears help', ...)
  it('draft round-trips and is flagged stale on version change but kept', ...)
  it('export → import round-trips progress and drafts', ...)
  it('import of invalid JSON / foreign object / schemaVersion 2 leaves existing data untouched', ...)  // three cases, reasons as named
  it('nextStep: readLesson → first unsolved exercise in pattern order → examReady', ...)
  ```
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** — PASS, `npx tsc -b` clean.
- [ ] **Step 5: Commit** `feat(progress): IndexedDB progress, drafts, export/import, next step`.

---

### Task 5: Shared code panel and linked-line highlighting

**Load `uxkin:no-ui-slop` first.**

**Files:**
- Create: `web/src/code/CodePanel.tsx`, `web/src/code/useDraft.ts`, tests
- Modify: `web/src/editor/CodeEditor.tsx` (prop `highlightedLines?: [number, number] | null` → whole-line decoration class `line-linked`, scrolled into view), `web/src/features/sandbox/SandboxPage.tsx` (rebuilt on `CodePanel`; behaviour, copy and e2e hooks unchanged), `web/src/styles/base.css`

**Interfaces:**
- Consumes: `useCompiler`, `runSandbox`, `OutputPanel`, `useLiveDiagnostics`, `CodeEditor` (M1); drafts (Task 4).
- Produces:
  ```ts
  export function useDraft(key: DraftKey | null, initial: string, contentVersion: number):
    { code: string; setCode(c: string): void; stale: boolean; loaded: boolean; reset(to: string): void }   // autosave 500 ms; key null = no persistence
  export interface CodePanelProps {
    code: string; onChange(c: string): void; fileName: string; ariaLabel: string
    highlightedLines?: [number, number] | null
    extraActions?: ReactNode          // e.g. the Exercise "Check" button, placed before Run
    results?: ReactNode               // rendered under the output (Check list)
    readOnly?: boolean
  }
  export function CodePanel(p: CodePanelProps): JSX.Element   // editor + compiler status + Run (Ctrl/Cmd+Enter) + OutputPanel
  ```
- [ ] **Step 1: Write failing tests:** `useDraft` loads an existing draft, autosaves once 500 ms after the last change (fake timers), reports `stale`, `reset` overwrites and saves; `CodePanel` (CodeEditor mocked) runs via `runSandbox` and shows output; existing Sandbox tests still pass unchanged.
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** `npm test -- --run`, `npx tsc -b`, `npm run e2e` (M1 e2e must stay green) — PASS.
- [ ] **Step 5: Commit** `refactor(web): shared CodePanel with drafts and linked-line highlighting`.

---

### Task 6: App navigation and Catalog page

**Load `uxkin:no-ui-slop` first.** Page pattern: list.

**Files:**
- Create: `web/src/features/catalog/{CatalogPage,StructureThumbnail}.tsx`, `web/src/locales/en/catalog.json`, tests
- Modify: `web/src/App.tsx` (header nav: Catalog `/`, Sandbox `/sandbox`, Progress `/progress`; routes `/` → Catalog, `/patterns/:patternId`, `/patterns/:patternId/practice/:exerciseId`, `/progress` — pages from later tasks may be placeholders until they land), `web/src/i18n/index.ts` (register new namespaces as they are added), `web/src/locales/en/common.json` (`nav.catalog` "Catalog", `nav.sandbox` "Sandbox", `nav.progress` "Progress")

**Interfaces:**
- Consumes: `getCatalog`, `getCatalogText`, `getPattern` (Task 1), `useAllProgress`, `nextStep` (Task 4).
- Produces: `StructureThumbnail({ structure }: { structure: Structure })` — static SVG (no React Flow) scaling node boxes and edges into a 72×44 box with role colours.

Rows grouped by Category headers ("Creational", "Structural", "Behavioral" with "N of M available"). Built row: thumbnail, name (link to Lesson), intent, Tier badge, one dot per Exercise (notStarted / attempted / solvedWithHelp half-filled / solved filled, with an accessible label), best exam "—", Next Step link ("Read the Lesson" / "Exercise {{index}}" / "Ready for the exam" — exam link disabled until M3 with a "coming in a later update" tooltip). Unbuilt row: muted, name + intent + "Coming soon", not a link. Copy keys in `catalog.json`: `title` "Catalog", `intro` "The 23 Gang of Four design patterns. Start with any one — nothing is locked.", `category.*`, `available` "{{built}} of {{total}} available", `tier.standard` "Standard", `tier.tricky` "Tricky", `comingSoon` "Coming soon", `bestExam` "Best exam", `next.readLesson` "Read the Lesson", `next.exercise` "Exercise {{index}}", `next.examReady` "Ready for the exam", `exercise.status.*` (`notStarted` "Not started", `attempted` "Attempted", `solvedWithHelp` "Solved with help", `solved` "Solved").

- [ ] **Step 1: Write failing tests:** renders 23 rows in 3 groups with counts; Observer row links to `/patterns/observer` and shows 3 dots; unbuilt rows are not links and say "Coming soon"; Next Step reflects seeded progress (fake-indexeddb). `StructureThumbnail` renders one rect per node.
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** — PASS; visual check at ~390 px and ~1440 px, light and dark, keyboard.
- [ ] **Step 5: Commit** `feat(web): navigation and Catalog page`.

---

### Task 7: Structure Diagram and Scene player

**Load `uxkin:no-ui-slop` first.** Respect `DESIGN.md` role colours and `prefers-reduced-motion`.

**Files:**
- Create: `web/src/visuals/{StructureDiagram,structureNodes,umlEdges}.tsx`, `web/src/visuals/scene/{sceneModel,ScenePlayer,SceneStage}.ts(x)`, `web/src/features/lesson/LessonContext.tsx`, tests
- Modify: `web/package.json` (`@xyflow/react`, `motion`)

**Interfaces:**
- Produces:
  ```ts
  // LessonContext.tsx — shared between visuals and the Lesson example
  export function LessonProvider(p: { children: ReactNode }): JSX.Element
  export function useLinkedLines(): { lines: [number, number] | null; link(lines: [number, number] | null): void }
  // StructureDiagram.tsx
  export function StructureDiagram(p: { structure: Structure; descriptions: Record<string, string> }): JSX.Element
  // sceneModel.ts
  export interface SceneFrame { index: number; caption: string; activeCall?: { from: string; to: string[]; label: string };
                                actorStates: Record<string, Record<string, string>>; code?: [number, number] }
  export function sceneFrames(script: SceneScript, captions: Record<string, string>): SceneFrame[]   // states accumulate step by step
  // ScenePlayer.tsx
  export function ScenePlayer(p: { script: SceneScript; captions: Record<string, string> }): JSX.Element
  ```
StructureDiagram: React Flow, custom class-box nodes (name, «interface»/«abstract» stereotype, members in mono), UML edges (association open arrow + label, realization dashed + hollow triangle, inheritance solid + hollow triangle, dependency/creates dashed open arrow); `fitView`, not draggable, no zoom-on-scroll, pan/zoom via controls only; hover or focus on a node shows its description and calls `link(node.codeLines)`; nodes are keyboard-focusable. ScenePlayer: actors laid out in a row as role-coloured boxes with their current state underneath; the active call animates a token along the arrow from caller to callee(s) (fan-out in parallel); caption below; controls: previous, play/pause, next, reset, a step scrubber (`input type=range`, labelled "Step {{n}} of {{total}}"), speed 0.5×/1×/2×; ←/→ step, Space play/pause when the player has focus; each frame calls `link(frame.code)`; under reduced motion no travel animation — the frame jumps to its end state. Copy in `lesson.json` (`scene.*`, `diagram.*`).

- [ ] **Step 1: Write failing tests:** `sceneFrames` accumulates state (after step 4 both displays show 23; after tv unsubscribes and 25 is set, tv still shows 23); fan-out produces `to` with two ids; ScenePlayer: next/prev/scrubber change the caption, keyboard ←/→ works, play advances on timers (fake timers) and stops at the end, reduced-motion (`matchMedia` mocked) renders no travel element; StructureDiagram renders node names and calls `link` with `codeLines` on focus.
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** — PASS; visual check.
- [ ] **Step 5: Commit** `feat(visuals): Structure Diagram and Scene player`.

---

### Task 8: Lesson page

**Load `uxkin:no-ui-slop` first.** Page pattern: detail (long-form reading).

**Files:**
- Create: `web/src/features/lesson/{LessonPage,Section,LessonToc,LessonExample,mdxComponents}.tsx`, `web/src/locales/en/lesson.json`, `web/src/content/lessons.ts`, tests
- Modify: `web/vite.config.ts` (`@mdx-js/rollup` with `providerImportSource: '@mdx-js/react'`, `enforce: 'pre'`, before `react()`), `web/package.json`

**Interfaces:**
- Consumes: Tasks 1, 4, 5, 7.
- Produces:
  ```ts
  export function loadLesson(patternId: string, lng: string): Promise<{ Component: MDXContent; untranslated: boolean } | undefined>  // lazy glob of lesson.*.mdx
  export const lessonSectionIds = ['problem', 'analogy', 'structure', 'interaction', 'example', 'when-to-use'] as const
  // MDX components available inside lessons (no imports needed in .mdx):
  //   <Section id>, <StructureDiagram />, <InteractionScene />, <LessonExample />, <Lookalikes />
  ```
Layout: page header (Category · Tier, pattern name, intent, "not yet translated" badge when applicable), sticky section TOC (desktop: left rail; narrow: horizontal scroll list at top) highlighting the section in view, 70ch reading column, and a footer "Practice" block listing the Exercises with status + links. `Section` renders `<section id aria-labelledby>` with the localized heading from `lesson.json` (`sections.problem` "Problem", `analogy` "Analogy", `structure` "Structure", `interaction` "How it runs", `example` "C# example", `when-to-use` "When to use it"). `LessonExample` = `CodePanel` with `useDraft('lesson:<id>')`, initial `example.cs`, highlighted lines from `useLinkedLines`, and a "Restore original" action. `Lookalikes` renders each lookalike's name (catalog text), its one-sentence difference, and a link when built. Opening the page calls `markLessonVisited`. Unknown/unbuilt pattern id → a "This pattern is coming soon" state with a link back to the Catalog.

- [ ] **Step 1: Write failing tests:** renders all six sections in order with headings and TOC entries; marks the lesson visited; unbuilt id shows the coming-soon state; `content.test.ts` gains a check that every built lesson contains exactly the six `<Section id="…">` in order (string scan of the `?raw` MDX).
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** — PASS; visual check incl. the diagram/scene/example linkage in the real browser with the engine.
- [ ] **Step 5: Commit** `feat(web): Lesson page with MDX, visuals and runnable example`.

---

### Task 9: Grading orchestration

**Files:**
- Create: `web/src/features/exercise/gradeExercise.ts`, `gradeExercise.test.ts`, `web/src/locales/en/{checks,contract}.json`, `web/src/features/exercise/checkMessage.ts` + test

**Interfaces:**
- Consumes: `CompilerClient.compile`, `RunnerHost.load/runCheck`, `checkResultOf` (M1); `ExerciseContent`, `ExerciseText` (Task 1).
- Produces:
  ```ts
  export type GradeResult =
    | { kind: 'compileErrors'; diagnostics: DiagnosticInfo[] }          // user-file errors only
    | { kind: 'contractViolations'; violations: ContractViolation[] }
    | { kind: 'checked'; results: CheckResult[]; allPassed: boolean }     // results in checkIds order
  export function gradeExercise(source: string, exercise: ExerciseContent,
    compiler: Pick<CompilerClient, 'compile'>, runner: Pick<RunnerHost, 'load' | 'runCheck'>): Promise<GradeResult>
  export function checkMessage(result: CheckResult, text: ExerciseText, t: TFunction): string | undefined  // undefined when passed
  export function contractMessage(v: ContractViolation, t: TFunction): string
  ```
`gradeExercise`: compile with `purpose: 'check'`, `checksSource`, `contract`; contract violations → `contractViolations`; user-file errors → `compileErrors`; a checks-file compile error (content bug) throws; otherwise load and run every check id sequentially via `checkResultOf` (timeouts and crashes become `timedOut`/`errored` results, never throws). `checkMessage`: custom text `checks.<id>.failures.<reason>` (interpolating args) else generic `checks:reasons.<reason>`; `threw` appends the exception message when present.
Copy — `checks.json` `reasons`: `isFalse` "This check's condition wasn't met.", `notEqual` "Expected {{expected}}, but got {{actual}}.", `notSame` "Expected the same object both times, but got two different objects.", `same` "Expected two different objects, but got the same one.", `didNotThrow` "Expected {{expected}} to be thrown, but nothing was thrown.", `wrongException` "Expected {{expected}}, but {{actual}} was thrown.", `typeNotFound` "Couldn't find a type named {{type}}.", `threw` "Your code threw {{type}}.", `timedOut` "Stopped after 5 seconds — this check may have hit an infinite loop."; `contract.json`: `missingType` "Your code needs a public type named {{type}}.", `wrongKind` "{{type}} isn't the kind of type the Contract asks for.", `missingMember` "{{type}} needs a public member: {{member}}".

- [ ] **Step 1: Write failing tests** with fake compiler/runner: contract violations short-circuit (runner untouched); compile errors keep only `file: 'user'` errors; checks-file error throws; all-pass → `allPassed`; a timed-out check becomes `timedOut` and later checks still run; `checkMessage` picks custom over generic and interpolates.
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(exercise): grading orchestration and check messages`.

---

### Task 10: Exercise page

**Load `uxkin:no-ui-slop` first.** Page pattern: split pane.

**Files:**
- Create: `web/src/features/exercise/{ExercisePage,CheckList,ContractView,HintsPanel,SolutionPanel}.tsx`, `web/src/locales/en/exercise.json`, tests

**Interfaces:**
- Consumes: Tasks 1, 4, 5, 9.

Layout (spec §8): left — breadcrumb (Catalog › Observer › Exercise N), title, Exercise Kind badge, status, scenario (paragraphs; `backticks` → inline code), `ContractView` (each type: kind + name, members in mono), `HintsPanel` ("Show hint 1 of 3" revealing one at a time; revealed hints persist via `hintsRevealed`), "Reveal solution" (disabled with explanation until the first Check; opens `SolutionPanel` read-only with "Copy into editor"), "Reset exercise" (named confirmation inline: "Reset this exercise? Your code and progress for it will be cleared." → Reset / Keep working). Right — `CodePanel` with `useDraft('exercise:<p>/<e>', starter, version)`, an extra primary action **Check** (Run stays available for printing output), stale-draft banner ("This exercise was updated since you last worked on it. Your code is kept." + "Start from the new version"), and results under the output: contract violations list, compile errors (reusing OutputPanel style), or `CheckList` (each check: icon + title + message when failed; summary "3 of 4 checks passed"); when all pass: success state "Solved" or "Solved with help" + link to the next exercise / back to the Lesson. Previous/next exercise navigation. Every Check records `checked`; hints/solution record their events. Copy keys in `exercise.json` (`kind.*`, `status.*`, `check` "Check", `checking` "Checking…", `hints.*`, `solution.*`, `reset.*`, `stale.*`, `summary` "{{passed}} of {{total}} checks passed", `solved` "Solved — every check passed.", `solvedWithHelp` "Solved with help — every check passed.", `contract.title` "Contract", `contract.intro` "Your code must provide:", `next` "Next exercise", `backToLesson` "Back to the Lesson").

- [ ] **Step 1: Write failing tests** (engine faked, CodeEditor mocked): Check shows the check list and summary; all-pass shows "Solved"; hint then pass shows "Solved with help"; Reveal solution disabled before first Check; reset confirmation clears draft and status; stale banner shown for an old draft; contract violations render translated.
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** — PASS; visual check in the real browser: solve the Observer `complete` exercise with its solution.
- [ ] **Step 5: Commit** `feat(web): Exercise page with checks, hints and solution`.

---

### Task 11: Progress page

**Load `uxkin:no-ui-slop` first.** Page pattern: settings/list.

**Files:**
- Create: `web/src/features/progress/ProgressPage.tsx`, `web/src/locales/en/progress.json`, test

Content: per built Pattern — Lesson visited, Exercise statuses with links, Next Step; totals ("2 of 3 exercises solved"); empty state when nothing is started ("Nothing here yet — open a pattern in the Catalog to start." + link). Backup section: "Export progress" downloads `design-patterns-progress-YYYY-MM-DD.json`; "Import progress" (file input, `.json`) shows an inline confirmation naming what will be replaced ("Importing replaces your current progress and saved code on this device.") → Import / Cancel; result message on success ("Imported progress for {{patterns}} patterns and {{drafts}} saved files.") or a recoverable error per `ImportResult.reason` (`invalidJson` "That file isn't valid JSON.", `notAnExport` "That file isn't a Design Patterns Trainer export.", `unsupportedVersion` "That export comes from a newer version of the app."). Exam history placeholder text: "Exam history arrives with the exam." 

- [ ] **Step 1: Write failing tests:** empty state; seeded progress renders statuses; export produces a Blob with the export shape; import of a bad file shows the error and leaves data; confirmed import replaces data.
- [ ] **Step 2: Run** — FAIL. · [ ] **Step 3: Implement.** · [ ] **Step 4: Run** — PASS; visual check.
- [ ] **Step 5: Commit** `feat(web): Progress page with export and import`.

---

### Task 12: End-to-end learning flow

**Files:**
- Create: `web/e2e/learning.spec.ts` (reuse `e2e/helpers.ts`)

Tests (Chromium, existing Playwright config):
```ts
test('catalog lists 23 patterns and opens the Observer lesson', ...)       // 23 rows; click Observer → six section headings visible
test('scene steps and the diagram link to example lines', ...)             // Next in the scene changes the caption; focusing a diagram node adds .line-linked in the editor
test('solves the complete exercise with its solution', ...)                // load solution.cs text via fs in the test, setCode, Check → "Solved — every check passed."; catalog dot shows Solved
test('a hint before solving gives Solved with help', ...)                  // refactor exercise
test('drafts survive a reload', ...)                                       // type into build exercise, wait 700 ms, reload, code still there
test('export then import restores progress', ...)                          // export download, clear site data via page.evaluate(indexedDB.deleteDatabase), import file, status back
```
- [ ] **Step 1:** Write the tests. · [ ] **Step 2: Run** `npm run e2e` — all PASS (M1 specs included). · [ ] **Step 3:** CI already runs `dotnet test` (now including content validation) and e2e — confirm no workflow change is needed, or add one.
- [ ] **Step 4: Commit** `test(web): end-to-end learning flow`.
