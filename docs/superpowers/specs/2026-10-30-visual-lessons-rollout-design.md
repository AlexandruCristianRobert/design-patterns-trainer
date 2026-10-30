# Visual Lessons rollout: Observer, Strategy, Decorator, Singleton — Design

**Date:** 2026-10-30 · **Status:** draft
**Builds on:** [Factory Method pilot spec](2026-10-29-visual-lesson-factory-method-design.md) (binding for vocabulary, constraints and accessibility) and DESIGN.md → "Lesson visual vocabulary".

## 1. Intent

The learner liked the Factory Method pilot and wants the other four built Lessons to get the same treatment. The approved choices carry over unchanged:

- every Section except the C# example gets at least one figure;
- participant names carry role tags;
- the key phrase is marked, and a "Key idea" box closes Problem and Analogy;
- annotated "before" code with the original bullets as a numbered badge list;
- a picture strip for the analogy;
- a relationship figure above the Structure Diagram;
- three numbered Point cards in Interaction;
- a checklist, figures and ✕/✓ pitfall cards in When to use.

**More visuals, never less text.** No sentence is removed from any Lesson.

## 2. Non-goals

- New visual vocabulary. The pilot's components and colours are reused. The only additions are the small component gaps in §3 and a few icons.
- Changing the Structure Diagrams, Interaction Scenes, C# example Sections (including the prose after `<LessonExample />` in Observer), Lookalikes, or any Exercise or Exam content.
- Changing the Factory Method Lesson's look. It only swaps its raw class names for the new components in §3.

## 3. Component gaps to close first

The pilot's final review flagged these before any rollout:

- **`Box ghost`**: a dashed, muted "future or absent" box. It replaces the hand-written `div.lesson-box.fig-ghost` in the Factory Method MDX and is used for "+ new class" and "unsubscribed" items below.
- **`ColumnHead`**: a small heading above a figure column. It replaces the raw `div.fig-colhead` in the Factory Method MDX.
- **Nested boxes**: a `Box` must render correctly with `Box` children (padding, border, role colour of the inner box). Decorator's layers depend on it.
- **New icons**, all from Lucide:

  | Name | Lucide icon | Lesson |
  |---|---|---|
  | `mail` | `Mail` | Observer |
  | `smartphone` | `Smartphone` | Observer |
  | `printer` | `Printer` | Observer |
  | `car` | `Car` | Strategy |
  | `train` | `TrainFront` | Strategy |
  | `image` | `Image` | Decorator |
  | `book` | `BookOpen` | Singleton |

- **`Pitfall` heading level**: an optional `level` prop (default 4), so a Pitfall used outside "### Pitfalls" doesn't skip heading levels.

## 4. Per Lesson

Role tags follow each pattern's `structure.yaml` roles, and apply to participant class and interface names plus the pattern's key method where it plays the "slot" role. Other members stay plain inline code, as in the pilot.

| Lesson | `primary` (orange) | `contract` (dashed blue) | `concrete` (purple) |
|---|---|---|---|
| Observer | `WeatherStation` | `IObserver`, `Update` | `PhoneDisplay`, `TvDisplay`, `WebDashboard`, `WatchDisplay` |
| Strategy | `ShippingCalculator` | `IShippingStrategy`, `Cost` | `StandardPost`, `ExpressCourier`, `PickupPoint` |
| Decorator | `CaptionDecorator` | `ICaption`, `Render` | `PlainCaption`, `SpeakerTag`, `Uppercase`, `Italic` |
| Singleton | `TicketDispenser` | (none) | `ShopCounter`, `OnlineOrders`, `PhoneOrders` |

