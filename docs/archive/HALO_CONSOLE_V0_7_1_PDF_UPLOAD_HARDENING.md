# HALO Console v0.7.1-local PDF Upload Hardening

## Bug Fixed

The Documents panel could show a raw parse error like `Unexpected token 'S'` when an upload failure returned a non-JSON server response. The upload client now checks the response content type and falls back to a clean HALO error message instead of crashing on `response.json()`.

## JSON Response Hardening

`/api/documents/upload` now returns `NextResponse.json` for every handled upload outcome:

- successful text document or text-based PDF upload
- unsupported file type
- missing multipart file
- empty file
- oversized file
- PDF with no extractable text
- PDF parser failure
- unexpected server error

## Text-Based PDF Support

Text-based PDFs are parsed locally on the HALO Console server, chunked locally, and stored under `.halo-documents/`. No cloud PDF service, hosted model, OpenAI API, web search, shell command, or OCR engine is used.

## Scanned PDF Limitation

Scanned or image-only PDFs do not contain extractable text for the local parser. They are stored as local document records with zero chunks and show:

```text
This PDF appears to contain no extractable text. OCR is not implemented yet.
```

## Security Boundaries

- Documents can only enter through browser upload or multipart API upload.
- Document storage remains under `.halo-documents/`, which is ignored by git.
- Document APIs use generated document ids, not user-provided filesystem paths.
- The upload flow does not add cloud APIs, OpenAI, web search, OCR, shell execution, arbitrary filesystem reads, or secret storage.
- Local document chunks remain capped and are only used when local document context is explicitly requested.
