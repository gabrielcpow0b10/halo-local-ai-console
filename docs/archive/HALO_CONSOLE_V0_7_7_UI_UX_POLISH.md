# HALO Console v0.7.7-local UI/UX Polish

HALO Console v0.7.7-local is a visual polish checkpoint for local documents, selected document scope, HALO Learning Layer cards, source inspector chunks, upload/status messages, and composer toggles.

## What changed

- Documents cards are more compact, with calmer selected states and truncated filenames using browser title tooltips.
- Document readiness states use softer badges for ready, partial, low-quality, and zero-chunk outcomes.
- Upload and document status messages are shorter, with longer extraction notes kept behind Details.
- HALO Learning Layer copy is consistent, compact, and focused on manual local notes.
- Learning note creation and edit forms are denser, and learning note cards clamp long previews until Details is opened.
- Source inspector chunk cards have clearer spacing for Document, Chunk, Quality, Score, and Preview fields.
- Composer toggles are balanced as compact pills for Web Search, Local Docs, Selected Docs, and Selected Learning.

## Behavior and security

This checkpoint does not change retrieval logic, PDF extraction logic, document quality scoring, or Learning Layer storage behavior.

HALO Console remains local-first. Documents stay in HALO-controlled local document storage, learning notes stay in HALO-controlled local learning storage, and chat history remains browser-local unless the user explicitly sends a message.

## Not added

- No cloud APIs.
- No OpenAI integration.
- No Web Search enablement.
- No OCR.
- No automatic memory or training.
- No shell execution.
- No arbitrary filesystem reads.
- No automatic full chat transcript storage.
