# HALO Console v0.7.9 Public Preview Release Notes

HALO Console v0.7.9 is a sanitized public preview of the local-first chat console, document context, and manual Learning Layer workflow. It is prepared for a public GitHub repository and intentionally excludes private runtime data, environment details, uploaded files, credentials, hostnames, network details, screenshots, and logs.

## Highlights

- Local streaming chat through Ollama.
- Quick, Daily, and Heavy model labels for local model selection and routing.
- Browser-local saved chat sessions with clearer session status and compact saved-chat cards.
- Local Documents panel for supported text, markdown, log, and text-based PDF files.
- Selected document scope for limiting retrieval to explicitly selected local documents.
- Readability scoring and filtering for extracted document chunks.
- Source inspector with compact local chunk previews.
- Manual HALO Learning Layer for user-curated local notes.
- Selected learning context injection through explicit note selection.
- Web Search remains disabled and unconfigured by default.
- Security boundaries remain local-first with no required cloud APIs.

## Local Chat

The chat interface streams responses from local Ollama models through `/api/chat`. Chat sessions are stored in browser `localStorage`. v0.7.9 polishes the session header, saved-chat cards, empty states, loading state, and context toggle presentation.

No server-side chat transcript store is added.

## Model Labels

HALO Console presents model choices as local tiers:

- `Quick`: short prompts and lightweight questions.
- `Daily`: normal development, documentation, analysis, and architecture tasks.
- `Heavy`: explicitly requested deep planning or complex reasoning.

These labels describe local routing intent. They are not hosted service tiers and do not require cloud model providers.

## Local Documents

The Documents panel supports local upload, listing, query, deletion, and selected document scope. Supported public-preview inputs are generic `.txt`, `.md`, `.log`, and text-based `.pdf` files.

When local document context is enabled, HALO Console retrieves a small capped set of readable matching chunks. It injects labeled local document context into chat rather than whole documents. Selected document scope restricts retrieval to selected document ids.

Scanned or image-only PDFs do not receive OCR in v0.7.9. They are handled safely as documents with no extractable text.

## HALO Learning Layer

The Learning Layer is manual and local. Users can create, review, edit, select, preview, filter, and delete learning notes. Selected learning notes can be passed to chat as capped supporting context.

HALO Console does not auto-save chats as memories, train on conversations, mine user messages, or inject all learning notes by default.

## Web Search

Web Search remains disabled and unconfigured by default. The public preview includes route and provider foundation code, but it does not include provider credentials, hosted search setup, cloud APIs, or an enabled public search integration.

## Security Notes

The public preview preserves these boundaries:

- No required cloud APIs.
- No required external API keys.
- No committed environment files.
- No shell execution from the web app.
- No arbitrary filesystem browser.
- No uploaded private documents in the repository.
- No real learning notes in the repository.
- No private network details, storage paths, user paths, credentials, or logs in public docs.

## Validation

Required checks for this release preparation:

```bash
npm run lint
npm run build
```
