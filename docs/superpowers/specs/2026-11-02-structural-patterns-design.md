# Remaining structural patterns: Adapter, Bridge, Composite, Facade, Flyweight, Proxy — Design

**Date:** 2026-11-02 · **Status:** accepted. The user asked to build the remaining six Structural Patterns with subagent-driven development, then merge to `main` and publish, without stopping.
**Builds on:**
- the trainer spec `2026-10-22-design-patterns-trainer-design.md`: §3 content and tiers, §4 grading, §5 C# runtime rules;
- the M4 content plan `docs/superpowers/plans/2026-10-23-m4-content.md`: Pattern layout and validation, the Exercise and Exam conventions, the giveaway rules;
- the visual Lesson specs `2026-10-29-…` and `2026-10-30-visual-lessons-rollout-design.md`, plus DESIGN.md → "Lesson visual vocabulary";
- the Creational spec `2026-10-30-creational-patterns-design.md`, whose shape this spec copies.

## 1. Intent

Finish the Structural category. Adapter, Bridge, Composite, Facade, Flyweight and Proxy become fully built Patterns, exactly like Decorator:

- a **visual** Lesson, authored with the Lesson visual components from the start;
- Structure Diagram, Interaction Scene and a runnable example;
- graded Exercises and Exam Questions.

After this, all 7 Structural Patterns are built (with the 5 Creational ones and Strategy and Observer, 14 of 23 Patterns). Decorator's Lookalike links to Proxy, Adapter and Composite go live.

## 2. Scope

| Pattern | Tier | Exercises | Exam Questions | `lookalikes` | `roleNames` |
|---|---|---|---|---|---|
| `adapter` | Standard | 3: `complete`, `refactor`, `build` | 3 | `decorator`, `facade`, `bridge`, `proxy` | `Adapter, Adaptee, Target` |
| `bridge` | Tricky | 5: `complete`, 2× `refactor`, 2× `build` (descriptive ids) | 5 | `adapter`, `strategy`, `abstract-factory` | `Bridge, Abstraction, RefinedAbstraction, Implementor, ConcreteImplementor` |
| `composite` | Standard | 3 | 3 | `decorator`, `iterator`, `visitor` | `Composite, Component, Leaf` |
| `facade` | Standard | 3 | 3 | `adapter`, `mediator`, `singleton` | `Facade, Subsystem` |
| `flyweight` | Tricky | 5 (descriptive ids) | 5 | `singleton`, `prototype`, `composite` | `Flyweight, FlyweightFactory, Intrinsic, Extrinsic` |
| `proxy` | Standard | 3 | 3 | `decorator`, `adapter`, `facade` | `Proxy, RealSubject, Subject, Surrogate` |

Lookalike text is one sentence per id that tells the two apart, in each Pattern's `text.en.yaml`. Unbuilt lookalikes (Iterator, Visitor, Mediator) show unlinked, as today.

**Non-goals:** engine, validator or UI changes apart from what a content test needs; other categories; German; changing existing Patterns except where a scenario would now give away a new Pattern (e.g. an existing exam using "adapter", "proxy", "facade", "leaf", "subsystem" as a domain word).

## 3. Lessons

Each Lesson follows the fixed six Sections and the visual vocabulary, like the Creational ones:

- **Problem:** annotated "before" code, the bullets as a `BadgeList`, and a `KeyIdea`.
- **Analogy:** a picture strip with a `KeyIdea`.
- **Structure:** a relationship figure above the Structure Diagram.
- **Interaction:** three `Point` cards above the Interaction Scene.
- **C# example:** plain, plus the "change it" exercise.
- **When to use:** a checklist, figures for the subsections, and `Pitfall` cards with code pairs.

Voice and length match the existing Lessons. Every figure is a described `Figure`; every Lesson works at 390px.

