# HALO Console

HALO Console is a local-first AI console built with Next.js, TypeScript, and Ollama. It provides a ChatGPT-style interface for a user-controlled local model runtime, with optional local document context and the manual HALO Learning Layer.

The project is designed for private local use. It does not require cloud APIs, external API keys, Open WebUI, or hosted model providers.

## Public Preview

This branch is prepared as a sanitized `v0.6-public-preview` candidate. It documents the local architecture and feature surface without including local runtime data, uploaded documents, memory entries, secrets, screenshots, or private environment files.

Public preview notes: [docs/PUBLIC_RELEASE_NOTES_V0_6_PREVIEW.md](docs/PUBLIC_RELEASE_NOTES_V0_6_PREVIEW.md).

v0.6.6 local UI note: the sidebar uses compact Documents, Memory, and Saved Chats cards with hover, focus, and click-to-toggle details. This is a UI polish update only; it does not change APIs, security boundaries, runtime storage, or dependencies.

Compact sidebar notes: [docs/HALO_CONSOLE_V0_6_6_COMPACT_SIDEBAR.md](docs/HALO_CONSOLE_V0_6_6_COMPACT_SIDEBAR.md).

v0.7-local note: HALO Learning Layer replaces the generic Memory UI with manual local learning notes for project notes, study notes, code patterns, mistakes corrected, and personal preferences. Learning notes are curated by the user, stored locally, and only selected notes are sent to chat as `SELECTED LEARNING CONTEXT`.

Learning Layer notes: [docs/HALO_CONSOLE_V0_7_LEARNING_LAYER.md](docs/HALO_CONSOLE_V0_7_LEARNING_LAYER.md).

v0.7.1-local note: document upload responses are hardened so `/api/documents/upload` always returns JSON. Text-based PDFs are extracted into local chunks, and scanned/image-only PDFs show the local OCR limitation without crashing the Documents panel.

PDF upload hardening notes: [docs/HALO_CONSOLE_V0_7_1_PDF_UPLOAD_HARDENING.md](docs/HALO_CONSOLE_V0_7_1_PDF_UPLOAD_HARDENING.md).

v0.7.2-local note: local document retrieval is filename/title-aware. Queries such as `COP3530 final exam review` can prefer chunks from a matching uploaded document even when the exact content terms are sparse.

Local document retrieval notes: [docs/HALO_CONSOLE_V0_7_2_LOCAL_DOC_RETRIEVAL.md](docs/HALO_CONSOLE_V0_7_2_LOCAL_DOC_RETRIEVAL.md).

v0.7.3-local note: PDF/document chunks now carry local readability scoring. HALO filters out mostly garbled extracted text, prefers readable chunks for chat context, and reports when a matching document has no readable chunks available.

PDF chunk quality notes: [docs/HALO_CONSOLE_V0_7_3_PDF_CHUNK_QUALITY.md](docs/HALO_CONSOLE_V0_7_3_PDF_CHUNK_QUALITY.md).

v0.7.4-local note: the chat source inspector now renders readable compact chunk cards with spaced labels, truncated filenames, quality labels, scores, and cleaned previews. This is UI polish only; retrieval behavior and security boundaries are unchanged.

Source inspector polish notes: [docs/HALO_CONSOLE_V0_7_4_SOURCE_INSPECTOR_POLISH.md](docs/HALO_CONSOLE_V0_7_4_SOURCE_INSPECTOR_POLISH.md).

v0.7.5-local note: PDF extraction quality scoring is recalibrated for course documents and programming-heavy PDFs. Readable chunks with normal words, identifiers, numbers, and code syntax remain eligible for local context, while truly garbled chunks are still filtered out.

PDF extraction quality calibration notes: [docs/HALO_CONSOLE_V0_7_5_PDF_EXTRACTION_QUALITY_CALIBRATION.md](docs/HALO_CONSOLE_V0_7_5_PDF_EXTRACTION_QUALITY_CALIBRATION.md).

v0.7.6-local note: the Documents panel now supports selected document scope. `Use Local Docs` enables local document retrieval, while `Use Selected Docs` limits retrieval to selected local documents only and returns a safe no-selection message when enabled with zero selected documents.

Selected document scope notes: [docs/HALO_CONSOLE_V0_7_6_SELECTED_DOCUMENT_SCOPE.md](docs/HALO_CONSOLE_V0_7_6_SELECTED_DOCUMENT_SCOPE.md).

