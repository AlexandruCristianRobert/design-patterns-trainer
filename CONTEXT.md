# Design Patterns Trainer

A browser-only learning app for software design patterns in C#: each pattern is explained, practised, and examined against real compiled C#. It also has a multiple-choice Quiz on senior-level .NET interview topics.

## Language

### Catalog

**Pattern**:
A named, reusable design solution taught by the app (e.g. Observer). The unit everything else hangs off.
_Avoid_: Topic, module, chapter

**Catalog**:
The full set of Patterns the app knows about. Targets the 23 Gang of Four patterns and is open to non-GoF patterns.
_Avoid_: Library, list, curriculum

**Category**:
A grouping tag on a Pattern — Creational, Structural, Behavioral for GoF, extensible for others.
_Avoid_: Type, family, kind

**Difficulty Tier**:
How hard a Pattern is to learn and apply correctly — **Standard** or **Tricky**. Tricky Patterns get more Exercises and Exam Questions.
_Avoid_: Level, rank, complexity

**Lookalike**:
A Pattern commonly confused with another (e.g. Strategy ↔ State). Drives "vs." comparisons in Lessons and plausible-but-wrong options in exam scenarios.
_Avoid_: Related pattern, sibling, alternative

### Learning

**Lesson**:
The explanation of one Pattern: problem, analogy, Structure Diagram, Interaction Scene, C# example, and when-to-use/pitfalls/related patterns.
_Avoid_: Article, page, tutorial

**Structure Diagram**:
The static, interactive class diagram of a Pattern's participants and their relationships.
_Avoid_: UML, class view, schema

**Interaction Scene**:
The time-based, steppable animation showing a Pattern's objects collaborating at runtime.
_Avoid_: Animation, sequence diagram, demo

**Scene Script**:
The declarative timeline (actors, calls, state changes, linked code lines) that defines an Interaction Scene. A Pattern may instead supply a custom scene when a script can't express it.
_Avoid_: Storyboard, animation config, timeline

**Sandbox**:
A free, ungraded place to edit and run C#. Nothing done there counts toward progress.
_Avoid_: Playground, scratchpad, REPL

### Practice

**Exercise**:
A graded practice task for one Pattern. Each Pattern has at least one of each Exercise Kind; Tricky Patterns have more.
_Avoid_: Task, challenge, kata, problem

**Exercise Kind**:
The shape of an Exercise: **Complete** (fill gaps in scaffolded code), **Refactor** (restructure working "before" code into the Pattern without changing its output), **Build** (implement from a plain-English scenario only).
_Avoid_: Level, difficulty, type

**Check**:
A single named pass/fail rule run against submitted, compiled C# — either about behaviour (what the code does) or structure (how it is shaped).
_Avoid_: Test, assertion, rule, validation

**Contract**:
The minimal public surface (types and members) an Exercise or Exam Question requires, so Checks can drive the learner's code. Describes only what client code touches; in unnamed Exam Questions it never names the Pattern's roles.
_Avoid_: Interface, spec, API, signature

**Hint**:
One of up to three progressively more specific nudges, revealed one at a time.
_Avoid_: Tip, clue

**Solved / Solved with help**:
The two success outcomes of an Exercise. "Solved with help" means a Hint or the revealed solution was used before all Checks passed.
_Avoid_: Completed, done, passed

### Exam

**Exam Question**:
A scenario requiring one Pattern to be implemented in C#. Drawn from a pool separate from Exercises. By default the Pattern is not named and must be identified.
_Avoid_: Exam exercise, problem, item

**Exam Session**:
One closed-book attempt at a set of Exam Questions, ending in a score and a pass/fail against the pass mark. Checks stay hidden until the session is submitted, unless Helpers are on. Is **in progress**, **submitted**, or **abandoned** (no score); at most one is in progress at a time, and its timer runs on wall-clock time even while the app is closed. Not a Quiz: Exam answers are compiled C#, not chosen Options.
_Avoid_: Test, attempt, run

**Exam Report**:
The post-submission breakdown of an Exam Session: Identification outcome, every Check result, and a reference solution per Exam Question.
_Avoid_: Results page, scorecard, summary

