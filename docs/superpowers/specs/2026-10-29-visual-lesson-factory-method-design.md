# Visual Lesson — Factory Method pilot — Design

**Date:** 2026-10-29 · **Status:** draft
**Vocabulary:** [`CONTEXT.md`](../../../CONTEXT.md) · **Visual design:** [`DESIGN.md`](../../../DESIGN.md)
**Mockups (approved):** `.superpowers/brainstorm/1913-1793285854/content/` — `problem-directions.html` (A), `analogy-directions.html` (A), `structure-directions.html` (A), `interaction-directions.html` (A), `when-to-use-blocks.html` (all of 1–7). Open them in a browser; they are the visual reference for this spec.

## 1. Intent

The learner reads the Lesson text and it "doesn't really hit". The Structure Diagram and the Interaction Scene work for them; the prose between them doesn't. They want **more visuals and more emphasis, not less text**: every section should carry pictures, symbols and colour that make the key ideas land while reading.

This is a pilot on **Factory Method only**. Other Lessons are not touched. If it works, the same components roll out to the other Patterns later (not in scope).

## 2. Goals, non-goals, anti-goals

**Goals**
- Every Lesson Section of Factory Method except the C# example gets at least one figure that shows the idea the text explains.
- Class and member names in prose carry their **role colour**, the same colour the Structure Diagram uses, so text, diagrams and code read as one system.
- The one sentence each Section exists to teach is visibly emphasised (highlighter mark and/or a "Key idea" callout).
- The pieces are reusable MDX components, so later Lessons can adopt them without new code.

**Non-goals**
- Rewriting or shortening the Lesson's content. The text stays (light wording adjustments only where a figure needs a caption or a numbered reference).
- Changing the Structure Diagram, the Interaction Scene, the C# example section, or the Lookalikes list.
- Applying the components to other Patterns' Lessons.
- Syntax highlighting for Lesson code blocks.

**Anti-goals** (a failure even if it technically works)
- Decoration: colour or icons that don't mean anything. Every colour is a role, a verdict (ok/bad/warn) or the accent. DESIGN.md's "Colour means something" holds.
- Emoji, glassmorphism, gradients, shadows-as-elevation, rainbow callouts (DESIGN.md, anti-slop).
- Figures that only work in light mode, only on desktop, or only for sighted mouse users.
- Text hidden inside figures that a screen reader can't reach. Each figure needs a text alternative.

## 3. The visual vocabulary

These are used across all Sections.

| Element | Looks like | Meaning | Use |
|---|---|---|---|
| **Role tag** | Mono text in a soft-tinted pill with a 1px border in the role colour; `contract` uses a dashed border | This name is a participant in the Pattern, with this role | Class, interface and factory-method names in prose. Roles come from DESIGN.md: `primary` orange (creator: `Level`), `contract` blue dashed (`IEnemy`, and the factory method slot `CreateEnemy`), `concrete` purple (`ForestLevel`, `CaveLevel`, `Wolf`, `Bat`, `Scorpion`, `GiantBat`) |
| *(scope of role tags)* | | | *Decided by the designer:* tag only the Pattern's participants: the classes and interface (`Level`, `ForestLevel`, `CaveLevel`, `IEnemy`, `Wolf`, `Bat`, and any later names in the text) and the factory method `CreateEnemy`. Other members (`SpawnWave`, `Name`) and non-participants (`EnemyFactory`) stay plain inline `code`. Tag them wherever they appear in prose, in every Section, so the rule is simple and consistent. |
| **Key mark** | Semibold + an accent-coloured highlighter underlay (bottom ~45% of the line) | The phrase to remember | At most one or two per Section |
| **Key idea callout** | Bordered box with a 3px accent left border, a Lucide `Lightbulb`, a small "KEY IDEA" label and one or two sentences | Section summary | Problem, Analogy, (optional elsewhere) |
| **Figure** | `code-bg` surface, 1px border, small uppercase caption | A picture of what the surrounding text says | All the Section visuals below |
| **Annotated code** | A code block where chosen lines are tinted (bad = red, good = purple/concrete, warn = amber) with a 3px left bar, numbered badges at line ends, and numbered notes beside the code (below it on narrow screens) | "Look here, and this is why" | Problem, Parameterised factory method |
| **Verdict marks** | ✓ in `ok` green circle, ✕ in `bad` red circle | Good / bad | Checklists, comparisons, pitfalls |
| **Warning card** | Amber left border + Lucide `TriangleAlert` + title | A trap | Pitfalls |
| **Note callout** | Plain bordered box with a Lucide icon (e.g. `Lock`) | A side remark | The `protected` note in Interaction |

**New token:** `warn` (amber) for warning cards and warn-tinted code lines: light `#b45309`, dark `#fbbf24`, plus a soft tint. Add it to `tokens.css` and to DESIGN.md's token table. The ✓/✕ glyphs in the mockups are text. The build uses Lucide `Check` / `X` icons inside the circles (DESIGN.md: icons from Lucide only).

