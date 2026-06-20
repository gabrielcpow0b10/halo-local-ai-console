# HALO Console

HALO Console is a local-first AI workbench for chatting with Ollama models from a polished browser interface. It is built with Next.js, TypeScript, and a small HALO API layer that keeps model calls, uploaded documents, and manually curated learning notes under local user control.

This repository is published as a sanitized `v0.8 Public Preview`. It is intended to show the architecture, interface shape, and local-first product direction without including private runtime data, uploaded files, secrets, screenshots, or environment-specific configuration.

## v0.8 Public Preview

The v0.8 public preview focuses on a complete local chat workflow:

- Local streaming chat through Ollama.
- Quick, Daily, and Heavy model labels for local model selection and routing.
- Browser-local saved chat sessions.
- Local document upload, listing, deletion, retrieval, and selected document scope.
- PDF text extraction for text-based PDFs, with safe handling for scanned or image-only PDFs.
- Source and chunk inspector UI for answers that use local document context.
- HALO Learning Layer for manual, user-curated local notes.
- Explicit selected learning context injection.
- Minimal HomeLab Runtime status in the sidebar, with detailed runtime context available only through chat when explicitly enabled.
- Web Search UI and route foundation kept disabled unless configured by the operator.
- Clear local-first security boundaries and no required cloud APIs.
- Runtime-enabled HomeLab questions answer from concrete public-safe status facts when available, with concise English or Spanish phrasing suitable for future voice use.

Release notes: [docs/RELEASE_NOTES_V0_8.md](docs/RELEASE_NOTES_V0_8.md)

Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

Security boundaries: [docs/SECURITY_BOUNDARIES.md](docs/SECURITY_BOUNDARIES.md)

## Architecture

HALO Console keeps the browser, API routes, model routing, and model runtime separated:

```text
Browser
  -> HALO Console UI
  -> HALO API Layer
  -> Model Router
  -> Ollama
  -> Local Models
```

At a code level:

- Browser UI: Next.js App Router page at `/`.
- API layer: local route handlers under `/api/*`.
- Model runtime: Ollama, defaulting to `http://127.0.0.1:11434`.
- Model metadata: `/api/models`.
- Streaming chat: `/api/chat`.
- Router decision endpoint: `/api/router`.
- Local documents: `/api/documents/upload`, `/api/documents/list`, `/api/documents/query`, and `/api/documents/delete`.
- Learning Layer: `/api/memory/list`, `/api/memory/create`, `/api/memory/update`, and `/api/memory/delete`.
- Runtime Bridge: `/api/runtime/status`, disabled unless `HALO_RUNTIME_PUBLIC_SAFE_REPORT` points to one public-safe report file.
- Web Search foundation: `/api/search`, disabled/not configured by default.

The browser does not receive provider credentials, local filesystem paths, shell access, or arbitrary private-file access. Uploaded documents and learning notes are stored only in HALO-controlled local storage directories on the machine running the app.

## Model Routing

HALO Console presents local model choices as user-facing tiers:

- `Quick`: short prompts, greetings, and lightweight questions.
- `Daily`: normal development, documentation, analysis, and architecture work.
- `Heavy`: explicit deep-planning or complex-reasoning requests.

The preview uses public-safe labels rather than promising a hosted service tier. The labels map to locally installed Ollama models and can be adjusted by the operator. Manual model selection takes precedence unless router mode is enabled.

Example local model labels:

```text
Quick -> qwen3:4b
Daily -> qwen3:14b
Heavy -> qwen3:30b-a3b
```

## Local Chat

Chat responses stream from Ollama through `/api/chat`. Chat sessions are stored in browser `localStorage`, not in a server-side transcript database. The UI includes compact saved-chat cards, active session status, empty and loading states, and explicit context toggles for local documents, selected documents, and selected learning.

The chat composer also includes `USE HOMELAB RUNTIME`. When enabled and the Runtime Bridge is available, HALO can use the configured public-safe runtime summary as private-safe context for questions such as "HALO, how is my HomeLab today?" or "HALO, como esta mi HomeLab hoy?". Runtime-enabled chat can answer overall HomeLab status, node health, temperature, memory, disk, Docker or service counts, safety boundary questions, and whether anything needs review. Specific metric questions are answered directly without dumping the full report. Runtime details are not shown automatically and are not displayed as a sidebar document.

## Local Documents

The Documents panel supports local uploads for generic `.txt`, `.md`, `.log`, and `.pdf` files. Text files are decoded locally. Text-based PDFs are extracted, chunked, quality-scored, and stored under HALO-controlled local document storage.

When `Use Local Docs` is enabled, HALO Console retrieves a small capped set of readable matching chunks and injects them into the chat request as labeled local document context. It does not inject entire documents.

