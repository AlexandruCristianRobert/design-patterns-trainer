# Visual Lessons Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Observer, Strategy, Decorator and Singleton Lessons the same visual treatment as the Factory Method pilot, without removing any text.

**Architecture:**
- The MDX components in `web/src/features/lesson/visuals/` already exist and are registered for every Lesson.
- Task 1 closes the small component gaps: `Box ghost`, `ColumnHead`, nested `Box`, new icons and the `Pitfall` level. It also moves the Factory Method MDX onto those components.
- Tasks 2–5 each rewrite one `lesson.en.mdx` to spec §4.x.
- Task 6 adds e2e coverage and does the final pass.

**Tech Stack:** React 19, TypeScript, MDX 3, lucide-react, Vitest + Testing Library, Playwright.

**Specs:** `docs/superpowers/specs/2026-10-30-visual-lessons-rollout-design.md` (this rollout; §4.x per Lesson is binding) and `docs/superpowers/specs/2026-10-29-visual-lesson-factory-method-design.md` (vocabulary §3 and constraints §5). DESIGN.md → "Lesson visual vocabulary" lists the component APIs. The visual reference is the live Factory Method Lesson (`/patterns/factory-method`).

## Global Constraints

- **No sentence removed** from any Lesson. Light wording changes are allowed only where a figure needs a caption or a number reference. Point title plus children must contain the whole paragraph.
- **What stays untouched:** the Structure Diagrams, Interaction Scenes, C# example Sections (including the prose after `<LessonExample />`), `<Lookalikes />`, Exercises and Exams.
- **Role tags:** use the table in the rollout spec §4. Only participants and the slot method get tags; other members stay plain inline code.
- **Every box-and-arrow figure** is a `<Figure caption description>`. Verdicts are spoken in words, and icons are `aria-hidden`.
- **Tokens only.** No hex outside `tokens.css`, and no new oxlint warnings.
- **Six `<Section>` elements** per Lesson, in order (content test).
- **Layout:** no page overflow at 390px. Figures stack sensibly, using `narrowCols` on Grids. Check both themes at 390px and 1440px.
- **MDX idioms from the pilot:**
  - markdown inside JSX goes dedented to column 0 with blank lines around it;
  - code goes in `code={`…`}`, with `${` and backticks escaped;
  - nested `AnnotatedCode` and `Figure` take `wide={false}`;
  - `<Role kind="contract">Cost()</Role>` keeps the parentheses inside the tag.
