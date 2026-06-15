# HALO Console v0.7.2-local Local Document Retrieval

## Problem Fixed

Uploaded PDFs could be chunked successfully but still fail retrieval from main chat, causing `LOCAL DOCS SEARCHED: NO CHUNKS USED` for questions that named an uploaded document.

## Filename/Title-Aware Retrieval

Local document search now scores:

- chunk text
- uploaded filename
- display title derived from the filename
- document type
- extraction status and note metadata

This lets queries such as `COP3530 final exam review` prefer chunks from `COP3530_Final_Exam_Review_Video_Guide.pdf`, even when individual chunks do not repeat every title term.

## Lexical Matching Limits

Retrieval is still lexical. It normalizes case, punctuation, separators, and word splitting, then scores token and phrase overlap. It can miss concepts that are only implied, heavily paraphrased, or poorly extracted from a PDF.

## Not Added

- No embeddings yet.
- No vector database.
- No cloud APIs.
- No OpenAI API.
- No web search provider changes.
- No OCR for scanned PDFs.
- No automatic memory, training, or chat transcript storage.

Documents remain uploaded local files and chunks. The HALO Learning Layer remains separate manual curated notes.
