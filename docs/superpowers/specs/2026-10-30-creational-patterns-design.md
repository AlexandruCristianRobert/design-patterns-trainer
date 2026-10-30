# Remaining creational patterns: Abstract Factory, Builder, Prototype — Design

**Date:** 2026-10-30 · **Status:** accepted. The user asked for spec → plan → build → merge without stopping.
**Builds on:**
- the trainer spec `2026-10-22-design-patterns-trainer-design.md`: §3 content and tiers, §4 grading, §5 C# runtime rules;
- the M4 content plan `docs/superpowers/plans/2026-10-23-m4-content.md`: how a Pattern is laid out and validated, the Exercise and Exam conventions, and the giveaway rules;
- the visual Lesson specs `2026-10-29-…` and `2026-10-30-visual-lessons-rollout-design.md`, plus DESIGN.md → "Lesson visual vocabulary".

## 1. Intent

Finish the Creational category. Abstract Factory, Builder and Prototype become fully built Patterns, the same way the other five are:

- a **visual** Lesson, authored with the Lesson visual components from the start;
- Structure Diagram, Interaction Scene and a runnable example;
- graded Exercises and Exam Questions.

After this, all 5 Creational Patterns are built. The Catalog shows 8 built Patterns, exams can mix them, and Factory Method's Lookalike link to Abstract Factory goes live.

## 2. Scope

| Pattern | Tier | Exercises | Exam Questions | `lookalikes` | `roleNames` |
|---|---|---|---|---|---|
| `abstract-factory` | Tricky | 5: `complete`, 2× `refactor`, 2× `build` (descriptive ids) | 5 | `factory-method`, `builder`, `prototype` | `Factory, AbstractFactory, ConcreteFactory, Product, AbstractProduct, ConcreteProduct, Family, Kit` |
| `builder` | Standard | 3: `complete`, `refactor`, `build` | 3 | `abstract-factory`, `factory-method` | `Builder, Director, ConcreteBuilder` |
| `prototype` | Standard | 3: `complete`, `refactor`, `build` | 3 | `abstract-factory`, `memento` | `Prototype, ConcretePrototype, Clone, Cloneable` |

Lookalike text is one sentence per id that tells the two apart, in each Pattern's `text.en.yaml`. Memento isn't built yet, so it shows unlinked, as other unbuilt lookalikes already do.

**Non-goals:**
- engine, validator or UI changes, apart from what a content test needs;
- other categories;
- the German locale;
- changing existing Patterns. The only exception: a scenario must change if it would now give away one of the new Patterns.

## 3. Lessons

Each Lesson follows the fixed six Sections and the visual vocabulary:

- **Problem:** annotated "before" code, the bullets as a `BadgeList`, and a `KeyIdea`.
- **Analogy:** a picture strip with a `KeyIdea`.
- **Structure:** a relationship figure above the Structure Diagram.
- **Interaction:** three `Point` cards above the Interaction Scene.
- **C# example:** plain, plus the "change it" exercise.
- **When to use:** a checklist, figures for the subsections, and `Pitfall` cards with code pairs.

The Lessons are written in the voice and length of the existing ones. Every figure is a described `Figure`, and every Lesson works at 390px.

Each Lesson's story is set here so the three stay distinct from each other and from every existing domain:

### 3.1 Abstract Factory: a café's breakfast sets
- **Problem:** a breakfast counter makes a drink and a main with two separate `switch`es on the set name. Nothing stops a "continental" order getting an English fry-up with a croissant-style drink. The two choices can drift apart, and every new set edits both switches.
- **Roles:**
  - `IBreakfastKitchen` (`contract`) has `MakeDrink()` and `MakeMain()`.
  - `ContinentalKitchen` and `EnglishKitchen` (`concrete`) are the kitchens.
  - `IDrink` and `IMain` (`contract`) are the products, with `Coffee`, `Tea`, `Croissant` and `FryUp` (`concrete`).
  - The client `BreakfastCounter` (`primary`) holds one kitchen.
