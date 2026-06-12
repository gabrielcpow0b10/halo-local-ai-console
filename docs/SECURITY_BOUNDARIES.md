# Security Boundaries

HALO Console v0.4a is a local-first Ollama console. The public export is designed to show the architecture without exposing private operational details or adding remote execution surfaces.

## Included Boundary

The intended trust boundary is:

- the local browser profile using the app,
- the local Next.js process,
- the local Ollama runtime,
- optional local-only services explicitly configured by the operator.

The app assumes the user controls the machine running Next.js and Ollama.

## Explicit Non-Goals

This repository does not include:

- cloud model APIs,
- hosted provider credentials,
- Web Search provider configuration,
- Agent Bridge automation,
- shell execution from the web app,
- private file browsing,
- NAS or internal infrastructure integration,
- screenshots or private deployment artifacts,
- committed `.env` files or secrets.

## Secrets And Environment

No secrets are required for the base app.

Environment variables may be used locally to override runtime endpoints, such as the Ollama URL or an optional SearXNG provider. Those values must stay outside the repository.

The app and docs intentionally avoid publishing:

- private usernames,
- private hostnames,
- local absolute paths,
- Tailscale or LAN IPs,
- tokens,
- `.env` content,
- internal infrastructure details.

## API Safety

The HALO API Layer exposes only narrow route handlers:

- health check,
- model listing,
- chat streaming,
- deterministic routing,
- optional normalized search.

It does not expose a generic proxy, command runner, file reader, admin endpoint, or arbitrary local network scanner.

## Shell Execution

HALO Console does not execute shell commands from the web application.

The security policy explicitly blocks:

- arbitrary shell execution,
- destructive local commands,
- secret access,
- `.env` access,
- private file access outside a future approved document module.

## Web Search

Web Search foundation code is present but disabled by default.

Search is only available when a server-side provider is configured. Provider configuration is not exposed to the browser and is not included in this public export.

## Local Storage

Chat history is stored in browser `localStorage`.

Implications:

- history is local to the browser profile,
- there is no server-side conversation database,
- clearing browser storage removes saved conversations,
- conversations are not synchronized across devices by this app.

## Future Work Requirements

Any future capability that touches local files, persistent memory, external search, or automation should preserve these rules:

- require explicit user enablement,
- keep credentials server-side,
- avoid broad filesystem access,
- avoid shell execution unless a separate audited design is added,
- require confirmation for sensitive actions,
- document the new boundary before release.
