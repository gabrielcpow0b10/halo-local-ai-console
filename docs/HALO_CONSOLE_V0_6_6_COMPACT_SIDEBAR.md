# HALO Console v0.6.6 Compact Sidebar

HALO Console `v0.6.6-local` tightens the left sidebar so local documents, manual memory, and saved chats stay readable when the user has more local data.

## Compact Sidebar Cards

- Documents now show a compact title, type badge, chunk count, created date, Details/Hide button, and Delete button by default.
- Memory entries now show a compact selected checkbox, memory type, title, one-line preview, Details/Hide button, Edit button, and Delete button by default.
- Saved chats now use compact cards with clamped titles, metadata, and spaced Rename/Delete actions.

## Hover, Focus, And Click Details

Details remain available without making the default sidebar heavy:

- Hovering a document or memory card reveals its detail area.
- Keyboard focus inside a card reveals the same detail area.
- The Details/Hide button toggles details for users who do not use hover.

Expanded details stay inside the same dark card and continue to scroll with the sidebar.

## Scope

This release is UI/UX polish only.

- No API behavior changes.
- No security boundary changes.
- No new dependencies.
- No cloud APIs.
- No OpenAI integration.
- No web search enablement.
- No shell execution feature.

HALO-controlled document and memory storage remain unchanged.