- **Analogy:** furniture collections in a showroom. Pick a collection (Scandinavian, Victorian) and every piece you get (chair, table, lamp) matches it.
- **Key teaching points:**
  - one object creates a whole family;
  - the client picks the family once;
  - mixing families becomes impossible.

  Factory Method vs Abstract Factory goes in its own figure: one overridable method vs one object with several creation methods. When to use covers the cost of adding a new product kind: every factory changes.

### 3.2 Builder: a rail journey booking
- **Problem:** a `Booking` constructor with many optional parameters (`seat`, `bike`, `meal`, `firstClass`, `return`). Call sites read as `new Booking("Cluj", "Brașov", null, true, false, null, …)`. Invalid combinations are only caught somewhere else.
- **Roles:**
  - `BookingBuilder` (`primary`) has fluent `WithSeat`, `WithBike`, `WithMeal` and `Build()`.
  - `Build()` validates, for example "a bike needs a carriage with bike spaces".
  - It returns an immutable `Booking` (`concrete`).
  - An optional `Director`-style `TripPlanner` shows a recipe that is reused, for example a commuter return.
- **Analogy:** a custom bicycle shop. You choose the frame, then the wheels, then the gears. The bike is assembled and checked only when you say "build it".
- **When to use:**
  - C# object initializers and records with `with` are often enough;
  - Builder earns its place when there are steps, validation at the end, or several representations.

### 3.3 Prototype: a wedding seating planner
- **Problem:** a planner sets up one table carefully (shape, a list of chairs, a centrepiece). To get ten more, the code rebuilds each one by hand with copied-and-pasted setup, and it has to know every concrete table class.
- **Roles:**
  - `ITable` (`contract`) has `Clone()`.
  - `RoundTable` and `LongTable` (`concrete`).
  - The `SeatingPlan` (`primary`) client copies a configured prototype without knowing its class.
- **Analogy:** a key cutter copies your key from the key itself, not from the lock maker's blueprint.
- **Key teaching points:**
  - the copy comes from an object, not a class;
  - **shallow vs deep copy** gets its own figure: the chair list is shared vs copied, so editing one table changes the other;
  - .NET notes: `MemberwiseClone` is shallow, `ICloneable` is discouraged because it is ambiguous, and records with `with` are also shallow;
  - a prototype registry, such as named templates.

## 4. Exercises and Exam Questions

The M4 conventions hold:

- a Contract, behavioural Checks plus at least one structural Check;
- `en` titles and failure messages, and at most 3 Hints;
- a scenario that states every behaviour a Check enforces;
- unique domains that appear nowhere else in the app;
- no Pattern or role word in Exam titles, scenarios or Contracts (the validator enforces `roleNames`, including plurals);
- at least one Exam Question per Pattern where a Lookalike is plausible but this Pattern is the one called for.

**Valid alternatives must pass:**
- **Abstract Factory:** a factory interface or an abstract class.
- **Builder:** a fluent builder or step methods returning `void`; a builder that is reusable or single-use, as the scenario says.
- **Prototype:** a `Clone()` written by hand, or one using a copy constructor or `MemberwiseClone` plus deep-copying the collections.

Checks test the behaviour that matters:
- **Prototype:** a copy is independent, so mutating the copy's list leaves the original alone. Copies keep their concrete type without the caller naming it.
- **Builder:** an invalid combination fails at `Build()`. Built objects are not changed by later builder calls when the scenario says so.
- **Abstract Factory:** every product from one factory belongs to the same family, and the client never names a concrete product.

## 5. Constraints

- All Global Constraints of the M4 plan, including the test budget: filtered .NET content tests per Pattern and at most one screenshot script per Lesson task. The full suites run once in the final task and once after the final fix wave.
- Lesson constraints from the visual specs: no sentence-level shortcuts, accessible figures, both themes, no overflow at 390px.
- The C# runtime rules (trainer spec §5): no file I/O and no threads. Checks must not rely on them.

## 6. Done means

- `/patterns/abstract-factory`, `/patterns/builder` and `/patterns/prototype` render full visual Lessons.
- Their Exercises and Exam Questions pass the .NET content validator, including tier counts.
- Exams can include them, and Factory Method's Abstract Factory Lookalike is a link.
- The e2e Lesson loop covers all 8 Lessons with no overflow at 390 and 1440.
- The full suites are green, and the work is merged to `main`.
