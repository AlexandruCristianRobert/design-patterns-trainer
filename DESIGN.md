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
