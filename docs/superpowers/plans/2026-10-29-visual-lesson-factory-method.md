# Visual Lesson (Factory Method pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Section of the Factory Method Lesson (except the C# example) figures, role-coloured names and emphasis, built as reusable MDX components, without removing any text.

**Architecture:** A set of small, generic React components lives in `web/src/features/lesson/visuals/`. They are registered in `mdxComponents.tsx`, so any `lesson.*.mdx` can use them without imports, and all figure text stays in the MDX. Styling uses the existing tokens and the existing `[data-role]` → `--role-c` mechanism in `base.css`. One new `--warn` token is added. Only `content/patterns/factory-method/lesson.en.mdx` is rewritten to use them.

**Tech Stack:** React 19, TypeScript, MDX 3 (`@mdx-js/rollup`), lucide-react, i18next, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-visual-lesson-factory-method-design.md`. Approved mockups are in `.superpowers/brainstorm/1913-1793285854/content/` (`problem-directions.html` A, `analogy-directions.html` A, `structure-directions.html` A, `interaction-directions.html` A, `when-to-use-blocks.html` 1–7). Open them; they are the visual target.

## Global Constraints

- No Lesson text is removed or shortened. Light wording changes only where a figure needs a caption or a numbered reference.
- Colour means something: every colour is a role (`primary` / `contract` / `concrete`), a verdict (`ok` / `bad` / `warn`) or `accent`. No emoji, no gradients, no shadows. Icons come from lucide-react only.
- New token `--warn`: light `#b45309`, dark `#fbbf24`. It goes in all three theme blocks of `tokens.css` and in the DESIGN.md token table.
- Soft tints use `color-mix(in srgb, <colour> 8%, var(--surface))` in light mode and the same expression in dark mode (on the dark surface this reads at roughly the 12% look of the mockup). No hard-coded hex values in components or CSS outside `tokens.css`.
- Role tags only for participants: `Level`, `ForestLevel`, `CaveLevel`, `IEnemy`, `Wolf`, `Bat`, `Scorpion`, `GiantBat`, and the factory method `CreateEnemy`. Other names (`SpawnWave`, `Name`, `EnemyFactory`) stay plain inline code. Tag them wherever they appear in prose, in all Sections.
- All figure text lives in the MDX (props or children). Generic labels ("Key idea", "Good:", "Avoid:") come from `web/src/locales/en/lesson.json` → `visual.*`.
- Components are generic: no Factory Method names in TSX.
- Exactly six `<Section>` elements stay, in their current order (content test).
- Accessibility rules:
  - figures are `<figure>` + `<figcaption>`, and a box-and-arrow figure carries a `description` read by screen readers (`.sr-only`);
  - icons are `aria-hidden`;
  - verdicts carry visually hidden "Good:" / "Avoid:" text.
- The page has no horizontal scroll at 390px. Code blocks may scroll inside themselves. Check both themes at 390px and 1440px.
- Do not touch the Structure Diagram, the Interaction Scene, the C# example Section or the Lookalikes list.

## Review Focus

1. **Narrow screens:** at 390px a figure such as Grid, Row or side-by-side cards, or a `nowrap` role tag, pushes the page wider than the viewport. Expected: no page scroll. Task 8 pins this with an e2e `scrollWidth` check.
2. **A typo'd `icon="…"` in MDX:** MDX props aren't type-checked, so an unknown icon name would silently render nothing. Expected: a content test fails. Task 2 owns this.
3. **Code edits shift line numbers:** an `AnnotatedCode` mark points past the end of its code. Expected: an error at render, not a mark that silently disappears. Task 4 owns this.
4. **Verdicts read by screen readers:** ✓/✕ must not be colour-only. Expected: "Good:" / "Avoid:" in the accessible text. Task 3 owns this.
5. **Other Lessons:** they must render exactly as before. Expected: the existing Lesson and content tests stay green, and Observer's e2e Lesson test still passes. Task 8 owns this.

---

## File structure

