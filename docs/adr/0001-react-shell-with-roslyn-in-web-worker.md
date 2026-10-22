# React shell with Roslyn compiling C# inside a Web Worker

The app is front-end only, yet practice and exam answers must be judged on real C# behaviour, not text matching. We therefore run the real C# compiler (Roslyn) in the browser as a .NET WebAssembly module hosted in a Web Worker, and build the UI in React + TypeScript + Vite. The UI talks to the compiler only through a narrow message API (compile / run / check).

## Considered Options

- **Blazor WebAssembly (all C#)** — rejected: .NET runs on the UI thread, so each 0.3–2 s compile would freeze the heavy animated visuals planned for pattern explanations, and every rich visual library would need hand-written JS interop.
- **Fake run with regex/structural text checks** — rejected: rejects valid solutions that differ in naming or shape, and is trivially fooled.
- **Remote compile API** — rejected: violates the front-end-only constraint.

## Consequences

- First load downloads ~15–25 MB of .NET runtime + Roslyn + reference assemblies (cached afterwards); the UI must be usable while the compiler warms up.
- Reference assemblies must be served as plain DLLs that Roslyn can read (Webcil-packaged `.wasm` assemblies are not readable as metadata).
- Two workers, not one: a long-lived **compiler worker** (Roslyn, diagnostics, Contract verification, and later lazily-loaded IDE features) and a disposable **runner worker** (.NET runtime only; executes compiled assembly bytes and Checks). Runaway user code is handled by terminating and respawning the runner, so compiler state — and any loaded IDE features — survive. Costs a second in-memory runtime, but no extra download.
- Two toolchains (Node and the .NET SDK) are required to build.
