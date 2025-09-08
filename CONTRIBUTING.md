# Contributing (Hub Project)

Thanks for your interest in the Hub! This document outlines conventions and expectations if/when the Hub is built as a separate repository.

## Code of Conduct
- Be respectful, collaborative, and security-minded.

## Contribution Guidelines
- Open an issue describing the proposal or bug.
- For features, include motivation, alternatives, and security considerations.
- Keep PRs focused and accompanied by tests.

## Development
- Languages: Go or Node accepted; Rust welcome for high-performance paths.
- Tests: unit + integration; mock Core processes for router tests.
- Observability: OTel in dev by default; add trace IDs to logs.

## Style
- Keep Hub thin: routing, policy, lifecycle, observability.
- Avoid embedding Core-specific business logic.

## Security
- No secrets in code or logs; use a secret manager.
- Perform threat modeling for changes to transport/policy.