| File | Responsibility |
|---|---|
| `web/src/features/lesson/visuals/inline.tsx` | `Role`, `Key`, `Slot`: inline marks in prose |
| `web/src/features/lesson/visuals/icons.ts` | `lessonIcons` name → lucide component map, `LessonIconName` type |
| `web/src/features/lesson/visuals/callouts.tsx` | `KeyIdea`, `Note`, `Pitfall` |
| `web/src/features/lesson/visuals/verdict.tsx` | `Verdict`, `Checklist`, `CodePair` |
| `web/src/features/lesson/visuals/AnnotatedCode.tsx` | `AnnotatedCode`, `BadgeList` |
| `web/src/features/lesson/visuals/figure.tsx` | `Figure`, `Row`, `Stack`, `Grid`, `Box`, `Arrow`, `Card`, `Track`, `Point` |
| `web/src/features/lesson/visuals/index.ts` | `lessonVisuals`: the object of all of the above, spread into the MDX components |
| `web/src/features/lesson/visuals/*.test.tsx` | one test file per source file |
| `web/src/features/lesson/mdxComponents.tsx` | spread `lessonVisuals` into `components` |
| `web/src/styles/tokens.css` | `--warn` |
| `web/src/styles/base.css` | new block `/* ---------- Lesson visuals ---------- */` after the `.lesson-note` rules |
| `web/src/locales/en/lesson.json` | `visual` labels |
| `web/src/content/content.test.ts` | icon-name check over Lesson sources |
| `content/patterns/factory-method/lesson.en.mdx` | the rewrite |
| `web/e2e/lesson.spec.ts` | Factory Method figures + 390px overflow |
| `DESIGN.md` | `warn` token row + "Lesson visual vocabulary" section |

Shared type: `Role` from `web/src/content/schema.ts` (`'primary' | 'contract' | 'concrete'`). Tone type used by several files, defined in `inline.tsx` and exported:

```ts
export type Tone = 'ok' | 'bad' | 'warn'
```

---

### Task 0: Commit the pending Space-key fix

The working tree already holds an unrelated fix: `web/src/visuals/StructureDiagram.tsx`, `StructureDiagram.test.tsx` and `web/e2e/lesson.spec.ts`.

- [ ] **Step 1: Verify it's green**

Run: `cd web && npx vitest run src/visuals/StructureDiagram.test.tsx && npx playwright test lesson.spec`
Expected: all pass.

- [ ] **Step 2: Commit on its own**

```bash
git add web/src/visuals/StructureDiagram.tsx web/src/visuals/StructureDiagram.test.tsx web/e2e/lesson.spec.ts
git commit -m "fix(diagram): stop React Flow's window key bindings eating Space in the editor"
```

---

### Task 1: `--warn` token and inline marks (`Role`, `Key`, `Slot`)

**Files:**
- Create: `web/src/features/lesson/visuals/inline.tsx`, `web/src/features/lesson/visuals/inline.test.tsx`, `web/src/features/lesson/visuals/index.ts`
- Modify: `web/src/styles/tokens.css` (three theme blocks), `web/src/styles/base.css`, `web/src/features/lesson/mdxComponents.tsx`, `DESIGN.md` (token table)

**Interfaces:**
- Produces:
  - `Role({ kind, children }: { kind: Role; children: ReactNode })` renders `<code class="role-tag" data-role={kind}>`;
  - `Key({ children })` renders `<mark class="key-mark">`;
  - `Slot({ children })` renders `<span class="slot">`, an inline dashed `contract` box;
  - `type Tone`;
  - `lessonVisuals: MDXComponents` in `index.ts`, which later tasks add their components to.

- [ ] **Step 1: Write the failing tests** in `inline.test.tsx`

```tsx
it('Role renders inline code carrying the role for colour', () => {
  render(<p><Role kind="contract">IEnemy</Role></p>)
  const tag = screen.getByText('IEnemy')
  expect(tag.tagName).toBe('CODE')
  expect(tag).toHaveClass('role-tag')
  expect(tag).toHaveAttribute('data-role', 'contract')
})
it('Key marks the phrase to remember', () => {
  render(<p><Key>only IEnemy</Key></p>)
  expect(screen.getByText('only IEnemy').tagName).toBe('MARK')
})
it('Slot renders an inline open-slot marker', () => {
  render(<p><Slot>Get a vehicle</Slot></p>)
  expect(screen.getByText('Get a vehicle')).toHaveClass('slot')
})
it('lessonVisuals exposes the inline marks to MDX', () => {
  expect(Object.keys(lessonVisuals)).toEqual(expect.arrayContaining(['Role', 'Key', 'Slot']))
})
```

- [ ] **Step 2: Run them to check they fail**

