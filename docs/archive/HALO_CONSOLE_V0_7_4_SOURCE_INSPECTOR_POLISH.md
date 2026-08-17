# HALO Console v0.7.4-local Source Inspector Polish

## Source Inspector Readability Polish

v0.7.4-local improves the chat source chunk inspector layout. Source chunks now render as compact dark cards with explicit labels:

- `Document:`
- `Chunk:`
- `Quality:`
- `Score:`
- `Preview:`

Long document filenames are visually truncated inside the card and remain available through the hover title. Preview text is cleaned, capped, and line-clamped so source cards do not widen or dominate the chat layout.

Low-quality chunks, if displayed by any future view, continue to use the label:

`Low-quality extracted text`

## No Retrieval Behavior Change

This update does not change document upload, chunk scoring, retrieval ranking, chat injection, API headers, or no-readable-chunks handling. It is presentation-only polish for the existing source inspector.

## No Security Boundary Change

The existing local-only security boundary is unchanged:

- no cloud APIs
- no OpenAI API
- no web search enablement
- no OCR
- no shell execution
- no arbitrary filesystem path reads
- no secret storage

The inspector still displays document names, chunk numbers, quality labels, scores, and short previews only. It does not expose local filesystem paths.
