# Design foundation — A · Editor-native

The app should feel like a polished IDE built for learning: calm neutral surfaces, one accent, and colour reserved for Pattern roles. Reference preview: `docs/design/foundations-comparison.html` (foundation A).

## Principles

- **The editor is home.** Practice and exams happen in code; every screen should feel continuous with the editor.
- **Colour means something.** The only strong colours are the accent (actions, progress) and the role colours (Pattern participants). Nothing decorative.
- **Borders, not shadows.** Elevation is a 1px border and a surface step. No glow, gradients or glassmorphism.
- **Lists over card grids.** Collections are rows whose content differs (e.g. each Pattern's own diagram thumbnail), never identical icon-title-sentence cards.
- **Icons from Lucide only.** No emoji as icons.
- **Every state designed:** compiler warming up, compile error, runner timeout, empty progress, no exam history, untranslated content.

## Tokens

| Token | Light | Dark |
|---|---|---|
| `bg` | `#f7f7f8` | `#111113` |
| `surface` | `#ffffff` | `#18181b` |
| `surface-2` | `#f1f1f3` | `#1f1f23` |
| `border` | `#e3e3e7` | `#2c2c31` |
| `text` | `#18181b` | `#ececef` |
| `muted` | `#5f5f68` | `#a1a1aa` |
| `accent` (teal) | `#0f766e` | `#2dd4bf` |
| `accent-fg` | `#ffffff` | `#042f2e` |
| `ok` | `#15803d` | `#4ade80` |
| `bad` | `#b91c1c` | `#f87171` |
| `warn` | `#b45309` | `#fbbf24` |
| `code-bg` | `#fbfbfc` | `#141416` |
| `line-highlight` | `#fef3c7` | `#3a2f12` |

### Role colours (diagrams, Interaction Scenes, linked code highlights)

Used consistently for the same role across Structure Diagram, Interaction Scene and highlighted code. A Pattern maps its participants onto these roles.

| Role | Light | Dark | Typical participants |
|---|---|---|---|
| `role-primary` | `#c2410c` | `#fb923c` | Subject, Context, Singleton, Creator, Component being wrapped |
| `role-contract` | `#2563eb` | `#60a5fa` | Interfaces / abstract roles (IObserver, IStrategy, Product) |
| `role-concrete` | `#7c3aed` | `#a78bfa` | Concrete implementations (ConcreteObserver, ConcreteStrategy, Decorators) |

Interfaces/abstract roles are drawn with a dashed border.

## Lesson visual vocabulary

Lessons use a fixed set of visual marks. Colour is always a role, a verdict (`ok` / `bad` / `warn`) or the accent. All figure text lives in the MDX; generic labels ("Key idea", "Good:", "Avoid:") come from `locales/*/lesson.json`.

| Element | Looks like | Meaning | Use |
|---|---|---|---|
| Role tag | Mono text in a soft-tinted pill with a 1px border in the role colour; `contract` has a dashed border | This name is a participant in the Pattern, with this role | Class, interface and factory-method names in prose |
| Key mark | Semibold with an accent highlighter underlay (bottom ~45% of the line) | The phrase to remember | At most one or two per Section |
| Key idea callout | Bordered box, 3px accent left border, Lucide `Lightbulb`, small label, one or two sentences | Section summary | Problem, Analogy, optionally elsewhere |
| Figure | `code-bg` surface, 1px border, small uppercase caption | A picture of what the text says | All Section visuals |
| Annotated code | Code with tinted lines (bad red, good purple/concrete, warn amber), 3px left bar, numbered badges at line ends, short notes beside them (listed under the code below 640px) | Look here, and this is why | Problem, Parameterised factory method |
| Verdict marks | Lucide `Check` in an `ok` circle, `X` in a `bad` circle, with hidden "Good:" / "Avoid:" text | Good / bad | Checklists, comparisons, pitfalls |
| Warning card | Amber left border, Lucide `TriangleAlert`, title | A trap | Pitfalls |
| Note callout | Plain bordered box with a Lucide icon | A side remark | e.g. the `protected` note |

**Scope of role tags:** tag only the Pattern's participants (the classes, the interface and the factory method), wherever they appear in prose, in every Section. Other members and non-participants stay plain inline code.

**MDX components** (`web/src/features/lesson/visuals/`): `Role kind`, `Key`, `Slot`; `KeyIdea`, `Note icon`, `Pitfall title`; `Verdict ok` (a block, so it never sits inside a paragraph), `Checklist` (announced as a list), `CodePair bad good badLabel goodLabel`; `AnnotatedCode code marks caption wide`, `BadgeList tone count` (only the first `count` items get a badge, the rest a plain dot); `Figure caption description wide` containing `Row`, `Stack`, `Grid cols narrowCols`, `Box role tone icon sub subIcon mono accent`, `Arrow dir label dashed`, `Card title role icon`, `Track label dots caption tone`, `Point n title aside`. A box-and-arrow figure always carries a `description` for screen readers (it becomes the figure's accessible description); arrows are decorative. `wide` (default true) gives a top-level `Figure` or `AnnotatedCode` the full column; pass `wide={false}` when nesting one in a `Point` aside or a `Grid` cell. A warn mark shows its authored `badge`, or "!" without one. At 640px and below every figure stacks to one column: a `Grid` whose `narrowCols` is one column, and every `Row`, turn their right arrows into down arrows; keep side-by-side meaning (e.g. a question and its exit) with a multi-column `narrowCols`.

## Type

- **UI and Lesson text:** Inter 400/500/600.
- **Code, diagrams, file names, scores:** JetBrains Mono 400/500.
- **Scale (px):** 12 · 13 · 14 (UI base) · 15 (Lesson body) · 17 · 22 · 24.
- **Lesson reading width:** max 70ch, line-height 1.6.

## Shape and spacing

- Radius **6px** everywhere (buttons, panels, inputs); dots and status icons are circular.
- Spacing on a **4/8px** rhythm: 4 · 8 · 12 · 16 · 24 · 32.
- Minimum interactive height **36px** desktop, **44px** touch.

## Theme

Follows the OS by default with a manual System / Light / Dark switch. The Monaco editor theme is derived from these tokens so the editor and app never mismatch.

## Review bar

Before UI work is called done: rendered check at ~390px and ~1440px, keyboard pass with visible focus (2px accent outline, 2px offset), text contrast ≥ 4.5:1, `prefers-reduced-motion` respected by Interaction Scenes.