### 3.1 Adapter: importing runs from a watch maker's SDK
- **Problem:** a running app's `TrainingLog` expects `IRunSource` with `GetRuns()` returning distances in km and durations as `TimeSpan`. A third-party `PaceWatchSdk` (can't be edited) offers `FetchActivities()` returning miles and seconds. The log is littered with conversion code and SDK calls; a second watch brand would mean more `if`s.
- **Roles:** `IRunSource` (`contract`, Target); `PaceWatchSdk` (`concrete`, Adaptee); `PaceWatchAdapter` (`primary`, implements `IRunSource`, holds the SDK, converts); client `TrainingLog`.
- **Analogy:** a travel plug adapter: the socket and the plug stay as they are; the small piece in between makes them fit.
- **Teaching points:** the client keeps its interface; the adaptee stays untouched; the adapter only translates (no new behaviour). Object adapter (composition) vs class adapter (inheritance) gets a two-card figure; C# favours the object adapter.

### 3.2 Bridge: podcast player controls × audio outputs
- **Problem:** `BasicSpeakerPlayer`, `BasicHeadphonePlayer`, `PodcastSpeakerPlayer`, `PodcastHeadphonePlayer`… every new control style or output multiplies classes (a class-count grid figure: 2×2 → 3×3).
- **Roles:** `Player` (`contract`, Abstraction) holds an `IAudioOutput`; `BasicPlayer`, `PodcastPlayer` (`concrete`, refined: podcast adds skip-30s and speed); `IAudioOutput` (`contract`, Implementor) with `Speaker`, `Headphones` (`concrete`); client program (`primary` not needed — client stays plain).
- **Analogy:** wall switches and lamps: any switch style (toggle, dimmer) works with any lamp, because they meet at the wiring.
- **Teaching points:** two hierarchies that vary independently; composition instead of a class per combination; the abstraction delegates to the implementor. Bridge vs Adapter (designed up front vs retrofitted) and Bridge vs Strategy (structure vs swappable algorithm) as figures.

### 3.3 Composite: a food-truck menu with combos
- **Problem:** a menu has single items and combos that contain items and other combos. Pricing code checks `if (x is Combo) … else …` recursively in many places.
- **Roles:** `IMenuEntry` (`contract`, Component) with `Price()` and `Describe()`; `MenuItem` (`concrete`, Leaf); `Combo` (`primary`, Composite) holds `List<IMenuEntry>` and sums its children; client `OrderTicket`.
- **Analogy:** shipping boxes inside boxes: you can weigh any box without caring what's inside it.
- **Teaching points:** one interface for one and many; the composite delegates to children and combines; recursion falls out naturally. Pitfall/note: where child-management methods live (transparency vs safety) as a two-card figure.

### 3.4 Facade: evening-class enrolment
- **Problem:** to enrol a student, the sign-up page calls `SeatRegister`, `PaymentGateway`, `LearnerAccounts` and `WelcomeMailer` in the right order with the right data, and so does the phone-booking screen. Both know four subsystems.
- **Roles:** `EnrolmentDesk` (`primary`, Facade) with one `Enrol(student, course)`; the four subsystem classes (`concrete`); clients `SignUpPage` and `PhoneBooking` (plain).
- **Analogy:** a hotel concierge: you ask one person, they phone the restaurant, the taxi firm and the theatre.
- **Teaching points:** one simple entry point; subsystems stay usable directly; the facade adds no new features, it orchestrates. Facade vs Adapter (simplify many vs translate one) figure; pitfall: the facade turning into a god object.

### 3.5 Flyweight: a concert hall seat map
- **Problem:** a seat map of 40,000 seats where each `Seat` object carries its own copy of price-band colour, icon, label font and description text — memory grows with every seat although there are only 5 price bands.
- **Roles:** `SeatStyle` (`primary`, Flyweight; immutable, intrinsic: colour, icon, band name); `SeatStyleCatalog` (`contract`-less class, `concrete`, the flyweight factory: returns the shared style for a band, creating it once); extrinsic state (row, number, position) passed in or kept in a light `SeatSpot` struct; client `SeatMap`.
- **Analogy:** a rubber stamp: one stamp, thousands of impressions, each at its own place on the page.
- **Teaching points:** intrinsic (shared, immutable) vs extrinsic (per use, passed in) state as its own figure; the factory guarantees sharing (`ReferenceEquals` same instance); a memory figure (40,000 heavy objects vs 5 shared + 40,000 tiny). .NET note: string interning is a built-in flyweight. Pitfall: mutable flyweights.