Run: `cd web && npx vitest run src/features/lesson/visuals/inline.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**
  - Write `inline.tsx` and `index.ts` (`export const lessonVisuals = { Role, Key, Slot }`).
  - In `mdxComponents.tsx`, spread `...lessonVisuals` into `components`.
  - Add `--warn` to `tokens.css` in all three blocks: light `#b45309`; dark `#fbbf24` (both the `[data-theme='dark']` and the `prefers-color-scheme` block).
  - In `base.css`, start the `/* ---------- Lesson visuals ---------- */` block:
    - `.role-tag`: mono 0.86em; `color: var(--role-c)`; `background: color-mix(in srgb, var(--role-c) 8%, var(--surface))`; `border: 1px solid color-mix(in srgb, var(--role-c) 35%, transparent)`; `[data-role='contract']` uses a dashed border; `white-space: nowrap`. It overrides `.lesson-body code`'s background.
    - `.key-mark`: `background: none`, `color: inherit`, weight 600, `box-shadow: inset 0 -0.45em 0 color-mix(in srgb, var(--accent) 22%, transparent)`.
    - `.slot`: dashed 1.5px `--role-contract` border, contract colour and tint, radius 4px, padding `0 var(--space-2)`.
  - Add the `warn` row to DESIGN.md's token table.

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run src/features/lesson`
Expected: PASS (new and existing Lesson tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/features/lesson web/src/styles DESIGN.md
git commit -m "feat(lesson): role tags, key marks and slots for Lesson prose"
```

---

### Task 2: Icons and callouts (`KeyIdea`, `Note`, `Pitfall`)

**Files:**
- Create: `visuals/icons.ts`, `visuals/callouts.tsx`, `visuals/callouts.test.tsx`
- Modify: `visuals/index.ts`, `web/src/locales/en/lesson.json`, `web/src/styles/base.css`, `web/src/content/content.test.ts`

**Interfaces:**
- Produces:
  - `lessonIcons: Record<LessonIconName, LucideIcon>`, with `LessonIconName = 'clipboard' | 'truck' | 'bike' | 'building' | 'mountain' | 'plus' | 'lock' | 'lightbulb' | 'warning'`, mapped to lucide `ClipboardList`, `Truck`, `Bike`, `Building2`, `Mountain`, `Plus`, `Lock`, `Lightbulb`, `TriangleAlert`;
  - `LessonIcon({ name, size? }: { name: LessonIconName; size?: number })`, which renders the icon with `aria-hidden`;
  - `KeyIdea({ children })`;
  - `Note({ icon, children }: { icon: LessonIconName; children })`;
  - `Pitfall({ title, children }: { title: string; children })`.
- `lesson.json` gains `"visual": { "keyIdea": "Key idea", "good": "Good:", "avoid": "Avoid:" }` (`good` and `avoid` are used in Task 3).

- [ ] **Step 1: Write the failing tests** in `callouts.test.tsx`

```tsx
it('KeyIdea is a labelled aside with its text', () => {
  render(<KeyIdea>Spawning is one job.</KeyIdea>)
  const box = screen.getByRole('complementary', { name: 'Key idea' })
  expect(box).toHaveTextContent('Spawning is one job.')
  expect(box.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
it('Note shows the chosen icon, hidden from screen readers', () => {
  render(<Note icon="lock">It is protected.</Note>)
  expect(screen.getByText('It is protected.').closest('.lesson-callout')!.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
})
it('Pitfall is a warning card headed by its title', () => {
  render(<Pitfall title="Making it public">Callers rely on it.</Pitfall>)
  expect(screen.getByRole('heading', { name: 'Making it public' })).toBeInTheDocument()
  expect(screen.getByText('Callers rely on it.').closest('.pitfall')).not.toBeNull()
})
```

In `content.test.ts`, add:

```ts
it('every icon="…" used in a Lesson is a known lesson icon', () => {
  for (const [file, source] of Object.entries(lessonSources))
    for (const m of source.matchAll(/\bicon="([^"]*)"/g)) expect(Object.keys(lessonIcons), `${file}: ${m[1]}`).toContain(m[1])
})
```

- [ ] **Step 2: Run them to check they fail**

Run: `cd web && npx vitest run src/features/lesson/visuals/callouts.test.tsx src/content/content.test.ts`
Expected: callouts FAIL (module missing). The content test fails to import `lessonIcons`.