### 4.1 Observer
- **Problem**:
  - the "before" code becomes annotated code, with the field and call lines tinted `bad`;
  - badges link the lines to the four bullets: 1 is the call block (adding a watch means editing it), 2 is the `readonly` fields (fixed at compile time), 3 is the `new()` fields (can't test without them), 4 is `_web.Render` (its own method name);
  - the bullets become a `BadgeList`, and the closing sentence goes in a `KeyIdea`.
- **Analogy**: picture strip.
  - A "Publisher · one mailing list" card (`primary`, `mail`) lists the steps: new issue out → send to every address on the list (a `Slot` "every address on the list").
  - Reader rows (`concrete`): phone reader (`smartphone`) and print reader (`printer`), plus a ghost row "Unsubscribed · next issue skips you".
  - `KeyIdea`: the subject keeps a list of `IObserver`s and sends each the same `Update`.
- **Structure**: a "one to many" figure.
  - Top: `WeatherStation` (sub "list of observers") → "notifies" → `IObserver` (interface).
  - Under the interface: `PhoneDisplay`, `TvDisplay` and a ghost "+ WatchDisplay".
  - Column heads: "Subject · owns the state", "Observers · get told".
- **Interaction**: three Points.
  1. The list growing at runtime: `[]` → `[Phone]` → `[Phone, Tv]`.
  2. Fan-out: `SetTemperature(23)` arrows down to Phone 23°C and Tv 23°C.
  3. After unsubscribe: list `[Phone]` → 25°C reaches Phone, and a ghost Tv still shows 23°C.

  The push/pull paragraph gets a two-card comparison, Push `Update(23)` vs Pull `Update()` → reads `station.Temperature`, with the existing sentences as the text.
- **When to use**:
  - a checklist (2 ✓, 1 ✕);
  - four pitfall cards, each with a ✕/✓ code pair:
    - forgotten unsubscribe: `station.Subscribe(view);` vs `using var sub = station.Subscribe(view);`;
    - order: relying on the `Subscribe` order vs calling the dependency explicitly;
    - re-entrancy: `foreach (var o in _observers)` vs `foreach (var o in _observers.ToList())`;
    - throwing: `o.Update(t);` vs `try { o.Update(t); } catch (Exception e) { Log(e); }`.

### 4.2 Strategy
- **Problem**:
  - annotated `switch` code, with the `switch` block tinted `bad`;
  - badges: 1 is the `switch` line (new carrier means editing it), 2 is a `case "…"` string (a typo compiles), 3 is the `case "express"` line (can't be tested alone), 4 is the `return` lines (rules mixed together);
  - `BadgeList` and `KeyIdea` as in the pilot.
- **Analogy**: picture strip.
  - A "Your trip plan · the same every time" card (`primary`) lists: leave home → `Slot` "a way to the airport" → catch the flight.
  - Option rows (`concrete`): taxi (`car`), train (`train`) and own bike (`bike`).
  - `KeyIdea`: the context holds one algorithm behind a shared interface.
- **Structure**: a "holds one, delegates" figure.
  - `ShippingCalculator` (sub "Quote · checks the weight") → "delegates Cost()" → `IShippingStrategy`.
  - Under the interface: `StandardPost`, `ExpressCourier` and a ghost "+ PickupPoint".
- **Interaction**: three Points.
  1. A snippet showing `new ShippingCalculator(new StandardPost())`, with the comment "chosen from outside".
  2. A chain: `Quote` → "calls Strategy.Cost(kg)" → whichever strategy.
  3. Two rows: standard → 4.50 and express → 12.00, as ok chips, for the same 2.5 kg parcel.

  The "read-only property" paragraph becomes a `Note` with a `lock` icon.
- **When to use**:
  - a checklist (3 ✓, 1 ✕);
  - "Delegates as strategies": the existing code as annotated code (badge on `Func<decimal, decimal>`), then two cards: Interface ✓ "several methods, own settings, a name in logs and DI" vs Delegate ✓ "one stateless method";
  - four pitfall cards with code pairs:
    - the client `switch` moved up vs a choice made in the composition root;
    - a wide parameter list vs a small parameter object;
    - a shared stateful instance vs one per context;
    - two classes for a rate vs one class with a constructor parameter.

### 4.3 Decorator
- **Problem**:
  - annotated code: `UppercaseSpeakerCaption` tinted `bad` (badge 1, combinations multiply; badge 3, copied logic);
  - a **class-explosion figure**: features speaker, uppercase and italic, with the combinations as boxes (3 features → 7 classes, the italic ones as ghosts) and the caption "each new feature doubles the classes";
  - `BadgeList`, plus a `KeyIdea` with the closing sentence.
- **Analogy**:
  - a **nested layers** figure: Frame ⊃ Mat ⊃ Photo as nested boxes (`image` icon on the photo), captioned "still hangs on the wall the same way";
  - two verdicts: ✓ mat inside frame, ✕ frame inside mat;
  - `KeyIdea`: same interface, passes the work on, adds its own part.
- **Structure**: an "is one and has one" figure. `CaptionDecorator` with two arrows to `ICaption`: a dashed "implements" and a solid "decorates 1". Below it, `SpeakerTag` and `Uppercase`. `PlainCaption` also implements `ICaption`.
- **Interaction**: three Points.
  1. Built from the inside out: nested boxes `Uppercase` ⊃ `SpeakerTag` ⊃ `plain`.
  2. In and back out: a chain down `Render` to `plain`, with the values coming back up: "We have to leave now" → "Ana: We have to leave now" → "ANA: WE HAVE TO LEAVE NOW".
  3. The outer layer has the last word: two rows, Uppercase-outside → `ANA: …` and Speaker-outside → `Ana: WE …`.

  The closing "none of the objects knows how deep it is" sentence stays as text.
- **When to use**:
  - a checklist (3 ✓, 1 ✕);
  - "Stacking order": two cards with the two orders and their outputs;
  - "Streams in .NET": nested boxes `GZipStream` ⊃ `BufferedStream` ⊃ file, captioned "each layer is itself a Stream";
  - three pitfall cards with code pairs:
    - `caption is PlainCaption` vs depending on `ICaption` only;
    - a ten-layer chain built in several places vs a short stack built in one named place;
    - "subclass changes the class" vs "decorator wraps one object at runtime".

### 4.4 Singleton
- **Problem**:
  - annotated code with both `= new();` dispenser fields tinted `bad`; badges 1 (two sequences) and 2 (anyone can `new`);
  - a **two queues figure**: two dispensers, with Ana → ticket 1 and Ben → ticket 1 as `bad` chips;
  - `BadgeList`, plus a `KeyIdea` with the closing sentence.
- **Analogy**: picture strip.
  - A "Mountain hut · one guest book" card (`primary`, `book`) lists: arrive → sign `Slot` "the book on the shelf by the door".
  - Walker rows (`concrete`) all pointing at the same book, plus a ghost row "Bring your own book ✕".
  - `KeyIdea`: one instance, one well-known place to find it.
- **Structure**: a "three locks" figure, three boxes in a row:
  - `private` constructor (`lock`), "no one else can new it";
  - `private static` field, "holds the one instance";
  - `public static Instance`, "the one place to find it".

  Below them, `ShopCounter` and `OnlineOrders` both read `Instance` (dashed arrows).
- **Interaction**: three Points.
  1. A track for `Created`: 0 while clients are built, then 1 at the first `Instance`.
  2. Two rows: counter → `Instance` → the same object, and online → `Instance` → the same object, with the second marked "no constructor run".
  3. Ana → 1 and Ben → 2, as ok chips, from one object.
- **When to use**:
  - a checklist (3 ✓, 1 ✕).
  - "Three thread-safe forms": the unsafe code as annotated code (`warn` mark on the `if (instance == null)` race line), then three cards, each with its existing paragraph:
    - `Lazy<T>`, accent, "the usual choice";
    - static initializer;
    - double-checked `lock`, with a ⚠ "easy to get subtly wrong".
  - "Hidden global state": a `KeyIdea` with "A singleton is a global variable with a class around it."
  - "Static class or Singleton?": a three-row comparison (Interfaces / Instance state / Lazy init) with ✓/✕ per column, plus the existing bullets.
  - "DI lifetime": a code pair, ✕ `TicketDispenser.Instance` vs ✓ `services.AddSingleton<ITicketSource, TicketDispenser>()`; the captive-dependency paragraph becomes a `Pitfall` card.
  - Three pitfall cards with code pairs:
    - a singleton for convenience vs passing it in;
    - `++last` vs `Interlocked.Increment(ref last)`;
    - a throwing constructor vs risky work in a method.

## 5. Constraints

All of the pilot spec's §5 constraints hold, in particular:

- MDX authoring with all figure text in the MDX;
- six Sections per Lesson;
- accessibility: a `Figure` with a `description` for every box-and-arrow figure, ✓/✕ in words, icons hidden;
- tokens only;
- no page overflow at 390px, and figures stack sensibly;
- both themes;
- no sentence removed.

## 6. Done means

- Each of the four Lessons has the §4 figures, checked in both themes at 390px and 1440px against this spec. The Factory Method pilot is the visual reference.
- A unit test per Lesson asserts its key figures: the Key idea count, `.code-line[data-tone="bad"]` in Problem, the figure names, three Points, the checklist verdict counts, the pitfall count and code pairs.
- An e2e test checks each Lesson at 390px and 1440px for no overflow and that the visuals render.
- The Factory Method MDX uses `Box ghost` and `ColumnHead` instead of raw classes.
- DESIGN.md lists the new props and icons.
