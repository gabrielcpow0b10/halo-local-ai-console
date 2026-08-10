# HALO AgentOps System

HALO AgentOps is a local-first, security-conscious HomeLab AI operations portfolio composed of four public repositories.

## Purpose

The system demonstrates local-first AI operations while keeping private runtime data out of public repositories. It brings together local automation, observability, operator-facing UI, model routing, and learning experiments, with an emphasis on reproducibility, explicit system boundaries, and security gates.

## Public repositories

| Repository | Role | What it demonstrates |
| --- | --- | --- |
| [homelab-agentops](https://github.com/gabrielcpow0b10/homelab-agentops) | Toolkit, quality gate, scripts, and release discipline | Repeatable operational workflows, validation, and public-safe release practices |
| [homelab-agentops-control-plane](https://github.com/gabrielcpow0b10/homelab-agentops-control-plane) | Orchestration and control-plane concepts | Coordinating operational workflows through explicit control-plane boundaries |
| [halo-local-ai-console](https://github.com/gabrielcpow0b10/halo-local-ai-console) | Local AI console, UI, API layer, RAG, and Runtime Bridge | Local model interaction, document-grounded chat, model routing, and operator-facing context |
| [halo-light-mini-lab](https://github.com/gabrielcpow0b10/halo-light-mini-lab) | Local model and lightweight AI experimentation | Small, reproducible experiments with local models and AI workflows |

## How this repository fits

`halo-local-ai-console` is the reasoning and operator-facing UI layer of the portfolio. It provides a browser UI and HALO API routes for Ollama model routing, local documents, and manual learning notes. An optional, read-only Runtime Bridge can supply public-safe runtime context. The console provides no shell execution or arbitrary local file access.

## Security and public/private boundary

The public repositories contain sanitized source and documentation only. They exclude secrets, tokens, private runtime data, local machine labels, and uploaded documents. When runtime context is enabled, it comes only from a single operator-configured public-safe report file. Tests and CI enforce parts of this boundary, and local environment files remain untracked.

## Current status

- `npm audit` is expected to remain at zero known npm vulnerabilities.
- CI runs the environment-contract check, tests, lint, and a production build.
- Model-router and Runtime Bridge behavior have deterministic tests.

## Roadmap

- Expand deterministic tests around document retrieval and PDF extraction.
- Continue improving mobile usability.
- Document cross-repository system contracts.
- Keep public/private separation strict as the system grows.
