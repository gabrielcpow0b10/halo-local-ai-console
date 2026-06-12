# HALO Console Architecture

HALO Console v0.4a is a local-first Next.js and TypeScript application for chatting with Ollama models through a browser UI. The app keeps model execution local, limits server routes to a small HALO API Layer, and avoids cloud APIs, Web Search providers by default, shell execution, and Agent Bridge automation.

## Application Shape

- Framework: Next.js App Router with TypeScript.
- UI route: `src/app/page.tsx`.
- API routes: `src/app/api/**/route.ts`.
- HALO shared logic: `src/lib/halo`.
- Styling: `src/app/globals.css`.
- Chat persistence: browser `localStorage`.
- Model runtime: local Ollama, defaulting to `http://127.0.0.1:11434`.

The browser calls local Next.js API routes. Those route handlers call Ollama or internal HALO library functions. The browser does not receive provider credentials, local filesystem access, or shell access.

## HALO API Layer

The HALO API Layer is the server-side boundary under `src/app/api`.

Current endpoints:

- `GET /api/health`: checks local Ollama reachability.
- `GET /api/models`: returns installed Ollama models from Ollama.
- `POST /api/chat`: forwards validated chat messages to Ollama and streams text back to the browser.
- `POST /api/router`: returns a deterministic model/tool routing decision.
- `POST /api/search`: returns normalized search output only when a provider is configured.

The API layer does not expose arbitrary files, secrets, environment files, host inventory, shell execution, or administrative actions.

## Streaming Chat

`/api/chat` uses Ollama's streaming chat API and converts Ollama newline-delimited JSON chunks into a plain text stream for the UI.

Flow:

1. The browser sends chat messages and options to `/api/chat`.
2. The route validates message shape.
3. The route selects a model manually or through router mode.
4. The route prepends the HALO system prompt.
5. Optional Web Search context is injected only if requested and configured.
6. The route streams from Ollama and forwards assistant text chunks to the browser.

If Ollama is unreachable, the route returns a controlled failure instead of exposing internal details.

## Model Router

The model router lives in `src/lib/halo/model-router.ts`. It maps prompts to local model tiers:

- Quick: `qwen3:4b` for greetings, short prompts, and simple questions.
- Daily: `qwen3:14b` for code, documentation, architecture, analysis, and normal work.
- Heavy: `qwen3:30b-a3b` for explicitly requested deep planning or complex reasoning.

Manual model selection wins unless router mode is explicitly enabled by the caller.

The router can also mark tools as needed, such as `web_search`, but only enabled tools are returned as available.

## Web Search Foundation

v0.4a includes Web Search foundation code but leaves it disabled by default.

Implemented pieces:

- search policy detection for current-information prompts,
- provider status detection,
- SearXNG-compatible server-side provider adapter,
- normalized search result types,
- optional source-context injection into `/api/chat`.

No provider URL or key is included in the public export. Search becomes available only when server-side environment variables configure a provider. Without configuration, `/api/search` returns a clear not-configured response.

## Tools And Future Modules

The tools registry exists as a foundation for future capabilities. Current boundaries keep potentially sensitive modules disabled unless intentionally implemented later.

Current placeholder areas:

- Web Search: foundation present, disabled unless configured.
- Documents/RAG: not implemented.
- Memory: not implemented beyond browser `localStorage` chat history.
- Agent Bridge: not implemented.
- System status tools: not implemented as executable actions.

## Security Model

HALO Console's security posture is local-first and explicit:

- no cloud model calls,
- no frontend secrets,
- no committed secrets,
- no `.env` content,
- no shell execution,
- no arbitrary filesystem access,
- no private file exposure,
- no Agent Bridge automation,
- no Web Search provider enabled by default.

See [Security Boundaries](SECURITY_BOUNDARIES.md) for the full public boundary statement.
