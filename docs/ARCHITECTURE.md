# HALO Console Architecture

HALO Console v0.8 Public Preview is a local-first Next.js and TypeScript application for chatting with Ollama models through a browser UI. The app keeps browser state, local API routes, model routing, document context, manually selected learning context, and optional read-only runtime context separated by explicit boundaries.

## System Flow

```text
Browser
  -> HALO Console UI
  -> HALO API Layer
  -> Model Router
  -> Ollama
  -> Local Models
```

The browser calls local Next.js API routes. Route handlers validate requests, call HALO library functions, and stream responses from Ollama. The browser does not receive provider credentials, local filesystem paths, shell access, or arbitrary private-file access.

## Application Shape

- Framework: Next.js App Router with TypeScript.
- UI route: `src/app/page.tsx`.
- API routes: `src/app/api/**/route.ts`.
- HALO shared logic: `src/lib/halo`.
- Styling: `src/app/globals.css`.
- Chat persistence: browser `localStorage`.
- Model runtime: local Ollama, defaulting to `http://127.0.0.1:11434`.
- Document storage: HALO-controlled local document storage.
- Learning storage: HALO-controlled local learning storage.

## HALO API Layer

The HALO API Layer is the server-side boundary under `src/app/api`.

Current endpoints:

- `GET /api/health`: checks local Ollama reachability.
- `GET /api/models`: returns installed Ollama models from Ollama.
- `POST /api/router`: returns a deterministic model/tool routing decision.
- `POST /api/chat`: validates chat input, optionally injects selected local context, forwards to Ollama, and streams text back to the browser.
- `POST /api/search`: returns search output only when a provider is configured.
- `POST /api/documents/upload`: accepts supported local document uploads.
- `GET /api/documents/list`: lists HALO-controlled local document records.
- `POST /api/documents/query`: retrieves readable matching chunks.
- `POST /api/documents/delete`: deletes a HALO-controlled local document record.
- `GET /api/memory/list`: lists manual learning notes.
- `POST /api/memory/create`: creates a manual learning note.
- `POST /api/memory/update`: updates a manual learning note.
- `POST /api/memory/delete`: deletes a manual learning note.
- `GET /api/runtime/status`: returns sanitized status for the optional read-only Runtime Bridge.

The API layer does not expose arbitrary files, secrets, environment files, host inventory, shell execution, administrative actions, or private runtime directories.

## Model Router

The model router lives in `src/lib/halo/model-router.ts`. It maps prompts to local model tiers:

- Quick: short prompts, greetings, and simple questions.
- Daily: code, documentation, architecture, analysis, and normal work.
- Heavy: explicitly requested deep planning or complex reasoning.

Manual model selection wins unless router mode is explicitly enabled by the caller.

The router can mark tools as needed, such as `documents` or `web_search`, but only enabled tools are returned as available. Web Search can be identified as useful for current-information prompts, while still remaining unavailable when no server-side provider is configured.

## Streaming Chat

`/api/chat` uses Ollama's streaming chat API and converts Ollama newline-delimited JSON chunks into a plain text stream for the UI.

Flow:

1. The browser sends chat messages and explicit context options to `/api/chat`.
2. The route validates message shape.
3. The route selects a manual model or asks the router for a model.
4. The route prepends the HALO system prompt.
5. If `Use Local Docs` is enabled, the route retrieves a capped set of readable matching chunks.
6. If selected document scope is enabled, retrieval is limited to selected document ids.
7. If selected learning is enabled, the route resolves selected learning note ids and injects capped supporting context.
8. If Runtime Bridge context is explicitly enabled and available, the route injects the configured public-safe runtime summary.
9. If Web Search is requested but not configured, the route returns a clear not-configured response.
10. The route streams from Ollama and forwards assistant text chunks to the browser.

If Ollama is unreachable, the route returns a controlled failure instead of exposing internal details.

## Local Documents

The document system supports local `.txt`, `.md`, `.log`, and text-based `.pdf` uploads. Uploaded content is stored in HALO-controlled local storage and referenced by document ids.

Document retrieval is bounded:

- Queries return a small set of matching readable chunks.
- Entire documents are not injected into chat.
- Low-quality extracted text is filtered.
- Selected document scope uses ids, not filesystem paths.
- Scanned or image-only PDFs are reported as having no extractable text; OCR is not implemented in the v0.8 public preview.

The source inspector exposes filenames, chunk numbers, scores, labels, and cleaned previews. It does not expose local filesystem paths.

## HALO Learning Layer

The Learning Layer is a manual local note system backed by HALO-controlled local storage. Supported note types include project notes, study notes, code patterns, corrected mistakes, and personal preferences.

Learning is explicit:

- Notes are created and edited by the user.
- Chat transcripts are not automatically saved into learning notes.
- Unselected notes are not injected into chat.
- Selected notes are capped and injected as `SELECTED LEARNING CONTEXT`.
- Learning notes are supporting context only, not credentials, hidden instructions, policy, or source-of-truth over documents.

## Web Search Foundation

The v0.8 public preview includes Web Search foundation code but leaves it disabled and unconfigured by default.

Implemented foundation pieces:

- Search policy detection for current-information prompts.
- Provider status detection.
- SearXNG-compatible server-side provider adapter.
- Normalized search result types.
- Optional source-context injection into `/api/chat` only when configured.

No provider URL or key is included in the public preview. Without configuration, `/api/search` and Web Search chat requests return a clear not-configured response.

## Runtime Bridge

Runtime Bridge is optional and disabled by default. When an operator configures one public-safe report file, `/api/runtime/status` reads that file and exposes only sanitized bridge status to the sidebar. Detailed report context is available to chat only when the user explicitly enables the runtime context toggle.

The bridge is deliberately narrow:

- It reads only the single operator-configured public-safe report file.
- It does not accept browser-supplied paths.
- It does not list directories or read arbitrary files.
- It does not execute shell commands or SSH.
- It rejects symbolic links, non-file paths, oversized reports, and reports containing private markers.

The report is generated outside HALO Console. Runtime Bridge adds no monitoring, command execution, or administrative capability.

## Security Model

HALO Console's security posture is local-first and explicit:

- No required cloud model calls.
- No frontend secrets.
- No committed secrets.
- No `.env` content.
- No shell execution.
- No arbitrary filesystem access.
- No private file exposure.
- Runtime Bridge disabled by default and limited to one operator-configured public-safe report file.
- No Agent Bridge automation.
- No Web Search provider enabled by default.
- Document and learning APIs use ids instead of filesystem paths.
- Browser chat history remains browser-local.

See [Security Boundaries](SECURITY_BOUNDARIES.md) for the full public boundary statement.
