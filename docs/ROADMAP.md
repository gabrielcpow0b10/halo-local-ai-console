# Roadmap

This roadmap keeps HALO Console local-first, Ollama-centered, and public-preview safe. Items here are not commitments to add cloud APIs, hosted model providers, enabled Web Search, or automation with shell access.

## v0.7.9 Public Preview

Current public preview scope:

- Local streaming chat through Ollama.
- Quick, Daily, and Heavy local model labels.
- Browser-local saved chat sessions.
- Local document upload, listing, deletion, query, and selected document scope.
- Text-based PDF extraction with readable chunk filtering.
- Source/chunk inspector UI for local document context.
- Manual HALO Learning Layer notes with selected-note context injection.
- Web Search route/provider foundation present but disabled unless configured.
- Public documentation for architecture, release notes, roadmap, and security boundaries.

## Near-Term Local Improvements

- Add focused tests for model routing, chat request validation, selected document scope, and selected learning context selection.
- Improve missing-model and unreachable-Ollama error states in the UI.
- Add clearer document extraction status messages for partial and low-quality documents.
- Add import/export controls for sanitized learning notes.
- Add stronger public examples using generic sample documents only.

## Documents And Retrieval

The current document system is intentionally simple and local.

Potential improvements:

- Better chunk ranking for long documents.
- Optional local embeddings or a local vector index.
- Re-indexing controls.
- Document metadata review before context use.
- Bulk deletion and storage cleanup controls.
- OCR as an explicit local-only feature, if added later.

## HALO Learning Layer

The Learning Layer should remain manual and user-curated.

Potential improvements:

- Better note organization and tags.
- Safer duplicate detection.
- Export/import for user-reviewed notes.
- More transparent prompt previews for selected learning context.
- Tests that confirm unselected notes are not injected into chat.

## Web Search Foundation

Web Search remains disabled and unconfigured by default.

Potential improvements, if an operator chooses to configure a local provider:

- Provider health checks.
- Source cards for streamed answers.
- Configurable result count.
- Clear not-configured and provider-failed states.
- Public setup notes that use only generic hostnames and placeholders.

## Agent Bridge

Agent Bridge is not included in this public preview.

Any future automation layer should be treated as a separate security project with:

- Explicit user confirmation.
- Narrow allowlists.
- Audit logs.
- No arbitrary command runner.
- No default access to secrets or private files.

## Deployment Notes

HALO Console should remain easy to run locally:

- Next.js app.
- Local Ollama runtime.
- No required external services.
- No required API keys.
- No committed environment files.
- No private runtime data in the public repository.
