# Remaining behavioral patterns: Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, State, Template Method, Visitor — Design

**Date:** 2026-11-03 · **Status:** accepted. The user asked to build the remaining nine Behavioral Patterns the same way as the Creational and Structural ones, then merge to `main` and publish.
**Builds on:**
- the trainer spec `2026-10-22-design-patterns-trainer-design.md`: §3 content and tiers, §4 grading, §5 C# runtime rules;
- the M4 content plan `docs/superpowers/plans/2026-10-23-m4-content.md`: Pattern layout and validation, the Exercise and Exam conventions, the giveaway rules;
- the visual Lesson specs `2026-10-29-…` and `2026-10-30-visual-lessons-rollout-design.md`, plus DESIGN.md → "Lesson visual vocabulary";
- the Structural spec `2026-11-02-structural-patterns-design.md`, whose shape this spec copies.

## 1. Intent

Finish the Behavioral category and the Catalog. The nine Patterns become fully built, exactly like Strategy and Observer:

- a **visual** Lesson, authored with the Lesson visual components from the start;
- Structure Diagram, Interaction Scene and a runnable example;
- graded Exercises and Exam Questions.

After this, all 23 Patterns are built. Every Lookalike link in the Catalog goes live.

## 2. Scope

Tiers follow trainer spec §3 (Tricky: Visitor, State, Mediator, Interpreter, Memento; the others Standard). Standard = 3 Exercises (`complete`, `refactor`, `build`) + 3 Exam Questions. Tricky = 5 Exercises (`complete`, 2× `refactor`, 2× `build`, descriptive kebab-case ids in kind order) + 5 Exam Questions.

| Pattern | Tier | `lookalikes` | `roleNames` |
|---|---|---|---|
| `chain-of-responsibility` | Standard | `decorator`, `command`, `observer` | `Handler, ConcreteHandler, Successor, Chain` |
| `command` | Standard | `strategy`, `memento`, `chain-of-responsibility` | `Command, ConcreteCommand, Invoker, Receiver` |
| `interpreter` | Tricky | `composite`, `visitor`, `strategy` | `Interpreter, Expression, TerminalExpression, NonterminalExpression, Grammar` |
| `iterator` | Standard | `composite`, `visitor` | `Iterator, Aggregate, ConcreteIterator, ConcreteAggregate, Cursor` |
| `mediator` | Tricky | `observer`, `facade`, `command` | `Mediator, ConcreteMediator, Colleague` |
| `memento` | Tricky | `command`, `prototype` | `Memento, Originator, Caretaker, Snapshot` |
| `state` | Tricky | `strategy`, `memento` | `State, ConcreteState, Context, Transition` |
| `template-method` | Standard | `strategy`, `factory-method` | `TemplateMethod, AbstractClass, ConcreteClass, Hook, PrimitiveOperation` |
| `visitor` | Tricky | `composite`, `iterator`, `strategy` | `Visitor, ConcreteVisitor, Element, ConcreteElement, Accept` |

Lookalike text is one sentence per id that tells the two apart, in each Pattern's `text.en.yaml`, consistent with the sentences existing Patterns already hold about these ids (e.g. Strategy's `state` and `template-method` lines, Observer's `mediator` and `chain-of-responsibility` lines).

**Non-goals:** engine, validator or UI changes apart from what a content test needs; German; changing existing Patterns except where a scenario would now give away a new Pattern (an existing exam using "command", "handler", "state", "iterator", "visitor", "snapshot", "expression", "hook"… as a role-like word).

## 3. Lessons

Each Lesson follows the fixed six Sections and the visual vocabulary, like the Structural ones:

- **Problem:** annotated "before" code, the bullets as a `BadgeList`, and a `KeyIdea`.
- **Analogy:** a picture strip with a `KeyIdea`.
- **Structure:** a relationship figure above the Structure Diagram.
- **Interaction:** three `Point` cards above the Interaction Scene.
- **C# example:** plain, plus the "change it" exercise.
- **When to use:** a checklist, figures for the subsections, and `Pitfall` cards with code pairs.

