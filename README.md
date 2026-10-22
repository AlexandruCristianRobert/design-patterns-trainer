# Design Patterns trainer

A browser-only C# design-patterns trainer. Code is compiled with Roslyn and run as WebAssembly inside the
browser; there is no server.

## Prerequisites

- .NET 10 SDK (version pinned by `global.json`)
- Node 24

## Commands

```sh
dotnet test                 # core + tests, from the repo root
cd web
npm ci
npm run build:dotnet        # publish the Roslyn/runner WebAssembly bundle into web/public/dotnet
npm run dev                 # Vite dev server
npm test                    # unit tests (Vitest)
npm run e2e                 # Playwright on its own port 5299 (needs build:dotnet first; port must be free)
npm run build               # production build; VITE_BASE sets the base path (default /)
```

## Deploy

Pushes to `main` run `.github/workflows/ci.yml`, which tests and then publishes `web/dist` to GitHub Pages
with `VITE_BASE=/<repo-name>/`.