- [ ] **Step 3: Implement**
  - `KeyIdea` is `<aside aria-label={t('visual.keyIdea')} class="lesson-callout key-idea">` containing a Lightbulb, a small uppercase label (with `aria-hidden`, since the aside already carries the name) and the children.
  - `Pitfall` uses an `<h4>` for the title, with a TriangleAlert in `--warn`.
  - CSS:
    - `.lesson-callout`: 1px border, radius 6px, padding `var(--space-3) var(--space-4)`, flex with a 12px gap;
    - `.key-idea`: 3px `--accent` left border; the label is 12px, uppercase, `--accent`, weight 600;
    - `.pitfall`: 3px `--warn` left border, with the border at `color-mix(--warn 40%)`;
    - margins `var(--space-4) 0`.
  - Add all three to `lessonVisuals`.

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run src/features/lesson src/content`
Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(lesson): key-idea, note and pitfall callouts`.

---

### Task 3: Verdicts (`Verdict`, `Checklist`, `CodePair`)

**Files:**
- Create: `visuals/verdict.tsx`, `visuals/verdict.test.tsx`
- Modify: `visuals/index.ts`, `base.css`

**Interfaces:**
- Consumes: `t('lesson:visual.good')`, `t('lesson:visual.avoid')`.
- Produces:
  - `Verdict({ ok, children }: { ok: boolean; children })` renders a `<p class="verdict" data-tone="ok|bad">`. It holds a circular badge with lucide `Check` or `X` (`aria-hidden`), then a `.sr-only` "Good:" or "Avoid:", then the children.
  - `Checklist({ children })` is a `<div class="checklist">` wrapper. It styles child `.verdict` elements as bordered rows, and gives the `bad` ones a red tint.
  - `CodePair({ bad, good, badLabel, goodLabel }: { bad: string; good: string; badLabel: string; goodLabel: string })` renders two tinted mono panels side by side, which stack below 640px. Each panel's label renders as a `Verdict`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('Verdict says good or avoid in words, not only by colour', () => {
  render(<><Verdict ok>Use it here.</Verdict><Verdict ok={false}>Skip it here.</Verdict></>)
  expect(screen.getByText('Use it here.').closest('.verdict')).toHaveTextContent('Good: Use it here.')
  expect(screen.getByText('Skip it here.').closest('.verdict')).toHaveTextContent('Avoid: Skip it here.')
  expect(screen.getByText('Skip it here.').closest('.verdict')).toHaveAttribute('data-tone', 'bad')
})
it('CodePair shows both snippets under their labels', () => {
  render(<CodePair bad="public IEnemy CreateEnemy()" good="protected IEnemy CreateEnemy()" badLabel="leaks" goodLabel="a hook" />)
  expect(screen.getByText('public IEnemy CreateEnemy()').tagName).toBe('CODE')
  expect(screen.getByText('leaks').closest('.verdict')).toHaveTextContent('Avoid: leaks')
  expect(screen.getByText('a hook').closest('.verdict')).toHaveTextContent('Good: a hook')
})
```

- [ ] **Step 2: Run them to check they fail**

Run: `cd web && npx vitest run src/features/lesson/visuals/verdict.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** as described in the Interfaces block above, and add the components to `lessonVisuals`. The badge is 20px, circular, with a white icon on `--ok` or `--bad`. Inside a `CodePair` it shrinks to 16px.