v0.7.7-local note: Documents, selected document cards, HALO Learning Layer cards, source inspector chunks, upload/status messages, and composer toggles received local UI/UX polish. This is visual polish only; retrieval, PDF extraction, quality scoring, storage behavior, and security boundaries are unchanged.

UI/UX polish notes: [docs/HALO_CONSOLE_V0_7_7_UI_UX_POLISH.md](docs/HALO_CONSOLE_V0_7_7_UI_UX_POLISH.md).

## Local Architecture

- Browser UI: Next.js App Router page at `/`
- App server: Next.js running locally
- Model runtime: Ollama at `http://127.0.0.1:11434` by default
- Health endpoint: `/api/health`
- Model endpoint: `/api/models`
- Streaming chat endpoint: `/api/chat`
- Optional web search endpoint: `/api/search`
- Local document endpoints: `/api/documents/upload`, `/api/documents/list`, `/api/documents/query`, `/api/documents/delete`
- HALO Learning Layer endpoints: `/api/memory/list`, `/api/memory/create`, `/api/memory/update`, `/api/memory/delete`
- Chat storage: browser `localStorage`
- Document storage: local `.halo-documents/` directory controlled by HALO Console
- Learning Layer storage: local `.halo-memory/` directory controlled by HALO Console

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

Scanned or image-only PDFs are accepted as local document records, but they produce no chunks and show: `This PDF appears to contain no extractable text. OCR is not implemented yet.`

When `Use Local Docs` is enabled, chat retrieves a small capped set of matching readable chunks and injects them as labeled local document context. It does not inject entire documents or low-quality extracted text.

When `Use Selected Docs` is enabled with `Use Local Docs`, chat searches only the selected readable local documents. If selected scope is enabled with no selected documents, HALO reports that no documents are selected and injects no document context.

If local documents exist but no chunks match a question, HALO Console reports that documents are available but no relevant chunks matched, and suggests using document-title terms or the Documents query box.

If a filename/title matches but the available extracted chunks are too noisy for reliable context, HALO Console reports that the document was found but no readable chunks were available. It does not answer from the filename alone.

### Source and Chunk Viewer

Answers that use local documents can show compact source hints and expandable chunk previews with readability labels. The UI exposes document filenames and chunk numbers, not local filesystem paths.

### HALO Learning Layer

HALO Console includes a manual local Learning Layer. Learning notes are created, reviewed, edited, searched, filtered, selected, previewed, and deleted through the UI. Entries are stored locally under `.halo-memory/`.

Learning is not automatic. HALO Console does not auto-save chats, extract memories from user messages, train on conversations, or inject all saved notes.

### Use Selected Learning

The `Use Selected Learning` toggle is explicit and off by default. When enabled, the browser sends only selected visible learning note ids to `/api/chat`. The server validates those ids, resolves them against HALO-controlled local storage, and injects only a small capped section labeled `SELECTED LEARNING CONTEXT`.

### Combined Local Context

`Use Local Docs` and `Use Selected Learning` can be enabled together. When both produce usable context, `/api/chat` sends separate labeled sections for local document context and selected learning context. The prompt treats learning notes as supporting context only, not as policy, system instruction, credential material, or source-of-truth over documents.

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
- Learning Layer API requests use learning note ids, not local filesystem paths.
- Manual learning notes are curated user-provided note data; do not store secrets, tokens, passwords, private keys, private paths, or full chat transcripts.
- Main chat local-docs context is opt-in per browser session with `Use Local Docs`.
- Selected document scope is opt-in per browser session with `Use Selected Docs` and uses document ids, not filesystem paths.
- Main chat document context is limited to a small number of retrieved chunks, not entire documents.
- Main chat selected learning context is opt-in and limited to selected visible learning notes.
- Browser chat history stays in `localStorage` on the client that used the app.
- Uploaded documents stay in `.halo-documents/` on the HALO Console server machine.
- Manual learning notes stay in `.halo-memory/` on the HALO Console server machine.

## Not Included

The public preview intentionally does not include:

- `.env` files or local environment configuration
- Tokens, API keys, passwords, SSH keys, private keys, or other secrets
- `.halo-memory/` contents
- `.halo-documents/` contents
- Uploaded private documents
- School PDFs, course files, or private source material
- Screenshots containing private information
- Real learning notes
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
