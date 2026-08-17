# HALO Console v0.4 Web Search Foundation

HALO Console v0.4 adds a safe Web Search Tool foundation for current-information questions. The base app still works without cloud APIs, API keys, Open WebUI, Agent Bridge, Documents/RAG, Memory, or shell execution.

## What Web Search Does

Web Search lets HALO Console collect server-side source snippets before sending a chat request to Ollama. When enabled in the UI, `/api/chat` searches for the latest user message and injects a concise source context into the system prompt before streaming the local model response.

For v0.4a, search is optional and provider-backed. If no provider is configured, HALO Console returns a clean message instead of crashing.

## Why Local Models Need Sources

Local Ollama models do not know live facts such as today's news, current prices, sports scores, release versions, schedules, or law changes unless those facts are supplied at request time. Web Search provides those sources so the assistant can answer current-information questions without inventing details.

## `/api/search`

`POST /api/search` accepts:

```json
{
  "query": "latest Ollama release",
  "maxResults": 5
}
```

Successful responses are normalized:

```json
{
  "ok": true,
  "query": "latest Ollama release",
  "provider": "searxng",
  "sources": [
    {
      "title": "Example",
      "url": "https://example.com",
      "snippet": "Short source summary.",
      "source": "SearXNG",
      "rank": 1
    }
  ],
  "message": null
}
```

If no provider is configured:

```json
{
  "ok": false,
  "query": "latest Ollama release",
  "provider": "none",
  "sources": [],
  "message": "Web Search is not configured yet. Configure a server-side provider such as SearXNG."
}
```

Input validation requires a non-empty `query` and an integer `maxResults` from 1 through 10.

## SearXNG Provider Plan

The v0.4a provider adapter supports SearXNG-compatible JSON search using server-side environment variables:

```bash
HALO_SEARCH_PROVIDER=searxng
HALO_SEARXNG_URL=http://127.0.0.1:8080
```

No `.env` file is created or modified by this feature. SearXNG does not need to be running for lint or build to pass.

## Router Behavior

The search policy marks Web Search as useful for prompts containing current-information terms such as `today`, `now`, `latest`, `current`, `this week`, `price`, `version`, `release`, `score`, `schedule`, `news`, `law`, `sports`, `live event`, `recent`, `search`, `verify`, and `look up`.

`/api/router` only marks `web_search` as available when tools are allowed and a server-side provider is configured. If tools are disabled, the router explains that Web Search would be useful but is not enabled.

## Security Boundaries

- No frontend API keys.
- No search provider URL is exposed to the frontend.
- Search provider configuration is read only on the server.
- The web app does not execute shell commands.
- The base app does not require cloud APIs.
- Web Search does not add Agent Bridge, Documents/RAG, or Memory.

## Failure Behavior

If search is enabled in chat but unavailable, HALO Console injects an instruction telling the model that current information could not be verified and that it must not invent current facts. `/api/search` returns JSON errors instead of throwing raw crashes.

## Future Improvements

- Add provider health checks with latency and last-error status.
- Add source display in streamed chat responses.
- Add configurable search categories and safe result filtering.
- Add tests for policy detection, validation, and provider normalization.