**Identification**:
Choosing which Pattern an unnamed Exam Question calls for, from the full Catalog (including Patterns not yet built). Scored separately from the implementation.
_Avoid_: Recognition, guess, classification

**Named mode**:
An Exam Session option where each Exam Question states its Pattern and Identification is skipped.
_Avoid_: Easy mode, practice exam

**Helpers**:
Optional aids in an Exam Session, turned on at setup: Check my answer (run the Checks before submitting), Show pattern (its name, Structure Diagram and Lesson link) and Reveal solution. Which ones were used is recorded per Exam Question and shown in the Exam Report. They never change the score.
_Avoid_: Cheats, assists, practice mode

### Quiz

**Quiz**:
One run through a chosen number of Quiz Questions on .NET interview topics. Each answer is marked straight away, and the run ends in a score. It is separate from the Exam and has no Patterns, Checks or compiled code.
_Avoid_: Test, drill, exam

**Quiz Question**:
A multiple-choice question with exactly four Options (A–D), exactly one of them correct.
_Avoid_: Item, card, flashcard

**Quiz Topic**:
The one subject area a Quiz Question belongs to, from a fixed list (e.g. Async & concurrency, EF Core & data). A Quiz can be narrowed to chosen Quiz Topics.
_Avoid_: Category (that is a Pattern grouping), tag, subject, section

**Option**:
One of the four labelled answers (A–D) to a Quiz Question. Every Option has its own Explanation.
_Avoid_: Answer, choice, alternative

**Explanation**:
Why an Option is correct or wrong. It is shown for all four Options once the learner has answered.
_Avoid_: Hint, rationale, feedback

**Question Visual**:
An optional, steppable picture attached to one Quiz Question, shown below its Options. It has a Setup, a Reality play and Claim plays. Not every Quiz Question has one.
_Avoid_: Interaction Scene (that belongs to a Lesson), animation, diagram, illustration

**Setup**:
The part of a Question Visual shown before the learner answers: the situation the Quiz Question asks about, never hinting which Option is correct.
_Avoid_: Intro, preview, context

**Reality play**:
The part of a Question Visual shown after answering, playing out what really happens — the behaviour the correct Option describes.
_Avoid_: Solution, answer animation

**Claim play**:
What one wrong Option claims would happen, shown side by side with the Reality play so the learner can see where the claim breaks. Shown first for the Option the learner chose.
_Avoid_: Wrong-answer animation, misconception

**Quiz Result**:
The record of a finished Quiz: when it was taken, which Quiz Topics it was narrowed to (or all), how many Quiz Questions it had, and how many were answered correctly. Which Options were chosen is not kept. A Quiz left before the end has no Quiz Result, but its answered Quiz Questions still move Box.
_Avoid_: Score record, attempt, report

**Quiz History**:
The learner's list of Quiz Results.
_Avoid_: Log, stats, scoreboard

**Box**:
A Quiz Question's spaced-repetition level, from 1 to 5. A correct answer moves the question up one Box. A wrong answer sends it back to Box 1. Higher Boxes wait longer before the question is Due again.
_Avoid_: Level, stage, mastery, streak

**New**:
A Quiz Question the learner has never answered. It has no Box yet.
_Avoid_: Unseen, fresh

**Due**:
A Quiz Question whose Box waiting period has passed since it was last answered. A Quiz draws Due questions first, then New ones.
_Avoid_: Overdue, scheduled, review

### Learner state

**Progress**:
Everything the app remembers about the learner: per-Pattern Lesson visits, Exercise outcomes, best exam scores, Drafts, exam history, each Quiz Question's Box, and the Quiz History. Lives only in the learner's browser unless exported.
_Avoid_: Profile, account, save, stats

**Next Step**:
The suggested action for a Pattern given current Progress (read the Lesson → Exercises in order → exam-ready). Guidance only — nothing in the app is ever locked.
_Avoid_: Unlock, gate, requirement, prerequisite

**Draft**:
The learner's latest unsubmitted code for one Exercise or Sandbox, autosaved. Never discarded when the Exercise's content changes — only flagged as stale.
_Avoid_: Autosave, buffer, work-in-progress