### 3.6 Proxy: house-listing floor-plan scans
- **Problem:** a property-listing page loads every high-resolution floor-plan scan when the listing opens, even though most visitors never open the plans; and plans of unpublished listings must be hidden from non-agents. Loading and access checks are mixed into the page.
- **Roles:** `IFloorPlan` (`contract`, Subject) with `Render()`; `ScannedFloorPlan` (`concrete`, RealSubject; expensive to create); `FloorPlanProxy` (`primary`, Proxy; same interface, creates the real plan on first `Render()`, and can refuse access); client `ListingPage`.
- **Analogy:** a debit card stands in for your bank account: same "pay" action, but it checks the PIN and only touches the account when you actually pay.
- **Teaching points:** same interface as the real object; controls access (lazy, protection, caching, remote); the client can't tell. Proxy vs Decorator figure (controls access to one object vs stacks added behaviour). .NET note: `Lazy<T>`.

## 4. Exercises and Exam Questions

The M4 conventions hold, as in the Creational spec §4: a Contract; behavioural Checks plus at least one structural Check; `en` titles and messages; ≤3 Hints; every enforced behaviour stated in the scenario; unique domains; no Pattern or role word in Exam titles, scenarios or Contracts (validator enforces `roleNames`, plurals included); at least one Exam Question per Pattern where a Lookalike is plausible but this Pattern is the one called for.

**Valid alternatives must pass:**
- **Adapter:** an object adapter (composition); a class adapter is accepted where the adaptee is not sealed and the Contract allows it.
- **Bridge:** the implementor as an interface or an abstract class; the abstraction as an abstract class or a concrete base.
- **Composite:** child management on the composite only, or on the component interface.
- **Facade:** a facade with constructor-injected subsystems or one that creates them.
- **Flyweight:** a dictionary-backed factory or a lazily filled array/switch; extrinsic state passed as parameters or held in a small context struct.
- **Proxy:** lazy creation via a null check or `Lazy<T>`.

**Checks test the behaviour that matters:**
- **Adapter:** the client works against the target interface; conversions are correct; the adaptee is called (not reimplemented).
- **Bridge:** every abstraction works with every implementor without a class per pair; swapping the implementor changes the output.
- **Composite:** a nested structure computes the right total; leaves and composites are used through one interface.
- **Facade:** one call performs the subsystem steps in the stated order; the client never touches the subsystems.
- **Flyweight:** the factory returns the **same instance** for the same key (`ReferenceEquals`), distinct instances for distinct keys; the flyweight is immutable; extrinsic state is not stored in it.
- **Proxy:** the real object is not created until first use and is created at most once; access rules are enforced; results equal the real object's.

## 5. Constraints

- All Global Constraints of the M4 and Creational plans, including the test budget: filtered .NET content tests per Pattern and at most one screenshot script per Lesson task. The full suites run once in the final task and once after the final fix wave.
- Lesson constraints from the visual specs: no sentence-level shortcuts, accessible figures, both themes, no overflow at 390px.
- C# runtime rules (trainer spec §5): no file I/O, no threads. Checks must not rely on them. Proxy Checks count creations with a static/instance counter, never timing.

## 6. Done means

- `/patterns/{adapter,bridge,composite,facade,flyweight,proxy}` render full visual Lessons.
- Their Exercises and Exam Questions pass the .NET content validator, including tier counts.
- Exams can include them; Decorator's Proxy/Adapter/Composite Lookalikes are links.
- The e2e Lesson loop covers all 14 Lessons with no overflow at 390 and 1440.
- The full suites are green, the work is merged to `main` and pushed (Pages deploys from CI).
