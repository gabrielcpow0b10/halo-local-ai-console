# HALO Console v0.4a

HALO Console is a local-first AI console built with Next.js and TypeScript. It provides a ChatGPT-style interface for local Ollama models, including streaming chat, model-tier routing, and a narrow server-side API layer designed around explicit security boundaries.

This public export is prepared as a portfolio repository. It does not include private deployment details, secrets, screenshots, hosted model keys, cloud API integrations, Web Search provider credentials, shell execution, or Agent Bridge automation.

## What It Does

- Runs as a Next.js App Router application with TypeScript.
- Talks to a local Ollama runtime from server-side route handlers.
- Streams assistant responses from Ollama back to the browser.
- Stores chat history in browser `localStorage`.
- Provides Quick, Daily, and Heavy model tiers for different prompt sizes.
- Includes a deterministic HALO model router.
- Includes a HALO API Layer for health checks, model listing, chat, routing, and optional search plumbing.
- Includes a Web Search foundation that is disabled unless a server-side provider is configured.

## Local-First Architecture

HALO Console is designed to run on a user-controlled local machine.

- Browser UI: `src/app/page.tsx`
- API routes: `src/app/api/**/route.ts`
- Shared HALO logic: `src/lib/halo`
- Default Ollama endpoint: `http://127.0.0.1:11434`
- Chat storage: browser `localStorage`

Current API routes:

- `GET /api/health`: checks whether local Ollama is reachable.
- `GET /api/models`: lists installed Ollama models.
- `POST /api/chat`: streams chat completions from Ollama.
- `POST /api/router`: returns a deterministic model/tool routing decision.
- `POST /api/search`: returns normalized search results only when a provider is configured.

## Model Tiers

The UI and router use three local model tiers:

- Quick: `qwen3:4b`
- Daily: `qwen3:14b`
- Heavy: `qwen3:30b-a3b`

Quick is the default for normal chat. Daily is used for code, documentation, architecture, and analysis prompts. Heavy is reserved for explicitly requested deep planning or complex reasoning tasks.

Manual model selection is preserved. Router mode only takes over when the client explicitly requests it.

## Web Search Foundation

HALO Console v0.4a includes Web Search plumbing but does not enable search by default.

The foundation includes:

- server-side provider detection,
- normalized search responses,
- search-aware router policy,
- optional source-context injection before Ollama streaming.

The public export does not include a configured provider or credentials. If search is requested without a configured provider, the app returns a clear "Web Search is not configured yet" response.

Supported provider adapter:

- SearXNG-compatible JSON search through server-side environment variables.

Example local-only configuration:

```bash
HALO_SEARCH_PROVIDER=searxng
HALO_SEARXNG_URL=http://127.0.0.1:8080
```

No `.env` file is included in this repository.

## Security Boundaries

HALO Console is intentionally narrow:

- No cloud model APIs.
- No frontend API keys.
- No committed secrets.
- No `.env` content.
- No arbitrary shell execution from the web app.
- No local file browser.
- No private file exposure.
- No Agent Bridge automation.
- No Web Search provider enabled by default.
- No server-side conversation database.

The local trust boundary is the machine running Next.js and Ollama. Browser chat history remains in the browser profile that used the app.

## Requirements

- Node.js and npm
- Ollama installed and running locally
- At least one compatible Ollama model installed

Install dependencies:

```bash
npm install
```

Start Ollama:

```bash
ollama serve
```

Pull example models:

```bash
ollama pull qwen3:4b
ollama pull qwen3:14b
ollama pull qwen3:30b-a3b
```

Run the development server:

```bash
npm run dev -- -p 3030
```

Open:

```text
http://localhost:3030
```

Useful local checks:

```bash
curl http://localhost:3030/api/health
curl http://localhost:3030/api/models
```

## Validation

```bash
npm run lint
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security Boundaries](docs/SECURITY_BOUNDARIES.md)
- [Roadmap](docs/ROADMAP.md)
- [v0.4 Web Search Notes](docs/HALO_CONSOLE_V0_4_WEB_SEARCH.md)