Voice and length match the existing Lessons. Every figure is a described `Figure`; every Lesson works at 390px.

### 3.1 Chain of Responsibility: expense-claim approvals
- **Problem:** `ExpenseForm.Submit` has an `if/else` ladder: up to 100 EUR the team lead approves, up to 1,000 the department head, up to 10,000 the finance director, above that it is refused. Adding a "travel desk" step or reordering means editing the ladder.
- **Roles:** `Approver` (`contract`, abstract handler with `SetNext` and `Handle`); `TeamLead`, `DepartmentHead`, `FinanceDirector` (`concrete`); the chain built by the client `ExpenseForm` (plain).
- **Analogy:** a customer-service phone line escalating: front desk, then supervisor, then manager; each either answers or passes you up.
- **Teaching points:** each handler decides "mine or next"; the sender knows only the first link; the chain is assembled at runtime. Pitfall: a request falling off the end unhandled (a default last link); handlers that both handle and pass on (that is a pipeline, still allowed when the scenario says so).

### 3.2 Command: a playlist editor with undo
- **Problem:** a playlist editor's buttons call `Playlist` directly; undo is a big `switch` on the last action name with stored loose fields.
- **Roles:** `IPlaylistEdit` (`contract`, Command, `Do()`/`Undo()`); `AddSong`, `RemoveSong`, `MoveSong` (`concrete`); `Playlist` (`concrete`, Receiver); `EditHistory` (`primary`, Invoker, runs edits and keeps a stack for Undo).
- **Analogy:** a restaurant order slip: the waiter writes the request down, the kitchen acts on it later, and a slip can be cancelled.
- **Teaching points:** a request becomes an object; the invoker doesn't know what the command does; undo, queueing and logging fall out. Command vs Strategy figure (what to do vs how to do it). Pitfall: commands that hold too little state to undo.

### 3.3 Interpreter: greenhouse watering rules
- **Problem:** a greenhouse controller reads rules such as `soil-dry and not raining` and the code is a tangle of string splitting and nested `if`s per rule shape.
- **Roles:** `IRule` (`contract`, Expression, `IsTrue(Readings)`); `SensorIs` (`concrete`, terminal); `Both`, `Either`, `Not` (`primary`, nonterminal, hold child rules); `Readings` (`concrete`, context).
- **Analogy:** sheet music: each symbol has a fixed meaning, and a phrase means what its symbols mean together.
- **Teaching points:** one class per grammar rule; a sentence becomes a tree; evaluating the tree interprets the sentence. Figure: the sentence and its tree. Interpreter vs Composite figure (same tree shape; Interpreter gives it a language meaning). Pitfall: large grammars (use a parser generator); note that parsing text into the tree is a separate step.

### 3.4 Iterator: a coin-collection album
- **Problem:** a coin album stores coins in pages of pockets (a jagged array with empty pockets). The display code, the value counter and the export each repeat the nested loops and the empty-pocket checks; changing the storage breaks all three.
- **Roles:** `CoinAlbum` (`concrete`, Aggregate, `CreateWalker()` or `GetEnumerator()`); `IEnumerator<Coin>`/`AlbumWalker` (`primary`, Iterator, keeps the page/pocket position); clients `ValueCounter`, `AlbumPrinter` (plain).
- **Analogy:** a TV remote's channel-up button: you step through channels without knowing how the tuner stores them.
- **Teaching points:** traversal moves out of the collection and the clients; several walks at once each keep their own position; C# builds this in (`IEnumerable<T>`, `foreach`, `yield return`) — a figure shows the hand-written walker and the `yield` version side by side. Pitfall: changing the collection during a walk.

