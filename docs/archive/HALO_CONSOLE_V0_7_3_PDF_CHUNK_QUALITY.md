# HALO Console v0.7.3-local PDF Chunk Quality

## Problem Fixed

HALO Console could upload and retrieve local PDF chunks, but some extracted PDF text was too garbled to be useful as local context. Examples included short symbol-heavy chunks such as `!!` or punctuation sequences with very few readable words.

v0.7.3-local adds local chunk readability scoring so poor extracted text is labeled and filtered before chat context injection.

## Chunk Quality Filtering

Each extracted chunk is scored locally using lexical readability signals:

- letter count
- letter-to-symbol ratio
- readable word ratio
- isolated symbol count
- repeated character runs
- short chunks with too few words

Chunks are marked as `readable`, `low_quality`, or `garbage`.

HALO stores readable and low-quality chunks with quality metadata, but it filters out chunks that are mostly garbage during upload. Retrieval only returns readable chunks for chat context.

## Filename-Only Matches Are Not Enough

Filename and title matching help find the right uploaded document, but HALO must not answer from a filename alone. If a document title matches but no readable chunk is available, chat returns:

`The document was found, but no readable chunks were available for this question.`

This prevents HALO from hallucinating document contents based only on a filename such as `Final_Exam_Review.pdf`.

## Scanned and Garbled PDF Limitation

Text-based PDFs can produce usable local chunks. Scanned, image-only, or unusually encoded PDFs may produce no readable text or only low-quality extracted text.

When extracted text is too poor for reliable local context, HALO reports:

`This document was uploaded, but the extracted text quality is too low for reliable local context. OCR is not implemented yet.`

## No OCR Yet

OCR is not implemented in v0.7.3-local. HALO does not attempt image recognition, page rasterization, or external OCR services.

## Security Boundaries

v0.7.3-local keeps the local-only document boundary:

- no cloud APIs
- no OpenAI API
- no web search enablement
- no OCR service
- no shell execution
- no arbitrary filesystem path reads
- no secret storage
- no public/export workflow changes

Uploaded files and chunk indexes remain under HALO-controlled local document storage.

## No Automatic Training

Local documents are retrieved as temporary prompt context only when `Use Local Docs` is enabled. HALO does not train on uploaded files, automatically create memories from documents, or save full chat transcripts into the Learning Layer.
