# Quiz M2 — Authoring guide and review rubric

This is the shared reference for the content tasks of `2026-11-06-quiz-m2-bank.md`. Authors and reviewers read it in full. The spec is `docs/superpowers/specs/2026-11-06-dotnet-quiz-design.md` (§3 content, §9 review loop).

## Audience and level

- The learner is preparing for **senior .NET developer interviews in Zurich**.
- The target is modern .NET (8/10, C# 12–14). Legacy .NET Framework behaviour appears only where interviewers still ask about it, and the question must then say so.
- A good question is one a senior interviewer would actually ask, or something a senior developer must know to avoid a real production bug. Avoid trivia like API parameter order, version numbers or release years.

## File format

Append to `content/quiz/<topic-id>.en.yaml`. Never edit or reorder the questions that are already there. Follow the existing entries in the file exactly:

```yaml
- id: kebab-case-unique-id          # unique across the WHOLE bank; check docs index
  question: |
    One clear question. Inline `code` and fenced ```csharp blocks are allowed.
  options:                          # exactly 4; exactly one has `correct: true`
    - text: Short label, inline `code` only (no fenced blocks)
      correct: true
      explanation: |
        Why it is right. Two to four sentences that say WHY, not just restate.
    - text: A plausible misconception
      explanation: |
        Why it is wrong, naming the misconception and the real behaviour.
    - text: …
      explanation: |
        …
    - text: …
      explanation: |
        …
  code: |                           # ONLY for "what does this print?" questions
    …complete program, top-level statements…
  expectedOutput: |                 # exactly what `code` prints
    …
```

**YAML pitfalls.** Quote an option `text` with single quotes when it starts with a backtick, `[`, `{`, `*`, `&`, `!`, `%`, `@` or `'`, or contains `: ` or ` #`. Inside single quotes, write a single quote as `''`. Use `|` block scalars for `question` and `explanation`.

## Hard rules (the validator enforces these)

- Exactly 4 Options, exactly 1 correct, all four texts distinct.
- No "all/none/both/neither of the above/these/others" Options.
- **Explanations never name a letter**: no "option B", "(C)", "B." or "A) ". The Options are shuffled at display time, so refer to an option by its content ("Calling `.Result` here…").
- No emphasis markup (`*word*`, `**word**`) outside code; plain text only.
- `code` and `expectedOutput` are both present or both absent.

## Length balance (the validator checks the whole bank)

The correct Option must not be guessable by its length. In each batch:
- the correct Option is the strictly longest of the four in **at most 30%** of the questions;
- the correct Option is the strictly shortest in **at most 30%** of the questions.

Make the distractors as specific and as long as the right answer. Check this before handing the batch in.

## Output questions ("What does this program print?")

- `code` is a complete program using top-level statements; `System`, `System.Linq` and `System.Collections.Generic` are available through implicit usings. Add any other `using` explicitly.
- It must be **deterministic**: no timing races, no `Task.Delay`-based ordering, no thread ids, no `GetHashCode` values, no ordering of `HashSet`/`Dictionary` enumeration after removals, no GC timing, no culture-dependent formatting (use `CultureInfo.InvariantCulture` or integers).
- It prints with `Console.WriteLine` / `Console.Write` only, and stays short (≤ 25 lines).
- `expectedOutput` is exactly what it prints. The build compiles and runs it (`QuizOutputTests`), so a wrong expected output fails the build.
- The question text is `What does this program print?`, and the Options are the candidate outputs in inline code.

## Self-check before handing in

From the repo root:

```bash
cd web && npx vitest run src/content/quiz.test.ts && cd ..
dotnet test tests/DesignPatterns.Content.Tests --filter "FullyQualifiedName~QuizOutputTests"
node web/scripts/quiz-index.mjs > /dev/null   # parses every file
```

All three must pass. `quiz.test.ts` includes the per-question rules and the bank-wide length shares.

## Review rubric (spec §9)

The reviewer returns, for **every** question id in the batch, `OK` or `NOT OK: <reason>`. A question is OK only if all of these hold:

1. **Correct** for .NET 8/10 and C# 12–14. If the reviewer is unsure, it checks Microsoft Learn or the official docs.
2. **Exactly one defensibly correct Option.** No reading ("it depends", an edge case, an older or newer version) makes another Option also right, or makes the keyed Option wrong.
3. **The distractors are plausible misconceptions**, not filler or jokes.
4. **Each Explanation is accurate and says why.**
5. **Senior-level interview relevance**: neither trivial nor obscure trivia.
6. **No letter references and no all/none-of-the-above.**
7. **No overlap** with an existing question in the bank index, meaning the same fact tested again with different wording.
8. For output questions, **the stated output is what the code prints**, and the code is deterministic.
9. **No answer leak.** The question or another Option does not give the answer away, for example through a grammatical mismatch, an absolute word ("always", "never") that only the distractors use, or the correct Option repeating the question's wording.
