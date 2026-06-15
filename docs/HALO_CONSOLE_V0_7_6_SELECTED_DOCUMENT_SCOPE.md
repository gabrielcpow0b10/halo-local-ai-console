# HALO Console v0.7.6-local Selected Document Scope

HALO Console `v0.7.6-local` adds selected document scope for local document retrieval. Uploaded documents remain local document records, but the user can now choose which uploaded documents are eligible for a chat turn.

## Selected Document Scope

The Documents panel shows a compact `Select` control on each document card. Selected cards use a subtle selected state, and the panel shows how many documents are selected with a `Clear selection` action.

Selection is local UI state. It does not copy documents, create memories, train a model, or change stored document contents.

## Toggle Interaction

`Use Local Docs` is still the main document-context switch:

- Off: no local document chunks are searched or injected.
- On: local document retrieval is enabled.

`Use Selected Docs` is a separate narrowing switch:

- Off: `Use Local Docs` searches all readable local documents.
- On: `Use Local Docs` searches only selected readable local documents.

If `Use Selected Docs` is on but no documents are selected, HALO returns:

```text
Selected docs is enabled, but no documents are selected.
```

No document chunks are injected in that case.

## Safety Behavior

HALO only injects readable chunks returned by the local document quality filter. Low-quality or unreadable chunks remain excluded from chat context.

If selected documents are searched but no relevant readable chunks are found, the chat indicator reports:

```text
LOCAL DOCS SEARCHED: SELECTED DOCUMENTS, NO RELEVANT READABLE CHUNKS USED
```

HALO does not answer from filenames alone. Filenames and document titles can help retrieval find the intended document, but generated answers only receive readable chunk text as document evidence.

## Source Inspector

When selected local documents are used, the chat indicator includes both the chunk count and selected document count, for example:

```text
LOCAL DOCS USED: 4 CHUNKS · SELECTED DOCS: 1
```

The source inspector keeps the same clean fields:

- `Document`
- `Chunk`
- `Quality`
- `Score`
- `Preview`

## Security Boundary

Selected document scope does not add cloud APIs, OpenAI calls, Web Search, shell execution, arbitrary filesystem reads, secret storage, public export behavior, or automatic training.

Document selection uses HALO document ids resolved against HALO-controlled `.halo-documents/` storage. The browser does not send local filesystem paths.

## No OCR

`v0.7.6-local` does not add OCR. Scanned or image-only PDFs can be uploaded as records, but their contents are not available as readable local context until OCR exists outside this release.

## No Automatic Memory Or Training

Selected documents remain separate from the HALO Learning Layer. HALO does not automatically create learning notes from uploaded documents, store full chat transcripts, train on documents, or merge selected documents into memory.