### 3.5 Mediator: a cinema ticket form
- **Problem:** in a ticket form, picking a film refreshes the showtimes, a showtime refreshes free seats, seats change the price, and "student" changes the price again. Each widget holds references to the others: a web of calls.
- **Roles:** `ITicketForm` (`contract`, Mediator, `Changed(widget)`); `TicketForm` (`primary`, concrete mediator, owns the widgets and the rules); `FilmPicker`, `ShowtimePicker`, `SeatPicker`, `PriceLabel` (`concrete`, colleagues; each knows only the form).
- **Analogy:** an airport control tower: planes don't talk to each other, they talk to the tower.
- **Teaching points:** many-to-many becomes many-to-one; the coordination rules live in one place; colleagues become reusable. Mediator vs Observer and Mediator vs Facade figures. Pitfall: the mediator growing into a god object.

### 3.6 Memento: sudoku checkpoints
- **Problem:** a sudoku app lets a player "set a checkpoint" before guessing and "go back". The history screen copies the board's public grid and pencil marks itself, so the board must expose its internals, and restore writes them back field by field.
- **Roles:** `SudokuBoard` (`primary`, Originator, `Save()` returns a checkpoint, `Restore(checkpoint)`); `BoardCheckpoint` (`concrete`, Memento, immutable, opaque to others); `CheckpointHistory` (`concrete`, Caretaker, keeps checkpoints, never looks inside).
- **Analogy:** a save slot in a video game: the console stores it, only the game can read it.
- **Teaching points:** the originator makes and reads its own snapshots; encapsulation stays intact; the caretaker only stores. C# figure: the memento as a nested private class or a record with internal members. Pitfall: snapshots that share mutable arrays (deep copy), memory cost of many snapshots. Memento vs Command figure.

### 3.7 State: e-scooter rental
- **Problem:** `Scooter` has a `status` string and every method (`Unlock`, `Pause`, `Resume`, `End`) is a `switch` over it; a new "low battery" status touches every method.
- **Roles:** `IScooterState` (`contract`, State); `Locked`, `Riding`, `Paused`, `LowBattery` (`concrete`); `Scooter` (`primary`, Context, delegates to its current state; states switch it to the next state).
- **Analogy:** a traffic light: the same "next" button does something different depending on the colour it shows now.
- **Teaching points:** one class per state; the state decides the transition; no status `switch`. A transition diagram figure. State vs Strategy figure (who swaps). Pitfall: states needing data from the context (pass the context in); creating a new state object each time vs shared stateless states.

### 3.8 Template Method: sports-club membership renewal
- **Problem:** `JuniorRenewal` and `SeniorRenewal` each copy the same five steps (check eligibility, work out the fee, charge, issue the card, send a welcome note) and drift apart; a fix to "charge" lands in one but not the other.
- **Roles:** `MembershipRenewal` (`primary`, abstract class with the fixed `Renew()` and abstract/virtual steps); `JuniorRenewal`, `SeniorRenewal` (`concrete`, fill in the varying steps); an optional hook (`SendWelcomeNote` default does nothing).
- **Analogy:** a fill-in-the-blanks form: the form's order is fixed, each person fills in their own answers.
- **Teaching points:** the base fixes the order; subclasses fill in steps; hooks are optional steps with a default. Template Method vs Strategy figure (inheritance vs composition). Pitfall: subclasses overriding the template itself (make it non-virtual); too many steps.

### 3.9 Visitor: a house-move inventory
- **Problem:** a move planner's inventory has `Furniture`, `Box` and `Appliance`. Every new report (moving cost, insurance value, packing list) adds a method to all three classes, and the classes fill with unrelated logic.
- **Roles:** `IInventoryItem` (`contract`, Element, `Accept(visitor)`); `Furniture`, `Box`, `Appliance` (`concrete`); `IItemVisitor` (`contract`, Visitor, one `Visit` overload per item class); `MovingCostReport`, `InsuranceReport` (`primary`, concrete visitors).
- **Analogy:** a home inspector visiting each room: the rooms stay the same, the inspector brings the checklist.
- **Teaching points:** new operations without touching the element classes; double dispatch (`Accept` calls the right `Visit`) as a figure; the trade-off: adding an element class means touching every visitor. C# note: `switch` pattern matching as the lighter alternative. Pitfall: visitors needing private data.