- [ ] **Step 4: Run the tests.** Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(lesson): verdicts, checklists and code pairs`.

---

### Task 4: `AnnotatedCode` and `BadgeList`

**Files:**
- Create: `visuals/AnnotatedCode.tsx`, `visuals/AnnotatedCode.test.tsx`
- Modify: `visuals/index.ts`, `base.css`

**Interfaces:**
- Consumes: `Tone` (Task 1).
- Produces:
  - `AnnotatedCode({ code, marks = [], caption }: { code: string; marks?: CodeMark[]; caption?: string })`, where `CodeMark = { line: number; tone: Tone | 'concrete'; badge?: string; note?: string }`. It renders a `<figure class="annotated-code">` containing a `<pre>` with one `<span class="code-line" data-tone>` per line. When a mark has a badge, the badge appears at the line end (`.code-badge`, tone background; `warn` badges show "!"), followed by a muted inline `note`. The optional `<figcaption>` comes after the pre.
  - `BadgeList({ tone, children }: { tone: Tone; children })` wraps a Markdown ordered list. CSS counters turn its markers into circular number badges in the tone colour, so its numbers match the code's badges.
- Rules:
  - `code` has exactly one leading and one trailing newline stripped;
  - `line` is 1-based;
  - a mark whose `line` falls outside the code throws `Error('AnnotatedCode: mark on line N, but the code has M lines')`.

- [ ] **Step 1: Write the failing tests**

```tsx
const code = `
var a = 1;
var b = new Wolf();
return b;
`
it('splits the code into lines and tints the marked ones', () => {
  const { container } = render(<AnnotatedCode code={code} marks={[{ line: 2, tone: 'bad', badge: '1', note: 'names a concrete class' }]} />)
  const lines = container.querySelectorAll('.code-line')
  expect(lines).toHaveLength(3)
  expect(lines[1]).toHaveAttribute('data-tone', 'bad')
  expect(lines[1]).toHaveTextContent('var b = new Wolf();1names a concrete class')
  expect(lines[0]).not.toHaveAttribute('data-tone')
})
it('shows a caption when given', () => {
  render(<AnnotatedCode code={code} caption="Before: only wolves" />)
  expect(screen.getByText('Before: only wolves').tagName).toBe('FIGCAPTION')
})
it('fails loudly when a mark points past the code', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => render(<AnnotatedCode code={code} marks={[{ line: 9, tone: 'bad' }]} />)).toThrow('AnnotatedCode: mark on line 9, but the code has 3 lines')
})
it('BadgeList keeps the list items and its tone', () => {
  render(<BadgeList tone="bad"><ol><li>First</li><li>Second</li></ol></BadgeList>)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByRole('list').closest('.badge-list')).toHaveAttribute('data-tone', 'bad')
})
```

- [ ] **Step 2: Run them to check they fail.** Expected: FAIL.

- [ ] **Step 3: Implement**
  - Each code line is `display:block` with `padding: 0 var(--space-4)`, and `white-space: pre`. A toned line gets a `color-mix(tone 8%, var(--code-bg))` background and an inset 3px left bar in the tone colour. The `concrete` tone uses `--role-concrete`.
  - The `pre` scrolls horizontally inside itself.
  - The figure is `.lesson-wide`, so it may use the full column.

- [ ] **Step 4: Run the tests.** Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(lesson): annotated code with line marks and badge lists`.

---

### Task 5: Figure building blocks

**Files:**
- Create: `visuals/figure.tsx`, `visuals/figure.test.tsx`
- Modify: `visuals/index.ts`, `base.css`

**Interfaces:**
- Consumes: `LessonIcon` / `LessonIconName` (Task 2), `Role`.
- Produces (each a plain component taking `children` unless stated):
  - `Figure({ caption, description?, children })` renders `<figure class="lesson-figure lesson-wide">`. It contains a `<figcaption>` (small uppercase caption) and, when `description` is given, a `<p class="sr-only">{description}</p>`. The drawing itself sits in `<div aria-hidden={description ? true : undefined}>`, so screen readers get the sentence instead of a box soup.
  - `Row({ align?: 'center' | 'start' })` is a flex row with a 12px gap. It wraps, and stacks to a column below 640px.
  - `Stack({ align?: 'center' | 'stretch' })` is a flex column with a 10px gap.
  - `Grid({ cols })`, where `cols` is a string used as `grid-template-columns` (e.g. `"1fr 120px 1fr"`), with a 10px gap. Below 640px it collapses each fixed `px` track to `minmax(0, 70px)` by switching to a `--narrow-cols` custom property when one is given (`narrowCols?: string`).
  - `Box({ role?, tone?, icon?, sub?, mono = true })`, where `role?: Role`, `tone?: Tone` and `icon?: LessonIconName`. It is a bordered 6px box carrying `data-role` or `data-tone`. The role uses `--role-c` with a tint, and `contract` gets a dashed border. An optional icon sits on the left, and an optional `sub` is a small muted line under the children.
  - `Arrow({ dir = 'right', label?, dashed? }: { dir?: 'right' | 'down'; label?: string; dashed?: boolean })` is a CSS line with a head and a small mono label. It is `aria-hidden`; the figure's description carries the meaning.
  - `Card({ title, role?, icon? })` is a bordered card. Its header strip uses the role tint and holds the title and an optional icon.
  - `Track({ label, dots, caption, tone = 'concrete' }: { label: string; dots: number[]; caption: string; tone?: 'concrete' | 'contract' })` is one timeline row: a label column, then a baseline with dots at `left: N%`, and the caption above it.
  - `Point({ n, title, aside })`, with `aside: ReactNode`, is a numbered card. It has an accent number circle, then a semibold `title` and the children (the text column), then `aside` in a 260px column that drops below the text under 640px.

