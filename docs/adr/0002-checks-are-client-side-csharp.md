# Checks are client-side C#; solutions are visible to a determined learner

Checks are authored as C# methods (behavioural calls plus Roslyn-based structural inspection) and are compiled together with the learner's code inside the browser. Because there is no server, Checks and reference solutions ship to the client and can be read in DevTools. We accept this: the app is for self-study, and honest grading of real behaviour matters more than tamper-resistance. Every reference solution is verified at build time to pass all its Checks, and every starter to fail at least one.

## Consequences

- Any future proctored/classroom mode needs a server-side grader; it cannot be bolted onto this design.