- **Memory is low:** one dev server or Playwright run at a time, and stop them afterwards. Screenshots go to the scratchpad `C:\Users\calexand\AppData\Local\Temp\claude\D--Repos-Design-Patterns\60c64b16-9341-4001-8677-cac3bc9cbb5f\scratchpad\`, never into the repo.

## Review Focus

1. **Nested `Box`:** the Decorator layers at 390px could overflow or lose the inner role colour. Expected: the boxes stay inside each other with no page scroll. Task 1 has a unit test, and Task 6 covers it in e2e at 390px.
2. **Text loss:** a Point title split or a card conversion silently drops a clause. Expected: every original sentence is still present. The reviewers for Tasks 2–5 diff against the original text.
3. **Unknown icon names in MDX** fail the existing content test. Task 1 adds the icons before Tasks 2–5 use them.
4. **Comparison grids** (Singleton's static vs Singleton, Observer's push/pull) squeeze at 390px. Expected: they stack or stay legible without overflow. Task 6 runs the e2e overflow check per Lesson.
5. **Other Lessons regress** through shared CSS changes in Task 1. Expected: Factory Method looks the same. Task 1 includes a Factory Method visual check, and the existing FM tests stay green.

---

### Task 0: Branch and spec

- [ ] `git checkout -b feat/visual-lessons-rollout`, then commit both docs (the rollout spec and this plan) with the message `docs: visual Lessons rollout design and plan`.

---

### Task 1: Component gaps, plus Factory Method moved onto them

**Files:**
- Modify: `web/src/features/lesson/visuals/figure.tsx`, `figure.test.tsx`, `icons.ts`, `callouts.tsx`, `callouts.test.tsx`, `index.ts`, `web/src/styles/base.css` (the Lesson visuals block), `content/patterns/factory-method/lesson.en.mdx`, `DESIGN.md`

**Interfaces:**
- Produces:
  - `Box` gains `ghost?: boolean`, which adds class `lesson-box-ghost`: a dashed `--border` outline, `--muted` text, transparent background, and it ignores role and tone colours.
  - `ColumnHead({ children })`, a small muted heading above a figure column. It replaces `div.fig-colhead`; reuse that CSS.
  - `Pitfall` gains `level?: 3 | 4 | 5`, default 4, which sets the heading element.
  - A `Box` may contain `Box` children. The inner box keeps its own role colour and padding, and an outer box with box children lays them out as a column with an 8px gap.
  - `LessonIconName` gains `mail`, `smartphone`, `printer`, `car`, `train` and `image` (Lucide `Mail`, `Smartphone`, `Printer`, `Car`, `TrainFront`, `Image`), and also `book` (Lucide `BookOpen`).
  - All are registered in `lessonVisuals` (ColumnHead is new).

- [ ] **Step 1: Failing tests**

```tsx
it('Box ghost renders a dashed placeholder without role colour', () => {
  render(<Box role="concrete" ghost>+ WatchDisplay</Box>)
  const box = screen.getByText('+ WatchDisplay').closest('.lesson-box')!
  expect(box).toHaveClass('lesson-box-ghost')
})
it('ColumnHead renders a column heading', () => {
  render(<ColumnHead>Observers · get told</ColumnHead>)
  expect(screen.getByText('Observers · get told')).toHaveClass('fig-colhead')
})
it('a Box can hold Boxes, each keeping its role', () => {
  render(<Box role="concrete">Frame<Box role="concrete">Mat<Box role="concrete" icon="image">Photo</Box></Box></Box>)
  const photo = screen.getByText('Photo').closest('.lesson-box')!
  expect(photo.parentElement!.closest('.lesson-box')).toHaveTextContent('Mat')
  expect(photo).toHaveAttribute('data-role', 'concrete')
})
it('Pitfall heading level is configurable', () => {
  render(<Pitfall title="Captive dependency" level={3}>Text.</Pitfall>)
  expect(screen.getByRole('heading', { level: 3, name: 'Captive dependency' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run them.**
  Run: `cd web && npx vitest run src/features/lesson/visuals`
  Expected: FAIL.

- [ ] **Step 3: Implement.** Implement the Interfaces above. In `lesson.en.mdx` (Factory Method), replace every `div className="lesson-box … fig-ghost"` with `<Box ghost>` and every `div className="fig-colhead"` with `<ColumnHead>`, so no raw `className` is left in the MDX. Update DESIGN.md's component list with `ghost`, `ColumnHead`, `level` and the icons.

- [ ] **Step 4: Verify.**
  Run: `cd web && npx vitest run && npx tsc -b && npx oxlint`
  Expected: all pass, and no new warnings. Then confirm `grep -c className content/patterns/factory-method/lesson.en.mdx` prints `0`.

- [ ] **Step 5: Visual check.** Screenshot Factory Method's Structure, the Simple Factory cards and the decision path at 390px and 1440px. Expected: they look as before.

- [ ] **Step 6: Commit** with the message `feat(lesson): ghost boxes, column heads, nested boxes, more icons`.

---

### Tasks 2–5: One Lesson each

Every Lesson task has the same shape. Each is one dispatch with its own spec section:

| Task | Lesson file | Spec section | Commit |
|---|---|---|---|
| 2 | `content/patterns/observer/lesson.en.mdx` | §4.1 | `content(observer): visual Lesson` |
| 3 | `content/patterns/strategy/lesson.en.mdx` | §4.2 | `content(strategy): visual Lesson` |
| 4 | `content/patterns/decorator/lesson.en.mdx` | §4.3 | `content(decorator): visual Lesson` |
| 5 | `content/patterns/singleton/lesson.en.mdx` | §4.4 | `content(singleton): visual Lesson` |

**Files:**
- Modify: the Lesson file, and `web/src/features/lesson/LessonPage.test.tsx`. Small CSS fixes are allowed in the Lesson visuals block of `base.css`, and must be reported.

**Interfaces:**
- Consumes: every component from the pilot and Task 1, as documented in DESIGN.md → "Lesson visual vocabulary".

- [ ] **Step 1: Failing test** in `LessonPage.test.tsx`, using its `renderAt(path)` helper:

```tsx
it('the <Name> Lesson shows its visuals', async () => {
  renderAt('/patterns/<id>')
  const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
  expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
  expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(2)
  expect(document.querySelectorAll('#problem .badge-list li').length).toBe(4)
  expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
  const when = document.querySelector('#when-to-use')!
  expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
  expect(when.querySelectorAll('.pitfall .code-pair').length).toBe(<pitfall count from spec>)
  // plus one getByRole('figure', { name: /…/ }) per figure the spec names for this Lesson (analogy strip, structure figure, and each extra figure)
})
```

Use the spec's counts. The pitfall code pairs are Observer 4, Strategy 4, Decorator 3 and Singleton 3. Singleton also has a captive-dependency `Pitfall` without a pair, so count `.pitfall` separately there.

- [ ] **Step 2: Run it.** Expected: FAIL.

- [ ] **Step 3: Rewrite the Lesson** to spec §4.x, Section by Section. Keep every sentence, and leave the C# example Section byte-identical.

- [ ] **Step 4: Verify.**
  Run: `cd web && npx vitest run src/features/lesson src/content && npx tsc -b`
  Expected: PASS.

- [ ] **Step 5: Visual check.** Run the dev server on 5199 and screenshot each Section at 1440×900 and 390×844, in light and dark. Read the screenshots and compare them with spec §4.x and the Factory Method look. Check `scrollWidth` is at most 390 at 390px. Stop the server.

- [ ] **Step 6: Commit** with the Lesson's message from the table.

---

### Task 6: e2e for all Lessons and final pass

**Files:** Modify `web/e2e/lesson.spec.ts`

- [ ] **Step 1: Extend the existing Factory Method overflow test** into a loop over all five Lesson ids.

```ts
for (const id of ['factory-method', 'observer', 'strategy', 'decorator', 'singleton'])
  for (const width of [390, 1440])
    test(`the ${id} Lesson renders its visuals without page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/patterns/${id}`)
      await expect(page.getByRole('heading', { level: 2, name: 'Problem' })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('complementary', { name: 'Key idea' }).first()).toBeVisible()
      await expect(page.locator('#interaction .fig-point')).toHaveCount(3)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
```

Keep the existing Factory Method-specific assertions, such as the pitfall count and the code-notes check, in their own test.

- [ ] **Step 2: Run the e2e specs.**
  Run: `cd web && npx playwright test lesson.spec`, then `npx playwright test visuals.spec patterns.spec`
  Expected: all pass.

- [ ] **Step 3: Full verification.**
  Run: `cd web && npx vitest run && npx tsc -b && npx oxlint`
  Expected: all green, with no new warnings.

- [ ] **Step 4: Commit** with the message `test(e2e): visual Lessons render without overflow`.