Soft tints are the role or verdict colour at about 8% alpha in light mode and 12% in dark mode, as in the mockups. Text inside role tags must meet 4.5:1 contrast against its tint in both themes, which the mockup values do. Verify this in the build.

## 4. Section by section

Content is the current `content/patterns/factory-method/lesson.en.mdx`. Figures use the Lesson's own names (`Level`, `Wolf`, …).

### 4.1 Problem — mockup `problem-directions.html`, option A
- Role tags on `Wolf`, `Bat` and `Level` in prose; key marks on "the same way" and "the enemies depend on the level".
- The "before" code becomes **annotated code**. It shows the **whole** current code, not the shortened excerpt in the mockup. The `switch` lines are tinted red, with three numbered badges.
- The three bullets they point at stay as the **full existing bullet text**, as a numbered list under the code with matching number badges. They don't become a side column of short notes, because the learner asked for no less text. The mockup's short notes only show the visual link: lines, badges and numbers.
  1. Adding a desert level means editing `SpawnWave`, even though the way a wave is spawned has not changed.
  2. `Level` names every concrete enemy class with `new`, so it depends on all of them, and so does everything that uses `Level`.
  3. A typo in the terrain string compiles fine and only fails when a player reaches that level.
- The fourth bullet (the `switch` spreading to bosses, sounds and loot) has no line to point at. It stays in the list without a badge.
- Ends with a **Key idea** callout carrying the existing closing sentence: spawning a wave is one job (`primary`), choosing which enemy is a second job (`concrete`) that differs per level.

### 4.2 Analogy — mockup `analogy-directions.html`, option A
- All three paragraphs of the current text stay.
- **Picture strip** figure: a "Head office procedure · written once" card (`primary`), listing the steps with "Get a vehicle" as a dashed `contract` slot and "← each depot decides". Beside it, depot rows (`concrete`):
  - City depot fills the slot with a cargo bike;
  - Mountain depot fills it with a 4×4 van;
  - a dashed "New depot opens · procedure untouched" row.
- Lucide icons: `ClipboardList`, `Truck`, `Bike`, `Building2`, `Mountain`, `Plus`.
- **Key idea**: `Level` writes `SpawnWave` once and leaves `CreateEnemy()` open for each subclass to fill.

### 4.3 Structure — mockup `structure-directions.html`, option A
- **Two parallel families** figure after "two parallel sets of roles":
  - creators column: `Level` (abstract), then `ForestLevel` and `CaveLevel`;
  - products column: `IEnemy` (interface, dashed), then `Wolf` and `Bat`;
  - between them, a solid `contract` "uses" arrow at the top level and a dashed «creates» arrow at the concrete level.
- Role tags on all names in the three paragraphs; "creator" and "factory method" in semibold as terms.
- The existing interactive Structure Diagram stays below, unchanged.

### 4.4 Interaction — mockup `interaction-directions.html`, option A
The "three things worth noticing" become three numbered cards. Each card has the full existing paragraph (its first sentence as the card title) on the left and a mini figure on the right, or below on narrow screens:
1. A mini code snippet of the two `Level x = new …Level()` lines, captioned "the only place a type is chosen".
2. A vertical chain: `Level.SpawnWave` → "calls CreateEnemy()" → `ForestLevel` override → "new" → `Wolf`, with "down" as a key mark in the text.
3. Two rows: forest → `wolf 1, wolf 2` and cave → `bat 1, bat 2`, as `ok`-tinted output chips, captioned "both from one loop in Level".

The `protected` paragraph becomes a **note callout** with a Lucide `Lock`. The Interaction Scene stays below, unchanged.

### 4.5 C# example
Unchanged.

### 4.6 When to use — mockup `when-to-use-blocks.html`, all blocks 1–7
1. **Checklist**: the three "use it when" bullets become ✓ rows and "Skip it…" becomes a ✕ row with a red tint.
2. **Decision path** (new figure, right after the checklist). Questions go top to bottom, and each has a side exit:
   - "Does the class to create ever vary?" no → plain `new`;
   - "Does the caller already know which object it needs?" yes → constructor parameter / DI;
   - "Does a base class need fresh objects while it runs, and is subclassing how it's extended?" yes → **Factory Method** (accent);
   - "Just want every `new` in one place?" yes → Simple Factory.
   The figure is new content, but it only restates the section's own text.
3. **The `new` call it removes**: text unchanged, plus a before/after figure. Before, `new Wolf()` inside `SpawnWave` is tinted red ("the loop can only make wolves"); after, the loop calls `CreateEnemy()` and `ForestLevel`'s override holds `new Wolf()`, tinted purple. The arrow between them reads "one line moves".
4. **Parameterised factory method**: the code becomes annotated code, shown in full and not shortened. The notes are short labels next to the lines, which is fine here because they add to the text rather than replace it. The badges and notes are:
   - ① defaults live in the base;
   - ⚠ the `throw` line is an unknown kind, so a runtime error (amber);
   - ② "boss" adds one kind;
   - ③ `base.CreateEnemy(kind)` handles the rest.
   The text before and after stays.
