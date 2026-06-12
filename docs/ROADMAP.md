# Roadmap

This roadmap keeps HALO Console local-first and Ollama-centered. Items here are not commitments to add cloud APIs, hosted model providers, Web Search providers by default, or Agent Bridge automation.

## v0.4a Public Export

- Public-facing README.
- Architecture documentation.
- Security boundary documentation.
- Roadmap documentation.
- Sanitized public repository contents.
- Lint and production build validation.

## Near-Term Local Improvements

- Add focused tests for model routing, search policy detection, and input validation.
- Improve error states for missing Ollama models.
- Add clearer model availability messaging in the UI.
- Add source display in chat when Web Search is configured and enabled.
- Add provider health checks for optional local Web Search.

## Web Search Foundation

The current Web Search foundation should remain disabled by default.

Potential improvements:

- source cards for streamed answers,
- configurable result count,
- provider status in the UI,
- local SearXNG setup notes that do not include private hostnames or credentials,
- tests for provider normalization and failure handling.

## Documents And Retrieval

Documents/RAG is not implemented in v0.4a.

Future work should require an explicit design for:

- user-approved document selection,
- ingestion and chunking,
- metadata handling,
- local-only vector storage,
- deletion and re-indexing,
- private file boundaries.

## Memory

Persistent assistant memory is not implemented in v0.4a.

Future work should distinguish between:

- browser-local chat history,
- user-approved preferences,
- durable memory storage,
- export and deletion controls.

## Agent Bridge

Agent Bridge is not included in this public export.

Any future automation layer should be treated as a separate security project with:

- explicit user confirmation,
- narrow allowlists,
- audit logs,
- no arbitrary command runner,
- no default access to secrets or private files.

## Deployment Notes

HALO Console should remain easy to run locally:

- Next.js app,
- local Ollama runtime,
- no required external services,
- no required API keys,
- no committed environment files.
