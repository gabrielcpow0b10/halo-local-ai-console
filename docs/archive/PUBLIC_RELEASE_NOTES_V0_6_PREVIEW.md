# HALO Console v0.6 Public Preview Release Notes

Recommended public version name: `v0.6-public-preview`.

This public preview summarizes the HALO Console local-first architecture and feature surface in a sanitized form. It is intended for a public GitHub branch or draft pull request before any public tag or release is created.

## What This Preview Shows

HALO Console is a local-first AI console built with Next.js, TypeScript, and Ollama. It runs the web interface and API routes locally, sends model requests to a local Ollama runtime, and keeps chat state, uploaded documents, and manual memory under user-controlled local storage.

The preview exposes the architecture and code paths for:

- Local chat through Next.js API routes and Ollama.
- Quick, Daily, and Heavy model routing labels.
- Local Documents/RAG foundation.
- Text-based PDF extraction.
- Local document chunk retrieval.
- Source and chunk viewer previews.
- Manual local memory create, review, edit, search, filter, select, preview, and delete flows.
- Explicit `Use Selected Memory` chat context.
- Combined `Use Local Docs` plus `Use Selected Memory` context.
- Disabled/unconfigured Web Search foundation.

## Local-First Architecture

The app is structured around a narrow local API layer:

- `/api/chat` streams responses from local Ollama.
- `/api/models` lists available local Ollama models.
- `/api/health` checks the local model runtime.
- `/api/router` returns model/tool routing decisions.
- `/api/documents/*` manages HALO-controlled local document storage.
- `/api/memory/*` manages HALO-controlled manual memory storage.
- `/api/search` exists as an optional provider boundary, but Web Search is disabled unless separately configured.

The browser UI uses the Next.js App Router and stores chat sessions in browser `localStorage`.

## Model Routing

The public preview documents a three-tier local model strategy:

- `Quick`: fast everyday local chat.
- `Daily`: stronger default reasoning for normal work.
- `Heavy`: slower, larger model for difficult prompts.

The default model names in this repo are Ollama tags and can be changed locally by editing the model registry.

## Local Documents and RAG Foundation

HALO Console supports upload-based local documents. Files enter through controlled browser or multipart upload, then are stored under `.halo-documents/`. API requests use generated document ids rather than user-provided filesystem paths.

Supported input types:

- `.txt`
- `.md`
- `.log`
- `.pdf` with extractable embedded text

Documents are chunked locally. When `Use Local Docs` is enabled, the chat route queries local chunks and injects only a capped set of relevant snippets. It does not inject full documents.

## PDF Extraction

Text-based PDF extraction is handled locally on the server side. Scanned or image-only PDFs require OCR, which is intentionally not included in this preview.

PDF boundaries:

- PDF bytes enter only through upload.
- Extracted text is chunked locally.
- Failed or empty extraction produces a visible unavailable state.
- No OCR or external document service is used.

## Source and Chunk Viewer

When local document context is used, HALO Console can show source hints and expandable chunk previews. The viewer is intentionally compact:

- document filename
- chunk label
- score
- short text preview

It does not expose absolute local filesystem paths.

## Manual Local Memory

Manual memory is a local-only note system controlled by the user. Entries can be created, reviewed, edited, searched, filtered, selected, previewed, and deleted.

Memory is intentionally bounded:

- No automatic chat capture.
- No hidden memory extraction.
- No all-memory injection.
- No memory treated as policy or instruction.
- No secrets should be stored as memory.
- Memory API calls use memory ids, not filesystem paths.

Stored memory data lives under `.halo-memory/`, which is intentionally excluded from public source control.

## Use Selected Memory

The `Use Selected Memory` composer toggle is explicit and off by default. When enabled, the browser sends selected memory ids to `/api/chat`. The server validates those ids, resolves only matching local entries, caps injected content, and labels it as selected memory context.

Selected memory is supporting context only. It is not a secret store, policy layer, developer instruction, or system instruction.

## Combined Local Docs and Selected Memory

`Use Local Docs` and `Use Selected Memory` can be enabled together. The chat route keeps the two sources separate:

- `LOCAL DOCUMENT CONTEXT`
- `SELECTED MEMORY CONTEXT`

The prompt directs the local model to use documents as source context when relevant and selected memory only as supporting context. If documents and memory conflict, the model should state the conflict rather than forcing them to agree.

## Web Search Status

Web Search remains disabled and unconfigured by default. The route and provider boundary are present for future local/private configuration, but this public preview does not include:

- a configured search provider
- API keys
- hosted search credentials
- enabled live web retrieval

If Web Search is requested without configuration, the app returns a clear not-configured response.

## Security Boundaries

This preview preserves these boundaries:

- No `.env` files in public source.
- No tokens, API keys, passwords, SSH keys, private keys, or secrets.
- No `.halo-memory/` contents.
- No `.halo-documents/` contents.
- No uploaded private documents.
- No local absolute paths.
- No screenshots with private information.
- No real memory entries.
- No shell execution from the web app.
- No arbitrary local filesystem reads.
- No cloud model provider dependency.

## Intentionally Not Included

The public preview does not include:

- Private local tags or private checkpoint history.
- Private runtime data.
- Private exports.
- School PDFs or course files.
- OCR for scanned PDFs.
- Embeddings or a vector database.
- Agent Bridge.
- HALO Mentor Mode.
- Cloud-hosted model providers.
- Configured Web Search.

## Recommended Public Release Strategy

Use a public pull request branch first, not an immediate GitHub release.

Recommended flow:

1. Create a sanitized branch named `public/v0.6-public-preview`.
2. Commit only reviewed sanitized files.
3. Open a draft pull request against the public repository default branch.
4. Review the GitHub diff in the browser for private paths, runtime files, uploaded documents, memory records, and secrets.
5. After review, merge or publish a release tag named `v0.6-public-preview`.

Do not push private local tags. Do not publish private checkpoint names as public tags.