When `Use Selected Docs` is enabled with `Use Local Docs`, retrieval is limited to the selected document ids. If selected scope is enabled with no selected documents, the chat route returns a safe no-selection response instead of falling back to all documents.

Scanned or image-only PDFs can be recorded as local document entries, but OCR is not implemented in this preview. HALO Console reports that no extractable text was found rather than guessing from filenames or private metadata.

## HALO Learning Layer

The HALO Learning Layer is a manual local note system. Users can create, edit, filter, select, preview, and delete learning notes such as project notes, study notes, code patterns, corrected mistakes, and personal preferences.

Learning is not automatic. HALO Console does not train on conversations, auto-save chat transcripts, mine user messages for memory, or inject every saved note into prompts.

When `Use Selected Learning` is enabled, the browser sends selected learning note ids to `/api/chat`. The server validates those ids, resolves them against HALO-controlled local storage, and injects only a capped `SELECTED LEARNING CONTEXT` section. Learning notes are treated as supporting context, not as credentials, hidden instructions, policy, or a source of truth over uploaded documents.

## Runtime Bridge

Runtime Bridge is optional and disabled by default. It provides read-only chat context from one public-safe local report file generated outside HALO Console.

Configure it with a placeholder-style absolute file path in local environment only:

```bash
HALO_RUNTIME_PUBLIC_SAFE_REPORT=/absolute/path/to/public-safe-demo-summary.local.md
```

Safety boundaries:

- Reads only the single file path configured by `HALO_RUNTIME_PUBLIC_SAFE_REPORT`.
- Does not accept report paths from browser query strings or request bodies.
- The browser can request runtime context only with a boolean chat flag.
- Does not list directories.
- Does not execute shell commands.
- Does not SSH.
- Does not read arbitrary files.
- Rejects symbolic links, non-file paths, reports larger than 64 KB, and reports containing private markers.
- The sidebar shows only a compact `HomeLab Runtime` status card: status, read-only mode, and optional timestamp.
- The sidebar does not render the runtime markdown report, raw report, paths, hostnames, IPs, ports, usernames, tokens, secrets, or detailed runtime content.
- Detailed runtime information is requested conversationally through chat and only used when `USE HOMELAB RUNTIME` is enabled.
- Public setup should point first to a public-safe demo summary, not private raw runtime reports.

Runtime answers are worded to be concise and naturally spoken when the user asks for quick, short, spoken, or voice-style output. Future HALO direction includes a local "Hey HALO" style voice assistant mode, but voice input and wake-word behavior are not implemented in this preview.

## Web Search

Web Search remains disabled and unconfigured by default in this public preview. The repository includes a local route/provider foundation for future use, but no cloud search provider, hosted search service, public API key, or default web search integration is enabled.

If no server-side provider is configured, Web Search requests return a clear not-configured response.

## Requirements

- Node.js and npm.
- Ollama installed and running.
- At least one local Ollama model installed.

## Run Locally

Install dependencies if needed:

```bash
npm install
```

Start Ollama:

```bash
ollama serve
```

Start HALO Console:

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
curl http://localhost:3030/api/documents/list
curl http://localhost:3030/api/memory/list
```

## Security Boundaries

- Local-first: designed to run on a user-controlled machine.
- No required cloud APIs.
- No required external API keys.
- No committed `.env` content.
- No shell execution from the web app.
- No arbitrary local file browser.
- Documents enter through browser upload or multipart API upload.
- Document and learning APIs use ids, not local filesystem paths.
- Runtime Bridge is disabled unless configured with one allowlisted public-safe report file.
- Runtime Bridge does not execute commands, SSH, list directories, or accept browser-supplied paths.
- Local document context is opt-in per browser session.
- Selected document scope is explicit and id-based.
- Selected learning context is explicit and capped.
- Browser chat history remains in browser `localStorage`.
- Uploaded documents remain in HALO-controlled local document storage.
- Manual learning notes remain in HALO-controlled local learning storage.

Do not store secrets, credentials, private paths, private document names, or full chat transcripts in learning notes or public docs.

## Not Included

The public preview intentionally excludes:

- `.env` files or local environment configuration.
- Secrets, credentials, keys, or private configuration values.
- Uploaded private documents or generated local document stores.
- Learning Layer data or real personal notes.
- Private logs, network details, storage paths, or user-specific filesystem paths.
- Screenshots containing private information.
- OCR for scanned PDFs.
- Embeddings or a vector database.
- Agent Bridge automation or shell execution.
- Hosted/cloud model providers.
- Enabled Web Search.

## Validation

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

Check patch whitespace:

```bash
git diff --check
```
