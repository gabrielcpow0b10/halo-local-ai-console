# HALO Console

HALO Console is a local-first AI console built with Next.js, TypeScript, and Ollama. It provides a ChatGPT-style interface for a user-controlled local model runtime, with optional local document context and manual local memory.

The project is designed for private local use. It does not require cloud APIs, external API keys, Open WebUI, or hosted model providers.

## Public Preview

This branch is prepared as a sanitized `v0.6-public-preview` candidate. It documents the local architecture and feature surface without including local runtime data, uploaded documents, memory entries, secrets, screenshots, or private environment files.

Public preview notes: [docs/PUBLIC_RELEASE_NOTES_V0_6_PREVIEW.md](docs/PUBLIC_RELEASE_NOTES_V0_6_PREVIEW.md).

## Local Architecture

- Browser UI: Next.js App Router page at `/`
- App server: Next.js running locally
- Model runtime: Ollama at `http://127.0.0.1:11434` by default
- Health endpoint: `/api/health`
- Model endpoint: `/api/models`
- Streaming chat endpoint: `/api/chat`
- Optional web search endpoint: `/api/search`
- Local document endpoints: `/api/documents/upload`, `/api/documents/list`, `/api/documents/query`, `/api/documents/delete`
- Manual memory endpoints: `/api/memory/list`, `/api/memory/create`, `/api/memory/update`, `/api/memory/delete`
- Chat storage: browser `localStorage`
- Document storage: local `.halo-documents/` directory controlled by HALO Console
- Memory storage: local `.halo-memory/` directory controlled by HALO Console

The web app never executes shell commands and does not expose arbitrary local private files. Document upload is limited to HALO-controlled storage and does not accept user-provided filesystem paths.

## Requirements

- Node.js and npm
- Ollama installed and running
- At least one local Ollama model installed

Expected local model routing labels:

- `Quick`: `qwen3:4b`
- `Daily`: `qwen3:14b`
- `Heavy`: `qwen3:30b-a3b`

## Features

### Local Chat

HALO Console streams chat responses from local Ollama through the `/api/chat` route. Manual model selection is available, and the router foundation can choose between Quick, Daily, and Heavy model tiers.

### Local Documents

HALO Console supports local document upload for `.txt`, `.md`, `.log`, and `.pdf` files. Text files are decoded as UTF-8. Text-based PDFs are extracted server-side, chunked locally, and stored under `.halo-documents/`.

When `Use Local Docs` is enabled, chat retrieves a small capped set of matching chunks and injects them as labeled local document context. It does not inject entire documents.

### Source and Chunk Viewer

Answers that use local documents can show compact source hints and expandable chunk previews. The UI exposes document filenames and chunk numbers, not local filesystem paths.

### Manual Local Memory

HALO Console includes a manual memory foundation. Memory entries are created, reviewed, edited, searched, filtered, selected, previewed, and deleted through the UI. Entries are stored locally under `.halo-memory/`.

Memory is not automatic. HALO Console does not auto-save chats, extract memories from user messages, or inject all saved memories.

### Use Selected Memory

The `Use Selected Memory` toggle is explicit and off by default. When enabled, the browser sends only selected visible memory ids to `/api/chat`. The server validates those ids, resolves them against HALO-controlled local memory storage, and injects only a small capped selected-memory context section.

### Combined Local Context

`Use Local Docs` and `Use Selected Memory` can be enabled together. When both produce usable context, `/api/chat` sends separate labeled sections for local document context and selected memory context. The prompt treats memory as supporting context only, not as policy, system instruction, credential material, or source-of-truth over documents.

### Web Search

Web Search remains disabled and unconfigured by default. The public preview includes the disabled route/provider foundation, but no public web search provider, cloud search integration, or API key configuration is included.

## Run the App

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

Open locally:

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

## Ollama Model Commands

Install the daily model:

```bash
ollama pull qwen3:14b
```

Install the heavier model:

```bash
ollama pull qwen3:30b-a3b
```

List installed models:

```bash
ollama list
```

Run a quick model test:

```bash
ollama run qwen3:14b
```

## Security Boundaries

- Local-first only: the app is intended to run on a user-controlled local machine or through a user-controlled tunnel.
- No cloud APIs are required.
- No external API keys are required.
- No shell execution from the web app.
- No local file browser or arbitrary private file exposure.
- Documents can only enter through browser upload or multipart API upload.
- Document API requests use document ids, not local filesystem paths.
- Memory API requests use memory ids, not local filesystem paths.
- Manual memory is curated user-provided note data; do not store secrets, tokens, passwords, private keys, or full chat transcripts.
- Main chat local-docs context is opt-in per browser session with `Use Local Docs`.
- Main chat document context is limited to a small number of retrieved chunks, not entire documents.
- Main chat selected-memory context is opt-in and limited to selected visible memory entries.
- Browser chat history stays in `localStorage` on the client that used the app.
- Uploaded documents stay in `.halo-documents/` on the HALO Console server machine.
- Manual memory stays in `.halo-memory/` on the HALO Console server machine.

## Not Included

The public preview intentionally does not include:

- `.env` files or local environment configuration
- Tokens, API keys, passwords, SSH keys, private keys, or other secrets
- `.halo-memory/` contents
- `.halo-documents/` contents
- Uploaded private documents
- School PDFs, course files, or private source material
- Screenshots containing private information
- Real memory entries
- Private local tags or private checkpoint history
- OCR for scanned PDFs
- Embeddings or a vector database
- Agent Bridge or shell execution
- Hosted/cloud model providers

## Validation

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

Run dependency audit without dev dependencies:

```bash
npm audit --omit=dev
```

Check patch whitespace:

```bash
git diff --check
```