- [ ] **Step 1: Write the failing tests**

```tsx
it('Figure gives screen readers the description instead of the drawing', () => {
  render(<Figure caption="Two families" description="Creators on the left make products on the right."><Box role="primary">Level</Box></Figure>)
  const fig = screen.getByRole('figure', { name: 'Two families' })
  expect(fig).toHaveTextContent('Creators on the left make products on the right.')
  expect(screen.getByText('Level').closest('[aria-hidden="true"]')).not.toBeNull()
})
it('Box carries its role and an optional sub line', () => {
  render(<Box role="contract" sub="interface">IEnemy</Box>)
  const box = screen.getByText('IEnemy').closest('.lesson-box')!
  expect(box).toHaveAttribute('data-role', 'contract')
  expect(box).toHaveTextContent('IEnemyinterface')
})
it('Track places a dot per position', () => {
  const { container } = render(<Track label="Factory Method" dots={[30, 48, 66]} caption="made fresh each time" />)
  const dots = container.querySelectorAll('.track-dot')
  expect([...dots].map((d) => (d as HTMLElement).style.left)).toEqual(['30%', '48%', '66%'])
})
it('Point numbers its card and shows the aside', () => {
  render(<Point n={2} title="The base class calls it." aside={<Box>Wolf</Box>}>Text.</Point>)
  expect(screen.getByText('2')).toHaveClass('point-num')
  expect(screen.getByText('The base class calls it.')).toBeInTheDocument()
  expect(screen.getByText('Wolf')).toBeInTheDocument()
})
it('Arrow is decorative', () => {
  const { container } = render(<Arrow label="«creates»" dashed />)
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
})
```

- [ ] **Step 2: Run them to check they fail.** Expected: FAIL.

- [ ] **Step 3: Implement** as described in the Interfaces block above, and add all of the components to `lessonVisuals`. The figure background is `--code-bg` with a 1px border, radius 6px and padding 16px. Arrow heads are CSS borders (see the `.cr::after` rule in `structure-directions.html`).

