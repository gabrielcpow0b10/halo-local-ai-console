# HALO Console v0.3 Architecture

HALO Console v0.3 starts the internal foundation for a local AI operating layer. The app remains a local-first Next.js console that talks to Ollama on `http://127.0.0.1:11434`, but the server code now has explicit boundaries for API routing, model routing, future tools, and security policy.

This release does not add cloud APIs, external API keys, Open WebUI, agent execution, web search, Documents/RAG, Memory, or shell access from the web app.

## HALO Console

HALO Console is the browser-facing local AI interface. The UI stays English-first and keeps normal chat streaming through `/api/chat`. Browser chat history remains client-side in `localStorage`.

Current local models:

- Quick: `qwen3:4b`
- Daily: `qwen3:14b`
- Heavy: `qwen3:30b-a3b`

Quick remains the default model for normal chat.

## HALO API Layer

The HALO API Layer is the local Next.js route-handler layer under `src/app/api`.

Current endpoints:

- `/api/health`: checks whether the local Ollama server is reachable.
- `/api/models`: lists installed Ollama models from Ollama.
- `/api/chat`: streams chat completions from Ollama.
- `/api/router`: returns a deterministic model and tool routing decision.

The API layer is intentionally narrow. It does not expose arbitrary local files, secrets, `.env` files, or shell execution.

## Model Router

The Model Router lives in `src/lib/halo/model-router.ts`. It maps a user message to a local model tier:

- Greeting, quick note, or simple question: Quick, `qwen3:4b`.
- Code, README, documentation, normal analysis, and architecture explanation: Daily, `qwen3:14b`.
- Heavy, deep architecture, long planning, or complex reasoning: Heavy, `qwen3:30b-a3b`, only when explicitly requested.

Manual model selection is preserved. If a caller sends a model to `/api/chat`, that model is used unless the caller explicitly enables router mode with `router: true`.

Example router request:

```json
{
  "message": "Explain this architecture and write documentation for it",
  "manualModel": null,
  "allowTools": false
}
```

Example router response:

```json
{
  "tier": "daily",
  "model": "qwen3:14b",
  "tools": [],
  "reason": "documentation/architecture task"
}
```

## Tools Layer

The Tools Layer starts as a disabled registry in `src/lib/halo/tool-registry.ts`.

Registered v0.3 placeholders:

- `web_search`
- `documents`
- `memory`
- `agents`
- `system_status`

All tools are disabled in v0.3. Router decisions can internally identify when a disabled tool would be needed, but no tool is executed and no tool is returned as enabled.

## Future Web Search

Future web search is reserved for current events, news, prices, sports, software versions, and other time-sensitive questions. In v0.3, the router can mark `web_search` as needed internally, but the tool remains disabled and no web search implementation exists.

## Future Documents/RAG

Future Documents/RAG is reserved for user-approved local document workflows: ingestion, chunking, metadata, retrieval, and answer grounding. In v0.3, document-related requests can mark `documents` as needed internally, but there is no document access and no private file exposure.

## Future Memory

Future Memory is reserved for durable preferences and long-lived context. In v0.3, Memory is a disabled placeholder only. Browser chat history continues to live in `localStorage`.

## Future Agent Bridge

Future Agent Bridge work would require constrained, confirmed, auditable local automation. v0.3 does not add agent execution. Agent-related requests can mark `agents` as needed internally, but no action is taken.

## Security Boundaries

The v0.3 security policy lives in `src/lib/halo/security-policy.ts`.

Boundaries:

- No arbitrary shell execution from the web app.
- No `rm` from the web app.
- No `docker prune` from the web app.
- No secret access.
- No `.env` access.
- No private file access unless a future safe document module allows it.
- Confirmation is required for future agent actions.
- Audit logging is required for future agent actions.

These boundaries are enforced architecturally in v0.3 by keeping all tool entries disabled and by limiting API routes to health, model listing, chat streaming, and deterministic routing.