5. **Simple Factory is not this pattern**: text unchanged, plus two cards side by side.
   - Simple Factory: `EnemyFactory.Create(kind)` fans out to `Wolf`, `Bat` and a dashed "+ Scorpion", with the verdict "✕ new kind → edit the switch".
   - Factory Method: `Level.CreateEnemy()` with Forest→Wolf, Cave→Bat and a dashed "+ Desert→Scorpion", with the verdict "✓ new kind → add a class, edit nothing".
6. **Constructor or DI**: text unchanged ("while it runs" as a key mark), plus a "When is the object made?" timeline with two tracks:
   - Constructor / DI: one dot before the run, "made once, before, by the caller";
   - Factory Method: several dots along Level's run, "made fresh, each time Level asks".
7. **Pitfalls**: each of the three pitfalls becomes a warning card, with its title, the full existing text, and a ✕/✓ pair of one-line code snippets:
   - `class ForestLevel : Level { override CreateEnemy() => new Wolf(); }` ✕ vs `new Level(() => new Wolf())` ✓;
   - `Level() { _e = CreateEnemy(); }` ✕ vs `SpawnWave() { var e = CreateEnemy(); }` ✓;
   - `public IEnemy CreateEnemy()` ✕ vs `protected IEnemy CreateEnemy()` ✓.

The Lookalikes list is unchanged.

## 5. Constraints

- **Authoring stays in MDX.** All figure text lives in `lesson.en.mdx`, written as component children and props. A future `lesson.de.mdx` translates it in the same file, with no strings hidden in TSX. Generic UI labels on the components ("Key idea", "Before", "After") go through i18next in `lesson.json`.
- **Components are registered** in `mdxComponents.tsx` (available in every Lesson without imports). They live under `web/src/features/lesson/visuals/` or similar, and they are generic: no Factory Method names in component code.
- **Six Sections, fixed order:** the content test requires exactly six `<Section>` elements, and that doesn't change.
- **Accessibility:**
  - figures are `<figure>` with a `<figcaption>`;
  - pictures made of boxes and arrows get either an accessible description (visually hidden text that reads the figure as a sentence) or a structure that reads correctly in DOM order;
  - decorative icons are `aria-hidden`;
  - verdicts are announced in words, not only by colour or glyph: visually hidden "Good:" / "Avoid:" text or equivalent;
  - annotated code: notes are associated with their lines by number in the text, so they read correctly in order.
- **Themes and widths:**
  - light and dark via the tokens (no hard-coded hex in components);
  - at ~390px every figure stacks to one column with no horizontal page scroll (code blocks may scroll inside themselves, as today);
  - checked at ~390px and ~1440px (DESIGN.md review bar).
- **Motion:** none needed. If any is added, respect `prefers-reduced-motion`.
- **Reading width:** prose stays at the Lesson's 70ch. Figures may use `.lesson-wide` where they need room (picture strip, parallel families, side-by-side cards, annotated code with notes).
- **Interactivity:** none required. Figures are static. Making role tags hover-link to the diagram or the code is a later idea.

## 6. Left to the builder

- Component API names and shapes (e.g. `<Role kind="primary">Level</Role>`, `<KeyIdea>`, `<AnnotatedCode lines={…}>`, `<Figure caption>`, `<Checklist>`, `<Pitfall>`, `<Compare>`), as long as authors can write every figure above in MDX without TSX changes per Lesson.
- How annotated code takes its line marks and notes: props, or a marker syntax inside the code string.
- How each box-and-arrow figure is composed: generic building blocks such as boxes, arrows and columns, or a few purpose-built components. Prefer the smallest set that covers these figures without one component per figure.
- Exact spacing, sizes and the soft-tint alpha within the DESIGN.md scale.
- Whether annotated code needs to support eliding lines: not needed, since both code blocks are shown in full.

## 6a. Before starting

The working tree holds an unrelated, uncommitted fix (React Flow key bindings swallowing Space in the Lesson editor: `StructureDiagram.tsx`, its test, `e2e/lesson.spec.ts`). Commit it on its own before this work begins.

## 7. Done means

- The Factory Method Lesson matches the approved mockups section by section in both themes at 390px and 1440px, with no horizontal page overflow.
- The other Lessons render unchanged.
- Unit tests cover the new components (rendering, roles to classes, accessible text for verdicts and figures). The existing content and Lesson tests pass, and an e2e check confirms the Factory Method Lesson renders its figures.
- DESIGN.md documents the `warn` token and the Lesson visual vocabulary (section 3) so later Lessons follow it.