- [ ] **Step 4: Run the tests.** Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(lesson): figure building blocks for Lesson visuals`.

---

### Task 6: Rewrite Problem, Analogy and Structure

**Files:**
- Modify: `content/patterns/factory-method/lesson.en.mdx` (the first three Sections)
- Test: `web/src/features/lesson/LessonPage.test.tsx`

**Interfaces:**
- Consumes: every component from Tasks 1–5, by their exact names and props.

- [ ] **Step 1: Write the failing test** in `LessonPage.test.tsx`. It uses the file's `renderAt(path)` helper.

```tsx
it('the Factory Method Lesson shows its Problem, Analogy and Structure visuals', async () => {
  renderAt('/patterns/factory-method') // existing helper in this file
  expect(await screen.findByRole('complementary', { name: 'Key idea' })).toBeInTheDocument()
  expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(5)
  expect(screen.getByRole('figure', { name: /written once/i })).toBeInTheDocument()
  expect(screen.getByRole('figure', { name: /two families/i })).toBeInTheDocument()
  expect(document.querySelector('#structure .role-tag[data-role="contract"]')).toHaveTextContent('IEnemy')
})
```

- [ ] **Step 2: Run it to check it fails**

Run: `cd web && npx vitest run src/features/lesson/LessonPage.test.tsx`
Expected: FAIL (no Key idea).

- [ ] **Step 3: Rewrite the three Sections**, keeping every sentence (spec §4.1–4.3):
  - **Problem:**
    - role tags and key marks: "the same way", "the enemies depend on the level";
    - the full "before" code as `<AnnotatedCode code={`…`} marks={…} />`, with the `switch` block lines (`IEnemy enemy = terrain switch` through `};`) toned `bad`. Badge `1` goes on the `switch` line, `2` on the `"forest" => new Wolf()` line, and `3` on the `_ => throw` line;
    - then `<BadgeList tone="bad">` wrapping the existing four bullets, unchanged and in their current order, as an ordered list;
    - then the closing sentence inside `<KeyIdea>`.
    - Inside the template literal, escape any `${` as `\${`. The current code has none (`$"{…}"` is fine).
  - **Analogy:**
    - all three paragraphs, with role tags in the third;
    - then `<Figure caption="Head office procedure · written once" description="…">` holding a `Grid cols="1.1fr 1fr"`. The left side is a `Card role="primary" icon="clipboard"` whose Markdown `ol` has `<Slot>Get a vehicle</Slot>` as step 2. The right side is a `Stack` of three `Box role="concrete"` rows:
      - `building` / City depot → cargo bike (`bike`);
      - `mountain` / Mountain depot → 4×4 van (`truck`);
      - a plain `Box icon="plus"`: "New depot opens · procedure untouched";
    - then a `<KeyIdea>` with the line from spec §4.2.
  - **Structure:**
    - after "two parallel sets of roles.", a `<Figure caption="Two families, side by side" description="…">` with `<Grid cols="1fr 120px 1fr" narrowCols="1fr 70px 1fr">`. The row 1 cells are `Box role="primary" sub="abstract · CreateEnemy()"` Level, `Arrow label="uses"`, and `Box role="contract" sub="interface"` IEnemy. The row 2 cells are `Row` [ForestLevel, CaveLevel] (concrete), `Arrow label="«creates»" dashed`, and `Row` [Wolf, Bat]. Above the boxes are column headings "Creators · make things" and "Products · get made";
    - role tags on every participant name in the three paragraphs, and `**creator**` / `**factory method**` in bold;
    - `<StructureDiagram />` stays last.
  - Every `description` is one or two sentences that read the figure aloud, e.g. "Two families mirror each other: the creator Level with subclasses ForestLevel and CaveLevel uses the IEnemy interface, and each subclass creates its own enemy, Wolf or Bat."

- [ ] **Step 4: Run the Lesson and content tests**

Run: `cd web && npx vitest run src/features/lesson src/content`
Expected: PASS. Six Sections stay, and the icon names are known.

- [ ] **Step 5: Look at it.** Run `npm run dev` in `web`, then open `/patterns/factory-method` at 1440px and 390px, in light and dark. Compare it with the three mockups (A options).

- [ ] **Step 6: Commit** with the message `content(factory-method): visual Problem, Analogy and Structure sections`.

---

### Task 7: Rewrite Interaction and When to use

**Files:**
- Modify: `content/patterns/factory-method/lesson.en.mdx` (Sections 4 and 6)
- Test: `web/src/features/lesson/LessonPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('the Factory Method Lesson shows its Interaction and When-to-use visuals', async () => {
  renderAt('/patterns/factory-method')
  await screen.findByRole('complementary', { name: 'Key idea' })
  expect(document.querySelectorAll('#interaction .point')).toHaveLength(3)
  const when = document.querySelector('#when-to-use')!
  expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
  expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
  expect(when.querySelectorAll('.pitfall')).toHaveLength(3)
  expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(3)
  expect(within(when as HTMLElement).getByRole('figure', { name: /which tool/i })).toBeInTheDocument()
  expect(within(when as HTMLElement).getByRole('figure', { name: /when is the object made/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to check it fails.** Expected: FAIL.

- [ ] **Step 3: Rewrite**, following spec §4.4 and §4.6 and keeping every sentence:
  - **Interaction:**
    - "Step through the scene. Three things are worth noticing." stays;
    - then three `<Point>` cards. Each card's `title` is its paragraph's first sentence, and the rest of the paragraph is the children;
    - the asides are:
      1. `AnnotatedCode` with the two `Level … = new …Level();` lines and the comment `// ↑ the only place a type is chosen`;
      2. a `Stack` chain: `Box role="primary"` Level.SpawnWave → `Arrow dir="down" label="calls CreateEnemy()"` → `Box role="concrete"` ForestLevel override → `Arrow dir="down" label="new"` → `Box role="concrete"` Wolf, with `<Key>down</Key>` in the text;
      3. a `Stack` of two `Row`s, each `Box role="concrete"` forest/cave → `Arrow` → `Box tone="ok"` `wolf 1, wolf 2` / `bat 1, bat 2`, plus a muted caption "both from one loop in Level";
    - the `protected` paragraph moves into `<Note icon="lock">`;
    - `<InteractionScene />` stays last.
  - **When to use:**
    1. a `<Checklist>` with three `<Verdict ok>` items and one `<Verdict ok={false}>` for "Skip it…";
    2. `<Figure caption="Which tool? Read top to bottom" description="…">`, a `Stack` of `Grid cols="1fr 24px 220px"` rows. Each row is a question `Box`, a label, then an answer `Box`, where the Factory Method answer is `tone`-less with the accent class `lesson-box-accent` (add that one modifier to `Box` as `accent?: boolean` in this task, with a one-line test in `figure.test.tsx`). `Arrow dir="down"` sits between rows, labelled yes/no, as in spec §4.6.2;
    3. under "The `new` call it removes", the full text, then a `Row` with `AnnotatedCode` (before: the `new Wolf()` line tone `bad`, caption "Before: the loop can only make wolves"), an `Arrow label="one line moves"`, and `AnnotatedCode` (after: the override lines tone `concrete`, caption "After: the loop makes whatever the subclass says");
    4. the parameterised code in full as `AnnotatedCode` with badges `1` (the "minion" line, note "defaults live in the base"), `!` tone `warn` (the `_ => throw` line, note "unknown kind = runtime error"), `2` (the `"boss"` line, note "add one kind") and `3` (the `base.CreateEnemy(kind)` line, note "the rest from the base");
    5. the text, then a `Row` of two `Card`s:
       - "Simple Factory": `Box` EnemyFactory.Create(kind) → fan of Wolf, Bat and a dashed "+ Scorpion", ending with `<Verdict ok={false}>new kind → edit the switch</Verdict>`;
       - "Factory Method": `Box role="primary"` Level.CreateEnemy() → Forest→Wolf, Cave→Bat and "+ Desert→Scorpion", ending with `<Verdict ok>new kind → add a class, edit nothing</Verdict>`;
    6. the text with `<Key>while it runs</Key>`, then `<Figure caption="When is the object made?">` with `<Track label="Constructor / DI" dots={[4]} tone="contract" caption="made once, before, by the caller" />` and `<Track label="Factory Method" dots={[30, 48, 66, 84]} caption="made fresh, each time Level asks" />`;
    7. three `<Pitfall title="…">` cards, each holding the full text and a `<CodePair>` with the snippets and labels from spec §4.6.7 (heavy / lighter, runs too early / runs when needed, leaks / a hook).
  - `<Lookalikes />` stays last.

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run`
Expected: everything PASSES.

- [ ] **Step 5: Look at it** at 1440px and 390px, in light and dark, against `interaction-directions.html` (A) and `when-to-use-blocks.html`.

- [ ] **Step 6: Commit** with the message `content(factory-method): visual Interaction and When-to-use sections`.

---

### Task 8: End-to-end check, DESIGN.md vocabulary, final pass

**Files:**
- Modify: `web/e2e/lesson.spec.ts`, `DESIGN.md`

- [ ] **Step 1: Write the e2e test**

```ts
for (const width of [390, 1440])
  test(`the Factory Method Lesson renders its visuals without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/patterns/factory-method')
    await expect(page.getByRole('heading', { level: 2, name: 'Problem' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('complementary', { name: 'Key idea' }).first()).toBeVisible()
    await expect(page.locator('.pitfall')).toHaveCount(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
```

- [ ] **Step 2: Run the e2e tests**

Run: `cd web && npx playwright test lesson.spec`
Expected: all PASS, including Observer's existing Lesson test (Review Focus 5). If 390px overflows, fix the offending CSS (a Grid without `narrowCols`, a `nowrap` tag inside a fixed-width box) and rerun.

- [ ] **Step 3: Document the vocabulary.** Add a "Lesson visual vocabulary" section to DESIGN.md: the table from spec §3 (element, look, meaning, use), the role-tag scope rule, and a one-line list of the MDX components with their main props. Later Lessons follow this.

- [ ] **Step 4: Run the full verification**

Run: `cd web && npx vitest run && npx tsc -b && npx oxlint && npx playwright test lesson.spec visuals.spec patterns.spec`
Expected: everything passes, and lint shows no new warnings.

- [ ] **Step 5: Final visual review.** Screenshot `/patterns/factory-method` at 390px and 1440px in light and dark mode (Playwright `page.screenshot`, saved to the scratchpad, not the repo). Check text contrast in role tags and verdict rows, and compare each Section with its mockup.

- [ ] **Step 6: Commit** with the message `docs(design): Lesson visual vocabulary; e2e for the Factory Method visuals`.
