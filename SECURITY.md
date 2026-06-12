# Security Policy

HALO Console is a local-first AI console designed to run on user-controlled infrastructure with explicit security boundaries.

## Supported Versions

| Version | Supported |
| --- | --- |
| v0.4a.x public preview | Yes |
| Earlier public previews | Best effort |

## Reporting a Vulnerability

Please use GitHub's private vulnerability reporting feature when available.

Do not include secrets, tokens, private keys, internal hostnames, private IP addresses, `.env` contents, or sensitive infrastructure details in public issues.

For non-sensitive bugs, open a normal GitHub issue.

## Security Scope

This public repository does not include:

- cloud model API keys,
- hosted provider credentials,
- Web Search provider credentials,
- private HomeLab deployment details,
- Agent Bridge automation,
- arbitrary shell execution,
- private file browsing,
- committed `.env` files,
- secrets or private screenshots.

## Local-First Boundary

The intended trust boundary is:

- the local browser profile,
- the local Next.js process,
- the local Ollama runtime,
- optional local-only services explicitly configured by the operator.

## Future Security Requirements

Any future feature that touches files, memory, external search, cloud providers, or automation must be documented before release and must preserve the following rules:

- no frontend secrets,
- credentials remain server-side,
- no broad filesystem access,
- no arbitrary shell execution,
- explicit user enablement for sensitive features,
- confirmation before sensitive actions,
- public exports must remain sanitized.
