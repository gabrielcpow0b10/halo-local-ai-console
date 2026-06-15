# HALO Console v0.7-local Learning Layer

HALO Console `v0.7-local` adds the HALO Learning Layer foundation for manually curated local learning notes.

## Purpose

The Learning Layer is a local note surface for user-approved context that HALO may reuse in later chats. It keeps curated knowledge separate from uploaded documents:

- Documents are uploaded files and retrieved chunks.
- HALO Learning Layer is short user-written knowledge.

Supported note types:

- Project notes
- Study notes
- Code patterns
- Mistakes corrected
- Personal preferences

## Manual-only Learning

Learning notes are created only when the user manually enters a title, category, short note, and optional source label. HALO Console does not auto-save full conversations, extract memories from chat, or train on chat history.

## Safety Rules

The UI displays this notice:

> Learning notes are manual and local. Do not store secrets, passwords, tokens, private paths, or full chat transcripts.

Learning notes should stay short and curated. They are not a credential store, transcript archive, filesystem index, or policy layer.

## Selected Learning Context

The chat composer can send selected notes only when `Use Selected Learning` is enabled. The browser sends selected note ids to `/api/chat`; the server resolves those ids from HALO-controlled `.halo-memory/` storage and injects a capped context block labeled:

```text
SELECTED LEARNING CONTEXT
```

Selected learning context is supporting context only. It is not a system policy, hidden command channel, credential material, or source-of-truth over uploaded documents.

## No Cloud APIs

The Learning Layer does not add cloud APIs, OpenAI APIs, hosted model providers, web search, shell execution, arbitrary filesystem reads, or secret storage.

## No Automatic Training

HALO Console does not train models. Learning notes are local records that can be manually selected for prompt context in a later chat.

## No Full Transcript Storage

HALO Console does not automatically save full chat transcripts into the Learning Layer. Browser chat history remains separate from Learning Layer records.