## 4. Exercises and Exam Questions

The M4 conventions hold: a Contract; behavioural Checks plus at least one structural Check; `en` titles and messages; ≤3 Hints; every enforced behaviour stated in the scenario; unique domains (none already used in `content/`); no Pattern or role word in Exam titles, scenarios or Contracts (validator enforces `roleNames`, plurals included); at least one Exam Question per Pattern where a Lookalike is plausible but this Pattern is the one called for. Checks that compare a value with a literal pass it as `expected` (`new { expected = "…", actual = x }`) so the result shows the aligned comparison.

**Valid alternatives must pass:**
- **Chain of Responsibility:** the handler base as an interface or an abstract class; the next link set by constructor or setter. (A central loop over a list of handlers is not a chain and fails the structural Check.)
- **Command:** commands as an interface or an abstract class; undo by stored previous state or by an inverse operation.
- **Interpreter:** expressions as an interface or an abstract class; terminals holding a name or a value.
- **Iterator:** a hand-written `IEnumerator<T>`/custom walker class, or `IEnumerable<T>` with `yield return`.
- **Mediator:** the mediator as an interface plus class or a single class; colleagues get the mediator by constructor or setter.
- **Memento:** the memento as a nested class, a record, or a class with internal/private members; immutable either way.
- **State:** states as an interface or an abstract class; shared stateless state instances or new ones per transition.
- **Template Method:** steps abstract or virtual; the template non-virtual or sealed.
- **Visitor:** the visitor as an interface or an abstract class; visits returning a value or accumulating in the visitor.

**Checks test the behaviour that matters:**
- **Chain of Responsibility:** each request reaches the right handler; order of the chain matters as stated; unhandled requests get the stated default; the sender only holds the first link.
- **Command:** executing changes the receiver; undo restores the exact previous result, several undos in reverse order; the invoker does not reference concrete commands.
- **Interpreter:** nested expressions evaluate correctly against several contexts; one class per stated grammar rule.
- **Iterator:** order, skipping of empty slots, two independent walks at once, an empty collection; clients don't touch the storage.
- **Mediator:** one widget's change produces the stated effect on the others; colleagues hold no reference to each other (reflection over fields).
- **Memento:** restore brings back the exact state after further changes; the snapshot is immutable and not shared (changing the originator after saving does not change the snapshot); the caretaker can't read the state (no public state members on the memento).
- **State:** each action in each state gives the stated result and next state; no status enum/string switch in the context (structural Check: a state interface/abstract class with ≥ the stated number of implementations).
- **Template Method:** the steps run in the fixed order for every subclass; the template is not overridable; the hook's default holds when not overridden.
- **Visitor:** each visitor computes the right result over a mixed structure; a new visitor needs no change to the element classes (structural Check: each element has `Accept` and the visitor has one method per element type).

## 5. Constraints

- All Global Constraints of the Structural plan, including the test budget: filtered .NET content tests per Pattern and at most one screenshot script per Lesson task. The full suites run once in the final task and once after the final fix wave.
- Lesson constraints from the visual specs: no sentence-level shortcuts, accessible figures, both themes, no overflow at 390px.
- C# runtime rules (trainer spec §5): no file I/O, no threads, no real time or randomness in Checks.

## 6. Done means

- `/patterns/<id>` renders a full visual Lesson for all nine.
- Their Exercises and Exam Questions pass the .NET content validator, including tier counts.
- Exams can include them; every Lookalike in the Catalog is a link.
- The e2e Lesson loop covers all 23 Lessons with no overflow at 390 and 1440.
- The full suites are green, the work is merged to `main` and pushed (Pages deploys from CI).
