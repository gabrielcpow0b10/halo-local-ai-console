# HALO Console v0.8 Public Preview Release Notes

HALO Console v0.8 is a sanitized public preview of the local-first chat console, document context, manual Learning Layer, and optional read-only Runtime Bridge. It is prepared for a public repository and intentionally excludes private runtime data, environment details, uploaded files, credentials, hostnames, network details, screenshots, and logs.

## Highlights

- Local streaming chat through Ollama.
- Quick, Daily, and Heavy labels for local model selection and routing.
- Browser-local saved chat sessions.
- Local document upload, listing, deletion, retrieval, and selected document scope.
- Text-based PDF extraction with readability filtering and source/chunk inspection.
- Manual HALO Learning Layer with explicit selected-note context injection.
- Web Search route and provider foundation, disabled and unconfigured by default.
- Optional read-only Runtime Bridge for one operator-configured public-safe report file.
- Local-first security boundaries with no required cloud APIs.

## Local Chat And Routing

The chat interface streams responses from local Ollama models through `/api/chat`. Chat sessions remain in browser `localStorage`; no server-side chat transcript store is added.

HALO Console presents local model choices as `Quick`, `Daily`, and `Heavy`. These labels describe local routing intent, not hosted service tiers. Manual model selection takes precedence unless router mode is enabled.

## Local Documents And Selected Scope

The Documents panel supports local upload, listing, deletion, retrieval, and selected document scope for generic `.txt`, `.md`, `.log`, and text-based `.pdf` files. Retrieval injects a small capped set of readable matching chunks rather than whole documents.

Selected document scope limits retrieval to explicit document ids. If selected scope is enabled without a selection, HALO Console returns a safe no-selection response rather than falling back to every document. Scanned or image-only PDFs are reported as having no extractable text; OCR is not included.

## HALO Learning Layer

The Learning Layer is a manual local note system. Users can create, review, edit, filter, select, preview, and delete notes. Only explicitly selected notes are injected into chat, and selected learning context is capped.

HALO Console does not automatically save chats as memory, train on conversations, mine user messages, or inject every learning note by default.

## Web Search Foundation

Web Search remains disabled and unconfigured by default. The public preview includes route and provider foundation code, but no cloud provider, hosted search service, credential, or enabled default integration. Without operator configuration, Web Search returns a clear not-configured response.

## Optional Runtime Bridge

Runtime Bridge is disabled by default. An operator may configure one public-safe report file generated outside HALO Console. When available, the sidebar shows compact bridge status, and the report can be used as chat context only when the user explicitly enables runtime context.

Runtime Bridge has fixed public-safety boundaries:

- It reads only one operator-configured public-safe report file.
- It does not accept paths supplied by the browser in query strings or request bodies.
- It does not execute shell commands.
- It does not SSH.
- It does not list directories.
- It does not provide an arbitrary filesystem browser.
- It rejects symbolic links, non-file paths, oversized reports, and reports containing private markers.

The bridge is read-only and adds no monitoring, automation, or administrative capability.

## Security Notes

- No required cloud APIs or external API keys.
- No committed environment files.
- No shell execution or SSH from the application.
- No arbitrary filesystem reads.
- Document and learning APIs use ids rather than local filesystem paths.
- Runtime Bridge is disabled unless explicitly configured with one public-safe report file.
- Uploaded documents, learning records, private runtime reports, secrets, logs, and environment-specific details are excluded from the public repository.

## Validation

Release preparation checks:

```bash
npm run lint
npm run build
npm audit --omit=dev
git diff --check
```
