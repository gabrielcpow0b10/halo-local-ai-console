# HALO Console v0.7.5-local PDF Extraction Quality Calibration

HALO Console v0.7.3 and v0.7.4 added local chunk quality scoring so garbled PDF extraction would not be injected into chat. That safety behavior remains in v0.7.5-local, but the scoring was too strict for readable programming and course PDFs. Normal punctuation, numbers, code identifiers, and common programming symbols could push otherwise useful chunks into the low-quality bucket.

v0.7.5-local recalibrates the local scorer to prefer readable chunks that contain normal words, course terms, code identifiers, numeric references, and mixed programming text. Symbols such as `()`, `{}`, `[]`, `<>`, `==`, `>=`, `<=`, `;`, `:`, `_`, and camelCase identifiers are no longer treated as low quality by themselves.

## Document Status Rules

Document-level status is based on extracted text and chunk readability:

- `Ready for local context`: at least one readable chunk and no stored low-quality chunks.
- `Partial extraction`: at least one readable chunk and at least one low-quality chunk.
- `Low-quality extraction`: extracted text exists, but zero chunks are readable.
- `No extractable text / OCR needed`: no usable extracted text was found.

HALO Console does not mark the whole document as low quality when any chunk is readable. Existing uploaded document records are normalized with the current scorer when listed or queried, so previously strict classifications can improve without re-upload.

## Programming PDF Support

Programming PDFs often mix prose, operators, brackets, generic types, method names, and identifiers. v0.7.5-local keeps those chunks eligible when they contain meaningful words or identifiers. Code-heavy chunks can be readable when they include signals such as camelCase, snake_case, class or method names, numeric references, or surrounding prose.

The scorer still rejects truly unreadable chunks, including empty text, repeated character runs, replacement-character-heavy extraction, symbol-only output, and text with too few meaningful tokens.

## Retrieval Safety

Chat retrieval still injects only readable local chunks. Low-quality chunks can support diagnostics, but they are not sent as local document context. If a document is found by title or filename and no readable chunks are available, HALO Console reports that no readable chunks were available instead of answering from the filename alone.

Local documents and the HALO Learning Layer remain separate. Uploaded documents are not converted into learning notes, and selected learning notes are not treated as document evidence.

## Scope Boundaries

v0.7.5-local does not add OCR. Scanned or image-only PDFs still need OCR before their contents can become local context.

v0.7.5-local does not add cloud APIs, OpenAI calls, Web Search, shell execution, arbitrary filesystem reads, secret storage, public/export workflow changes, or automatic training. All extraction, scoring, chunking, querying, and diagnostics stay local to HALO Console storage.
