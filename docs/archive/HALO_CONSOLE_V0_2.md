# HALO Console v0.2

HALO Console v0.2 is a clean local AI console for an Ollama node. It keeps the browser UI, API routes, model runtime, and chat history local to the user-controlled environment.

## Current Architecture

- Next.js App Router provides the UI and local API routes.
- The main console lives in `src/app/page.tsx`.
- Global styling lives in `src/app/globals.css`.
- `/api/health` checks whether Ollama is reachable.
- `/api/models` returns installed Ollama models from `/api/tags`.
- `/api/chat` streams local Ollama chat responses back to the browser.
- Ollama defaults to `http://127.0.0.1:11434`.
- Browser conversations are stored in `localStorage`.

## Current Features

- Dark HALO console interface.
- Left sidebar with New Chat, Ollama status, active model selector, installed models, saved chats, and node information.
- Main chat area with streaming assistant responses.
- Bottom composer with Enter-to-send and Shift+Enter for new lines.
- Stop button for in-progress generation.
- Local conversation management:
  - New Chat
  - Saved Chats
  - Rename Chat
  - Delete Chat
  - Clear current chat
- Model labels:
  - `qwen3:14b` displays as `Daily`
  - `qwen3:30b-a3b` displays as `Heavy`
- Browser title is `HALO Console`.

## Known Limitations

- Chat history is per browser and per browser profile because it uses `localStorage`.
- There is no account system or authentication yet.
- There is no server-side conversation database.
- There is no document upload or retrieval pipeline.
- There is no image generation or image understanding workflow.
- There is no voice input or voice output.
- There is no external agent bridge.
- The app assumes Ollama is reachable from the Next.js server process.

## Roadmap for v0.3

- Documents: add a local document workspace with ingestion, chunking, metadata, and retrieval.
- Images: add local image workflows for model-supported image input or generation when available.
- Voice: add local speech-to-text and text-to-speech options.
- Agent bridge: future automation was considered, but it is not included in this public export.
- Authentication: add an access layer for LAN or tunneled use, while keeping the app local-first.
