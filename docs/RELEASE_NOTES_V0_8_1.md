# HALO Console v0.8.1 Public Preview Release Notes

HALO Console v0.8.1 is a hardening and polish patch on top of the v0.8 Public Preview. It preserves the same local-first product scope while strengthening validation, automated coverage, storage boundaries, and public-release presentation.

## Hardening And Validation

- CI now runs dependency auditing, environment-contract validation, linting, explicit TypeScript checking, automated tests with coverage thresholds, and the production build.
- The supported environment-variable contract is documented and checked explicitly so unexpected or unsafe configuration names fail validation.
- Dependabot monitors npm and GitHub Actions dependencies, and the CI dependency audit rejects high-severity vulnerabilities.
- GitHub Actions are pinned to immutable commit SHAs.
- Automated coverage now includes model routing, chat request limits, selected document retrieval, selected learning-memory behavior, PDF extraction, upload-size policy, Runtime Bridge security, and Web Search/Runtime privacy-policy separation.
- Runtime Bridge report reading and validation were consolidated and hardened while retaining its narrow, read-only safety boundary. Reports with unsafe paths, symbolic links, unsupported file types, excessive size, or private markers are rejected.
- Chat and upload request limits reject oversized input before unnecessary processing.
- Learning-memory persistence uses safer validation and atomic write behavior.
- Document storage validates configured and derived paths, record identifiers, and stored-record identity before file access.

## Documents And Retrieval

- Document upload rejects oversized files before buffering them.
- Deterministic regression coverage was added for text-based PDF extraction and document retrieval.
- Retrieval quality, selected-document scoping, result limits, and document-storage path handling received additional robustness coverage.
- PDF handling continues to report scanned or image-only documents without extractable text instead of guessing or adding OCR behavior.

## Interface And Public Documentation

- Mobile sidebar controls and the chat composer were refined for smaller screens, alongside desktop sidebar polish and clearer document chunk labeling.
- The README now includes CI and license badges, clearer local-run instructions, and an architecture diagram.
- The public preview screenshot uses synthetic, public-safe demonstration data.
- Historical documentation was moved into the archive so current guidance remains easier to distinguish from past release material. Archived files remain historical and unchanged by this release-alignment patch.

## Repository Hosting And Security Configuration

CodeQL was enabled as repository-hosting security configuration; this does not change HALO Console application behavior. Its current state was verified with zero open findings before this release work. Document-storage path hardening was also added in repository code and regression tests.

## Boundaries Preserved

- HALO Console remains local-first and Ollama-centered.
- Web Search remains optional and disabled unless an operator configures a server-side provider.
- No cloud provider or external API is newly required.
- No shell execution, SSH capability, or arbitrary filesystem access is introduced.
- Saved chat sessions remain in browser `localStorage`; no server-side transcript store is added.
- Runtime Bridge remains optional, disabled by default, read-only, and limited to one operator-configured public-safe report file.
- Documents and learning notes remain in HALO-controlled local storage and are selected through validated ids rather than browser-supplied filesystem paths.

## Validation

Release preparation checks:

```bash
npm run check:env
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit --audit-level=high
git diff --check
```
